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

   setInput (input)
   {
      this .input = input;
   }

   isValid ()
   {
      console .log (this .input);
      
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
         gaussianSplats = scene .createNode ("GaussianSplats");

      scene .rootNodes .push (gaussianSplats);

      return scene;
   }
}

X3D .GoldenGate .addParsers (SOGParser);
