#!/usr/bin/env node
"use strict";

const { sh, systemSync } = require ("shell-tools");

function main ()
{
	// version
	const
		name   = sh (`node -p "require('./package.json').name"`) .trim (),
		online = sh (`npm view ${name} version`) .trim ();

	if (sh (`npm pkg get version | sed 's/"//g'`) .trim () === online)
		systemSync (`npm version patch --no-git-tag-version --force`);

	const updated = sh (`npm pkg get version | sed 's/"//g'`) .trim ();

	systemSync (`sed -i "" -E "s|${name}@[0-9.]+|${name}@${updated}|g" ./README.md`);

	const version = sh (`npm pkg get version | sed 's/"//g'`) .trim ();

	console .log (`NPM version ${online}`);
	console .log (`New version ${version}`);

	// commit
	systemSync (`git add -A`);
	systemSync (`git commit -am 'Published version ${version}'`);
	systemSync (`git push origin`);

	// tag
	systemSync (`git tag ${version}`);
	systemSync (`git push origin --tags`);

	// npm
	systemSync (`npm login`);
	systemSync (`npm publish`);
}

main ();
