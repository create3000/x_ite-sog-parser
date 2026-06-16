const
   path = require ("path"),
   os   = require ("os");

module .exports = async () =>
{
   // `src/${entry}.js`;
   const entries = [
      "x_ite-sog-parser-2",
   ];

   const targets = [ ];

   targets .push ({
      entry: Object .fromEntries (entries .map (entry => [
         `${entry}`, `./src/${entry}.js`,
      ])),
      output: {
         path: path .resolve (__dirname, "dist"),
         filename: "[name].js",
         library: {
            type: "module",
         },
         iife: true,
      },
      experiments: {
         outputModule: true,
      },
      mode: "production",
      module: {
         rules: [ ],
      },
      optimization: {
         minimize: false,
      },
      node: {
         __filename: false,
      },
      resolve: {
         fallback: {
            process: false,
            path: false,
            fs: false,
         },
      },
      stats: "errors-warnings",
      performance: {
         hints: "warning",
         maxEntrypointSize: 10_000_000,
         maxAssetSize: 10_000_000,
      },
   });

   console .log (`Using ${os .cpus () .length} CPUs to package project.`);

   targets .parallelism = os .cpus () .length;

   return targets;
};
