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
      if (this .buffer .byteLength < 4)
         return false;

      // Check magic.

      const dataView = new DataView (this .buffer);

      if (dataView .getUint32 (0, false) !== 0x504B0304)
         return false;

      // Check minimum requirement for Gaussian Splats.

      const keys = [
         "means_l.webp",
         "means_u.webp",
         "scales.webp",
         "sh0.webp",
         "quats.webp",
         "meta.json",
      ];

      this .files = unzipSync (new Uint8Array (this .buffer));

      if (!keys .every (key => this .files [key]))
         return false;

      // Check version.

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

      // Set spherical harmonics.

      if (gaussianCloud .shs .length)
      {
         const {
            meta: { count, shN: { bands } },
         } = this .files;

         const
            shs      = gaussianCloud .shs,
            shDegree = bands;

         this .setSphericalHarmonics (count, shs, shDegree, gaussianSplats)
      }

      // Add nodes to scene.

      transform .rotation = new X3D .Rotation4 (1, 0, 0, Math .PI);

      transform .children .push (gaussianSplats);
      scene .rootNodes .push (transform);

      return scene;
   }

   setSphericalHarmonics (numSplats, shs, shDegree, gaussianSplats)
   {
      const
         shCoeffs  = this .dimForDegree (shDegree),
         shCoeffs3 = this .dimForDegree (shDegree) * 3,
         splatShs  = Array .from ({ length: shCoeffs }, () => [ ]);

      for (let c = 0; c < shCoeffs; ++ c)
      {
         const
            c3      = c * 3,
            splatSh = splatShs [c];

         for (let i = 0; i < numSplats; ++ i)
         {
            const offset = shCoeffs3 * i + c3;

            for (let j = 0; j < 3; ++ j)
               splatSh .push (shs [offset + j]);
         }
      }

      // GaussianSplats node only supports up to degree 3.
      const shDegreeMax = Math .min (shDegree, 3);

      for (let d = 0, i = 0; d < shDegreeMax; ++ d)
      {
         const coefs = this .coefsForDegree (d);

         for (let c = 0; c < coefs; ++ c, ++ i)
            gaussianSplats [`sphericalHarmonicsDegree${d + 1}Coef${c}`] = splatShs [i];
      }
   }

   parseMeta ()
   {
      return this .files .meta = JSON .parse (new TextDecoder () .decode (this .files ["meta.json"]));
   }

   async unpackFiles ()
   {
      await this .unpackImages ();

      const
         positions        = this .unpackPositions (),
         rotations        = this .unpackRotations (),
         scales           = this .unpackScales (),
         [alphas, colors] = this .unpackAlphasAndAColors (),
         shs              = this .unpackSphericalHarmonics ();

      return {
         positions,
         rotations,
         scales,
         alphas,
         colors,
         shs,
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

      this .files [key] = image;
      this .files [key .replace (".webp", "")] = data;

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
         meta: { count, means: { mins, maxs }},
         means_l,
         means_u,
      } = this .files;

      const
         N     = count * 4,
         array = [ ];

      for (let i = 0; i < N; i += 4)
      {
         // 16-bit normalized value per axis (0..65535)

         const
            qx = (means_u [i]     << 8) | means_l [i],
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
         meta: { count },
         quats,
      } = this .files;

      const
         N     = count * 4,
         array = [ ];

      for (let i = 0; i < N; i += 4)
      {
         const
            a = toComp (quats [i]),
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
         meta: { count, scales: { codebook } },
         scales,
      } = this .files;

      const
         N     = count * 4,
         array = [ ];

      for (let i = 0; i < N; i += 4)
      {
         array .push (
            Math .exp (codebook [scales [i]]), // r,g,b are 0..255
            Math .exp (codebook [scales [i + 1]]),
            Math .exp (codebook [scales [i + 2]]),
         );
      }

      return array;
   }

   unpackAlphasAndAColors ()
   {
      const {
         meta: { count, sh0: { codebook } },
         sh0,
      } = this .files;

      const
         N      = count * 4,
         array  = [ ],
         alphas = [ ];

      for (let i = 0; i < N; i += 4)
      {
         array .push (
            codebook [sh0 [i]],
            codebook [sh0 [i + 1]],
            codebook [sh0 [i + 2]],
         );

         alphas .push (sh0 [i + 3] / 255);
      }

      return [alphas, array];
   }

   unpackSphericalHarmonics ()
   {
      if (!this .files .meta .shN)
         return [ ];

      const {
         meta: { count, shN: { bands, codebook } },
         shN_labels,
         shN_centroids,
         "shN_centroids.webp": { width },
      } = this .files;

      const getIndex = (u, v) => u + v * width;

      const
         coeffs   = [0, 3, 8, 15],
         shCoeffs = coeffs [bands]; // coefficients per color channel

      if (!shCoeffs)
         return [ ];

      const
         N     = count * 4,
         array = [ ];

      for (let i = 0; i < N; i += 4)
      {
         // 1. Look up this gaussian's palette entry.

         const label = shN_labels [i] + (shN_labels [i + 1] << 8);

         // 2. For each coefficient, read RGB from the centroids pixel and map through the codebook.

         for (let c = 0; c < shCoeffs; ++ c)
         {
            const
               u = (label % 64) * shCoeffs + c,
               v = Math .floor (label / 64);

            // pixel (u, v) in shN_centroids.webp
            const index = getIndex (u, v) * 4;

            const
               r = shN_centroids [index],
               g = shN_centroids [index + 1],
               b = shN_centroids [index + 2];

            array .push (
               codebook [r], // SH AC coefficient for color channel 0
               codebook [g], // SH AC coefficient for color channel 1
               codebook [b], // SH AC coefficient for color channel 2
            );
         }
      }

      return array;
   }

   dimForDegree (degree)
   {
      return (degree + 1) ** 2 - 1;
   }

   coefsForDegree (degree)
   {
      return degree * 2 + 3;
   }
}

X3D .GoldenGate .addParsers (SOGParser);

// Decrement extensions attribute to show that the parser is loaded.

const canvases = document .querySelectorAll ("x3d-canvas");

for (const canvas of canvases)
{
   const { element } = X3D .getBrowser (canvas);

   element .setAttribute ("extensions", (element .getAttribute ("extensions")|0) - 1);
}
