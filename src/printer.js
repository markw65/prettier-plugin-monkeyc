// If we pull in "prettier", we also pull in the `fs` module which
// prevents the plugin from working in the browser, so we
// pull in the standalone version.
import Prettier from "prettier/standalone.js";

const { builders } = Prettier.doc;

// Commands to build the prettier syntax tree
const {
  concat,
  group,
  fill,
  // ifBreak,
  line,
  softline,
  hardline,
  //lineSuffix,
  //lineSuffixBoundary,
  indent,
  dedent,
  join,
  //markAsRoot,
  //breakParent,
} = builders;

let estree_print;

// We set this as the parser's preprocess function. That lets
// us grab the estree printer early on, and munge our printer,
// before any printing starts
export default function printerIntialize(text, options) {
  if (!estree_print) {
    const find = (name) =>
      options.plugins.find((p) => p.printers[name]).printers[name];
    const { print, ...rest } = find("estree");
    Object.assign(find("monkeyc-ast"), rest, { print: printMonkeyCAst });
    estree_print = print;
  }
  return text;
}

function printMonkeyCAst(path, options, print) {
  const node = path.getValue();
  if (!node) {
    return "";
  }

  if (typeof node === "string") {
    return node;
  }

  let rhs, body;
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

    case "ImportModule":
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
      body = estree_print(path, options, print);
      if (nodeNeedsParens(node, path.getParentNode())) {
        body = concat(["(", body, ")"]);
      }
      return body;

    case "TypeSpecList":
      return group(join([" or", line], path.map(print, "ts")));

    case "TypeSpecPart":
      body = [node.name || ""];

      if (node.body) {
        body.push(" ", dedent(path.call(print, "body")));
      }
      if (node.generics) {
        const final_space = node.generics.slice(-1)[0].ts.slice(-1)[0].generics
          ? line
          : softline;
        body.push(
          group([
            "<",
            softline,
            indent(join([",", line], path.map(print, "generics"))),
            final_space,
            ">",
          ])
        );
      }
      if (node.dictionary) {
        body.push(
          group([
            "{",
            line,
            indent(join([",", line], path.map(print, "dictionary"))),
            line,
            "}",
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
      if (!node.size) {
        return concat([estree_print(path, options, print), node.byte || ""]);
      }
      return group([
        "new ",
        node.ts ? [path.call(print, "ts"), node.ts.generics ? "" : " "] : "",
        "[",
        indent(path.call(print, "size")),
        "]",
        node.byte || "",
      ]);

    case "VariableDeclaration":
    case "FunctionDeclaration":
    case "MethodDeclaration":
    case "ClassDeclaration":
      body = estree_print(path, options, print);
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

    case "Literal":
      if (typeof node.value === "string") {
        return node.raw;
      }
      break;
  }

  return estree_print(path, options, print);
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
