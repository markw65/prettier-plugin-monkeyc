import { parse } from "../peg/monkeyc.js";
import { printMonkeyCAst, parserPreprocess } from "./printer.js";

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
    preprocess : parserPreprocess,
  },
};

export const printers = {
  "monkeyc-ast": {
    print: printMonkeyCAst,
    canAttachComment: (node) =>
      node && node.type && node.type !== "Line" && node.type != "MultiLine",
  },
};

export const options = {};

export const defaultOptions = {
  tabWidth: 4,
};

export default { languages, parsers, printers, options };
