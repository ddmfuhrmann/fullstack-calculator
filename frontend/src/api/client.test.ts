import { afterEach, describe, expect, it, vi } from "vitest";
import type { CalculationRequest } from "../calculator/types";
import { calculate } from "./client";

const multiply: CalculationRequest = { operation: "multiply", operands: ["12", "4"] };

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function stubFetch(respond: () => Promise<Response>) {
  const fetchMock = vi.fn<typeof fetch>(respond);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function stubFetchWith(response: Response) {
  return stubFetch(() => Promise.resolve(response));
}

/** Like a real fetch that never gets an answer: it only settles if aborted. */
function stubHangingFetch() {
  const fetchMock = vi.fn<typeof fetch>(
    (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (!signal) return;
        const abort = () => reject(new DOMException("The operation was aborted.", "AbortError"));
        if (signal.aborted) abort();
        else signal.addEventListener("abort", abort);
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function sentRequest(fetchMock: ReturnType<typeof stubFetchWith>) {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const call = fetchMock.mock.calls[0];
  if (!call) throw new Error("expected fetch to be called");
  const [input, init] = call;
  const body = init?.body;
  if (typeof body !== "string") throw new Error("expected a string request body");
  const parsed: unknown = JSON.parse(body);
  return { url: String(input), method: init?.method, body: parsed };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("request shape", () => {
  it("posts a binary operation to /api/v1/calculate as {operation, operands}", async () => {
    const fetchMock = stubFetchWith(jsonResponse({ result: "48" }, 200));

    await calculate(multiply);

    expect(sentRequest(fetchMock)).toEqual({
      url: "/api/v1/calculate",
      method: "POST",
      body: { operation: "multiply", operands: ["12", "4"] },
    });
  });

  it("posts sqrt with a single operand", async () => {
    const fetchMock = stubFetchWith(jsonResponse({ result: "3" }, 200));

    await calculate({ operation: "sqrt", operands: ["9"] });

    expect(sentRequest(fetchMock)).toEqual({
      url: "/api/v1/calculate",
      method: "POST",
      body: { operation: "sqrt", operands: ["9"] },
    });
  });
});

describe("ok outcome", () => {
  it("returns the result string of a 200 response", async () => {
    stubFetchWith(jsonResponse({ result: "48" }, 200));

    await expect(calculate(multiply)).resolves.toEqual({ kind: "ok", result: "48" });
  });

  it("keeps the result exactly as the API sent it", async () => {
    const result = "0.3333333333333333333333333333333333";
    stubFetchWith(jsonResponse({ result }, 200));

    await expect(calculate({ operation: "divide", operands: ["1", "3"] })).resolves.toEqual({
      kind: "ok",
      result,
    });
  });
});

describe("api error outcome", () => {
  it.each([
    [422, "DIVISION_BY_ZERO", "division by zero"],
    [422, "NEGATIVE_SQRT", "square root of a negative number"],
    [400, "OPERAND_TOO_LONG", "operand too long"],
    [400, "INVALID_OPERAND", "invalid operand"],
    [413, "PAYLOAD_TOO_LARGE", "payload too large"],
    [500, "INTERNAL", "internal error"],
  ])("returns the code of a %i %s response", async (status, code, message) => {
    stubFetchWith(jsonResponse({ error: { code, message } }, status));

    await expect(calculate(multiply)).resolves.toEqual({ kind: "apiError", code });
  });
});

describe("network error outcome", () => {
  it("returns networkError when fetch rejects", async () => {
    stubFetch(() => Promise.reject(new TypeError("Failed to fetch")));

    await expect(calculate(multiply)).resolves.toEqual({ kind: "networkError" });
  });

  it("returns networkError after 10 s without an answer, and not before", async () => {
    vi.useFakeTimers();
    stubHangingFetch();
    let settled = false;

    const outcome = calculate(multiply);
    void outcome.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );

    await vi.advanceTimersByTimeAsync(9_999);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await expect(outcome).resolves.toEqual({ kind: "networkError" });
  });

  it("returns networkError when the body is not JSON", async () => {
    stubFetchWith(new Response("<html>Bad Gateway</html>", { status: 200 }));

    await expect(calculate(multiply)).resolves.toEqual({ kind: "networkError" });
  });

  it("returns networkError when an error status has a non-JSON body", async () => {
    stubFetchWith(new Response("Bad Gateway", { status: 502 }));

    await expect(calculate(multiply)).resolves.toEqual({ kind: "networkError" });
  });

  it("returns networkError when the body is empty", async () => {
    stubFetchWith(new Response("", { status: 200 }));

    await expect(calculate(multiply)).resolves.toEqual({ kind: "networkError" });
  });

  it.each([
    ["no result", {}],
    ["a numeric result", { result: 48 }],
    ["a null result", { result: null }],
    ["an error body", { error: { code: "INTERNAL", message: "internal error" } }],
  ])("returns networkError when a 200 has %s", async (_name, body) => {
    stubFetchWith(jsonResponse(body, 200));

    await expect(calculate(multiply)).resolves.toEqual({ kind: "networkError" });
  });

  it.each([
    ["no error", 500, {}],
    ["an error without a code", 422, { error: { message: "division by zero" } }],
    ["a non-string code", 400, { error: { code: 42, message: "bad" } }],
    ["an error that is not an object", 400, { error: "DIVISION_BY_ZERO" }],
    ["a null error", 500, { error: null }],
    ["a result instead of an error", 422, { result: "48" }],
  ])("returns networkError when an error status has %s", async (_name, status, body) => {
    stubFetchWith(jsonResponse(body, status));

    await expect(calculate(multiply)).resolves.toEqual({ kind: "networkError" });
  });

  it.each([
    ["an array", 200, []],
    ["null", 200, null],
    ["a string", 200, "48"],
    ["a number", 200, 48],
    ["an array", 422, []],
    ["null", 400, null],
    ["a string", 500, "DIVISION_BY_ZERO"],
  ])("returns networkError when the JSON is %s (status %i)", async (_name, status, body) => {
    stubFetchWith(jsonResponse(body, status));

    await expect(calculate(multiply)).resolves.toEqual({ kind: "networkError" });
  });
});
