import { unzipSync } from "../node_modules/fflate/esm/browser.js";

const X3D = window [Symbol .for ("X_ITE.X3D")];

/*
 * Parser
 * Reference: https://github.com/playcanvas/splat-transform/blob/main/src/lib/readers/read-sog.ts
 */

class SOGParser extends X3D .X3DParser
{
   constructor (scene)
   {
      super (scene);
   }

   getEncoding ()
   {
      return "ARRAY_BUFFER";
   }

   setInput (buffer)
   {
      this .buffer = buffer;
   }

   isValid ()
   {
      const dataView = new DataView (this .buffer);

      if (dataView .getUint32 (0, false) !== 0x504B0304)
         return false;

      this .files = unzipSync (new Uint8Array (this .buffer));

      const keys = new Set ([
         "means_l.webp",
         "means_u.webp",
         "scales.webp",
         "sh0.webp",
         "shN_centroids.webp",
         "shN_labels.webp",
         "quats.webp",
         "meta.json",
      ]);

      if (!Object .keys (this .files) .every (key => keys .has (key)))
         return false;

      const meta = this .parseMeta ();

      if (meta .version < 2 || meta .version > 2)
         return false;

      return true;
   }

   parseIntoScene (resolve, reject)
   {
      this .sog ()
         .then (resolve)
         .catch (reject);
   }

   async sog ()
   {
      const
         browser = this .getBrowser (),
         scene   = this .getScene ();

      scene .setEncoding ("SOG");
      scene .setProfile (browser .getProfile ("Interchange"));
      scene .addComponent (browser .getComponent ("X_ITE"));

      await this .getBrowser () .loadComponents (scene);

      const
         transform      = scene .createNode ("Transform"),
         gaussianSplats = scene .createNode ("GaussianSplats"),
         gaussianCloud  = await this .unpackFiles ();

      gaussianSplats .positions    = gaussianCloud .positions;
      gaussianSplats .orientations = gaussianCloud .rotations;
      gaussianSplats .scales       = gaussianCloud .scales;
      gaussianSplats .opacities    = gaussianCloud .alphas;

      gaussianSplats .sphericalHarmonicsDegree0Coef0 = gaussianCloud .colors;

      transform .rotation = new X3D .Rotation4 (1, 0, 0, Math .PI);

      transform .children .push (gaussianSplats);
      scene .rootNodes .push (transform);

      return scene;
   }

   parseMeta ()
   {
      return this .files ["meta.json"] = JSON .parse (new TextDecoder () .decode (this .files ["meta.json"]));
   }

   async unpackFiles ()
   {
      await this .unpackImages ();

      const
         positions        = this .unpackPositions (),
         rotations        = this .unpackRotations (),
         scales           = this .unpackScales (),
         [alphas, colors] = this .unpackAlphasAndAColors ();

      console .log (this .files);
      console .log (alphas, colors);

      return {
         positions,
         rotations,
         scales,
         alphas,
         colors,
      }
   }

   async unpackImages ()
   {
      return Promise .all (Object .keys (this .files)
         .filter (key => key .endsWith (".webp"))
         .map (key => this .unpackImage (key)));
   }

   async unpackImage (key)
   {
      const
         bytes = this .files [key],
         blob  = new Blob ([bytes], { type: "image/webp" }),
         url   = URL .createObjectURL (blob),
         image = await this .loadImage (url),
         data  = this .readPixels (image);

      this .files [key] = data;

      URL .revokeObjectURL (url);
   }

   loadImage (url)
   {
      return new Promise ((resolve, reject) =>
      {
         const image = new Image ();

         image .onload = () => resolve (image);

         image .onerror =
         image .onabort = event => reject (new Error (`Couldn't load WebP image: ${event .type}.`));

         image .src = url;
      });
   }

