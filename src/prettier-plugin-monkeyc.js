import { parse } from "../peg/monkeyc.peggy";
import preprocess from "./printer.js";

export const languages = [
  {
    name: "monkeyc",
    extensions: [".mc"],
    parsers: ["monkeyc-parser"],
  },
];

export const parsers = {
  "monkeyc-parser": {
    parse,
    astFormat: "monkeyc-ast",
    locStart: (node) => node.start || 0,
    locEnd: (node) => node.end || 0,
    preprocess,
  },
};

export const printers = {
  "monkeyc-ast": {
    print: () => { throw "Something went wrong: printer not initialized!" },
  },
};

export const options = {};

export const defaultOptions = {
  tabWidth: 4,
};

export default { languages, parsers, printers, options };
