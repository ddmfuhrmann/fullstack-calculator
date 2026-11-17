import { describe, expect, it } from "vitest";

import { formatNumber } from "./format";
import { initialState, reducer } from "./reducer";
import type { Action, BinaryOperator, State } from "./types";

function press(...actions: Action[]): State {
  return actions.reduce(reducer, initialState);
}

function type(text: string): Action[] {
  return [...text].map((char) =>
    char === "." ? { type: "decimal" } : { type: "digit", digit: char },
  );
}

function op(operator: BinaryOperator): Action {
  return { type: "operator", operator };
}

const sign: Action = { type: "toggleSign" };
const backspace: Action = { type: "backspace" };
const clear: Action = { type: "clear" };
const sqrt: Action = { type: "sqrt" };
const equals: Action = { type: "equals" };
const retry: Action = { type: "retry" };
const networkError: Action = { type: "networkError" };

function resolved(result: string): Action {
  return { type: "resolved", result };
}

function apiError(code: string): Action {
  return { type: "apiError", code };
}

function shown(state: State): string {
  return formatNumber(state.entry);
}

const binaryOperators: {
  operator: BinaryOperator;
  pending: string;
  sent: string;
}[] = [
  { operator: "add", pending: "12 +", sent: "12 + 4 =" },
  { operator: "subtract", pending: "12 −", sent: "12 − 4 =" },
  { operator: "multiply", pending: "12 ×", sent: "12 × 4 =" },
  { operator: "divide", pending: "12 ÷", sent: "12 ÷ 4 =" },
  { operator: "power", pending: "12 ^", sent: "12 ^ 4 =" },
  { operator: "percentage", pending: "12% of", sent: "12% of 4 =" },
];

const pendingMultiply = [...type("12"), op("multiply")];
const twelveTimesFour = [...pendingMultiply, ...type("4")];
const resultOf48 = [...twelveTimesFour, equals, resolved("48")];
const chainPending = [...type("12"), op("add"), ...type("3"), op("multiply")];
const divideByZeroPending = [...type("12"), op("divide"), ...type("0"), equals];

