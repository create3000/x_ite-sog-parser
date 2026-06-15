#!/usr/bin/env node
"use strict";

const { sh, systemSync } = require ("shell-tools");

function main ()
{
   const cwd = process .cwd ();

   systemSync ("mkdir build-sog");
   process .chdir ("build-sog");
   systemSync ("git clone --depth 1 --single-branch https://github.com/nianticlabs/sog.git");
   process .chdir ("sog");
   systemSync ("emcmake cmake -B build-wasm .");
   systemSync ("cmake --build build-wasm");
   process .chdir (cwd);
   systemSync ("cp -r build-sog/sog/dist src/sog");
   systemSync ("rm -r -f build-sog");
}

main ();
