type Node = unknown; //Record<string, unknown> & { type: string };

type Parser = {
  parse: (str: string, options: { grammarSource?: string }) => Node;
  astFormat: string;
  locStart: (node: Node) => number;
  locEnd: (node: Node) => number;
  preprocess: (text: string, options: unknown) => string;
};

declare const parser: {
  parsers: {
    monkeyc: Parser;
    "monkeyc-json": Parser;
  };
};

export = parser;
