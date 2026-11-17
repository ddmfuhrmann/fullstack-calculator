import type { Action } from "./types";

export type ShortcutEvent = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
};

const SHORTCUTS: Record<string, Action> = {
  ".": { type: "decimal" },
  ",": { type: "decimal" },
  "+": { type: "operator", operator: "add" },
  "-": { type: "operator", operator: "subtract" },
  "*": { type: "operator", operator: "multiply" },
  "/": { type: "operator", operator: "divide" },
  "^": { type: "operator", operator: "power" },
  "%": { type: "operator", operator: "percentage" },
  r: { type: "sqrt" },
  F9: { type: "toggleSign" },
  "=": { type: "equals" },
  Backspace: { type: "backspace" },
  Escape: { type: "clear" },
};

/**
 * Maps a key event inside the calculator to the action of the matching key.
 * Enter means Equals only when the calculator container itself has focus: on
 * a focused key the browser already activates that key.
 */
export function shortcutAction(event: ShortcutEvent, onContainer: boolean): Action | null {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return null;
  }
  if (event.key === "Enter") {
    return onContainer ? { type: "equals" } : null;
  }
  if (/^[0-9]$/.test(event.key)) {
    return { type: "digit", digit: event.key };
  }
  return SHORTCUTS[event.key] ?? null;
}
