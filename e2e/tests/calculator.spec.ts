import { expect, test, type Locator, type Page } from "@playwright/test";

const key = (page: Page, name: string): Locator =>
  page.getByRole("button", { name, exact: true });

async function press(page: Page, ...names: string[]): Promise<void> {
  for (const name of names) {
    await key(page, name).click();
  }
}

const expression = (page: Page): Locator => page.getByLabel("Expression");
const result = (page: Page): Locator => page.getByRole("status");

test.describe("happy path per operation", () => {
  const cases = [
    { name: "add", keys: ["0", "Decimal point", "1", "Add", "0", "Decimal point", "2", "Equals"], expression: "0.1 + 0.2 =", result: "0.3" },
    { name: "subtract", keys: ["3", "Subtract", "5", "Equals"], expression: "3 − 5 =", result: "−2" },
    { name: "multiply", keys: ["1", "2", "Multiply", "4", "Equals"], expression: "12 × 4 =", result: "48" },
    { name: "divide", keys: ["1", "0", "Divide", "4", "Equals"], expression: "10 ÷ 4 =", result: "2.5" },
    { name: "power", keys: ["2", "Power", "1", "0", "Equals"], expression: "2 ^ 10 =", result: "1024" },
    { name: "percentage", keys: ["1", "5", "Percent of", "2", "0", "0", "Equals"], expression: "15% of 200 =", result: "30" },
    { name: "square root", keys: ["9", "Square root"], expression: "√(9) =", result: "3" },
  ];

  for (const c of cases) {
    test(`${c.name}: ${c.expression} ${c.result}`, async ({ page }) => {
      await page.goto("/");
      await press(page, ...c.keys);
      await expect(result(page)).toHaveText(c.result);
      await expect(expression(page)).toHaveText(c.expression);
      await expect(page.getByRole("alert")).toHaveCount(0);
    });
  }
});

test("chaining sends the pending operation and selects the next operator", async ({ page }) => {
  await page.goto("/");
  await press(page, "1", "2", "Add", "3", "Multiply");
  await expect(expression(page)).toHaveText("15 ×");
  await expect(result(page)).toHaveText("0");
  await expect(key(page, "Multiply")).toHaveAttribute("aria-pressed", "true");
  await expect(key(page, "Add")).not.toHaveAttribute("aria-pressed", "true");

  await press(page, "2", "Equals");
  await expect(result(page)).toHaveText("30");
  await expect(expression(page)).toHaveText("15 × 2 =");
});

test.describe("errors", () => {
  test("division by zero shows an alert without retry", async ({ page }) => {
    await page.goto("/");
    await press(page, "8", "Divide", "0", "Equals");
    await expect(page.getByRole("alert")).toContainText("Can't divide by zero.");
    await expect(page.getByRole("button", { name: "Retry" })).toHaveCount(0);
    await expect(expression(page)).toHaveText("8 ÷ 0 =");
    await expect(key(page, "7")).not.toHaveAttribute("aria-disabled", "true");
  });

  test("equals without a second operand asks for one", async ({ page }) => {
    await page.goto("/");
    await press(page, "1", "2", "Multiply", "Equals");
    await expect(page.getByRole("alert")).toContainText("Enter a second number.");
    await expect(expression(page)).toHaveText("12 ×");
    await expect(result(page)).toHaveText("0");
    await expect(key(page, "Multiply")).toHaveAttribute("aria-pressed", "true");
  });

  test("square root of a negative number shows an alert", async ({ page }) => {
    await page.goto("/");
    await press(page, "9", "Toggle sign", "Square root");
    await expect(page.getByRole("alert")).toContainText(
      "Can't take the square root of a negative number.",
    );
    await expect(page.getByRole("button", { name: "Retry" })).toHaveCount(0);
    await expect(expression(page)).toHaveText("√(−9) =");
  });
});

test("keyboard only: 12 * 4 Enter gives 48", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("region", { name: "Calculator" }).focus();
  await page.keyboard.type("12*4");
  await expect(expression(page)).toHaveText("12 ×");
  await expect(result(page)).toHaveText("4");
  await page.keyboard.press("Enter");
  await expect(result(page)).toHaveText("48");
  await expect(expression(page)).toHaveText("12 × 4 =");
});

test.describe("mobile viewport", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test("no horizontal scroll and every key is at least 48px", async ({ page }) => {
    await page.goto("/");
    const fits = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );
    expect(fits).toBe(true);

    const keys = page.getByRole("group", { name: "Keypad" }).getByRole("button");
    await expect(keys).toHaveCount(22);
    for (const k of await keys.all()) {
      const box = await k.boundingBox();
      const label = await k.textContent();
      expect(box, `bounding box of ${label}`).not.toBeNull();
      expect(box!.width, `width of ${label}`).toBeGreaterThanOrEqual(48);
      expect(box!.height, `height of ${label}`).toBeGreaterThanOrEqual(48);
    }
  });

  test("calculates 12 × 4 = 48", async ({ page }) => {
    await page.goto("/");
    await press(page, "1", "2", "Multiply", "4", "Equals");
    await expect(result(page)).toHaveText("48");
    await expect(expression(page)).toHaveText("12 × 4 =");
  });
});
