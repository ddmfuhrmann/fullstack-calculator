import type { CalculationRequest } from "../calculator/types";

export type CalculationOutcome =
  | { kind: "ok"; result: string }
  | { kind: "apiError"; code: string }
  | { kind: "networkError" };

const ENDPOINT = "/api/v1/calculate";
const TIMEOUT_MS = 10_000;
const NETWORK_ERROR: CalculationOutcome = { kind: "networkError" };

/**
 * Sends one calculation. It never throws: a failed fetch, a timeout and a
 * response outside the JSON contract all resolve to a network error.
 */
export async function calculate(request: CalculationRequest): Promise<CalculationOutcome> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<CalculationOutcome>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(NETWORK_ERROR);
    }, TIMEOUT_MS);
  });
  try {
    return await Promise.race([send(request, controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function send(request: CalculationRequest, signal: AbortSignal): Promise<CalculationOutcome> {
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal,
    });
    const body: unknown = await response.json();
    return parse(response.ok, body);
  } catch {
    return NETWORK_ERROR;
  }
}

function parse(ok: boolean, body: unknown): CalculationOutcome {
  if (!isRecord(body)) {
    return NETWORK_ERROR;
  }
  if (ok) {
    return typeof body.result === "string" ? { kind: "ok", result: body.result } : NETWORK_ERROR;
  }
  if (isRecord(body.error) && typeof body.error.code === "string") {
    return { kind: "apiError", code: body.error.code };
  }
  return NETWORK_ERROR;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
