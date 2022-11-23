// Type definitions for MonkeyC ESTree-like AST specification

// Find the union of all keys across all components of U
type InclusiveUnionKeys<U> = U extends unknown ? keyof U : never;

// Create a type whose keys are InclusiveUnionKeys<U>, and whose
// corresponding types are the union across all components of U[K]
type InclusiveUnion<U> = {
  [K in InclusiveUnionKeys<U>]: U extends any
    ? K extends keyof U
      ? U[K]
      : never
    : never;
};
type SubfieldsOfType<T, U> = {
  [K in keyof T as T[K] extends U ? K : never]: T[K];
};

export type NodeAll = InclusiveUnion<Node>;
export type NodeSubFields = SubfieldsOfType<NodeAll, Node>;
export type NodeSubArrays = SubfieldsOfType<NodeAll, Node[]>;

interface BaseNode {
  // Every leaf interface that extends BaseNode must specify a type property.
  // The type property should be a string literal. For example, Identifier
  // has: `type: "Identifier"`
  type: string;
  loc?: SourceLocation | null | undefined;
  start?: number;
  end?: number;
  range?: [number, number] | undefined;
}

export type Node =
  | Identifier
  | DottedName
  | ScopedName
  | Literal
  | Program
  | SwitchCase
  | InstanceOfCase
  | CatchClause
  | CatchClauses
  | VariableDeclarator
  | EnumStringBody
  | EnumStringMember
  | Statement
  | Expression
  | Property
  | Declaration
  | ImportStatement
  | AsTypeSpec
  | AttributeList
  | Attributes
  | TypeSpecList
  | TypeSpecPart
  | ClassElement
  | ClassBody
  | MethodDefinition
  | Comment;

export interface Comment extends BaseNode {
  type: "Line" | "Block" | "MultiLine";
  value: string;
}

interface SourceLocation {
  source?: string | null | undefined;
  start: Position;
  end: Position;
}

export interface Position {
  /** >= 1 */
  line: number;
  /** >= 0 */
  column: number;
  /** >= 0 */
  offset: number;
}

export interface Program extends BaseNode {
  type: "Program";
  body: Array<Declaration | ImportStatement>;
  comments?: Array<Comment> | undefined;
}

export interface ModuleDeclaration extends BaseDeclaration {
  type: "ModuleDeclaration";
  body: BlockStatement;
  id: Identifier;
}

interface BaseFunction extends BaseNode {
  params: Array<TypedIdentifier>;
  body: BlockStatement | null;
}

export type Statement =
  | ExpressionStatement
  | BlockStatement
  | ReturnStatement
  | BreakStatement
  | ContinueStatement
  | IfStatement
  | SwitchStatement
  | ThrowStatement
  | TryStatement
  | WhileStatement
  | DoWhileStatement
  | ForStatement
  | Declaration;

interface BaseStatement extends BaseNode {}

export interface BlockStatement extends BaseStatement {
  type: "BlockStatement";
  body: Array<Statement>;
  innerComments?: Array<Comment> | undefined;
}

export interface ExpressionStatement extends BaseStatement {
  type: "ExpressionStatement";
  expression: Expression;
}

export interface IfStatement extends BaseStatement {
  type: "IfStatement";
  test: Expression;
  consequent: Statement;
  alternate?: Statement | null | undefined;
}

export interface BreakStatement extends BaseStatement {
  type: "BreakStatement";
}

export interface ContinueStatement extends BaseStatement {
  type: "ContinueStatement";
}

export interface SwitchStatement extends BaseStatement {
  type: "SwitchStatement";
  discriminant: Expression;
  cases: Array<SwitchCase>;
}

export interface ReturnStatement extends BaseStatement {
  type: "ReturnStatement";
  argument?: Expression | null | undefined;
}

export interface ThrowStatement extends BaseStatement {
  type: "ThrowStatement";
  argument: Expression;
}

export interface TryStatement extends BaseStatement {
  type: "TryStatement";
  block: BlockStatement;
  handler?: CatchClause | CatchClauses | null | undefined;
  finalizer?: BlockStatement | null | undefined;
}

export interface WhileStatement extends BaseStatement {
  type: "WhileStatement";
  test: Expression;
  body: Statement;
}

export interface DoWhileStatement extends BaseStatement {
  type: "DoWhileStatement";
  body: Statement;
  test: Expression;
}

export interface ForStatement extends BaseStatement {
  type: "ForStatement";
  init?: VariableDeclaration | Expression | null | undefined;
  test?: Expression | null | undefined;
  update?: Expression | null | undefined;
  body: Statement;
}

