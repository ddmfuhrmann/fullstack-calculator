# Full-stack calculator

A calculator with a React + TypeScript frontend and a Go REST API. The frontend
does no math: every operation is a call to the backend.

## Setup

Requirements: Docker and Make. For local development without Docker: Go 1.22+ and Node 24 (22.22+ also works).

```bash
make up
```

Without Make, `docker compose up --build` does the same.

The app and the API are then served on http://localhost:8080.

## Running without Docker

Two terminals. The API listens on port 8080 and the Vite dev server proxies
`/api` to it.

```bash
cd backend && go run ./cmd/server
```

```bash
cd frontend && npm ci && npm run dev
```

Then open http://localhost:5173.

## API

`POST /api/v1/calculate`

```
Request   {"operation": "add", "operands": ["0.1", "0.2"]}
200       {"result": "0.3"}
4xx/5xx   {"error": {"code": "DIVISION_BY_ZERO", "message": "division by zero"}}
```

Operands and results are decimal strings, so no precision is lost in JSON. An
operand matches `^-?[0-9]+(\.[0-9]+)?$` and has at most 64 characters.

| Operation    | Operands | Meaning      | Example request body                                 | Result                                 |
| ------------ | -------- | ------------ | ---------------------------------------------------- | -------------------------------------- |
| `add`        | 2        | `a + b`      | `{"operation":"add","operands":["0.1","0.2"]}`       | `0.3`                                  |
| `subtract`   | 2        | `a − b`      | `{"operation":"subtract","operands":["5","3"]}`      | `2`                                    |
| `multiply`   | 2        | `a × b`      | `{"operation":"multiply","operands":["4","2.5"]}`    | `10`                                   |
| `divide`     | 2        | `a ÷ b`      | `{"operation":"divide","operands":["1","3"]}`        | `0.3333333333333333333333333333333333` |
| `power`      | 2        | `a ^ b`      | `{"operation":"power","operands":["2","10"]}`        | `1024`                                 |
| `sqrt`       | 1        | `√a`         | `{"operation":"sqrt","operands":["2"]}`              | `1.4142135623730950488016887242096981` |
| `percentage` | 2        | `a`% of `b`  | `{"operation":"percentage","operands":["15","200"]}` | `30`                                   |

```bash
curl -s -w ' %{http_code}\n' localhost:8080/api/v1/calculate -d '{"operation":"add","operands":["0.1","0.2"]}'
# {"result":"0.3"} 200
```

```bash
curl -s -w ' %{http_code}\n' localhost:8080/api/v1/calculate -d '{"operation":"sqrt","operands":["2"]}'
# {"result":"1.4142135623730950488016887242096981"} 200
```

```bash
curl -s -w ' %{http_code}\n' localhost:8080/api/v1/calculate -d '{"operation":"divide","operands":["1","0"]}'
# {"error":{"code":"DIVISION_BY_ZERO","message":"division by zero"}} 422
```

```bash
curl -s -w ' %{http_code}\n' localhost:8080/api/v1/calculate -d '{"operation":"add","operands":["abc","1"]}'
# {"error":{"code":"INVALID_OPERAND","message":"operand is not a decimal number"}} 400
```

Error codes. Validation runs in this order and reports the first failure: body
size, JSON, operation, operand count, operand length, operand grammar, math.

| Status | Code                    | When                                                                     | Example request body                              |
| ------ | ----------------------- | ------------------------------------------------------------------------ | ------------------------------------------------- |
| 400    | `INVALID_JSON`          | Body is not valid JSON, has wrong types, unknown fields or trailing data | `{"operation":`                                   |
| 400    | `UNKNOWN_OPERATION`     | `operation` is not registered, missing or empty                          | `{"operation":"modulo","operands":["1","2"]}`     |
| 400    | `INVALID_OPERAND_COUNT` | Wrong number of operands for the operation                               | `{"operation":"add","operands":["1"]}`            |
| 400    | `OPERAND_TOO_LONG`      | An operand is longer than 64 characters                                  | a 65-digit operand                                |
| 400    | `INVALID_OPERAND`       | An operand does not match the grammar                                    | `{"operation":"add","operands":["abc","1"]}`      |
| 413    | `PAYLOAD_TOO_LARGE`     | Body is larger than 1024 bytes                                           | any body of 1025 bytes                            |
| 422    | `DIVISION_BY_ZERO`      | `divide` by zero, or `power` of zero to a negative exponent              | `{"operation":"divide","operands":["1","0"]}`     |
| 422    | `NEGATIVE_SQRT`         | `sqrt` of a negative number                                              | `{"operation":"sqrt","operands":["-9"]}`          |
| 422    | `UNSUPPORTED_EXPONENT`  | Exponent is not an integer in `[-1000, 1000]`                            | `{"operation":"power","operands":["2","0.5"]}`    |
| 500    | `INTERNAL`              | Anything unexpected                                                      |                                                   |

A wrong method on the endpoint is the router's default 405 and an unknown
`/api/` path is a 404.

## Tests and coverage

```bash
make test
```

Backend: `go vet` and `go test`. Frontend: ESLint, `tsc` and Vitest.

```bash
make coverage
```

```bash
make e2e
```

Builds and starts the container, runs Playwright (Chromium) against it and
stops it: one happy path per operation, chaining, division by zero, invalid
input (a missing second operand, the square root of a negative), a
keyboard-only calculation and a 360px viewport check.

