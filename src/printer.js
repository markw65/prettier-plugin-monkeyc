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
  fill,
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

  // console.log(`node: ${node.type} at line ${node.location.start.line}`);
  const estree = options.plugins[0].printers.estree;

  let lhs, rhs, label, prefix, suffix, body, delimiters, parent;
  switch (node.type) {
    case "ModuleDeclaration":
      return group([
        group(["module", line, indent(node.id.name), line]),
        path.call(print, "body"),
      ]);

    case "TypedefDeclaration":
      return group([
        group(["typedef", line, node.id.name]),
        path.call(print, "ts"),
        ";",
      ]);

    case "EnumDeclaration":
      return ["enum ", node.id ? [print("id"), " "] : "", print("body")];

    case "Property":
      return group([
        path.call(print, "key"),
        line,
        "=>",
        line,
        path.call(print, "value"),
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
        return group([node.name, path.call(print, "ts")]);
      }
      return node.name;

    case "AttributeArgList":
      return group(
        concat(["[", join([",", line], path.map(print, "args"), "]")])
      );

    case "AsTypeSpec":
      return indent(fill([line, "as", line, path.call(print, "ts")]));

    case "AsExpression":
      body = [path.call(print, "expr"), path.call(print, "ts")];
      if (nodeNeedsParens(node.expr, node)) {
        body = [concat(["(", body[0], ")"]), body[1]];
      }
      if (nodeNeedsParens(node, path.getParentNode())) {
        body.unshift("(");
        body.push(")");
      }
      return group(body);
    case "NewExpression":
      body = estree.print(path, options, print);
      if (nodeNeedsParens(node, path.getParentNode())) {
        body = concat(["(", body, ")"]);
      }
      return body;

    case "TypeSpecList":
      return group(join([" or", line], path.map(print, "ts")));

    case "TypeSpecPart":
      body = [];

      if (node.name) {
        body.push(node.name)
      } else {
        body.push(
          group([
            "{",
            line,
            indent(join([",", line], path.map(print, "object"))),
            line,
            "}",
          ])
        );
      }
      if (node.generics) {
        body.push(
          group([
            "<",
            softline,
            indent(join([",", line], path.map(print, "generics"))),
            softline,
            ">",
          ])
        );
      }
      if (node.callspec) {
        options.semi = false;
        body.push(path.call(print, "callspec"));
        options.semi = true;
      }
      if (node.nullable) {
        if (node.callspec) {
          body.unshift("(");
          body.push(")");
        }
        body.push("?");
      }
      return concat(body);

    case "ArrayExpression":
      if (!node.size) break;
      return group(["new [", indent(path.call(print, "size")), "]"]);

    case "VariableDeclaration":
    case "FunctionDeclaration":
    case "MethodDeclaration":
    case "ClassDeclaration":
      body = estree.print(path, options, print);
      if (node.attrs) {
        body = [path.call(print, "attrs"), body];
      }
      return body;

    case "ClassElement":
      body = [];
      if (node.access) {
        body.push(node.access, line);
      }
      if (node.item.static) {
        body.push("static", line);
      }
      rhs = path.call(print, "item");
      if (!body.length) {
        return rhs;
      }
      if (Array.isArray(rhs)) {
        body = body.concat(rhs);
      } else {
        body.push(rhs);
      }
      return fill(body);

    case "CatchClauses":
      return join(" ", path.map(print, "catches"));

    case "ThisExpression":
      return node.text;

    case "InstanceOfCase":
      return concat(["instanceof ", path.call(print, "id")]);
  }

  return estree.print(path, options, print);
}

function nodeNeedsParens(node, parent) {
  if (node.type == "AsExpression") {
    switch (parent.type) {
      case "BinaryExpression":
        // there's a bug handling multiplicative ops
        // in the monkeyc parser, but the precedence is
        // confusing enough anyway. Just wrap them all.
        return true;
      case "MemberExpression":
        return node == parent.object;
      case "NewExpression":
      case "CallExpression":
        return node == parent.callee;
    }
    return false;
  }
  if (parent.type == "AsExpression") {
    switch (node.type) {
      // pretty much everything except primary, call, new, member
      case "ThisExpression":
      case "Identifier":
      case "ArrayExpression":
      case "ObjectExpression":
      case "Literal":
      case "MemberExpression":
      case "NewExpression":
      case "CallExpression":
        return false;
    }
    return true;
  }

  if (node.type == "NewExpression") {
    return parent.type == "MemberExpression";
  }
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
export function printComment(commentPath, options) {
  const estree = options.plugins[0].printers.estree;

  return estree.printComment(commentPath, options);
}
