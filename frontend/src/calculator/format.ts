import type { BinaryOperator, CalculationRequest } from "./types";

const MINUS_SIGN = "−";

const API_ERROR_MESSAGES: Record<string, string> = {
  DIVISION_BY_ZERO: "Can't divide by zero.",
  NEGATIVE_SQRT: "Can't take the square root of a negative number.",
  UNSUPPORTED_EXPONENT: "Exponent must be a whole number between −1000 and 1000.",
  OPERAND_TOO_LONG: "That number is too long.",
};

/** Renders a number for the display: the ASCII hyphen becomes a minus sign. */
export function formatNumber(value: string): string {
  return value.replace("-", MINUS_SIGN);
}

function binaryExpression(operator: BinaryOperator, first: string, second: string): string {
  switch (operator) {
    case "add":
      return `${first} + ${second}`;
    case "subtract":
      return `${first} ${MINUS_SIGN} ${second}`;
    case "multiply":
      return `${first} × ${second}`;
    case "divide":
      return `${first} ÷ ${second}`;
    case "power":
      return `${first} ^ ${second}`;
    case "percentage":
      return `${first}% of ${second}`;
  }
}

/** Expression line while the second operand is pending, e.g. "12 ×". */
export function pendingExpression(first: string, operator: BinaryOperator): string {
  return binaryExpression(operator, formatNumber(first), "").trimEnd();
}

/** Expression line once a request is sent, e.g. "12 × 4 =" or "√(9) =". */
export function requestExpression(request: CalculationRequest): string {
  const [first = "", second = ""] = request.operands.map(formatNumber);
  if (request.operation === "sqrt") {
    return `√(${first}) =`;
  }
  return `${binaryExpression(request.operation, first, second)} =`;
}

/** Drops the trailing "." an entry may have before it is sent. */
export function normalizeEntry(entry: string): string {
  return entry.endsWith(".") ? entry.slice(0, -1) : entry;
}

export function binaryRequest(operator: BinaryOperator, first: string, entry: string): CalculationRequest {
  return { operation: operator, operands: [first, normalizeEntry(entry)] };
}

export function sqrtRequest(entry: string): CalculationRequest {
  return { operation: "sqrt", operands: [normalizeEntry(entry)] };
}

/** Banner copy for an API error code. */
export function apiErrorMessage(code: string): string {
  return API_ERROR_MESSAGES[code] ?? "Something went wrong. Try again.";
}
