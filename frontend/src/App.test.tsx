import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { calculate, type CalculationOutcome } from "./api/client";
import { App } from "./App";

vi.mock("./api/client", () => ({ calculate: vi.fn() }));

const calculateMock = vi.mocked(calculate);

const KEYS_IN_VISUAL_ORDER = [
  "Square root",
  "Power",
  "Clear",
  "Backspace",
  "Percent of",
  "Divide",
  "7",
  "8",
  "9",
  "Multiply",
  "4",
  "5",
  "6",
  "Subtract",
  "1",
  "2",
  "3",
  "Add",
  "Toggle sign",
  "0",
  "Decimal point",
  "Equals",
];

const BINARY_OPERATOR_KEYS = ["Add", "Subtract", "Multiply", "Divide", "Power", "Percent of"];

const BINARY_OPERATORS = [
  { key: "Add", operation: "add", pending: "12 +", sent: "12 + 4 =" },
  { key: "Subtract", operation: "subtract", pending: "12 −", sent: "12 − 4 =" },
  { key: "Multiply", operation: "multiply", pending: "12 ×", sent: "12 × 4 =" },
  { key: "Divide", operation: "divide", pending: "12 ÷", sent: "12 ÷ 4 =" },
  { key: "Power", operation: "power", pending: "12 ^", sent: "12 ^ 4 =" },
  { key: "Percent of", operation: "percentage", pending: "12% of", sent: "12% of 4 =" },
];

type Deferred = { resolve: (outcome: CalculationOutcome) => void };

/** Makes the next `calculate` call return a promise the test resolves later. */
function deferNextCall(): Deferred {
  let resolve: (outcome: CalculationOutcome) => void = () => {};
  const promise = new Promise<CalculationOutcome>((res) => {
    resolve = res;
  });
  calculateMock.mockImplementationOnce(() => promise);
  return { resolve };
}

async function settle(deferred: Deferred, outcome: CalculationOutcome) {
  await act(async () => {
    deferred.resolve(outcome);
    await Promise.resolve();
  });
}

function key(name: string) {
  return within(screen.getByRole("group", { name: "Keypad" })).getByRole("button", { name });
}

function allKeys() {
  return within(screen.getByRole("group", { name: "Keypad" })).getAllByRole("button");
}

async function press(user: UserEvent, ...names: string[]) {
  for (const name of names) {
    await user.click(key(name));
  }
}

function result() {
  return screen.getByRole("status");
}

function text(element: HTMLElement) {
  return (element.textContent ?? "").replace(/\s+/g, " ").trim();
}

function expressionText() {
  return text(screen.getByLabelText("Expression"));
}

function isBusy() {
  return result().closest('[aria-busy="true"]') !== null;
}

function pressedKeys() {
  return allKeys()
    .filter((button) => button.getAttribute("aria-pressed") === "true")
    .map((button) => button.getAttribute("aria-label") ?? text(button));
}

function expectKeysEnabled() {
  for (const button of allKeys()) {
    expect(button).not.toHaveAttribute("aria-disabled", "true");
    expect(button).toBeEnabled();
  }
}

function sentRequests() {
  return calculateMock.mock.calls.map((call) => call[0]);
}