describe("entering numbers", () => {
  it("F-01 starts idle with an empty expression, a 0 entry, no banner and keys enabled", () => {
    expect(initialState.status).toBe("idle");
    expect(initialState.expression).toBe("");
    expect(shown(initialState)).toBe("0");
    expect(initialState.error).toBeNull();
    expect(initialState.operator).toBeNull();
    expect(initialState.first).toBeNull();
    expect(initialState.request).toBeNull();
    expect(initialState.nextOperator).toBeNull();
  });

  it("F-02 first digit moves idle to typing and shows the digit", () => {
    const state = press(...type("7"));
    expect(state.status).toBe("typing");
    expect(shown(state)).toBe("7");
  });

  it("F-03 appends more digits", () => {
    expect(shown(press(...type("75")))).toBe("75");
  });

  it("F-03 keeps a single 0 when 0 is pressed on 0", () => {
    expect(shown(press(...type("0")))).toBe("0");
    expect(shown(press(...type("00")))).toBe("0");
  });

  it("F-03 replaces a 0 with the pressed digit", () => {
    expect(shown(press(...type("05")))).toBe("5");
  });

  it("F-04 decimal point from idle shows 0.", () => {
    expect(shown(press(...type(".")))).toBe("0.");
  });

  it("F-04 ignores a second decimal point", () => {
    const before = press(...type("1.5"));
    expect(shown(before)).toBe("1.5");
    expect(reducer(before, { type: "decimal" })).toEqual(before);
  });

  it("F-05 accepts the 16th digit", () => {
    expect(shown(press(...type("1234567890123456")))).toBe("1234567890123456");
  });

  it("F-05 ignores a digit when the entry has 16 digits", () => {
    const before = press(...type("1234567890123456"));
    expect(reducer(before, { type: "digit", digit: "7" })).toEqual(before);
  });

  it("F-05 counts digits, not the decimal point", () => {
    const before = press(...type("1234567.123456789"));
    expect(shown(before)).toBe("1234567.123456789");
    expect(reducer(before, { type: "digit", digit: "7" })).toEqual(before);
  });

  it("F-06 toggles the sign of the entry and back", () => {
    const negative = press(...type("12"), sign);
    expect(negative.entry).toBe("-12");
    expect(shown(negative)).toBe("−12");
    expect(shown(reducer(negative, sign))).toBe("12");
  });

  it("F-06 does nothing on 0", () => {
    expect(press(sign)).toEqual(initialState);
    const typedZero = press(...type("0"));
    expect(reducer(typedZero, sign)).toEqual(typedZero);
  });

  it("F-07 removes the last digit", () => {
    expect(shown(press(...type("123"), backspace))).toBe("12");
  });

  it("F-07 a single digit becomes 0", () => {
    expect(shown(press(...type("7"), backspace))).toBe("0");
  });

  it("F-07 a negative single digit becomes 0", () => {
    const state = press(...type("7"), sign, backspace);
    expect(state.entry).toBe("0");
  });

  it.each([
    { keys: "0.5", shown: "0." },
    { keys: "0.05", shown: "0.0" },
    { keys: "0.50", shown: "−0.5" },
  ])("F-07 a negative entry backspaced to zero loses its sign: $keys", ({ keys, shown: expected }) => {
    expect(shown(press(...type(keys), sign, backspace))).toBe(expected);
  });

  it("F-07 a negative zero is never sent as an operand", () => {
    const state = press(...type("5"), op("add"), ...type("0.5"), sign, backspace, equals);
    expect(state.request).toEqual({ operation: "add", operands: ["5", "0"] });
    expect(state.expression).toBe("5 + 0 =");
  });

  it("F-07 does nothing in idle", () => {
    expect(press(backspace)).toEqual(initialState);
  });

  it("F-07 does nothing in the result state", () => {
    const before = press(...resultOf48);
    expect(reducer(before, backspace)).toEqual(before);
  });

  it.each<[string, Action[]]>([
    ["typing", type("12")],
    ["a pending operator", pendingMultiply],
    ["a second operand", twelveTimesFour],
    ["a result", resultOf48],
    ["a validation error", [...pendingMultiply, equals]],
    ["an API error", [...divideByZeroPending, apiError("DIVISION_BY_ZERO")]],
    ["a network error", [...twelveTimesFour, equals, networkError]],
  ])("F-08 AC from %s goes back to idle", (_name, actions) => {
    expect(press(...actions, clear)).toEqual(initialState);
  });
});

