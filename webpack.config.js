/* eslint-env node */
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default (env, argv) => {
  function getConfig(extra) {
    const config = {
      mode: argv.mode || "development",
      performance: {
        hints: false,
      },
      output: {
        filename: "[name].cjs",
        path: path.resolve(__dirname, "build"),
        libraryTarget: "commonjs",
        devtoolModuleFilenameTemplate: "webpack://[resource-path]",
      },
      devtool: argv.mode != "production" ? "source-map" : false,
    };
    return { ...config, ...extra };
  }
  const monkeyc = getConfig({
    name: "monkeyc",
    entry: {
      monkeyc: "./peg/monkeyc.peggy",
    },
    module: {
      rules: [
        {
          test: /\.peggy$/,
          // Set the type so that the raw .js file is generated
          type: "asset/resource",
          use: [
            {
              loader: path.resolve(__dirname, "src/peggy-loader.cjs"),
              options: { allowedStartRules: ["Start", "SingleExpression"] },
            },
          ],
          generator: {
            // name the raw .js file
            filename: "[name].js",
          },
        },
      ],
    },
    plugins: [
      {
        /*
         * Probably overthinking this. I want "webpack watch" to work,
         * so I want the parser generation to be part of the build.
         * My previous attempt worked, but we ended up generating the
         * parser twice (once as part of the main library, and once
         * standalone), and since peggy doesn't generate SourceMaps,
         * there was nothing for the generated .js code to refer back
         * to.
         *
         * So I wanted to just generate the standalone file,
         * and use it as an input to the main library.
         * So it has to happen in a separate, dependent config.
         *
         * So far, so good... but Peggy generates a perfectly good es
         * module, which peg.js could import - but webpack insists on
         * converting it to commonjs. This isn't really a problem, but
         * I'd prefer to have the SourceMap refer back to a clean es
         * module, rather than the webpackified version.
         *
         * If I mark it "asset/resource" it will at least generate both
         * the raw output of peggy, and the "wrapped" version. But now
         * I also have an unwanted .cjs version. I use the following
         * plugin to remove that from the build before it's emitted.
         *
         * There has to be a better way...
         */
        apply(compiler) {
          const pluginName = "Assets Plugin";
          compiler.hooks.compilation.tap(pluginName, function (compilation) {
            compilation.hooks.processAssets.tap(
              {
                name: pluginName,
                stage:
                  compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_PRE_PROCESS,
                additionalAssets: false,
              },
              function (assets) {
                Object.keys(assets).forEach((file) => {
                  if (/\.cjs$/.test(file)) {
                    compilation.deleteAsset(file);
                  }
                });
              }
            );
          });
        },
      },
    ],

    devtool: false,
  });
  const plugin = getConfig({
    name: "prettierPluginMonkeyC",
    entry: {
      "prettier-plugin-monkeyc": "./src/prettier-plugin-monkeyc.ts",
    },
    dependencies: ["monkeyc"],
    module: {
      rules: [
        {
          test: /\.ts$/,
          loader: "ts-loader",
          exclude: /node_modules/,
          options: {
            // set to true for faster builds, or to transpile even
            // when there are errors.
            transpileOnly: false,
          },
        },
      ],
    },
    resolve: {
      enforceExtension: false,
      extensions: [".ts", ".js"],
      alias: {
        build: path.resolve(__dirname, "build"),
      },
    },
    externals: { prettier: "prettier" },
    plugins: [
      {
        apply(compiler) {
          const pluginName = "Log On Done Plugin";
          compiler.hooks.afterDone.tap(pluginName, () => {
            console.log(`\n[${new Date().toLocaleString()}] Build finished.\n`);
          });
          /*
           * When you import a .cjs module from an esm module, node tries
           * to guess the names of the .cjs module's exports. It does this
           * based on some heuristics which fail for webpack generated code.
           *
           * When the heuristics fail, node treats the whole exported object
           * as the default export of the module, so you have to do
           *
           *   import foo from "foo";
           *   const { import1, import2 } = foo;
           *
           * rather than
           *
           *   import { import1, import2 } from "foo";
           *
           * A minor inconvenience, but I'd rather keep the import syntax
           * the same as if I was importing the original esm source (since
           * hopefully, vscode will start supporting esm extensions at some
           * point).
           *
           * One of the patterns that node *does* recognize is
           *
           *  0 && (module.exports = {name1, ..., nameK});
           *
           * Note that this code *does* nothing, but since it matches one of
           * node's patterns, its enough to make named imports work.
           * The above pattern was added to support esbuild, and node has
           * tests to make sure it continues to work.
           *
           * So, first we gather all the exported names from the esm modules
           * in the build.
           */
          const fileToExports = {};
          const recordExport = (request, name) => {
            request = request.replace(/\.(js|ts)$/, "").replace(/^\.[\\/]/, "");
            if (!Object.prototype.hasOwnProperty.call(fileToExports, request)) {
              fileToExports[request] = [];
            }
            fileToExports[request].push(name);
          };
          compiler.hooks.normalModuleFactory.tap(pluginName, (factory) => {
            const exportParser = (parser) => {
              parser.hooks.exportSpecifier.tap(
                pluginName,
                (statement, id, name) =>
                  recordExport(parser.state.module.rawRequest, name)
              );
              parser.hooks.exportImportSpecifier.tap(
                pluginName,
                (statement, source, id, name) =>
                  recordExport(parser.state.module.rawRequest, name)
              );
            };
            ["javascript/esm", "javascript/auto"].forEach((target) =>
              factory.hooks.parser.for(target).tap(pluginName, exportParser)
            );
          });
          /*
           * Now we insert the fake exports line into each of the .cjs
           * files. We don't currently enable minimization, but if we
           * ever do, we're doing the insertion after minimization would
           * run.
           */
          compiler.hooks.compilation.tap(pluginName, function (compilation) {
            compilation.hooks.processAssets.tap(
              {
                name: pluginName,
                stage:
                  compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_DEV_TOOLING,
                additionalAssets: false,
              },
              function (assets) {
                Object.entries(assets).forEach(([file, asset]) => {
                  const match = file.match(/^(.*)\.cjs/);
                  if (match) {
                    const original = `src/${match[1]}`;
                    const exports = fileToExports[original];
                    if (exports) {
                      const fakeExportLine = `0 && (module.exports = {${exports.join(
                        ","
                      )}});\n`;
                      compilation.updateAsset(
                        file,
                        new compiler.webpack.sources.ConcatSource(
                          fakeExportLine,
                          asset
                        )
                      );
                    }
                  }
                });
              }
            );
          });
        },
      },
    ],
  });

  return [monkeyc, plugin];
};
