import * as fs from "fs/promises";
import { argv } from "process";
import { parse } from "../peg/monkeyc.cjs";

if (process.argv.length <= 2) {
  console.error("No files to process!");
  process.exit(1);
}

Promise.all(
  argv.slice(2).map((file) =>
    fs
      .readFile(file)
      .then((data) => {
        return {
          file,
          ast: parse(data.toString()),
        };
      })
      .catch((data) => {
        let message = data.toString();
        if (data.location) {
          message += `in file '${file}' at line ${data.location.start.line}, column ${data.location.start.column}`;
        }
        console.error(message);
        process.exit(1);
      })
  )
).then((results) => console.log(JSON.stringify(results)));
