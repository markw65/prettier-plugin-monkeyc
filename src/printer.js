// If we pull in "prettier", we also pull in the `fs` module which
// prevents the plugin from working in the browser, so we
// pull in the standalone version.
import Prettier from "prettier/standalone.js";

const { util } = Prettier;
const { builders, utils } = Prettier.doc;

// Commands to build the prettier syntax tree
const {
  concat,
  group,
  //fill,
  //ifBreak,
  line,
  softline,
  hardline,
  //lineSuffix,
  //lineSuffixBoundary,
  indent,
  join,
  //markAsRoot,
  breakParent,
} = builders;

function wrapInParenGroup(doc) {
  return group(concat(["(", indent(concat([softline, doc])), softline, ")"]));
}

/**
 * Returns true if `node.expression` should be wrapped in
 * parens to avoid potential confusion (e.g., because
 * the reader has forgotten the precedence of operations)
 *
 * @param {*} node
 */
function nodeExpressionNeedsWrapping(node) {
  if (!node.expression || true) {
    return false;
  }
  // Most of the time we want to wrap expressions like `&foo?` in
  // parenthesis like `&(foo?)`. The exceptions are `$foo*`, etc., whose meaning
  // should be clear
  if (
    isPrefixOperator(node) &&
    node.type !== "text" &&
    isSuffixOperator(node.expression)
  ) {
    if (node.type === "") return true;
  }
  if (node.type === "labeled" && isSuffixOperator(node.expression)) {
    // Suffix operators will wrap their arguments in parenthesis if needed
    // so we don't need to wrap them in another set
    return false;
  }
  // Normally `labeled` expressions are wrapped in parens, but
  // if they are part of a choice, we don't want them wrapped.
  // For example `a:Rule {return a}` should *not* become
  // `(a:Rule) {return a}`.
  if (node.type === "action" && node.expression.type === "labeled") {
    return false;
  }
  if (["choice", "labeled", "action"].includes(node.expression.type)) {
    return true;
  }
  return false;
}

// The signature of this function is determined by the Prettier
// plugin API.
export function printMonkeyCAst(path, options, print) {
  const node = path.getValue();

  let lhs, rhs, label, prefix, suffix, body, delimiters, parent;
  switch (node.type) {
    case "Program":
      // This is the root node of a Pegjs grammar
      return join(concat([hardline, hardline]), path.map(print, "body"));

      if (!node.initializer) {
        // A `hardline` is inserted at the end so that any trailing comments
        // are printed
        return concat([body, hardline]);
      }

      // A `hardline` is inserted at the end so that any trailing comments
      // are printed
      return concat([
        path.call(print, "initializer"),
        hardline,
        hardline,
        body,
        hardline,
      ]);
    case "rule":
      lhs = [node.name];
      if (node.displayName) {
        lhs.push(" ", path.call(print, "displayName"));
      }

      rhs = concat([
        line,
        path.call(print, "delimiter"),
        " ",
        path.call(print, "expression"),
      ]);
      return group(concat(lhs.concat(indent(rhs))));

    case "rule_ref":
      return node.name;

    // This is a string a quoted string. E.g., literally `"abc"`
    case "stringliteral":
      return util.makeString(node.value, '"');

    case "delimiter":
      return node.value;

    case "any":
      return ".";

    case "choice":
      rhs = path.map(print, "alternatives");
      if (rhs.length === 0) {
        return "";
      }
      // Delimiters (i.e., "/") are theoretically all the same,
      // but they may have comments surrounding them. To preserve these
      // comments, we actually print them.
      delimiters = path.map(print, "delimiters");

      body = [rhs[0]];
      for (let i = 0; i < delimiters.length; i++) {
        body.push(line, delimiters[i], " ", rhs[i + 1]);
      }

      parent = path.getParentNode();
      if (parent && parent.type === "rule") {
        // Rules are the top-level objects of a grammar. If we are the child
        // of a rule, we want to line-break nomatter what.
        body.push(breakParent);
      }

      return concat(body);

    case "literal":
      if (node.ignoreCase) {
        return concat([util.makeString(node.value, '"'), "i"]);
      }
      return util.makeString(node.value, '"');

    case "group":
      return wrapInParenGroup(path.call(print, "expression"));

    case "sequence":
      body = path.map(print, "elements");
      // Any `action` or `choice` that appears in a sequence needs to
      // be wrapped in parens.
      body = body.map((printed, i) => {
        const child = node.elements[i];
        if (["action", "choice"].includes(child.type)) {
          return wrapInParenGroup(printed);
        }
        return printed;
      });
      return group(indent(join(line, body)));

    case "labeled":
      label = node.label;
      rhs = path.call(print, "expression");
      if (nodeExpressionNeedsWrapping(node)) {
        rhs = wrapInParenGroup(rhs);
      }
      lhs = [];
      if (node.pick) {
        lhs.push("@");
      }
      if (label) {
        lhs.push(label, ":");
      }
      return concat([...lhs, rhs]);

    // suffix operators
    case "optional":
    case "zero_or_more":
    case "one_or_more":
      suffix = SUFFIX_MAP[node.type];
      body = path.call(print, "expression");
      if (nodeExpressionNeedsWrapping(node)) {
        return concat([wrapInParenGroup(body), suffix]);
      }
      return concat([body, suffix]);

    // prefix operators
    case "text":
    case "simple_and":
    case "simple_not":
      prefix = PREFIX_MAP[node.type];
      if (nodeExpressionNeedsWrapping(node)) {
        return concat([
          prefix,
          wrapInParenGroup(path.call(print, "expression")),
        ]);
      }
      return concat([prefix, path.call(print, "expression")]);

    // Things in square brackets (e.g. `[a-zUVW]`)
    case "class":
      prefix = node.inverted ? "^" : "";
      suffix = node.ignoreCase ? "i" : "";
      lhs = node.parts.map((part) => {
        if (Array.isArray(part)) {
          return part.join("-");
        }
        return part;
      });

      return concat(["[", prefix, ...lhs, "]", suffix]);

    case "comment":
      // XXX I'm not sure why this is here. I don't think this code is ever reached.
      return concat(["A COMMENT", node.value]);

    default:
      return concat(["[--> ", JSON.stringify(node), " <--]"]);
      console.warn(
        `Found node with unknown type '${node.type}'`,
        JSON.stringify(node)
      );
  }

  throw new Error(`Could not find printer for node ${JSON.stringify(node)}`);
}

/**
 * This is called by Prettier whenever a comment is to be printed.
 * Comments are stored outside of the AST, but Prettier will make its best guess
 * about which node a comment "belongs to". The return Doc of this function
 * is inserted in the appropriate place.
 *
 * @param {*} commentPath
 * @param {*} options
 */
export function printComment(commentPath) {
  const comment = commentPath.getValue();

  const prefix = comment.forceBreakAfter ? hardline : "";

  if (comment.multiline) {
    return concat([prefix, "/*", comment.value, "*/"]);
  }
  return concat([prefix, "//", comment.value]);
}
