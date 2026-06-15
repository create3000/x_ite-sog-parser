#!/usr/bin/env node
"use strict";

const { systemSync } = require ("shell-tools");

function main ()
{
   systemSync (`npx webpack`);
}

main ();
