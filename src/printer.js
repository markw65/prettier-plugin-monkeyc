// If we pull in "prettier", we also pull in the `fs` module which
// prevents the plugin from working in the browser, so we
// pull in the standalone version.
import Prettier from "prettier/standalone.js";

const { doc } = Prettier;

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
} = doc.builders;

let estree_print, estree_preprocess;

// We set this as the parser's preprocess function. That lets
// us grab the estree printer early on, and munge our printer,
// before any printing starts
export default function printerIntialize(text, options) {
  if (!estree_print) {
    const find = (name) =>
      options.plugins.find((p) => p.printers[name]).printers[name];
    let rest;
    ({
      print: estree_print,
      preprocess: estree_preprocess,
      ...rest
    } = find("estree"));
    Object.assign(find("monkeyc-ast"), rest, {
      print: printAst,
      preprocess: preprocessAst,
    });
  }
  return text;
}

function preprocessAst(ast, options) {
  return preprocessHelper(
    estree_preprocess ? estree_preprocess(ast, options) : ast,
    options
  );
}

function printAst(path, options, print) {
  const node = path.getValue();
  if (!node) {
    return "";
  }

  if (typeof node === "string") {
    return node;
  }

  if (options.debugFoobar) {
    return doc;
  }

  let rhs, body;
  switch (node.type) {
    case "ModuleDeclaration":
      return group([
        group(["module", line, indent(node.id.name), line]),
        path.call(print, "body"),
      ]);

    case "TypedefDeclaration":
      return concat([
        group(["typedef", line, node.id.name]),
        indent(path.call(print, "ts")),
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

    case "Identifier":
      if (node.ts) {
        return group([node.name, path.call(print, "ts")]);
      }
      return node.name;

    case "TypeSpecList":
      if (
        node.ts.length == 2 &&
        node.ts[1].type == "TypeSpecPart" &&
        node.ts[1].name == "Null"
      ) {
        return concat(
          path.map((sub, index) => (index > 0 ? "?" : print(sub)), "ts")
        );
      }
      return group(join([" or", line], path.map(print, "ts")));

    case "ObjectExpression":
      return estree_print(path, options, print);

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
            indent([softline, join([",", line], path.map(print, "generics"))]),
            final_space,
            ">",
          ])
        );
      }
      if (node.callspec) {
        options.semi = false;
        body.unshift("(");
        body.push(
          indent([softline, path.call(print, "callspec")]),
          softline,
          ")"
        );
        options.semi = true;
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

// Table of operators to their precedences in [js, mc]
// Prettier tends to remove parens if it thinks they're
// not needed in js.
const BinaryOpPrecedence = {
  "*": [0, 0],
  "/": [0, 0],
  "%": [0, 0],
  "+": [10, 10],
  "-": [10, 10],
  "<<": [20, 0],
  ">>": [20, 0],
  "<": [30, 30],
  "<=": [30, 30],
  ">": [30, 30],
  ">=": [30, 30],
  instanceof: [30, 5],
  has: [99, 5],
  // Force parens when an "as" is a child of a binary operator
  as: [-1, 99],
  "==": [40, 30],
  "!=": [40, 30],
  "&": [50, 0],
  "^": [60, 10],
  "|": [70, 10],
};

function preprocessHelper(node, parent, options) {
  for (const [key, value] of Object.entries(node)) {
    if (!value) continue;
    if (Array.isArray(value)) {
      value.forEach((obj) => preprocessHelper(obj, null, options));
    } else if (typeof value == "object" && value.type) {
      node[key] = preprocessHelper(value, node, options);
    }
  }

  if (parent && nodeNeedsParens(node, parent)) {
    return {
      type: "ParenthesizedExpression",
      expression: node,
      start: node.start,
      end: node.end,
    };
  }

  return node;
}

function nodeNeedsParens(node, parent) {
  if (parent.type == "BinaryExpression" && parent.operator == "as") {
    if (node == parent.right) return false;
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
      case "UnaryExpression":
      case "ParenthesizedExpression":
        return false;
    }
    return true;
  }

  if (node.type == "BinaryExpression") {
    switch (parent.type) {
      case "BinaryExpression": {
        const nprec = BinaryOpPrecedence[node.operator];
        const pprec = BinaryOpPrecedence[parent.operator];
        if (nprec && pprec) {
          const needsParensInMC =
            pprec[1] < nprec[1] ||
            (node == parent.right && pprec[1] == nprec[1]);
          const needsParensInJS =
            pprec[0] < nprec[0] ||
            (node == parent.right && pprec[0] == nprec[0]);
          if (needsParensInMC && !needsParensInJS) {
            return true;
          }
        }
        break;
      }
      case "MemberExpression":
        return node.operator == "as" && node == parent.object;
      case "NewExpression":
      case "CallExpression":
        return node.operator == "as" && node == parent.callee;
    }
    return false;
  }

  if (node.type == "NewExpression") {
    return parent.type == "MemberExpression";
  }
}
