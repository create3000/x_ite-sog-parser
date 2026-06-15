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

      const files = new Set ([
         "means_l.webp",
         "means_u.webp",
         "scales.webp",
         "sh0.webp",
         "shN_centroids.webp",
         "shN_labels.webp",
         "quats.webp",
         "meta.json",
      ]);

      if (!Object .keys (this .files) .every (file => files .has (file)))
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
      console .log (this .files)

      const
         browser = this .getBrowser (),
         scene   = this .getScene ();

      scene .setEncoding ("SOG");
      scene .setProfile (browser .getProfile ("Interchange"));
      scene .addComponent (browser .getComponent ("X_ITE"));

      await this .getBrowser () .loadComponents (scene);

      const
         gaussianSplats = scene .createNode ("GaussianSplats");

      scene .rootNodes .push (gaussianSplats);

      return scene;
   }
}

X3D .GoldenGate .addParsers (SOGParser);