`make help` lists every target and the command behind it.

Coverage from `make coverage`. The full HTML reports are generated locally
(`frontend/coverage/`, and `go tool cover -html=backend/coverage.out`).

Backend, statements (`go tool cover -func`):

| Package / function                       | Coverage |
| ---------------------------------------- | -------- |
| `internal/calculator` (all 10 functions) | 100.0%   |
| `internal/httpapi`                       | 94.8%    |
| &nbsp;&nbsp;`calculate`                  | 94.1%    |
| &nbsp;&nbsp;`fromCalculator`             | 83.3%    |
| &nbsp;&nbsp;`NewAPI`, `NewRouter`, `decodeStrict`, `writeError`, `writeJSON` | 100.0% |
| `cmd/server` (`main`, `run`)             | 0.0%     |
| `internal/static` (`Files`)              | 0.0%     |
| **Total**                                | **77.8%** |

The uncovered lines in `internal/httpapi` are two defensive paths the handler
tests cannot trigger: a body read error other than the size limit, and the
`INTERNAL` fallback of the error mapping. `cmd/server` (timeouts, graceful
shutdown) and the embedded file system have no unit tests; the end-to-end
suite runs them in the real image.

Frontend (Vitest, v8):

| File                                   | Statements | Branches | Functions | Lines |
| -------------------------------------- | ---------- | -------- | --------- | ----- |
| `src/App.tsx`                          | 100%       | 92.3%    | 100%      | 100%  |
| `src/api/client.ts`                    | 100%       | 100%     | 100%      | 100%  |
| `src/calculator/format.ts`             | 100%       | 100%     | 100%      | 100%  |
| `src/calculator/reducer.ts`            | 100%       | 98.63%   | 100%      | 100%  |
| `src/calculator/shortcuts.ts`          | 100%       | 100%     | 100%      | 100%  |
| `src/components/` (Display, ErrorBanner, Key, Keypad, keys) | 100% | 100% | 100% | 100% |
| **All files**                          | **100%** (178/178) | **98.62%** (143/145) | **100%** (50/50) | **100%** (177/177) |

## Design decisions

- **The backend owns all math.** The frontend only collects input and renders
  results, so there is one source of truth and one place to test arithmetic.
- **Decimal arithmetic, not `float64`.** `0.1 + 0.2` must be `0.3`. Numbers travel
  as JSON strings and are computed with arbitrary-precision decimals.
- **One endpoint, operation in the body.** Adding an operation is one registry
  entry and its tests; the HTTP surface and the client do not change.
- **Pure calculator package.** No HTTP or I/O inside it, so it is tested with
  plain table-driven tests and no mocks.
- **400 vs 422.** Malformed requests return 400; well-formed requests that are
  mathematically invalid (division by zero, square root of a negative) return 422.
  Errors carry a stable `code` the frontend switches on.
- **Standard library HTTP.** One endpoint does not justify a framework.
- **`useReducer` state machine in the frontend.** The calculator states (typing,
  pending, result, error) are explicit and the reducer is tested without rendering.
- **Single Docker image.** The Go binary serves the API and the embedded frontend
  build, so the whole app runs with one command and has no CORS setup.
- **Playwright for end-to-end, no Testcontainers.** The service is stateless with
  no database or broker, so there is nothing to containerize for integration
  tests; a few browser tests against the real image cover the full path.
- **Fixed precision where a result cannot be exact.** `divide`, `sqrt` and
  negative exponents round to 34 decimal places, half away from zero. Every
  other operation is exact. `sqrt` is an integer square root on `math/big`, so
  there is no `float64` anywhere in the calculation path.
- **Bounded power.** The exponent must be an integer with absolute value up to
  1000, otherwise the request is a 422. `0 ^ 0` is `1` and zero to a negative
  exponent is a division by zero.
- **Bounded input.** A body over 1024 bytes is a 413 and an operand over 64
  characters is a 400, so a request cannot ask for unbounded work.
- **Chaining instead of precedence.** With `12 + 3` typed, pressing another
  operator sends `12 + 3` and the result becomes the first operand of the new
  operation.
- **Enter key.** Enter means Equals when focus is on the calculator itself; on a
  focused key, Enter and Space activate that key, as any button does.

## Assumptions

- Single operation per request; no expression parsing or operator precedence.
- No authentication, persistence or calculation history.
- `percentage` with operands `[a, b]` means `a` percent of `b` (`a × b ÷ 100`, exact).
- Operands use plain decimal notation: no exponent notation, no leading `+`, no
  `.5` or `5.`. JSON numbers are rejected; operands are strings.
- Results are plain decimal strings with no trailing zeros and never `-0`.
- API messages are technical English; the UI maps the error `code` to its own copy.
- The client gives up after 10 seconds and offers a retry.
- The UI accepts at most 16 digits per operand. `√x` while a binary operation is
  pending asks the user to finish it first instead of nesting operations.

## How this was built

AI-assisted, in four steps: project setup, design, behavioral plan, then
implementation one feature per commit. Tests were written in a separate context from the plan (not
from the code), and the final diff got an independent review. The prompts are in
[PROMPTS.md](PROMPTS.md) and the project rules in [CLAUDE.md](CLAUDE.md).
