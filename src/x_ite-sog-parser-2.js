import { unzipSync } from "../node_modules/fflate/esm/browser.js";

const X3D = window [Symbol .for ("X_ITE.X3D")];

/*
 * Parser
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
      console .log (key);
   }
}

X3D .GoldenGate .addParsers (SOGParser);