export type Declaration =
  | ClassDeclaration
  | EnumDeclaration
  | FunctionDeclaration
  | ModuleDeclaration
  | TypedefDeclaration
  | VariableDeclaration;

interface BaseDeclaration extends BaseStatement {
  attrs?: AttributeList;
}

export interface FunctionDeclaration extends BaseFunction, BaseDeclaration {
  type: "FunctionDeclaration";
  id: Identifier;
  optimizable?: boolean;
  hasOverride?: boolean;
  returnType?: AsTypeSpec;
}

export interface VariableDeclaration extends BaseDeclaration {
  type: "VariableDeclaration";
  declarations: Array<VariableDeclarator>;
  kind: "var" | "const";
}

export interface VariableDeclarator extends BaseNode {
  type: "VariableDeclarator";
  id: TypedIdentifier;
  init?: Expression | null | undefined;
  kind: "var" | "const";
}

export type Expression =
  | ThisExpression
  | ArrayExpression
  | SizedArrayExpression
  | ObjectExpression
  | Literal
  | UnaryExpression
  | UpdateExpression
  | BinaryExpression
  | AsExpression
  | AsIdentifier
  | InstanceofExpression
  | InstanceofIdentifier
  | AssignmentExpression
  | LogicalExpression
  | MemberExpression
  | ConditionalExpression
  | CallExpression
  | NewExpression
  | SequenceExpression
  | Identifier
  | ParenthesizedExpression;

export interface BaseExpression extends BaseNode {
  // Added by optimizer
  enumType?: string | Node;
}

export interface ThisExpression extends BaseExpression {
  type: "ThisExpression";
  text: string;
}

export interface ArrayExpression extends BaseExpression {
  type: "ArrayExpression";
  elements: Array<Expression>;
  byte?: "b";
}

type SingleTypeSpec = TypeSpecPart | ObjectExpression;

export interface SizedArrayExpression extends BaseExpression {
  type: "SizedArrayExpression";
  size: Expression;
  ts?: SingleTypeSpec;
  byte?: "b";
}

export interface ObjectExpression extends BaseExpression {
  type: "ObjectExpression";
  properties: Array<Property>;
}

export interface Property extends BaseNode {
  type: "Property";
  key: Expression;
  value: Expression;
  kind: "init";
}

export interface SequenceExpression extends BaseExpression {
  type: "SequenceExpression";
  expressions: Array<Expression>;
}

export interface ParenthesizedExpression extends BaseExpression {
  type: "ParenthesizedExpression";
  expression: Expression;
}

interface BaseUnaryExpression extends BaseExpression {
  type: "UnaryExpression";
  prefix: true;
}

interface TrueUnaryExpression extends BaseUnaryExpression {
  operator: UnaryOperator;
  argument: Expression;
}

interface SymbolExpression extends BaseUnaryExpression {
  operator: ":";
  argument: Identifier;
}

export type UnaryExpression = TrueUnaryExpression | SymbolExpression;

export interface BinaryExpression extends BaseExpression {
  type: "BinaryExpression";
  operator: BinaryOperator;
  left: Expression;
  right: Expression;
}

export interface AsExpression extends BaseExpression {
  type: "BinaryExpression";
  operator: "as";
  left: Expression;
  right: TypeSpecList;
}

export interface AsIdentifier extends AsExpression {
  left: Identifier;
}

export interface InstanceofExpression extends BaseExpression {
  type: "BinaryExpression";
  operator: "instanceof";
  left: Expression;
  right: ScopedName;
}

export interface InstanceofIdentifier extends InstanceofExpression {
  type: "BinaryExpression";
  operator: "instanceof";
  left: Identifier;
  right: ScopedName;
}

export interface AssignmentExpression extends BaseExpression {
  type: "AssignmentExpression";
  operator: AssignmentOperator;
  left: Identifier | MemberExpression;
  right: Expression;
}

export interface UpdateExpression extends BaseExpression {
  type: "UpdateExpression";
  operator: UpdateOperator;
  argument: Identifier | MemberExpression;
  prefix: boolean;
}

export interface LogicalExpression extends BaseExpression {
  type: "LogicalExpression";
  operator: LogicalOperator;
  left: Expression;
  right: Expression;
}

export interface ConditionalExpression extends BaseExpression {
  type: "ConditionalExpression";
  test: Expression;
  alternate: Expression;
  consequent: Expression;
}

interface BaseCallExpression extends BaseExpression {
  callee: Expression;
  arguments: Array<Expression>;
}
export type CallExpression = SimpleCallExpression | NewExpression;

