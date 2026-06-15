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
         gaussianSplats = scene .createNode ("GaussianSplats"),
         stuff          = await this .unpackFiles ();

      scene .rootNodes .push (gaussianSplats);

      return scene;
   }

   parseMeta ()
   {
      return this .files ["meta.json"] = JSON .parse (new TextDecoder () .decode (this .files ["meta.json"]));
   }

   async unpackFiles ()
   {
      await this .unpackImages ();

      console .log (this .files);
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

         image .onload  = () => resolve (image);
         image .onerror = event => reject (new Error (`Couldn't load WebP image: ${event .type}`));
         image .onabort = event => reject (new Error (`Couldn't load WebP image: ${event .type}`));

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
      gl .deleteFramebuffer (framebuffer);
      gl .deleteTexture (texture);

      return data;
   }
}

X3D .GoldenGate .addParsers (SOGParser);
