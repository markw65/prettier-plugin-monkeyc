/* eslint-env node */
import path from "path";
import { fileURLToPath } from "url";
import peggy from "peggy";
import * as fs from "fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default (env, argv) => {
  const generated = path.resolve(__dirname, "generated");
  return Promise.all([
    fs.mkdir(generated, { recursive: true }),
    fs.readFile("peg/monkeyc.peggy"),
  ])
    .then(([, data]) => {
      return fs.writeFile(
        path.resolve(generated, "monkeyc.js"),
        peggy.generate(data.toString(), {
          cache: true,
          format: "es",
          output: "source",
        })
      );
    })
    .then(() => {
      const config = {
        entry: {
          "prettier-plugin-monkeyc": "./src/prettier-plugin-monkeyc.js",
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
        module: {},
      };
      if (argv.mode != "production") {
        config.devtool = "source-map";
      }
      return config;
    });
};
