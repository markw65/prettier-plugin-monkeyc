# Change Log

All notable changes to the "prettier-plugin-monkeyc" package will be documented in this file.

#### 1.0.58

- Fix an indentation issue with interfaces

#### 1.0.57

- Add a missing field in estree_types

#### 1.0.56

- Allow exclude annotations on typedefs

#### 1.0.55

- No change in functionality, but make @markw65/peggy-optimizer a devDependency so it doesn't get shipped with the package.

#### 1.0.54

- Updates for compatibility with sdk-7.0.2-beta

#### 1.0.53

- Performance
  - use @markw65/peggy-optimizer to optimize the generated parser
  - various tweaks to the grammar for parsing speed
- fix the monkeyc-json parser (used by @markw65/monkeyc-optimizer to pretty-print the optimized code) to work with prettier-3.x
- wrap `ObjectExpression`s in parentheses when they're the operand of an `as` expression, to work around [this bug](https://forums.garmin.com/developer/connect-iq/i/bug-reports/the-parser-doesn-t-handle-object-literal-as-type-correctly).


#### 1.0.52
- Allow `import` and `using` inside class declarations

#### 1.0.51
- Fix a potential crash introduced in the last release

#### 1.0.50
- Make the plugin work with prettier@3.0.0

#### 1.0.49
- No changes in functionality. esbuild was accidentally added as a dependency, rather than a dev dependency.

#### 1.0.48
- No changes in functionality, but switch from webpack to esbuild. I had been meaning to do that anyway, but webpack's minifier started breaking the code (the published 1.0.47 is unusable as a result).

#### 1.0.47
- Add support for parsing (but not formatting) .mss files
- Fix a bug where Long hex and octal constants were stored as number rather than BigInt, possibly losing precision.
- Fix a formatting issue where Long hex and octal constants would be converted to decimal
- Upgrade all the dev dependencies, including typescript.

#### 1.0.46
- Change the `type` of the project to `commonjs`, so it can be imported by typescript with `moduleResolution` set to `nodenext`

#### 1.0.45
- Fix some issues where the formatter didn't print comments attached to certain identifiers (eg the name in `module <name>`), resulting in an internal error.

#### 1.0.44

- Fix parsing of union expressions so that `Void` never includes the following types. This lets us parse `Method() as Void or xxx` the same way that Garmin does.
- Fix printing of nested Methods. If one Method's declaration contained another Method (eg as a parameter, or the return type), then the outer Method would be incorrectly terminated by a `;`

#### 1.0.43

- Add an "original" field to Identifier, to indicate that this variable was renamed by the optimizer. The printer will display the name as a comment after each use.
#### 1.0.42

- Add an "origins" array to BaseNode, to store inlining history.
- Ensure that MethodDefinition.params is never null.

#### 1.0.41

- Fix LiteralIntegerRe to include negative numbers
- Round Float literals to 32 bits
- Properly parse "foo as Bar as Baz", without requiring parentheses "(foo as Bar) as Baz"
- In enums, allow whitespace between the initializer and the following comma
- Fix an issue where a number whose representation looked like an integer, and ended in capital D would be converted to a float.
- More precise typescript types for MemberExpressions

#### 1.0.40

- Fix an issue parsing Char literals
- Fix location info for parenthesized expressions

#### 1.0.39
- Fix issues with NaN
  - NaN was prettied to nan, even though the token is case sensitive
  - NaN was serialized to null (default JSON.serialize behavior), so the optimizer converted NaN to null.
- Add support for parsing single expressions, rather than modules.

#### 1.0.38

- Turn off caching, reducing the parser's memory use by about 5x. This initially had very little effect on parsing speed for most code, but there were some pathological cases that were relying on caching. So I followed this up by a series of fixes to the grammar to reduce the amount of backtracking and re-parsing. At the end of which, parsing was about twice as fast on average, and no slower worst case.
- Added tests that the location info was consistent, after accidentally breaking it with the backtracking fixes.
- Fix the layout of the generated .d.ts files
- Update the parser to handle the attribute fields in api.mir, so we can access things like minCiq version from the ast.
- Switch to my own build of prettier-plugin-pegjs, which can handle peggy's global initializer

#### 1.0.37

- Tweaks to estree-types.ts to more accurately describe the AST

#### 1.0.36

- Upgrade to latest versions of all dependent packages

#### 1.0.35

- Formatter fix
  - Don't indent object types in typedef declarations [#1](https://github.com/markw65/prettier-plugin-monkeyc/issues/1)

