/* eslint-env node */
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default (env, argv) => {
  const config = {
    entry: {
      "prettier-plugin-monkeyc": "./src/prettier-plugin-monkeyc.js",
      "monkeyc": "./peg/monkeyc.peggy"
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
  };
  if (argv.mode != "production") {
    config.devtool = "source-map";
  }
  return config;
};
