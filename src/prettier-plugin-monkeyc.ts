import { parse } from "../build/monkeyc.js";
import { default as preprocess, LiteralIntegerRe } from "./printer";
import { Node as ESTreeNode, Program as ESTreeProgram } from "./estree-types";
import { Parser, ParserOptions, Printer } from "prettier";
export * as mctree from "./estree-types";
export { LiteralIntegerRe };

export const languages = [
  {
    name: "monkeyc",
    extensions: [".mc"],
    parsers: ["monkeyc"],
  },
];

export const parsers = {
  monkeyc: {
    parse: (
      text: string,
      parsers: unknown,
      options: Partial<ParserOptions<ESTreeNode>>
    ) =>
      parse(
        text,
        options && options.filepath && { grammarSource: options.filepath }
      ),
    astFormat: "monkeyc",
    locStart: (node: ESTreeNode) => node.start || 0,
    locEnd: (node: ESTreeNode) => node.end || 0,
    preprocess,
  } as const,
  "monkeyc-json": {
    // just parse the last line out of str, so we can pass in the
    // original text, followed by the json ast. This is because
    // prettier makes some of its formatting decisions by looking
    // at the original source, rather than the contents of the ast.
    parse: (str: string): ESTreeNode => {
      const match = str.match(
        /^((.|[\r\n\u2028\u2029])*)(\r\n|[\n\r\u2028\u2029])(.+)$/
      );
      const result = JSON.parse(match ? match[4] : str) as ESTreeNode;
      if ("comments" in result) {
        if (
          !match ||
          !match[1] ||
          (result.end && match[1].length < result.end)
        ) {
          // If we didn't get original text, don't try to print comments
          // because prettier ignores the comment value, and reads the
          // text of the comment from the source.
          delete result.comments;
        } else if (result.comments) {
          // And if we did get the original text, ignore any
          // prettier-ignore directives, because that would
          // throw away any changes we made to the ast.
          result.comments = result.comments.filter(
            (comment) => !comment.value.includes("prettier-ignore")
          );
        }
      }
      return result;
    },
    astFormat: "monkeyc",
    locStart: (node) => node.start || 0,
    locEnd: (node) => node.end || 0,
    preprocess,
  } as Parser<ESTreeNode>,
};

export const printers: Record<string, Printer<ESTreeNode>> = {
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
