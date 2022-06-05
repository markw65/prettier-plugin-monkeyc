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
npm run watch
```

This will keep your build up to date as you make changes. You can then execute Prettier with

```
npx prettier [ --write ] --plugin build/prettier-plugin-monkeyc.cjs ...
```

### Code structure

`@markw65/prettier-plugin-monkeyc` uses a Peggy grammar (located in `peg/`)
to parse monkeyc. This grammar was originally copied from the Peggy sample javascript grammar, and still has some javascript features that aren't relevant to monkeyc. I'm planning to clean that up, but for now it shouldn't matter.

`@markw65/prettier-plugin-monkeyc` is written in native ES6 javascript, but uses webpack to dynamically compile to commonjs, because thats what prettier wants.

The plugin is organized as follows:

- `prettier-plugin-monkeyc.js` This file exports the objects required of a Prettier plugin.
- `peg/monkeyc.peggy` The Peggy grammar for monkey-c.
- `src/printer.js` Printers take an AST and produce a Doc (the intermediate
  format that Prettier uses). The current implementation is a thin wrapper around Prettier's default, estree printer. It handles just the nodes that it needs to, and delegates to "javascript-like" behavior for everything else.

## Release Notes

#### 1.0.0

- Initial release

#### 1.0.1 - 1.0.7

- Minor tweaks for better consistency with Prettier for javascript

#### 1.0.8

- Fix some issues with the standard prettier options. Eg setting options.semi=false would have produced illegal MonkeyC, as would setting options.trailingComma=all
- Add a monkeyc-json parser, which just takes the AST (in JSON format) as input. This will allow us to build tools that use the plugin to parse MonkeyC, then change the AST in some way, and then print out the result.

#### 1.0.9

- Don't bundle prettier/standalone.js in the build, since we depend on prettier anyway. This halves the size of the bundle.
- Improve the monkeyc-json parser to allow passing the original source, followed by the json-ast, so that prettier can still inspect the original source when printing (it does this for comments, and for deciding when to leave blank lines between certain constructs).

#### 1.0.10

- Fixed the parser to allow import/using inside modules.

#### 1.0.11

- Fixed an issue parsing object literals whose keys were not PrimaryExpressions

#### 1.0.12

Fixed various parser issues:

- Allow space after `arg` in `catch ( arg ) {`
- Allow space after `,` in `for (i = 0 , j = 0; whatever; i++ , j++ ) {`
- Don't reuse ArrayLiteral for `new [ size ]` because it can
  confuse the estree printer
- Ignore "@" at the beginning of an identifier (is this right? It doesn't
  seem to do anything)
- Floating point literals need a digit after the point. Otherwise
  `42.toChar()` gets misparsed by consuming `42.` as a float literal,
  and then hitting a syntax error.
- Allow `static class Foo {}` (but ignore the static)
- Fixup reserved word lists
- Handle octal literals
- Parse `new [size]b`

#### 1.0.13

A few bug fixes and enhancements

- Bit of parser cleanup
- Let the parser ignore a missing ";" before a "}", so the printer can add it for us
- Allow any PrimaryExpression for arguments to attributes
- Don't let the printer change Floats to Numbers
- Fix the printer to correctly wrap the bodies of conditional and loop statements

#### 1.0.14

Accept and fix a few more illegal programs

- Allow an omitted semi-colon in more places (then add it in via the printer)
- Allow numbers outside the 32-bit range, and add an "l" suffix when printing them so the compiler will accept them.

#### 1.0.15

- Add loc field to nodes
- Fix a bug that dropped attributes on module declarations

#### 1.0.16

- Write a webpack plugin to add a fake module.exports header to build/prettier-plugin-monkeyc.cjs, so that typescript, and node properly recognize what's being exported.

#### 1.0.17

- As of sdk 4.1.3, some of the sample projects no longer build with type checking enabled.
  - Drop -l option from tests
- Fix start/end locations for certain nodes
  - When building chains of nodes via `reduce`, we were fixing start and end, but not the newly added loc.start/loc.end.
- Add an index.d.ts
  - @markw65/monkeyc-optimizer is switching over to typescript, and needs some basic type declarations.

#### 1.0.18

- Make TypedIdentifier a union type between `Identifier` and `AsExpression`. The problem with the old way of doing it was that the identifier's location went from before the start of the identifier to after the end of the `as` expression, which was problematic when finding all references to the symbol, or renaming the symbol in vscode.
- Switch everything over to typescript. This found some bugs, and some dead code (where fields had been moved around, but there was still dead code looking at the old locations). It also creates better type exports for typescript projects that import this one.

#### 1.0.19

- Switch to using prettier, rather than prettier/standalone since we don't need to run in the browser, and @types/prettier is missing a lot of types for prettier/standalone.

#### 1.0.20

- Allow null for FunctionDeclaration.body
- Turn on stricter checking for typescript.

#### 1.0.21

- Stricter typechecking, and fix a declaration in estree-types
- Bump to latest versions of all npm packages

#### 1.0.22

- Fix a couple of estree-types declarations
- Fix parsing and printing of top level object literals
- Parenthesize various top level expressions so the Garmin parser can handle them
