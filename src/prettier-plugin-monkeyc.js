import { parse } from "../build/monkeyc.js";
import preprocess from "./printer.js";

export const languages = [
  {
    name: "monkeyc",
    extensions: [".mc"],
    parsers: ["monkeyc"],
  },
];

export const parsers = {
  monkeyc: {
    parse,
    astFormat: "monkeyc",
    locStart: (node) => node.start || 0,
    locEnd: (node) => node.end || 0,
    preprocess,
  },
};

export const printers = {
  monkeyc: {
    print: () => {
      throw "Something went wrong: printer not initialized!";
    },
  },
};

export const options = {};

export const defaultOptions = {
  tabWidth: 4,
};

export default { languages, parsers, printers, options };
