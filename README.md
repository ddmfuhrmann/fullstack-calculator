# Full-stack calculator

A calculator with a React + TypeScript frontend and a Go REST API. The frontend
does no math: every operation is a call to the backend.

> Status: project scaffold. The sections marked _(pending)_ are filled in as the
> implementation lands.

## Setup

Requirements: Docker and Make. For local development without Docker: Go 1.22+ and Node 20+.

```bash
make up
```

Without Make, `docker compose up --build` does the same.

The app and the API are then served on http://localhost:8080.

## Running without Docker

_(pending)_

## API

`POST /api/v1/calculate`

| Operation    | Operands | Example                 |
| ------------ | -------- | ----------------------- |
| `add`        | 2        | `1 + 2`                 |
| `subtract`   | 2        | `5 - 3`                 |
| `multiply`   | 2        | `4 * 2.5`               |
| `divide`     | 2        | `10 / 4`                |
| `power`      | 2        | `2 ^ 10`                |
| `sqrt`       | 1        | `√9`                    |
| `percentage` | 2        | `15% of 200`            |

Operands and results are decimal strings, so no precision is lost in JSON.

```bash
curl -s localhost:8080/api/v1/calculate \
  -H 'Content-Type: application/json' \
  -d '{"operation":"add","operands":["0.1","0.2"]}'
# {"result":"0.3"}
```

```bash
curl -s localhost:8080/api/v1/calculate \
  -H 'Content-Type: application/json' \
  -d '{"operation":"divide","operands":["1","0"]}'
# 422 {"error":{"code":"DIVISION_BY_ZERO","message":"division by zero"}}
```

Full list of examples and error codes: _(pending)_

## Tests and coverage

```bash
make test
```

```bash
make coverage
```

```bash
make e2e
```

`make help` lists every target and the command behind it.

Coverage report: _(pending)_

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

## Assumptions

- Single operation per request; no expression parsing or operator precedence.
- No authentication, persistence or calculation history.
- `percentage` with operands `[a, b]` means `a` percent of `b`.

## How this was built

AI-assisted, in four steps: project setup, design, behavioral plan, then
implementation one feature per commit. Tests were written in a separate context from the plan (not
from the code), and the final diff got an independent review. The prompts are in
[PROMPTS.md](PROMPTS.md) and the project rules in [CLAUDE.md](CLAUDE.md).