beforeEach(() => {
  calculateMock.mockReset();
  calculateMock.mockImplementation(() => new Promise<CalculationOutcome>(() => {}));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("App", () => {
  it("renders the labelled calculator region", () => {
    render(<App />);

    expect(screen.getByRole("region", { name: "Calculator" })).toBeInTheDocument();
  });

  describe("F-01 idle", () => {
    it("F-01: starts with an empty expression, a 0 result, no banner and every key enabled", () => {
      render(<App />);

      expect(expressionText()).toBe("");
      expect(text(result())).toBe("0");
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(allKeys()).toHaveLength(22);
      expectKeysEnabled();
      expect(pressedKeys()).toEqual([]);
      expect(isBusy()).toBe(false);
      expect(calculateMock).not.toHaveBeenCalled();
    });
  });

  describe("F-09 binary operator", () => {
    it.each(BINARY_OPERATORS)(
      "F-09: $key after 12 shows '$pending', a 0 result and the key pressed",
      async ({ key: operatorKey, pending }) => {
        const user = userEvent.setup();
        render(<App />);

        await press(user, "1", "2", operatorKey);

        expect(expressionText()).toBe(pending);
        expect(text(result())).toBe("0");
        expect(key(operatorKey)).toHaveAttribute("aria-pressed", "true");
        expect(pressedKeys()).toEqual([operatorKey]);
        expect(calculateMock).not.toHaveBeenCalled();
      },
    );
  });

  describe("F-12 equals", () => {
    it.each(BINARY_OPERATORS)(
      "F-12: 12 $key 4 = shows '$sent', is loading and sends one $operation request",
      async ({ key: operatorKey, operation, sent }) => {
        const user = userEvent.setup();
        deferNextCall();
        render(<App />);

        await press(user, "1", "2", operatorKey, "4", "Equals");

        expect(expressionText()).toBe(sent);
        expect(isBusy()).toBe(true);
        expect(calculateMock).toHaveBeenCalledTimes(1);
        expect(sentRequests()).toEqual([{ operation, operands: ["12", "4"] }]);
      },
    );
  });

  describe("F-15 equals without a second operand", () => {
    it("F-15: shows a validation banner, sends nothing and keeps the pending operation", async () => {
      const user = userEvent.setup();
      render(<App />);

      await press(user, "1", "2", "Multiply", "Equals");

      expect(calculateMock).not.toHaveBeenCalled();
      const banner = screen.getByRole("alert");
      expect(banner).toHaveTextContent("Enter a second number.");
      expect(within(banner).queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
      expect(expressionText()).toBe("12 ×");
      expect(text(result())).toBe("0");
      expect(key("Multiply")).toHaveAttribute("aria-pressed", "true");
      expect(isBusy()).toBe(false);
      expectKeysEnabled();
    });
  });

  describe("F-18 keys locked", () => {
    it("F-18: marks the display busy and keeps the previous value while pending", async () => {
      const user = userEvent.setup();
      deferNextCall();
      render(<App />);

      await press(user, "1", "2", "Multiply", "4", "Equals");

      expect(isBusy()).toBe(true);
      expect(text(result())).toBe("4");
    });

    it("F-18: every key is aria-disabled, not disabled, and focus stays on the pressed key", async () => {
      const user = userEvent.setup();
      deferNextCall();
      render(<App />);

      await press(user, "1", "2", "Multiply", "4", "Equals");

      const keys = allKeys();
      expect(keys).toHaveLength(22);
      for (const button of keys) {
        expect(button).toHaveAttribute("aria-disabled", "true");
        expect(button).not.toHaveAttribute("disabled");
      }
      expect(key("Equals")).toHaveFocus();
    });

    it("F-18: clicks do nothing while pending", async () => {
      const user = userEvent.setup();
      deferNextCall();
      render(<App />);

      await press(user, "1", "2", "Multiply", "4", "Equals");
      await press(user, "7", "Add", "Clear", "Backspace", "Toggle sign", "Square root", "Equals");

      expect(expressionText()).toBe("12 × 4 =");
      expect(text(result())).toBe("4");
      expect(isBusy()).toBe(true);
      expect(calculateMock).toHaveBeenCalledTimes(1);
    });

    it("F-18: shortcuts and key activation from the keyboard do nothing while pending", async () => {
      const user = userEvent.setup();
      deferNextCall();
      render(<App />);

      await press(user, "1", "2", "Multiply", "4", "Equals");
      await user.keyboard("7+{Escape}{Backspace}r={Enter} ");

      expect(expressionText()).toBe("12 × 4 =");
      expect(text(result())).toBe("4");
      expect(isBusy()).toBe(true);
      expect(key("Equals")).toHaveFocus();
      expect(calculateMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("F-19 delayed indicator", () => {
    const progressBar = (container: HTMLElement) =>
      container.querySelector('[aria-busy="true"] [aria-hidden="true"]');

    function startRequest() {
      for (const name of ["1", "2", "Multiply", "4", "Equals"]) {
        fireEvent.click(key(name));
      }
    }

    it("F-19: shows no progress bar before 150 ms and shows it after", () => {
      vi.useFakeTimers();
      deferNextCall();
      const { container } = render(<App />);

      startRequest();

      expect(isBusy()).toBe(true);
      expect(progressBar(container)).toBeNull();

      act(() => {
        vi.advanceTimersByTime(149);
      });
      expect(progressBar(container)).toBeNull();

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(progressBar(container)).not.toBeNull();
    });

    it("F-19: never shows the progress bar when the answer arrives before 150 ms", async () => {
      vi.useFakeTimers();
      const pending = deferNextCall();
      const { container } = render(<App />);

      startRequest();
      act(() => {
        vi.advanceTimersByTime(100);
      });
      await settle(pending, { kind: "ok", result: "48" });
      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(text(result())).toBe("48");
      expect(isBusy()).toBe(false);
      expect(progressBar(container)).toBeNull();
    });
  });

  describe("F-20 success", () => {
    it("F-20: shows the API result, keeps the expression and unlocks the keys", async () => {
      const user = userEvent.setup();
      const pending = deferNextCall();
      render(<App />);

      await press(user, "1", "2", "Multiply", "4", "Equals");
      await settle(pending, { kind: "ok", result: "48" });

      expect(expressionText()).toBe("12 × 4 =");
      expect(text(result())).toBe("48");
      expect(isBusy()).toBe(false);
      expectKeysEnabled();
      expect(pressedKeys()).toEqual([]);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  describe("F-23 result size", () => {
    async function classNameForResult(value: string) {
      const user = userEvent.setup();
      const pending = deferNextCall();
      const view = render(<App />);

      await press(user, "1", "Add", "1", "Equals");
      await settle(pending, { kind: "ok", result: value });

      expect(text(result())).toBe(value);
      const className = result().className;
      view.unmount();
      return className;
    }

    it("F-23: uses three distinct sizes for up to 10, 11 to 14 and over 14 characters", async () => {
      const large = await classNameForResult("48");
      const medium = await classNameForResult("12345678901");
      const small = await classNameForResult("123456789012345");

      expect(new Set([large, medium, small]).size).toBe(3);
    });

    it("F-23: switches size exactly at the 10 and 14 character boundaries", async () => {
      const large = await classNameForResult("48");
      const medium = await classNameForResult("12345678901");

      expect(await classNameForResult("1234567890")).toBe(large);
      expect(await classNameForResult("12345678901234")).toBe(medium);
    });

    it("F-23: shows a long result in full, without cutting it off", async () => {
      const user = userEvent.setup();
      const pending = deferNextCall();
      const long = "0.3333333333333333333333333333333333";
      render(<App />);

      await press(user, "1", "Divide", "3", "Equals");
      await settle(pending, { kind: "ok", result: long });

      expect(text(result())).toBe(long);
    });
  });

  describe("F-24 API error", () => {
    it.each([
      {
        code: "DIVISION_BY_ZERO",
        keys: ["8", "Divide", "0", "Equals"],
        expression: "8 ÷ 0 =",
        lastEntry: "0",
        message: "Can't divide by zero.",
      },
      {
        code: "NEGATIVE_SQRT",
        keys: ["9", "Toggle sign", "Square root"],
        expression: "√(−9) =",
        lastEntry: "−9",
        message: "Can't take the square root of a negative number.",
      },
      {
        code: "UNSUPPORTED_EXPONENT",
        keys: ["2", "Power", "1", "0", "0", "1", "Equals"],
        expression: "2 ^ 1001 =",
        lastEntry: "1001",
        message: "Exponent must be a whole number between −1000 and 1000.",
      },
      {
        code: "OPERAND_TOO_LONG",
        keys: ["1", "2", "Multiply", "4", "Equals"],
        expression: "12 × 4 =",
        lastEntry: "4",
        message: "That number is too long.",
      },
      {
        code: "INTERNAL",
        keys: ["1", "2", "Add", "4", "Equals"],
        expression: "12 + 4 =",
        lastEntry: "4",
        message: "Something went wrong. Try again.",
      },
    ])(
      "F-24: $code shows '$message' with no Retry, keeps the expression and unlocks the keys",
      async ({ code, keys, expression, lastEntry, message }) => {
        const user = userEvent.setup();
        const pending = deferNextCall();
        render(<App />);

        await press(user, ...keys);
        expect(isBusy()).toBe(true);
        await settle(pending, { kind: "apiError", code });

        const banner = screen.getByRole("alert");
        expect(text(banner)).toBe(message);
        expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
        expect(expressionText()).toBe(expression);
        expect(text(result())).toBe(lastEntry);
        expect(isBusy()).toBe(false);
        expectKeysEnabled();
        expect(calculateMock).toHaveBeenCalledTimes(1);
      },
    );
  });

  describe("F-25 network error", () => {
    it("F-25: shows 'Couldn't reach the server.' with a Retry button and unlocks the keys", async () => {
      const user = userEvent.setup();
      const pending = deferNextCall();
      render(<App />);

      await press(user, "1", "2", "Multiply", "4", "Equals");
      await settle(pending, { kind: "networkError" });

      const banner = screen.getByRole("alert");
      expect(banner).toHaveTextContent("Couldn't reach the server.");
      expect(within(banner).getByRole("button", { name: "Retry" })).toBeEnabled();
      expect(isBusy()).toBe(false);
      expectKeysEnabled();
    });
  });

  describe("F-26 retry", () => {
    it("F-26: Retry sends the same request again and goes back to loading", async () => {
      const user = userEvent.setup();
      const first = deferNextCall();
      render(<App />);

      await press(user, "1", "2", "Multiply", "4", "Equals");
      await settle(first, { kind: "networkError" });
      const second = deferNextCall();
      await user.click(screen.getByRole("button", { name: "Retry" }));

      const request = { operation: "multiply", operands: ["12", "4"] };
      expect(sentRequests()).toEqual([request, request]);
      expect(isBusy()).toBe(true);
      expect(expressionText()).toBe("12 × 4 =");
      for (const button of allKeys()) {
        expect(button).toHaveAttribute("aria-disabled", "true");
      }

      await settle(second, { kind: "ok", result: "48" });

      expect(text(result())).toBe("48");
      expect(expressionText()).toBe("12 × 4 =");
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(isBusy()).toBe(false);
    });

    it("F-26: Retry keeps a chained operator", async () => {
      const user = userEvent.setup();
      const first = deferNextCall();
      render(<App />);

      await press(user, "1", "2", "Add", "3", "Multiply");
      await settle(first, { kind: "networkError" });
      const second = deferNextCall();
      await user.click(screen.getByRole("button", { name: "Retry" }));

      const request = { operation: "add", operands: ["12", "3"] };
      expect(sentRequests()).toEqual([request, request]);
      expect(isBusy()).toBe(true);

      await settle(second, { kind: "ok", result: "15" });

      expect(expressionText()).toBe("15 ×");
      expect(text(result())).toBe("0");
      expect(pressedKeys()).toEqual(["Multiply"]);
    });
  });

  describe("F-29 stable layout", () => {
    it("F-29: the keypad and its keys stay in place, in the same order, when a banner appears", async () => {
      const user = userEvent.setup();
      render(<App />);
      const keypad = screen.getByRole("group", { name: "Keypad" });
      const keysBefore = allKeys();

      await press(user, "1", "2", "Multiply", "Equals");

      const banner = screen.getByRole("alert");
      expect(screen.getByRole("group", { name: "Keypad" })).toBe(keypad);
      const keysAfter = allKeys();
      expect(keysAfter).toHaveLength(keysBefore.length);
      keysAfter.forEach((button, index) => {
        expect(button).toBe(keysBefore[index]);
      });
      expect(
        banner.compareDocumentPosition(keypad) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        result().compareDocumentPosition(banner) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });
  });

  describe("F-32 semantics", () => {
    it("F-32: the keypad is a group named Keypad inside the calculator region", () => {
      render(<App />);

      const region = screen.getByRole("region", { name: "Calculator" });
      expect(within(region).getByRole("group", { name: "Keypad" })).toBeInTheDocument();
    });

    it("F-32: every key is a button with the accessible name from the design table, in visual order", () => {
      render(<App />);

      const keypad = screen.getByRole("group", { name: "Keypad" });
      for (const name of KEYS_IN_VISUAL_ORDER) {
        expect(within(keypad).getByRole("button", { name })).toBeInTheDocument();
      }
      const keys = allKeys();
      expect(keys).toHaveLength(22);
      keys.forEach((button, index) => {
        expect(button).toHaveAccessibleName(KEYS_IN_VISUAL_ORDER[index]);
        expect(button).toHaveAttribute("type", "button");
      });
    });

    it("F-32: only binary operator keys expose a pressed state", () => {
      render(<App />);

      for (const name of BINARY_OPERATOR_KEYS) {
        expect(key(name)).toHaveAttribute("aria-pressed", "false");
      }
    });

    it("F-32: the result is an output with aria-live polite", () => {
      render(<App />);

      expect(result().tagName).toBe("OUTPUT");
      expect(result()).toHaveAttribute("aria-live", "polite");
    });

    it("F-32: the expression is labelled Expression", () => {
      render(<App />);

      const region = screen.getByRole("region", { name: "Calculator" });
      expect(within(region).getByLabelText("Expression")).toBeInTheDocument();
    });

    it("F-32: Tab visits the keys in visual order", async () => {
      const user = userEvent.setup();
      render(<App />);
      const keypad = screen.getByRole("group", { name: "Keypad" });

      await user.tab();
      if (!keypad.contains(document.activeElement)) {
        await user.tab();
      }

      for (const name of KEYS_IN_VISUAL_ORDER) {
        expect(document.activeElement).toBe(key(name));
        await user.tab();
      }
      expect(keypad.contains(document.activeElement)).toBe(false);
    });
  });
});
