/* eslint-env node */
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default (env, argv) => {
    return {
      entry: {
        "prettier-plugin-monkeyc": "./src/prettier-plugin-monkeyc.js",
      },
      mode: "development",
      devtool: "source-map",
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
      module: {
      },
    };
  };
