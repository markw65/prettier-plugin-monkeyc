import * as fs from "fs/promises";
import { argv } from "process";
import {
  default as MonkeyC,
  serializeMonkeyC,
} from "../build/prettier-plugin-monkeyc.cjs";

if (process.argv.length <= 2) {
  console.error("No files to process!");
  process.exit(1);
}

const args = argv.slice(2);
let time = false;
if (args[0] === "--time") {
  args.splice(0, 1);
  time = true;
}
let total = 0;
const start = Date.now();
const results = [`${new Date().toLocaleString()} - Start`];
args
  .reduce(
    (promise, file) =>
      promise.then(() => {
        const s = Date.now();
        return fs
          .readFile(file)
          .then((data) => {
            const ast = MonkeyC.parsers.monkeyc.parse(data.toString(), null, {
              filepath: file,
            });
            const duration = Date.now() - s;
            total += duration;
            results.push({
              file,
              data: time ? duration : ast,
            });
          })
          .catch((data) => {
            let message = data.toString();
            if (data.location) {
              message += `in file '${file}' at line ${data.location.start.line}, column ${data.location.start.column}`;
            }
            results.push({ file, data: message });
          });
      }),
    Promise.resolve()
  )
  .then(() => {
    results.push(
      `${new Date().toLocaleString()} - Done in ${
        Date.now() - start
      }ms (parsing took ${total}ms)`
    );
    console.log(serializeMonkeyC(results));
  });
