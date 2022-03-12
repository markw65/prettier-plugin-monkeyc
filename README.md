# @markw65/prettier-plugin-monkeyc

A prettier plugin for formatting monkey-c code.

## Intro

Prettier is an opinionated code formatter. It enforces a consistent style by parsing your code and re-printing it with its own rules that take the maximum line length into account, wrapping code when necessary.

This plugin adds support for the monkey-c language to Prettier.

### Input

```
    dc.drawText(_width/2, 3,Graphics.FONT_TINY, "Ax = "+_accel[0], Graphics.TEXT_JUSTIFY_CENTER);
```

### Output

```
    dc.drawText(
        _width / 2,
        3,
        Graphics.FONT_TINY,
        "Ax = " + _accel[0],
        Graphics.TEXT_JUSTIFY_CENTER
    );
```

## Install

```bash
npm install --save-dev @markw65/prettier-plugin-monkeyc

# or globally

npm install --global @markw65/prettier-plugin-monkeyc
```

## Use

### With VSCode

Install the Prettier extension from https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode.

 - if you installed the plugin globally, you need to enable `prettier.resolveGlobalModules` in your settings.
 - if you installed locally, [the documentation](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) says it should just work, but I've found you need to tell the extension how to find the local copy of prettier. Put `"prettier.prettierPath": "./node_modules/prettier"` in your `.vscode/settings.json`.

Once configured as above, VSCode's `Format Document` command (`Option-Shift-F`) will reformat your .mc files for you.

### With Node.js

If you installed prettier as a local dependency, you can run it via

```bash
npx prettier path/to/code.mc --write
```

If you installed globally, run

```bash
prettier path/to/code.mc --write
```

## Options

The standard Prettier options (such as `tabWidth`) can be used.

## Development

To make a production build, run

```
npm run build-release
```

To develop, run

```
npm run build-debug
```

You can then execute Prettier with

```
npx prettier [ --write ] --plugin build/prettier-plugin-monkeyc.cjs ...
```

### Code structure

`@markw65/prettier-plugin-monkeyc` uses a Peggy grammar (located in `peg/`)
to parse monkeyc. This grammar was originally copied from the Peggy sample javascript grammar, and still has some javascript features that aren't relevant to monkeyc. I'm planning to clean that up, but for now it shouldn't matter.

`@markw65/prettier-plugin-monkeyc` is written in native ES6 javascript, but uses webpack to dynamically compile to commonjs, because thats what prettier wants.

The plugin is organized as follows:

 -   `prettier-plugin-monkeyc.js` This file exports the objects required of a Prettier plugin.
 -   `peg/monkeyc.peggy` The Peggy grammar for monkey-c.
 -   `src/printer.js` Printers take an AST and produce a Doc (the intermediate
format that Prettier uses). The current implementation is a thin wrapper around Prettier's default, estree printer. It handles just the nodes that it needs to, and delegates to "javascript-like" behavior for everything else.