   readPixels (image)
   {
      const
         gl          = this .getBrowser () .getContext (),
         texture     = gl .createTexture (),
         framebuffer = gl .createFramebuffer (),
         width       = image .width,
         height      = image .height,
         data        = new Uint8Array (width * height * 4);

      // Create texture.

      gl .bindTexture (gl .TEXTURE_2D, texture);
      gl .pixelStorei (gl .UNPACK_COLORSPACE_CONVERSION_WEBGL, gl .NONE);
      gl .texImage2D  (gl .TEXTURE_2D, 0, gl .RGBA, width, height, 0, gl .RGBA, gl .UNSIGNED_BYTE, image);
      gl .pixelStorei (gl .UNPACK_COLORSPACE_CONVERSION_WEBGL, gl .BROWSER_DEFAULT_WEBGL);

      // Read pixels from framebuffer.

      gl .bindFramebuffer (gl .FRAMEBUFFER, framebuffer);
      gl .framebufferTexture2D (gl .FRAMEBUFFER, gl .COLOR_ATTACHMENT0, gl .TEXTURE_2D, texture, 0);
      gl .readPixels (0, 0, width, height, gl .RGBA, gl .UNSIGNED_BYTE, data);

      // Clean up.

      gl .deleteFramebuffer (framebuffer);
      gl .deleteTexture (texture);

      return data;
   }

   unpackPositions ()
   {
      const lerp = (a, b, t) => a + t * (b - a);

      const unlog = n => Math .sign (n) * (Math .exp (Math .abs (n)) - 1);

      const {
         ["meta.json"]: { count, means: { mins, maxs }},
         ["means_l.webp"]: means_l,
         ["means_u.webp"]: means_u,
      } = this .files;

      const
         N     = count * 4,
         array = [ ];

      for (let i = 0; i < N; i += 4)
      {
         // 16-bit normalized value per axis (0..65535)

         const
            qx = (means_u [i + 0] << 8) | means_l [i + 0],
            qy = (means_u [i + 1] << 8) | means_l [i + 1],
            qz = (means_u [i + 2] << 8) | means_l [i + 2];

         // Dequantize into *log-domain* nx,ny,nz using per-axis ranges from meta:

         const
            nx = lerp (mins [0], maxs [0], qx / 65535),
            ny = lerp (mins [1], maxs [1], qy / 65535),
            nz = lerp (mins [2], maxs [2], qz / 65535);

         // Undo the symmetric log transform used at encode time:

         array .push (
            unlog (nx),
            unlog (ny),
            unlog (nz),
         );
      }

      return array;
   }

   unpackRotations ()
   {
      const toComp = c => (c / 255 - 0.5) * 2 / Math .SQRT2;

      const {
         ["meta.json"]: { count },
         ["quats.webp"]: quats,
      } = this .files;

      const
         N     = count * 4,
         array = [ ];

      for (let i = 0; i < N; i += 4)
      {
         const
            a = toComp (quats [i + 0]),
            b = toComp (quats [i + 1]),
            c = toComp (quats [i + 2]);

         const mode = quats [i + 3] - 252; // 0..3 → omitted component is w, x, y or z respectively

         // Reconstruct the omitted component so that ||q|| = 1 and w.l.o.g. the omitted one is non-negative.

         const
            t = Math .hypot (a, b, c),
            d = Math .sqrt (Math .max (0, 1 - t));

         // Place components according to mode; q is ordered [x, y, z, w].

         switch (mode)
         {
            case 0: array .push (a, b, c, d); break; // omitted = w
            case 1: array .push (d, b, c, a); break; // omitted = x
            case 2: array .push (b, d, c, a); break; // omitted = y
            case 3: array .push (b, c, d, a); break; // omitted = z
            default: throw new Error ("Invalid quaternion mode");
         }
      }

      return array;
   }

   unpackScales ()
   {
      const {
         ["meta.json"]: { count, scales: { codebook } },
         ["scales.webp"]: scales,
      } = this .files;

      const
         N     = count * 4,
         array = [ ];

      for (let i = 0; i < N; i += 4)
      {
         array .push (
            Math .exp (codebook [scales [i + 0]]), // r,g,b are 0..255
            Math .exp (codebook [scales [i + 1]]),
            Math .exp (codebook [scales [i + 2]]),
         );
      }

      return array;
   }

   unpackAlphasAndAColors ()
   {
      const {
         ["meta.json"]: { count, sh0: { codebook } },
         ["sh0.webp"]: sh0,
      } = this .files;

      const
         N      = count * 4,
         array  = [ ],
         alphas = [ ];

      for (let i = 0; i < N; i += 4)
      {
         array .push (
            codebook [sh0 [i + 0]],
            codebook [sh0 [i + 1]],
            codebook [sh0 [i + 2]],
         );

         alphas .push (sh0 [i+ 3] / 255);
      }

      return [alphas, array];
   }
}

X3D .GoldenGate .addParsers (SOGParser);
