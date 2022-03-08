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
  ifBreak,
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
  if (!node) {
    return "";
  }

  if (typeof node === "string") {
    return node;
  }

  console.log(`node: ${node.type} at line ${node.location.start.line}`);
  const estree = options.plugins[0].printers.estree;

  let lhs, rhs, label, prefix, suffix, body, delimiters, parent;
  switch (node.type) {
    default:
      return estree.print(path, options, print);

    case "ModuleDeclaration":
      return group([
        group(["module", line, node.id.name, line, "{"]),
        indent(path.call(print, "body")),
        "}",
      ]);
    case "TypedefDeclaration":
      return group([
        group(["typedef", line, node.id.name, line, "as"]),
        line,
        path.call(print, "ts"),
      ]);

    case "Import":
      return group(concat(["import", line, node.id.name, ";"]));

    case "Using":
      body = ["using", line, node.id.name];
      if (node.as != null) {
        body.push(line, "as", line, node.as.name);
      }
      body.push(";");
      return group(concat(body));

    case "AttributeList":
      return concat([
        "(",
        group(join([",", softline], path.map(print, "attrs"))),
        ")",
        hardline,
      ]);

    case "Attribute":
      body = [node.name];
      if (node.arg) {
        body.push("(", softline, path.call(print, "arg"), ")");
      }
      return group(concat(body));

    case "Identifier":
      if (node.ts) {
        return group([node.name, line, path.call(print, "ts")]);
      }
      return node.name;

    case "AttributeArgList":
      return group(
        concat(["[", join([",", softbreak], path.map(print, "args"), "]")])
      );

    case "AsTypeSpec":
      return group(["as", line, path.call(print, "ts")]);
    case "TypeSpecList":
      return group(join([" or", line], path.map(print, "ts")));
    case "TypeSpecPart":
      body = [node.name];
      if (node.arg) {
        body.push(
          group([
            "<",
            softline,
            ifBreak(indent(path.call(print, "arg")), path.call(print, "arg")),
            softline,
            ">",
          ])
        );
      }
      return concat(body);
    case "VariableDeclaration":
      body = estree.print(path, options, print);
      if (node.attrs) {
        body = [path.call(print, "attrs"), hardline, body];
      }
      return body;
    case "ClassElement":
      body = path.call(print, "item");
      if (node.access) {
        body = [node.access, line, body];
      }
      return group(body);
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
