import * as Prettier from "prettier";
import {
  BlockStatement as ESTreeBlockStatement,
  Statement as ESTreeStatement,
  Node as ESTreeNode,
  AttributeList,
} from "./estree-types";
const { doc } = Prettier;

// Commands to build the prettier syntax tree
const {
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

export const LiteralIntegerRe = /^(0x[0-9a-f]+|\d+)(l)?$/i;

type AstPath<T = any> = Prettier.AstPath<T>;
type ParserOptions = Prettier.ParserOptions<ESTreeNode>;

interface Printer<T> extends Prettier.Printer<T> {
  preprocess: (node: T, options: Prettier.ParserOptions<T>) => T;
}

let estree_print: Printer<ESTreeNode>["print"],
  estree_preprocess: Printer<ESTreeNode>["preprocess"];

// We set this as the parser's preprocess function. That lets
// us grab the estree printer early on, and munge our printer,
// before any printing starts
export default function printerIntialize(text: string, options: ParserOptions) {
  if (!estree_print) {
    const find = (name: string) => {
      const finder = (p: Prettier.Plugin | string | undefined) =>
        p && typeof p !== "string" && p.printers?.[name];
      const result = finder(options.plugins?.find(finder));
      if (!result) throw new Error("Prettier setup failure!");
      return result as Printer<ESTreeNode>;
    };
    let rest;
    ({
      print: estree_print,
      preprocess: estree_preprocess,
      ...rest
    } = find("estree"));
    Object.assign(find("monkeyc"), rest, {
      print: printAst,
      preprocess: preprocessAst,
    });
  }
  return text;
}

function preprocessAst(ast: ESTreeNode, options: ParserOptions) {
  return preprocessHelper(
    estree_preprocess ? estree_preprocess(ast, options) : ast,
    null,
    options
  );
}

function printAttributeList(
  path: AstPath<AttributeList | undefined>,
  options: ParserOptions,
  print: (path: AstPath<ESTreeNode | string>) => Prettier.Doc,
  body: Prettier.Doc
) {
  const node = path.getValue();
  if (!node) return [];
  if (node.access) {
    const access = path
      .map(print, "access")
      .sort()
      .filter((item, index, arr) => !index || item != arr[index - 1]);
    access.push(body);
    body = join(" ", access);
  }
  if (!node.attrs) return body;
  return [
    group([
      "(",
      indent([
        softline,
        group(join([",", softline], path.map(print, "attrs"))),
      ]),
      softline,
      ")",
    ]),
    hardline,
    body,
  ];
}

function printAst(
  path: AstPath<ESTreeNode>,
  options: ParserOptions,
  print: (path: AstPath<ESTreeNode | string | null | undefined>) => Prettier.Doc
) {
  const node = path.getValue();
  if (!node) {
    return "";
  }

  if (typeof node === "string") {
    return node;
  }

  const typedPath = <T extends ESTreeNode>(node: T) => path as AstPath<T>;

  switch (node.type) {
    case "Program": {
      const { semi, trailingComma } = options;
      options.semi = true;
      if (options.trailingComma == "all") {
        options.trailingComma = "es5";
      }
      const body = estree_print(path, options, print);
      options.semi = semi;
      options.trailingComma = trailingComma;
      return body;
    }
    case "ModuleDeclaration": {
      let body: Prettier.Doc = group([
        group(["module", line, indent(node.id.name), line]),
        typedPath(node).call(print, "body"),
      ]);
      if (node.attrs) {
        body = typedPath(node).call(
          (p) => printAttributeList(p, options, print, body),
          "attrs"
        );
      }
      return body;
    }

    case "TypedefDeclaration":
      return [
        group(["typedef", line, node.id.name]),
        indent(typedPath(node).call(print, "ts")),
        ";",
      ];

    case "Property": {
      return group([
        group([path.call(print, "key"), line, "=>", line]),
        typedPath(node).call(print, "value"),
      ]);
    }

    case "ImportModule":
      return group(["import", line, path.call(print, "id"), ";"]);

    case "Using": {
      const body = ["using", line, path.call(print, "id")];
      if (node.as != null) {
        body.push(line, "as", line, node.as.name);
      }
      body.push(";");
      return group(body);
    }

    case "Identifier":
      return node.name;

    case "TypeSpecList": {
      const body = path.map(print, "ts");
      if (body.length == 2 && body[1] == "Null") {
        body[1] = "?";
        return body;
      }
      return group(join([" or", line], body));
    }

    case "ObjectExpression":
      return estree_print(path, options, print);

    case "TypeSpecPart": {
      const body = [node.name ? path.call(print, "name") : ""];

      if (node.body) {
        body.push(" ", dedent(typedPath(node).call(print, "body")));
      }
      if (node.generics) {
        // Add a space between the trailing >> in Array<Array<Number>>,
        // because the monkeyc parser can't handle that.
        const final_space =
          "generics" in node.generics.slice(-1)[0].ts.slice(-1)[0]
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
      return body.length == 1 ? body[0] : body;
    }

    case "ArrayExpression":
      return [estree_print(path, options, print), node.byte || ""];

    case "SizedArrayExpression":
      return group([
        "new ",
        node.ts
          ? [
              typedPath(node).call(print, "ts"),
              /*
               * if the typespec has a generic, don't leave
               * a space.
               *
               * So:
               *   new Foo [ size ];
               * but
               *   new Array<Number>[ size ]
               */
              "generics" in node.ts ? "" : " ",
            ]
          : "",
        "[",
        indent(path.call(print, "size")),
        "]",
        node.byte || "",
      ]);

    case "VariableDeclaration":
    case "FunctionDeclaration":
    case "ClassDeclaration": {
      let body = estree_print(path, options, print);
      if (node.attrs) {
        body = typedPath(node).call(
          (p) => printAttributeList(p, options, print, body),
          "attrs"
        );
      }
      return body;
    }

    case "EnumDeclaration": {
      let body: Prettier.Doc = ["enum"];
      if (node.id) {
        body.push(path.call(print, "id"));
      }
      body = join(" ", body);
      if (node.attrs) {
        body = typedPath(node).call(
          (p) => printAttributeList(p, options, print, body),
          "attrs"
        );
      }
      return [body, " ", typedPath(node).call(print, "body")];
    }

    case "AttributeList":
      return printAttributeList(
        path as AstPath<typeof node>,
        options,
        print,
        ""
      );

    case "ClassElement":
      return path.call(print, "item");

    case "CatchClauses":
      return join(" ", path.map(print, "catches"));

    case "ThisExpression":
      return node.text;

    case "InstanceOfCase":
      return ["instanceof ", path.call(print, "id")];

    case "Literal":
      if (typeof node.value === "string") {
        return node.raw;
      } else if (
        typeof node.value === "number" &&
        node.value === Math.floor(node.value)
      ) {
        if (node.raw && !LiteralIntegerRe.test(node.raw)) {
          const result = doc.printer.printDocToString(
            estree_print(path, options, print),
            options
          ).formatted;
          return LiteralIntegerRe.test(result)
            ? // we started with an integer valued float or double
              // but ended with an integer. Add a suffix.
              `${result}${node.raw.endsWith("d") ? "d" : "f"}`
            : result;
        } else if (
          (node.value > 0xffffffff || -node.value > 0xffffffff) &&
          !/l$/i.test(node.raw || "")
        ) {
          return (node.raw || node.value.toString()).toLowerCase() + "l";
        }
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

function wrapBody(node: ESTreeStatement): ESTreeBlockStatement {
  if (node.type == "BlockStatement") return node;
  const wrapped = {
    type: "BlockStatement",
    body: [node],
  } as ESTreeBlockStatement;
  if (node.start != null) wrapped.start = node.start;
  if (node.end != null) wrapped.end = node.end;
  if (node.loc != null) wrapped.loc = node.loc;
  return wrapped;
}

function preprocessHelper<T extends ESTreeNode>(
  node: T,
  parent: ESTreeNode | null,
  options: ParserOptions
) {
  for (const [key, value] of Object.entries(node)) {
    if (!value) continue;
    if (Array.isArray(value)) {
      value.forEach((obj) => preprocessHelper(obj, null, options));
    } else if (typeof value == "object" && value.type) {
      node[key as keyof T] = preprocessHelper(value, node, options);
    }
  }

  switch (node.type) {
    case "IfStatement":
      node.consequent = wrapBody(node.consequent);
      if (node.alternate && node.alternate.type != "IfStatement") {
        node.alternate = wrapBody(node.alternate);
      }
      break;
    case "WhileStatement":
    case "DoWhileStatement":
    case "ForStatement":
      node.body = wrapBody(node.body);
      break;
  }

  if (parent && nodeNeedsParens(node, parent)) {
    return {
      type: "ParenthesizedExpression",
      expression: node,
      start: node.start,
      end: node.end,
      loc: node.loc,
    };
  }

  return node;
}

function nodeNeedsParens(node: ESTreeNode, parent: ESTreeNode): boolean {
  if (parent.type == "BinaryExpression" && parent.operator == "as") {
    if (node == parent.right) return false;
    switch (node.type) {
      // pretty much everything except primary, call, new, member
      case "ThisExpression":
      case "Identifier":
      case "SizedArrayExpression":
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

  return false;
}