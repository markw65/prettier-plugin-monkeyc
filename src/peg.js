import * as fs from "fs/promises";
import { parse } from "../peg/monkeyc.cjs";

fs.readFile(
  "example/AnalogView.mc"
)
  .then((data) => parse(data.toString()))
  .then((data) => console.log(data))
  .catch((data) => {
    let message = data.toString();
    if (data.location) {
      message += ` at line ${data.location.start.line}, column ${data.location.start.column}`
    }
    console.log(message);
  });