describe("choosing an operation", () => {
  it.each(binaryOperators)(
    "F-09 $operator after 12 shows '$pending', a 0 entry and the operator selected",
    ({ operator, pending }) => {
      const state = press(...type("12"), op(operator));
      expect(state.status).toBe("typing");
      expect(state.expression).toBe(pending);
      expect(shown(state)).toBe("0");
      expect(state.operator).toBe(operator);
      expect(state.first).toBe("12");
      expect(state.error).toBeNull();
    },
  );

  it("F-10 changes the operator while there is no second operand", () => {
    const state = press(...pendingMultiply, op("add"));
    expect(state.expression).toBe("12 +");
    expect(state.operator).toBe("add");
    expect(state.first).toBe("12");
    expect(state.status).not.toBe("loading");
  });

  it("F-11 typing the second operand keeps the expression", () => {
    const state = press(...twelveTimesFour);
    expect(state.expression).toBe("12 ×");
    expect(shown(state)).toBe("4");
    expect(state.operator).toBe("multiply");
  });

  it.each(binaryOperators)(
    "F-12 equals with $operator sends its operation with [first, second]",
    ({ operator, sent }) => {
      const state = press(...type("12"), op(operator), ...type("4"), equals);
      expect(state.status).toBe("loading");
      expect(state.expression).toBe(sent);
      expect(state.request).toEqual({ operation: operator, operands: ["12", "4"] });
      expect(state.error).toBeNull();
    },
  );

  it("F-12 sends a typed 0 as the second operand", () => {
    const state = press(...divideByZeroPending);
    expect(state.status).toBe("loading");
    expect(state.expression).toBe("12 ÷ 0 =");
    expect(state.request).toEqual({ operation: "divide", operands: ["12", "0"] });
  });

  it("F-12 drops a trailing decimal point before sending", () => {
    const state = press(...type("12."), op("multiply"), ...type("4."), equals);
    expect(state.status).toBe("loading");
    expect(state.expression).toBe("12 × 4 =");
    expect(state.request).toEqual({ operation: "multiply", operands: ["12", "4"] });
  });

  it("F-12 sends raw negative operands and shows them with a minus sign", () => {
    const state = press(...type("12"), sign, op("subtract"), ...type("4"), sign, equals);
    expect(state.request).toEqual({ operation: "subtract", operands: ["-12", "-4"] });
    expect(state.expression).toBe("−12 − −4 =");
  });

  it("F-13 square root of a typed number sends sqrt", () => {
    const state = press(...type("9"), sqrt);
    expect(state.status).toBe("loading");
    expect(state.expression).toBe("√(9) =");
    expect(state.request).toEqual({ operation: "sqrt", operands: ["9"] });
  });

  it("F-13 square root from idle sends 0", () => {
    const state = press(sqrt);
    expect(state.status).toBe("loading");
    expect(state.request).toEqual({ operation: "sqrt", operands: ["0"] });
  });

  it.each<[string, Action[]]>([
    ["12 ×", pendingMultiply],
    ["12 × 4", twelveTimesFour],
  ])("F-14 square root with %s pending shows a validation banner and sends nothing", (_name, actions) => {
    const state = press(...actions, sqrt);
    expect(state.status).toBe("error");
    expect(state.request).toBeNull();
    expect(state.error).toEqual({
      kind: "validation",
      message: "Finish the current operation first.",
      retryable: false,
    });
  });

  it("F-15 equals without a second operand shows a validation banner and sends nothing", () => {
    const state = press(...pendingMultiply, equals);
    expect(state.status).toBe("error");
    expect(state.request).toBeNull();
    expect(state.error).toEqual({
      kind: "validation",
      message: "Enter a second number.",
      retryable: false,
    });
    expect(state.expression).toBe("12 ×");
    expect(shown(state)).toBe("0");
    expect(state.operator).toBe("multiply");
  });

  it("F-16 equals does nothing in idle", () => {
    expect(press(equals)).toEqual(initialState);
  });

  it("F-16 equals does nothing while typing with no operator", () => {
    const before = press(...type("12"));
    expect(reducer(before, equals)).toEqual(before);
  });

  it("F-16 equals does nothing in the result state", () => {
    const before = press(...resultOf48);
    expect(reducer(before, equals)).toEqual(before);
  });

  it("F-17 an operator after a full expression sends the pending operation", () => {
    const state = press(...chainPending);
    expect(state.status).toBe("loading");
    expect(state.expression).toBe("12 + 3 =");
    expect(state.request).toEqual({ operation: "add", operands: ["12", "3"] });
    expect(state.nextOperator).toBe("multiply");
  });

  it("F-17 the chained result becomes the first operand with the new operator selected", () => {
    const state = press(...chainPending, resolved("15"));
    expect(state.status).toBe("typing");
    expect(state.expression).toBe("15 ×");
    expect(shown(state)).toBe("0");
    expect(state.operator).toBe("multiply");
    expect(state.first).toBe("15");
    expect(state.nextOperator).toBeNull();
    expect(state.error).toBeNull();
  });

  it("F-17 the chained result is used as the first operand of the next request", () => {
    const state = press(...chainPending, resolved("15"), ...type("2"), equals);
    expect(state.status).toBe("loading");
    expect(state.expression).toBe("15 × 2 =");
    expect(state.request).toEqual({ operation: "multiply", operands: ["15", "2"] });
  });
});

