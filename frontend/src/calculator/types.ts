export type BinaryOperator = "add" | "subtract" | "multiply" | "divide" | "power" | "percentage";

export type OperationName = BinaryOperator | "sqrt";

export type CalculationRequest = {
  operation: OperationName;
  operands: string[];
};

export type Status = "idle" | "typing" | "loading" | "result" | "error";

export type CalculatorError = {
  kind: "validation" | "api";
  message: string;
  retryable: boolean;
};

export type State = {
  status: Status;
  /** The number being typed, as a string ("0" when empty). */
  entry: string;
  /** Whether the entry was typed, which tells a typed "0" from an empty one. */
  entered: boolean;
  /** First operand once a binary operator is chosen. */
  first: string | null;
  /** Selected binary operator, if any. */
  operator: BinaryOperator | null;
  /** Text of the expression line. */
  expression: string;
  /** The request in flight or last sent, kept for Retry. */
  request: CalculationRequest | null;
  /** Operator to select after a chained request succeeds. */
  nextOperator: BinaryOperator | null;
  error: CalculatorError | null;
};

export type Action =
  | { type: "digit"; digit: string }
  | { type: "decimal" }
  | { type: "toggleSign" }
  | { type: "backspace" }
  | { type: "clear" }
  | { type: "operator"; operator: BinaryOperator }
  | { type: "sqrt" }
  | { type: "equals" }
  | { type: "retry" }
  | { type: "resolved"; result: string }
  | { type: "apiError"; code: string }
  | { type: "networkError" };
