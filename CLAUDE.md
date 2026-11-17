# Full-stack calculator

React frontend that calls a Go REST API for every calculation. Take-home scope
(2–4h): correctness, clarity and maintainability come before extra features.

- Plan: `docs/plan.md` is the source of truth for behavior. Do not expand scope.
- Design: `design/` holds the handoff (tokens, components, states, breakpoints).

## Layout

```
backend/   Go module: cmd/server, internal/calculator, internal/httpapi
frontend/  React + TypeScript + Vite
e2e/       Playwright tests, run against docker compose
design/    Design handoff
docs/      plan.md
Makefile   Single entry point for run, test, e2e and coverage
```

Plain monorepo: no workspace tooling (Turborepo, Nx, go.work). The two projects
share no code, so a root Makefile is enough.

## Backend (Go)

- Stdlib only for HTTP (`net/http`, Go 1.22+ routing). No framework: the API has one endpoint.
- `internal/calculator` is pure (no HTTP, no I/O). `internal/httpapi` decodes, validates, calls it, encodes.
- Operations live in a `map[string]Operation` registry: adding one is a single entry plus its tests.
- Sentinel errors in `calculator` (`ErrDivisionByZero`, `ErrNegativeSqrt`, ...); the handler maps them with `errors.Is`.
- Error contract: `{"error": {"code": "DIVISION_BY_ZERO", "message": "..."}}`.
  400 for malformed requests, 413 for a body over 1024 bytes, 422 for valid requests with a math error.
- Numbers: `shopspring/decimal`, operands and results as JSON strings. No `float64` in the calculation path.
  Division and square root use a fixed, documented precision.
- Limit body size, reject unknown JSON fields, set server timeouts, shut down gracefully.
- Table-driven tests, one table per operation. Handlers tested with `httptest`. No mocks.

## Frontend (React + TypeScript)

- Vite, strict TypeScript, no `any`.
- No state library: one `useReducer` holds the calculator state machine.
- The reducer is pure and tested on its own; components only render and dispatch.
- One API client module returning a discriminated union (`ok | error`). It never throws to the UI.
- No math on the client. Keys are disabled while a request is pending.
- Tests use Vitest + Testing Library and query by role/label, not class or test id.

## Docker

- One multi-stage image: build frontend, build Go, final image runs the Go binary
  serving the API and the embedded static frontend on port 8080.
- `make up` (`docker compose up --build`) is the one-command way to run it.

## Commits

- Conventional Commits: `type(scope): subject`, imperative, lower case, no trailing period.
- Types: `feat`, `fix`, `test`, `docs`, `build`, `chore`, `refactor`. Scopes: `calculator`, `api`, `web`, `e2e`, `docker`.
- One commit per feature slice. A feature and its unit tests go in the same commit.
- Every commit builds and passes the checks that exist at that point.
- Never mix backend and frontend in one commit. No "wip" or "fix review" commits: amend before moving on.

## Checks

The root Makefile wraps the real commands. Targets stay thin (one or two lines
each) and `make help` lists them.

```
make up        # docker compose up --build
make test      # backend: go vet + go test; frontend: lint, typecheck, vitest
make coverage  # coverage reports for both layers
make e2e       # start the stack, run Playwright against it, stop it
```

## General

- No dead code, no commented-out code, no TODOs left behind.
- If a test fails, fix the code, not the test.
- Report any deviation from the plan instead of silently adapting.
