import { parse } from "build/monkeyc.js";
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
      _parsers: unknown,
      options: Partial<ParserOptions<ESTreeNode>> & {
        singleExpression?: boolean;
      }
    ) =>
      parse(
        text,
        options && options.filepath
          ? {
              grammarSource: options.filepath,
              startRule: options.singleExpression
                ? "SingleExpression"
                : "Start",
            }
          : null
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
      const result = unserializeMonkeyC(match ? match[4] : str);
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

export const options = {
  singleExpression: {
    since: "",
    type: "boolean",
    category: "Global",
    default: false,
    description: "Parse a single monkeyc expression, rather than a module.",
  },
} as const;

export const defaultOptions = {
  tabWidth: 4,
};

/*
 * BigInt's can't be JSON.serialized, so use a replacer function
 * Literals have a value field, which can be a string, number,
 * bigint, boolean or null. Since the string type can hold an
 * arbitrary string, we can't convert the BigInt to "1n" or
 * "BigInt(1)", since a string could take on the same value.
 *
 * Instead, we just encode it as Number(0). Then when we unpack,
 * if we find a 0, we can use the Literal's "raw" field to
 * unpack the actual BigInt value.
 */
export function serializeMonkeyC(node: ESTreeNode) {
  return JSON.stringify(node, (key: string, value: unknown) => {
    if (
      key === "value" &&
      (typeof value === "bigint" || (typeof value === "number" && isNaN(value)))
    ) {
      return 0;
    }
    return value;
  });
}

export function unserializeMonkeyC(serialized: string) {
  return JSON.parse(serialized, function (key: string, value: unknown) {
    if (key === "value" && value === 0) {
      if (this.type === "Literal" && typeof this.raw === "string") {
        if (this.raw === "NaN") {
          return NaN;
        }
        const match = this.raw.match(LiteralIntegerRe);
        if (match && (match[2] === "l" || match[2] === "L")) {
          return BigInt(match[1]);
        }
      }
    }
    return value;
  }) as ESTreeNode;
}

export default { languages, parsers, printers, options };