describe("result", () => {
  it("F-20 a successful answer shows the result with no operator selected", () => {
    const state = press(...resultOf48);
    expect(state.status).toBe("result");
    expect(state.expression).toBe("12 × 4 =");
    expect(shown(state)).toBe("48");
    expect(state.operator).toBeNull();
    expect(state.nextOperator).toBeNull();
    expect(state.error).toBeNull();
  });

  it("F-20 a negative result is shown with a minus sign", () => {
    const state = press(...type("3"), op("subtract"), ...type("5"), equals, resolved("-2"));
    expect(state.status).toBe("result");
    expect(shown(state)).toBe("−2");
  });

  it("F-21 a digit after a result starts a new entry", () => {
    const state = press(...resultOf48, ...type("7"));
    expect(state.status).toBe("typing");
    expect(state.expression).toBe("");
    expect(shown(state)).toBe("7");
    expect(state.operator).toBeNull();
  });

  it("F-22 an operator after a result uses the result as the first operand", () => {
    const state = press(...resultOf48, op("subtract"));
    expect(state.expression).toBe("48 −");
    expect(state.operator).toBe("subtract");
    expect(state.first).toBe("48");
    expect(state.status).not.toBe("loading");
  });

  it("F-22 square root after a result sends the result", () => {
    const state = press(...resultOf48, sqrt);
    expect(state.status).toBe("loading");
    expect(state.expression).toBe("√(48) =");
    expect(state.request).toEqual({ operation: "sqrt", operands: ["48"] });
  });
});

