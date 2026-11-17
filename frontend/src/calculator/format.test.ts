import { describe, expect, it } from "vitest";

import {
  apiErrorMessage,
  binaryRequest,
  formatNumber,
  normalizeEntry,
  pendingExpression,
  requestExpression,
  sqrtRequest,
} from "./format";
import type { BinaryOperator, CalculationRequest } from "./types";

describe("formatNumber", () => {
  it.each([
    ["12", "12"],
    ["0", "0"],
    ["0.", "0."],
    ["1.5", "1.5"],
    ["-12", "−12"],
    ["-0.5", "−0.5"],
  ])("renders %s as %s", (value, expected) => {
    expect(formatNumber(value)).toBe(expected);
  });
});

describe("pendingExpression", () => {
  it.each<[BinaryOperator, string]>([
    ["add", "12 +"],
    ["subtract", "12 −"],
    ["multiply", "12 ×"],
    ["divide", "12 ÷"],
    ["power", "12 ^"],
    ["percentage", "12% of"],
  ])("F-09 %s shows %s", (operator, expected) => {
    expect(pendingExpression("12", operator)).toBe(expected);
  });

  it("renders a negative first operand with a minus sign", () => {
    expect(pendingExpression("-12", "add")).toBe("−12 +");
  });
});

describe("requestExpression", () => {
  it.each<[CalculationRequest, string]>([
    [{ operation: "add", operands: ["12", "4"] }, "12 + 4 ="],
    [{ operation: "subtract", operands: ["12", "4"] }, "12 − 4 ="],
    [{ operation: "multiply", operands: ["12", "4"] }, "12 × 4 ="],
    [{ operation: "divide", operands: ["12", "4"] }, "12 ÷ 4 ="],
    [{ operation: "power", operands: ["12", "4"] }, "12 ^ 4 ="],
    [{ operation: "percentage", operands: ["15", "200"] }, "15% of 200 ="],
    [{ operation: "sqrt", operands: ["9"] }, "√(9) ="],
  ])("F-12/F-13 formats %o as %s", (request, expected) => {
    expect(requestExpression(request)).toBe(expected);
  });

  it("renders negative operands with a minus sign", () => {
    expect(requestExpression({ operation: "subtract", operands: ["-12", "-4"] })).toBe(
      "−12 − −4 =",
    );
    expect(requestExpression({ operation: "sqrt", operands: ["-9"] })).toBe("√(−9) =");
  });
});

describe("normalizeEntry", () => {
  it.each([
    ["12.", "12"],
    ["0.", "0"],
    ["-7.", "-7"],
    ["12", "12"],
    ["1.5", "1.5"],
    ["-1.5", "-1.5"],
  ])("turns %s into %s", (entry, expected) => {
    expect(normalizeEntry(entry)).toBe(expected);
  });
});

describe("binaryRequest", () => {
  it.each<BinaryOperator>(["add", "subtract", "multiply", "divide", "power", "percentage"])(
    "F-12 %s sends its own operation name with [first, second]",
    (operator) => {
      expect(binaryRequest(operator, "12", "4")).toEqual({
        operation: operator,
        operands: ["12", "4"],
      });
    },
  );

  it("keeps the ASCII minus in operands", () => {
    expect(binaryRequest("add", "-12", "-4").operands).toEqual(["-12", "-4"]);
  });
});

describe("sqrtRequest", () => {
  it("F-13 sends sqrt with one operand", () => {
    expect(sqrtRequest("9")).toEqual({ operation: "sqrt", operands: ["9"] });
  });
});

describe("apiErrorMessage", () => {
  it.each([
    ["DIVISION_BY_ZERO", "Can't divide by zero."],
    ["NEGATIVE_SQRT", "Can't take the square root of a negative number."],
    ["UNSUPPORTED_EXPONENT", "Exponent must be a whole number between −1000 and 1000."],
    ["OPERAND_TOO_LONG", "That number is too long."],
    ["INTERNAL", "Something went wrong. Try again."],
    ["INVALID_OPERAND", "Something went wrong. Try again."],
    ["", "Something went wrong. Try again."],
  ])("F-24 maps %s to its banner message", (code, expected) => {
    expect(apiErrorMessage(code)).toBe(expected);
  });
});