export interface SimpleCallExpression extends BaseCallExpression {
  type: "CallExpression";
}

export interface NewExpression extends BaseCallExpression {
  type: "NewExpression";
}

export interface MemberExpression extends BaseExpression {
  type: "MemberExpression";
  object: Expression;
  property: Expression;
  computed: boolean;
}

export interface DottedName extends MemberExpression {
  type: "MemberExpression";
  object: ScopedName;
  property: Identifier;
  computed: false;
}

export type ScopedName = DottedName | Identifier;

export interface SwitchCase extends BaseNode {
  type: "SwitchCase";
  test?: Expression | InstanceOfCase | null | undefined;
  consequent: Array<Statement>;
}

export interface InstanceOfCase extends BaseNode {
  type: "InstanceOfCase";
  id: ScopedName;
}

export interface CatchClause extends BaseNode {
  type: "CatchClause";
  param: Identifier | InstanceofIdentifier | null;
  body: BlockStatement;
}

export interface CatchClauses extends BaseNode {
  type: "CatchClauses";
  catches: CatchClause[];
}

export interface Identifier extends BaseNode, BaseExpression {
  type: "Identifier";
  name: string;
}

export interface Literal extends BaseNode, BaseExpression {
  type: "Literal";
  value: string | boolean | number | bigint | null;
  raw: string;
}

export type UnaryOperator = "-" | "+" | "!" | "~" | " as";

export type BinaryOperator =
  | "=="
  | "!="
  | "<"
  | "<="
  | ">"
  | ">="
  | "<<"
  | ">>"
  | "+"
  | "-"
  | "*"
  | "/"
  | "%"
  | "|"
  | "^"
  | "&"
  | "has";

export type LogicalOperator = "||" | "&&" | "or" | "and";

export type AssignmentOperator =
  | "="
  | "+="
  | "-="
  | "*="
  | "/="
  | "%="
  | "<<="
  | ">>="
  | "|="
  | "^="
  | "&=";

export type UpdateOperator = "++" | "--";

export interface ClassDeclaration extends BaseDeclaration {
  type: "ClassDeclaration";
  id: Identifier;
  superClass?: ScopedName | null | undefined;
  body: ClassBody;
}

export interface ClassBody extends BaseStatement {
  type: "ClassBody";
  body: Array<ClassElement>;
}

export interface ClassElement extends BaseStatement {
  type: "ClassElement";
  item: Exclude<Declaration, ModuleDeclaration>;
}

export interface EnumDeclaration extends BaseDeclaration {
  type: "EnumDeclaration";
  id?: Identifier | null;
  body: EnumStringBody;
}

export interface EnumStringBody extends BaseNode {
  type: "EnumStringBody";
  members: Array<EnumStringMember | Identifier>;
  // Added by optimizer
  enumType?: string;
}

export interface EnumStringMember extends BaseNode {
  type: "EnumStringMember";
  id: Identifier;
  init: Expression;
  // Added by optimizer
  enumType?: string;
}

export interface TypedefDeclaration extends BaseDeclaration {
  type: "TypedefDeclaration";
  id: Identifier;
  ts: AsTypeSpec;
}

export interface AsTypeSpec
  extends Omit<UnaryExpression, "operator" | "argument"> {
  operator: " as";
  argument: TypeSpecList;
}

export interface TypeSpecList extends BaseNode {
  type: "TypeSpecList";
  ts: Array<SingleTypeSpec>;
}

export interface TypeSpecPart extends BaseNode {
  type: "TypeSpecPart";
  name: ScopedName | string;
  body?: BlockStatement;
  callspec?: MethodDefinition;
  generics?: Array<TypeSpecList>;
}

export type TypedIdentifier = Identifier | AsIdentifier;

export interface MethodDefinition extends BaseNode {
  type: "MethodDefinition";
  kind: "method";
  key: "";
  params: Array<TypedIdentifier>;
  returnType: AsTypeSpec;
}

export type AccessSpecifier =
  | "static"
  | "private"
  | "protected"
  | "hidden"
  | "public";

export interface Attributes extends BaseNode {
  type: "Attributes";
  elements: Attribute[];
}

export interface AttributeList extends BaseNode {
  type: "AttributeList";
  attributes?: Attributes;
  access?: AccessSpecifier[];
}

type Attribute = SymbolExpression | CallExpression;

export type ImportStatement = ImportModule | Using;

export interface ImportModule extends BaseNode {
  type: "ImportModule";
  id: ScopedName;
}

export interface Using extends BaseNode {
  type: "Using";
  id: ScopedName;
  as: Identifier;
}
