import { parse } from "peg/monkeyc.peggy";
import {
  default as preprocess,
  LiteralIntegerRe,
  estree_promise,
} from "./printer";
import { Node as ESTreeNode } from "./estree-types";
import { Parser, ParserOptions } from "prettier";
import { Printer } from "./printer";
export * as mctree from "./estree-types";
export { LiteralIntegerRe };

export const languages = [
  {
    name: "monkeyc",
    extensions: [".mc"],
    parsers: ["monkeyc"],
  },
];

function parseMonkeyC(
  text: string,
  parsers: unknown,
  options: Partial<ParserOptions<ESTreeNode>> & {
    singleExpression?: boolean;
    mss?: string;
  }
) {
  const peggyOptions: {
    grammarSource?: string;
    startRule?: string;
    mss?: string;
  } = {};
  if (!options) {
    options = parsers as typeof options;
  }
  if (options) {
    if (options.filepath) {
      peggyOptions.grammarSource = options.filepath;
    }
    if (options.mss != null) {
      peggyOptions.startRule = "PersonalityStart";
      peggyOptions.mss = options.mss;
    } else {
      peggyOptions.startRule = options.singleExpression
        ? "SingleExpression"
        : "Start";
    }
  }
  return parse(text, peggyOptions);
}

export const parsers = {
  monkeyc: {
    parse: (
      text: string,
      parsers: unknown,
      options: Partial<ParserOptions<ESTreeNode>> & {
        singleExpression?: boolean;
        mss?: string;
      }
    ) => {
      if (estree_promise) {
        return estree_promise.then(() => parseMonkeyC(text, parsers, options));
      }
      return parseMonkeyC(text, parsers, options);
    },
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
    parse: (str: string) => {
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
      if (estree_promise) {
        return estree_promise.then(() => result);
      }
      return result;
    },
    astFormat: "monkeyc",
    locStart: (node) => node.start || 0,
    locEnd: (node) => node.end || 0,
    preprocess,
  } as Parser<ESTreeNode>,
};

const nonTraversableKeys = new Set([
  "tokens",
  "comments",
  "parent",
  "enclosingNode",
  "precedingNode",
  "followingNode",
]);

export const printers: Record<string, Printer<ESTreeNode>> = {
  monkeyc: {
    print() {
      throw "Something went wrong: printer not initialized!";
    },
    preprocess() {
      throw "Something went wrong: printer not initialized!";
    },
    getVisitorKeys(node) {
      return Object.entries(node)
        .filter(
          ([key, value]) =>
            !nonTraversableKeys.has(key) &&
            ((value && typeof value.type === "string") ||
              (Array.isArray(value) &&
                value.every((v) => v && typeof v.type === "string")))
        )
        .map(([key]) => key);
    },
  },
};

export const options = {
  singleExpression: {
    since: "",
    type: "boolean",
    category: "Special",
    default: false,
    description: "Parse a single monkeyc expression, rather than a module.",
  },
  mss: {
    since: "",
    type: "string",
    category: "Special",
    description: "Parse a .mss file, rather than a .mc file.",
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
