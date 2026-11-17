import { apiErrorMessage, binaryRequest, normalizeEntry, pendingExpression, requestExpression, sqrtRequest } from "./format";
import type { Action, BinaryOperator, CalculationRequest, State } from "./types";

const MAX_DIGITS = 16;

/** An entry worth zero ("0", "0.", "0.00"): it never carries a sign. */
const ZERO = /^0\.?0*$/;

export const initialState: State = {
  status: "idle",
  entry: "0",
  entered: false,
  first: null,
  operator: null,
  expression: "",
  request: null,
  nextOperator: null,
  error: null,
};

export function reducer(state: State, action: Action): State {
  switch (state.status) {
    case "loading":
      return whenLoading(state, action);
    case "error":
      return whenError(state, action);
    case "result":
      return whenResult(state, action);
    case "idle":
    case "typing":
      return whenEditing(state, action);
  }
}

/** While a request is pending only its outcome is accepted. */
function whenLoading(state: State, action: Action): State {
  switch (action.type) {
    case "resolved":
      return resolve(state, action.result);
    case "apiError":
      return {
        ...state,
        status: "error",
        nextOperator: null,
        error: { kind: "api", message: apiErrorMessage(action.code), retryable: false },
      };
    case "networkError":
      return {
        ...state,
        status: "error",
        error: { kind: "api", message: "Couldn't reach the server.", retryable: true },
      };
    default:
      return state;
  }
}

function resolve(state: State, result: string): State {
  if (state.nextOperator) {
    return selectOperator(state, result, state.nextOperator);
  }
  return { ...state, status: "result", entry: result, entered: false };
}

/**
 * Any key clears the banner and is then applied: with the pending operation
 * kept after a validation error, as if from idle after an API or network error.
 * A request outcome is only meaningful while loading and is ignored here.
 */
function whenError(state: State, action: Action): State {
  if (action.type === "resolved" || action.type === "apiError" || action.type === "networkError") {
    return state;
  }
  if (action.type === "retry") {
    return state.error?.retryable ? { ...state, status: "loading", error: null } : state;
  }
  if (state.error?.kind === "validation") {
    return whenEditing({ ...state, status: "typing", error: null }, action);
  }
  return whenEditing(initialState, action);
}

function whenResult(state: State, action: Action): State {
  switch (action.type) {
    case "digit":
    case "decimal":
    case "clear":
      return whenEditing(initialState, action);
    case "operator":
      return selectOperator(state, state.entry, action.operator);
    case "sqrt":
      return send(state, sqrtRequest(state.entry));
    default:
      return state;
  }
}

function whenEditing(state: State, action: Action): State {
  switch (action.type) {
    case "digit":
      return typeDigit(state, action.digit);
    case "decimal":
      return typeDecimal(state);
    case "toggleSign":
      return toggleSign(state);
    case "backspace":
      return backspace(state);
    case "clear":
      return initialState;
    case "operator":
      return pressOperator(state, action.operator);
    case "sqrt":
      return pressSqrt(state);
    case "equals":
      return pressEquals(state);
    default:
      return state;
  }
}

function withEntry(state: State, entry: string): State {
  return { ...state, status: "typing", entry, entered: true };
}

function typeDigit(state: State, digit: string): State {
  if (!state.entered || state.entry === "0") {
    return withEntry(state, digit);
  }
  if (state.entry.replace(/\D/g, "").length >= MAX_DIGITS) {
    return state;
  }
  return withEntry(state, state.entry + digit);
}

function typeDecimal(state: State): State {
  if (!state.entered) {
    return withEntry(state, "0.");
  }
  if (state.entry.includes(".")) {
    return state;
  }
  return withEntry(state, `${state.entry}.`);
}

function toggleSign(state: State): State {
  if (ZERO.test(state.entry)) {
    return state;
  }
  const entry = state.entry.startsWith("-") ? state.entry.slice(1) : `-${state.entry}`;
  return withEntry(state, entry);
}

function backspace(state: State): State {
  if (!state.entered) {
    return state;
  }
  const entry = state.entry.slice(0, -1);
  if (entry === "" || entry === "-") {
    return withEntry(state, "0");
  }
  return withEntry(state, ZERO.test(entry.slice(1)) ? entry.replace("-", "") : entry);
}

function pressOperator(state: State, operator: BinaryOperator): State {
  if (state.operator === null || state.first === null) {
    return selectOperator(state, normalizeEntry(state.entry), operator);
  }
  if (!state.entered) {
    return selectOperator(state, state.first, operator);
  }
  return { ...send(state, binaryRequest(state.operator, state.first, state.entry)), nextOperator: operator };
}

function pressSqrt(state: State): State {
  if (state.operator !== null) {
    return validationError(state, "Finish the current operation first.");
  }
  return send(state, sqrtRequest(state.entry));
}

function pressEquals(state: State): State {
  if (state.operator === null || state.first === null) {
    return state;
  }
  if (!state.entered) {
    return validationError(state, "Enter a second number.");
  }
  return send(state, binaryRequest(state.operator, state.first, state.entry));
}

/** Starts waiting for the second operand of a binary operation. */
function selectOperator(state: State, first: string, operator: BinaryOperator): State {
  return {
    ...state,
    status: "typing",
    entry: "0",
    entered: false,
    first,
    operator,
    expression: pendingExpression(first, operator),
    nextOperator: null,
    error: null,
  };
}

function send(state: State, request: CalculationRequest): State {
  return {
    ...state,
    status: "loading",
    first: null,
    operator: null,
    expression: requestExpression(request),
    request,
    nextOperator: null,
    error: null,
  };
}

function validationError(state: State, message: string): State {
  return { ...state, status: "error", error: { kind: "validation", message, retryable: false } };
}