describe("errors", () => {
  it.each<[string, Action[], string, string, string]>([
    ["DIVISION_BY_ZERO", divideByZeroPending, "12 ÷ 0 =", "0", "Can't divide by zero."],
    [
      "NEGATIVE_SQRT",
      [...type("9"), sign, sqrt],
      "√(−9) =",
      "−9",
      "Can't take the square root of a negative number.",
    ],
    [
      "UNSUPPORTED_EXPONENT",
      [...type("2"), op("power"), ...type("0.5"), equals],
      "2 ^ 0.5 =",
      "0.5",
      "Exponent must be a whole number between −1000 and 1000.",
    ],
    ["OPERAND_TOO_LONG", twelveTimesFour.concat(equals), "12 × 4 =", "4", "That number is too long."],
    ["INTERNAL", twelveTimesFour.concat(equals), "12 × 4 =", "4", "Something went wrong. Try again."],
    ["INVALID_JSON", twelveTimesFour.concat(equals), "12 × 4 =", "4", "Something went wrong. Try again."],
  ])(
    "F-24 API error %s shows its banner with no Retry, the expression and the last entry",
    (code, actions, expression, entry, message) => {
      const state = press(...actions, apiError(code));
      expect(state.status).toBe("error");
      expect(state.error).toEqual({ kind: "api", message, retryable: false });
      expect(state.expression).toBe(expression);
      expect(shown(state)).toBe(entry);
    },
  );

  it("F-25 a network error shows a retryable banner", () => {
    const state = press(...twelveTimesFour, equals, networkError);
    expect(state.status).toBe("error");
    expect(state.error).toEqual({
      kind: "api",
      message: "Couldn't reach the server.",
      retryable: true,
    });
    expect(state.request).toEqual({ operation: "multiply", operands: ["12", "4"] });
  });

  it("F-26 retry sends the same request again", () => {
    const state = press(...twelveTimesFour, equals, networkError, retry);
    expect(state.status).toBe("loading");
    expect(state.error).toBeNull();
    expect(state.expression).toBe("12 × 4 =");
    expect(state.request).toEqual({ operation: "multiply", operands: ["12", "4"] });
  });

  it("F-26 retry then success gives the result", () => {
    const state = press(...twelveTimesFour, equals, networkError, retry, resolved("48"));
    expect(state.status).toBe("result");
    expect(shown(state)).toBe("48");
  });

  it("F-26 retry keeps a chained operator", () => {
    const retried = press(...chainPending, networkError, retry);
    expect(retried.status).toBe("loading");
    expect(retried.request).toEqual({ operation: "add", operands: ["12", "3"] });
    expect(retried.nextOperator).toBe("multiply");

    const state = reducer(retried, resolved("15"));
    expect(state.status).toBe("typing");
    expect(state.expression).toBe("15 ×");
    expect(state.operator).toBe("multiply");
  });

  it("F-27 an API error during chaining drops the chained operator", () => {
    const state = press(
      ...type("12"),
      op("divide"),
      ...type("0"),
      op("multiply"),
      apiError("DIVISION_BY_ZERO"),
    );
    expect(state.status).toBe("error");
    expect(state.error).toEqual({
      kind: "api",
      message: "Can't divide by zero.",
      retryable: false,
    });
    expect(state.expression).toBe("12 ÷ 0 =");
    expect(shown(state)).toBe("0");
    expect(state.nextOperator).toBeNull();
  });

  it("F-28 a digit after a validation error clears the banner and keeps the pending operation", () => {
    const state = press(...pendingMultiply, equals, ...type("4"));
    expect(state.error).toBeNull();
    expect(state.status).toBe("typing");
    expect(state.expression).toBe("12 ×");
    expect(shown(state)).toBe("4");
    expect(state.operator).toBe("multiply");
    expect(state.first).toBe("12");

    const sent = reducer(state, equals);
    expect(sent.status).toBe("loading");
    expect(sent.expression).toBe("12 × 4 =");
    expect(sent.request).toEqual({ operation: "multiply", operands: ["12", "4"] });
  });

  it("F-28 equals after the square root validation error sends the pending operation", () => {
    const state = press(...twelveTimesFour, sqrt, equals);
    expect(state.error).toBeNull();
    expect(state.status).toBe("loading");
    expect(state.expression).toBe("12 × 4 =");
    expect(state.request).toEqual({ operation: "multiply", operands: ["12", "4"] });
  });

  it("F-28 an operator after a validation error changes the pending operator", () => {
    const state = press(...pendingMultiply, equals, op("add"));
    expect(state.error).toBeNull();
    expect(state.expression).toBe("12 +");
    expect(state.operator).toBe("add");
  });

  const failures: [string, Action[]][] = [
    ["an API error", [...divideByZeroPending, apiError("DIVISION_BY_ZERO")]],
    ["a network error", [...twelveTimesFour, equals, networkError]],
  ];
  const keys: [string, Action][] = [
    ["a digit", { type: "digit", digit: "7" }],
    ["the decimal point", { type: "decimal" }],
    ["an operator", op("add")],
    ["square root", sqrt],
    ["equals", equals],
    ["backspace", backspace],
    ["toggle sign", sign],
  ];

  describe.each(failures)("after %s", (_failure, actions) => {
    it.each(keys)("F-28 %s clears the banner and applies as if from idle", (_key, key) => {
      const state = press(...actions, key);
      expect(state.error).toBeNull();
      expect(state).toEqual(press(key));
    });
  });

  it.each([resolved("1"), apiError("INTERNAL"), networkError])(
    "F-24/F-25 a request outcome outside loading is ignored: $type",
    (outcome) => {
      const validation = press(...type("12"), op("multiply"), equals);
      expect(reducer(validation, outcome)).toBe(validation);
      const failed = press(...type("8"), op("divide"), ...type("0"), equals, apiError("DIVISION_BY_ZERO"));
      expect(reducer(failed, outcome)).toBe(failed);
      const result = press(...type("9"), sqrt, resolved("3"));
      expect(reducer(result, outcome)).toBe(result);
      expect(reducer(initialState, outcome)).toBe(initialState);
    },
  );
});
