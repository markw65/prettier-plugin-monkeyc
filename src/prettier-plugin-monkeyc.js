import Prettier from "prettier/standalone.js";
import { parse } from "../peg/monkeyc.js";
import { printMonkeyCAst, printComment } from "./printer.js";

const { util } = Prettier;
/**
 * This is called by prettier whenever it detects a comment on its own
 * line (i.e., only whitespace before/after). We have a chance to change what
 * node the comment is assigned to.
 *
 * @param {object} comment
 * @param {string} text
 * @param {object} options
 * @param {object} ast
 * @param {boolean} isLastComment
 * @returns {boolean} `true` if the comment was handled, `false` to pass through to Prettier's default handler
 */
function handleOwnLineComment(comment, text, options, ast, isLastComment) {
  if (options.debugComments && comment.value.includes("debug")) {
    console.log("handleOwnLineComment", comment);
  }

  const { enclosingNode, precedingNode, followingNode } = comment;

  if (enclosingNode && enclosingNode.type === "choice") {
    // If the comment is on its own line in a `choice` block,
    // It is probably meant to describe one of the choices. In this case,
    // it should be rendered *before* the node it is currently attached to.
    // I.e., at the end of the previous node.
    if (precedingNode) {
      util.addTrailingComment(precedingNode, comment);
      return true;
    }
  }
  if (enclosingNode && enclosingNode.type === "rule") {
    if (followingNode && followingNode.type === "delimiter") {
      // We have a comment before the `=`. For example,
      // abc
      //   // my comment
      //   = some rule
      util.addLeadingComment(followingNode, comment);
      return true;
    }
  }
}

/**
 * This is called by prettier whenever it detects a comment at the end of a line
 * (i.e., there is some non-whitespace on the same line as the comment, but nothing
 * after the comment). We have a chance to change what
 * node the comment is assigned to.
 *
 * @param {object} comment
 * @param {string} text
 * @param {object} options
 * @param {object} ast
 * @param {boolean} isLastComment
 * @returns {boolean} `true` if the comment was handled, `false` to pass through to Prettier's default handler
 */
function handleEndOfLineComment(comment, text, options, ast, isLastComment) {
  if (options.debugComments && comment.value.includes("debug")) {
    console.log("handleEndOfLineComment", comment);
  }

  const { enclosingNode, precedingNode, followingNode } = comment;

  if (
    enclosingNode &&
    (enclosingNode.type === "choice" || enclosingNode.type === "rule")
  ) {
    if (
      !comment.multiline &&
      precedingNode &&
      precedingNode.type === "delimiter"
    ) {
      // Single-line comments that come directly after a delimiter should really
      // be printed *before* that delimiter.
      util.addLeadingComment(precedingNode, comment);
      return true;
    }

    if (
      !comment.multiline &&
      followingNode &&
      followingNode.type === "stringliteral"
    ) {
      // Reformat rules like
      //   a //some comment
      //     "label" = y
      // to
      //   a "label" // some comment
      //     = y
      util.addTrailingComment(followingNode, comment);
      return true;
    }
  }
}

/**
 * This is called by prettier whenever it finds a comment that it cannot classify
 * as `ownLine` or `endOfLine`. We have a chance to change what
 * node the comment is assigned to.
 *
 * @param {object} comment
 * @param {string} text
 * @param {object} options
 * @param {object} ast
 * @param {boolean} isLastComment
 * @returns {boolean} `true` if the comment was handled, `false` to pass through to Prettier's default handler
 */
function handleRemainingComment(comment, text, options, ast, isLastComment) {
  if (options.debugComments && comment.value.includes("debug")) {
    console.log("handleRemainingComment", comment);
  }
}

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
    locStart: (node) => (node.start || 0),
    locEnd: (node) => (node.end || 0),
  },
};

export const printers = {
  "monkeyc-ast": {
    print: printMonkeyCAst,
    canAttachComment: (node) => node && node.type && node.type !== "comment",
    isBlockComment: (node) =>
      node && node.type === "comment" && node.multiline === true,
    printComment,
    handleComments: {
      ownLine: handleOwnLineComment,
      endOfLine: handleEndOfLineComment,
      remaining: handleRemainingComment,
    },
  },
};

export const options = {
  /*
    actionParser: {
        type: "string",
        category: "Global",
        default: "babel",
        description: "The parser to use for the content of Pegjs actions",
    },
  */
};

export const defaultOptions = {
  tabWidth: 4,
  // actionParser: "babel",
};

export default { languages, parsers, printers, options };
