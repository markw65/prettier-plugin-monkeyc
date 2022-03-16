/* eslint-env node */
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default (env, argv) => {
  const config = {
    mode: argv.mode || "development",
    entry: {
      "prettier-plugin-monkeyc": "./src/prettier-plugin-monkeyc.js",
      monkeyc: "./peg/monkeyc.peggy",
    },
    performance: {
      hints: false
    },
    module: {
      rules: [
        {
          test: /\.peggy$/,
          use: [{ loader: path.resolve(__dirname, "src/peggy-loader.cjs") }],
        },
      ],
    },

    output: {
      filename: "[name].cjs",
      path: path.resolve(__dirname, "build"),
      library: "prettierPluginMonkeyC",
      globalObject: `(() => {
              if (typeof self !== 'undefined') {
                  return self;
              } else if (typeof window !== 'undefined') {
                  return window;
              } else if (typeof global !== 'undefined') {
                  return global;
              } else {
                  return Function('return this')();
              }
          })()`,
      libraryTarget: "umd",
    },
    plugins: [],
  };
  if (argv.mode != "production") {
    config.devtool = "source-map";
  }
  config.plugins.push(
    new (function () {
      this.apply = (compiler) => {
        compiler.hooks.done.tap("Log On Done Plugin", () => {
          console.log(
            `\n[${new Date().toLocaleString()}] Begin a new compilation.\n`
          );
        });
      };
    })()
  );

  return config;
};
