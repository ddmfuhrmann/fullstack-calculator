import { describe, expect, it } from "vitest";
import { shortcutAction, type ShortcutEvent } from "./shortcuts";
import type { Action } from "./types";

function press(key: string, modifiers: Partial<Omit<ShortcutEvent, "key">> = {}): ShortcutEvent {
  return { key, ctrlKey: false, metaKey: false, altKey: false, ...modifiers };
}

const digits: [string, Action][] = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"].map(
  (digit) => [digit, { type: "digit", digit }],
);

const shortcuts: [string, Action][] = [
  ...digits,
  [".", { type: "decimal" }],
  [",", { type: "decimal" }],
  ["+", { type: "operator", operator: "add" }],
  ["-", { type: "operator", operator: "subtract" }],
  ["*", { type: "operator", operator: "multiply" }],
  ["/", { type: "operator", operator: "divide" }],
  ["^", { type: "operator", operator: "power" }],
  ["%", { type: "operator", operator: "percentage" }],
  ["r", { type: "sqrt" }],
  ["F9", { type: "toggleSign" }],
  ["=", { type: "equals" }],
  ["Backspace", { type: "backspace" }],
  ["Escape", { type: "clear" }],
];

describe("shortcutAction", () => {
  describe("F-30 shortcuts from the design table", () => {
    it.each(shortcuts)("maps %j on the container to its key action", (key, action) => {
      expect(shortcutAction(press(key), true)).toEqual(action);
    });

    it.each(shortcuts)("maps %j on a focused key to its key action", (key, action) => {
      expect(shortcutAction(press(key), false)).toEqual(action);
    });
  });

  describe("F-30 modifiers", () => {
    const modifiers: [string, Partial<Omit<ShortcutEvent, "key">>][] = [
      ["Ctrl", { ctrlKey: true }],
      ["Meta", { metaKey: true }],
      ["Alt", { altKey: true }],
    ];
    const keys = ["1", "r", "+", "-", "=", "Backspace", "Escape", "F9", "Enter"];
    const cases = modifiers.flatMap(([name, modifier]) =>
      keys.flatMap((key) =>
        [true, false].map((onContainer): [string, string, boolean, ShortcutEvent] => [
          name,
          key,
          onContainer,
          press(key, modifier),
        ]),
      ),
    );

    it.each(cases)("ignores %s+%s (onContainer: %s)", (_name, _key, onContainer, event) => {
      expect(shortcutAction(event, onContainer)).toBeNull();
    });
  });

  describe("F-31 Enter and Space", () => {
    it("maps Enter to equals when the container has focus", () => {
      expect(shortcutAction(press("Enter"), true)).toEqual({ type: "equals" });
    });

    it("ignores Enter when a key has focus", () => {
      expect(shortcutAction(press("Enter"), false)).toBeNull();
    });

    it.each([true, false])("ignores Space (onContainer: %s)", (onContainer) => {
      expect(shortcutAction(press(" "), onContainer)).toBeNull();
    });
  });

  describe("unrelated keys", () => {
    const keys = ["a", "Tab", "Shift", "ArrowLeft"];
    const cases = keys.flatMap((key) => [true, false].map((c): [string, boolean] => [key, c]));

    it.each(cases)("ignores %j (onContainer: %s)", (key, onContainer) => {
      expect(shortcutAction(press(key), onContainer)).toBeNull();
    });
  });
});
