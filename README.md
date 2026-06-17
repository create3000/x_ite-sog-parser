# x_ite-sog-parser

[![npm Version](https://img.shields.io/npm/v/x_ite-sog-parser)](https://www.npmjs.com/package/x_ite-sog-parser)
[![Build Size](https://img.shields.io/bundlephobia/minzip/x_ite-sog-parser)](https://bundlephobia.com/package/x_ite-sog-parser)
[![jsDelivr Hits](https://data.jsdelivr.com/v1/package/npm/x_ite-sog-parser/badge?style=rounded)](https://create3000.github.io/jsdelivr-download-stats/?username=create3000&repository=x_ite)
[![npm Downloads](https://img.shields.io/npm/dm/x_ite-sog-parser)](https://npmtrends.com/x_ite-sog-parser)

SOG File Format Parser for [X_ITE](https://create3000.github.io/x_ite/) for 3D Gaussian Splatting

## Usage

Include the script after X_ITE:

```html
<script defer src="https://cdn.jsdelivr.net/npm/x_ite@VERSION/dist/x_ite.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/x_ite-sog-parser@1.0.5/dist/x_ite-sog-parser-2.min.js"></script>
<!-- or as ES module -->
<script type="module" src="https://cdn.jsdelivr.net/npm/x_ite@VERSION/dist/x_ite.min.mjs"></script>
<script type="module" src="https://cdn.jsdelivr.net/npm/x_ite-sog-parser@1.0.5/dist/x_ite-sog-parser-2.min.js"></script>
```

Now you can directly load `.sog` files with the `src` attribute, but you also have to add the `extensions` attribute with a number, how many X_ITE extension you have included. Each extension will decrease this count and when it becomes `0`, the canvas knows that all extensions are loaded and now starts loading the file in the `src` attribute.

You can also use `.sog` files as source of an Inline node.

```html
<x3d-canvas data-src="room.sog"></x3d-canvas>
```

## NPM

You can also install it from npm:

```sh
npm i x_ite-sog-parser
```

## Converter

There is a converter at: https://superspl.at/convert

## License

x_ite-sog-parser is free software and licensed under the [MIT License](LICENSE.md).
