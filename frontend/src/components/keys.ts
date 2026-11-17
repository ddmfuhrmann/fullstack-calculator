import type { Action } from "../calculator/types";

export type KeyVariant = "digit" | "fn" | "op" | "equals";

export type KeyDefinition = {
  label: string;
  /** Accessible name. */
  name: string;
  variant: KeyVariant;
  /** Spans two columns (function row). */
  wide?: boolean;
  action: Action;
};

function digit(value: string): KeyDefinition {
  return { label: value, name: value, variant: "digit", action: { type: "digit", digit: value } };
}

/** The keypad in visual (and DOM) order. */
export const KEYS: readonly KeyDefinition[] = [
  { label: "√x", name: "Square root", variant: "op", wide: true, action: { type: "sqrt" } },
  { label: "xʸ", name: "Power", variant: "op", wide: true, action: { type: "operator", operator: "power" } },
  { label: "AC", name: "Clear", variant: "fn", action: { type: "clear" } },
  { label: "⌫", name: "Backspace", variant: "fn", action: { type: "backspace" } },
  { label: "%", name: "Percent of", variant: "op", action: { type: "operator", operator: "percentage" } },
  { label: "÷", name: "Divide", variant: "op", action: { type: "operator", operator: "divide" } },
  digit("7"),
  digit("8"),
  digit("9"),
  { label: "×", name: "Multiply", variant: "op", action: { type: "operator", operator: "multiply" } },
  digit("4"),
  digit("5"),
  digit("6"),
  { label: "−", name: "Subtract", variant: "op", action: { type: "operator", operator: "subtract" } },
  digit("1"),
  digit("2"),
  digit("3"),
  { label: "+", name: "Add", variant: "op", action: { type: "operator", operator: "add" } },
  { label: "±", name: "Toggle sign", variant: "fn", action: { type: "toggleSign" } },
  digit("0"),
  { label: ".", name: "Decimal point", variant: "digit", action: { type: "decimal" } },
  { label: "=", name: "Equals", variant: "equals", action: { type: "equals" } },
];