- Parser fixes to match some [undocumented monkeyc behavior](https://github.com/markw65/monkeyc-optimizer/issues/1)
  - Allow '|' as well as 'or' in type unions
  - Treat \<letter>, \" and \<space> as whitespace
  - Treat \<newline> as <newline>

#### 1.0.34

- Parser fix
  - Allow space to separate attributes (rather than requiring a comma)

#### 1.0.33

- Cleanup

  - Use ConditionalExpressionTail in ConditionalExpression
  - Fix more estree-types

- Api change

  - Use `BigInt`s for `Long`s

- Parser fix
  - Allow `new arr[index](...args)`
    - previously it would treat arr as a type, and create a SizedArrayExpression `new arr [index]`, and try to invoke that.

#### 1.0.32

- Disambiguate the ? in `foo as Bar ? E1 : E2`
  - Without this fix, it would be greedily parsed as `(foo as Bar?)`, and then the parser would trip over the remainder of the expression. This adds a lookahead, so the `?` is only included in the type if the rest of the expression doesn't parse as a ConditionalExpression.

#### 1.0.31

- Parenthesize AsExpression when its the test of a ConditionalExpression

#### 1.0.30

- Parenthesize AsExpression when its a sub-expression of LogicalExpression
- Export Expression from estree-types

#### 1.0.29

- Fix a bug where comments beginning `\s*::` on certain nodes could end up not being printed, and result in an error from prettier.

#### 1.0.28

- More nits in estree-types.

#### 1.0.27

- More nits in estree-types.

#### 1.0.26

- Fix bug parsing `case instanceof` (it only allowed a plain identifier)
- Fix more estree types

#### 1.0.25

- Fix some nits in estree-types.

#### 1.0.24

- Add an Attributes node between the AttributeList and the Attribute[]
  - This allows us to handle trailing comments on attributes better.
- Properly handle comments in the monkeyc-json parser.
  - Drop comments unless we have the source code
  - Drop prettier-ignore comments if we _do_ have the source code.

#### 1.0.23

- Don't allow comments on AttributeList nodes.
  - They weren't handled, and that resulted in an assertion from Prettier

#### 1.0.22

- Fix a couple of estree-types declarations
- Fix parsing and printing of top level object literals
- Parenthesize various top level expressions so the Garmin parser can handle them

#### 1.0.21

- Stricter typechecking, and fix a declaration in estree-types
- Bump to latest versions of all npm packages

#### 1.0.20

- Allow null for FunctionDeclaration.body
- Turn on stricter checking for typescript.

#### 1.0.19

- Switch to using prettier, rather than prettier/standalone since we don't need to run in the browser, and @types/prettier is missing a lot of types for prettier/standalone.

#### 1.0.18

- Make TypedIdentifier a union type between `Identifier` and `AsExpression`. The problem with the old way of doing it was that the identifier's location went from before the start of the identifier to after the end of the `as` expression, which was problematic when finding all references to the symbol, or renaming the symbol in vscode.
- Switch everything over to typescript. This found some bugs, and some dead code (where fields had been moved around, but there was still dead code looking at the old locations). It also creates better type exports for typescript projects that import this one.

#### 1.0.17

- As of sdk 4.1.3, some of the sample projects no longer build with type checking enabled.
  - Drop -l option from tests
- Fix start/end locations for certain nodes
  - When building chains of nodes via `reduce`, we were fixing start and end, but not the newly added loc.start/loc.end.
- Add an index.d.ts
  - @markw65/monkeyc-optimizer is switching over to typescript, and needs some basic type declarations.

#### 1.0.16

- Write a webpack plugin to add a fake module.exports header to build/prettier-plugin-monkeyc.cjs, so that typescript, and node properly recognize what's being exported.

#### 1.0.15

- Add loc field to nodes
- Fix a bug that dropped attributes on module declarations

#### 1.0.14

Accept and fix a few more illegal programs

- Allow an omitted semi-colon in more places (then add it in via the printer)
- Allow numbers outside the 32-bit range, and add an "l" suffix when printing them so the compiler will accept them.

#### 1.0.13

A few bug fixes and enhancements

- Bit of parser cleanup
- Let the parser ignore a missing ";" before a "}", so the printer can add it for us
- Allow any PrimaryExpression for arguments to attributes
- Don't let the printer change Floats to Numbers
- Fix the printer to correctly wrap the bodies of conditional and loop statements

#### 1.0.12

Fixed various parser issues:

- Allow space after `arg` in `catch ( arg ) {`
- Allow space after `,` in `for (i = 0 , j = 0; whatever; i++ , j++ ) {`
- Don't reuse ArrayLiteral for `new [ size ]` because it can
  confuse the estree printer
- Ignore "@" at the beginning of an identifier (is this right? It doesn't
  seem to do anything)
- Floating point literals need a digit after the point. Otherwise
  `42.toChar()` gets mis-parsed by consuming `42.` as a float literal,
  and then hitting a syntax error.
- Allow `static class Foo {}` (but ignore the static)
- Fixup reserved word lists
- Handle octal literals
- Parse `new [size]b`

#### 1.0.11

- Fixed an issue parsing object literals whose keys were not PrimaryExpressions

#### 1.0.10

- Fixed the parser to allow import/using inside modules.

#### 1.0.9

- Don't bundle prettier/standalone.js in the build, since we depend on prettier anyway. This halves the size of the bundle.
- Improve the monkeyc-json parser to allow passing the original source, followed by the json-ast, so that prettier can still inspect the original source when printing (it does this for comments, and for deciding when to leave blank lines between certain constructs).

#### 1.0.8

- Fix some issues with the standard prettier options. Eg setting options.semi=false would have produced illegal MonkeyC, as would setting options.trailingComma=all
- Add a monkeyc-json parser, which just takes the AST (in JSON format) as input. This will allow us to build tools that use the plugin to parse MonkeyC, then change the AST in some way, and then print out the result.

#### 1.0.1 - 1.0.7

- Minor tweaks for better consistency with Prettier for javascript

#### 1.0.0

- Initial release
