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
  "monkeyc-json": {
    // just parse the last line out of str, so we can pass in the
    // original text, followed by the json ast. This is because
    // prettier makes some of its formatting decisions by looking
    // at the original source, rather than the contents of the ast.
    parse: (str) =>
      JSON.parse(
        str.replace(
          /^(.|[\r\n\u2028\u2029])*(\r\n|[\n\r\u2028\u2029])(.)/,
          "$3"
        )
      ),
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
