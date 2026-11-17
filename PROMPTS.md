# Prompts

The prompts used to build this project, in the order they were run.
Project rules shared by every prompt live in [CLAUDE.md](CLAUDE.md).

Workflow: project setup → design → behavioral plan → implementation per feature,
with tests written in a separate context and an independent review at the end.

## 1. Project setup

Tool: Claude Code. Output: `CLAUDE.md`, `PROMPTS.md`, `README.md`, `.gitignore`.

```text
Initialize this repository for a full-stack calculator take-home (2–4h budget):
React + TypeScript frontend consuming a Go REST API, shipped with Docker.
Do not write application code yet.

Create:
- CLAUDE.md: the project rules every later prompt must follow. Concrete
  decisions only, each one defensible in a sentence, no generic "best practices":
  - Backend: stdlib net/http, a pure calculator package separate from the HTTP
    layer, operations in a registry, sentinel errors mapped by the handler,
    a stable JSON error contract (400 malformed, 422 math errors), decimal
    arithmetic instead of float64, table-driven tests with no mocks.
  - Frontend: Vite, strict TypeScript, a useReducer state machine, one typed
    API client that never throws to the UI, no math on the client.
  - Docker: one multi-stage image where the Go binary serves the embedded
    frontend, started with docker compose.
  - Commits: Conventional Commits, one commit per feature slice with its tests,
    never mixing backend and frontend, every commit building and passing.
  - Plain monorepo with a root Makefile (up, test, coverage, e2e) as the single
    entry point, no workspace tooling.
- PROMPTS.md: every prompt used in this project, in order, starting with this one.
- README.md: setup, API examples, design decisions and assumptions. Mark as
  pending whatever cannot be true until the code exists.
- .gitignore for Go, Node, coverage and Playwright output.

Run git init on main. Do not commit until I review the files.
```

## 2. Design

Tool: Claude Design. Output committed to `design/`.

```text
Design a calculator web app UI (React + TypeScript will implement it).

Operations: add, subtract, multiply, divide, plus exponent, square root, percentage.
The frontend does NOT compute anything — every result comes from a REST API, so
design for async.

Required states: idle, typing, loading (awaiting API), result, validation error
(invalid input), API error (division by zero, sqrt of negative, network failure).

Requirements:
- Standard keypad layout + display showing current expression and result
- Full keyboard support, visible focus states, accessible labels and contrast
- Responsive: mobile-first (360px) up to desktop, keypad stays thumb-friendly
- Clean, minimal, one accent color, light and dark theme

Deliver a handoff: design tokens (colors, spacing, type), component list
(Display, Keypad, Key, ErrorBanner), every state per component, and breakpoints.
```

## 3. Plan

Tool: Claude Code. Output: `docs/plan.md`.

```text
Read CLAUDE.md and the design handoff in ./design, then write an implementation
plan for a full-stack calculator. This is a take-home with a 2–4h budget:
prioritize correctness, clarity and maintainability over features.

Backend: POST /api/v1/calculate {operation, operands} -> {result} or
{error: {code, message}}. Operations: add, subtract, multiply, divide, power,
sqrt, percentage.

Specify every behavior as Given/When/Then, one per operation and one per error
case: division by zero, sqrt of negative, invalid JSON, unknown operation, wrong
operand count, non-numeric operand, oversized input, and 0.1 + 0.2 precision.
Do the same for the frontend: each UI state in the design and each transition.

Then split the work into feature slices, in order, each one small enough to be a
single conventional commit that builds and passes its own tests. For each slice
list the files, the behaviors it covers and the commit message.

Do not write code. Ask me about anything ambiguous before finalizing, then save
the plan to docs/plan.md.
```

## 4. Implementation, tests and end-to-end

Tool: Claude Code.

```text
Implement docs/plan.md exactly, following CLAUDE.md. No scope expansion.

Work one feature slice at a time, in the plan's order. For each slice:
1. Implement the production code.
2. Have a subagent write the tests reading only docs/plan.md and the public
   API of the slice, not the implementation. Every Given/When/Then in the slice
   maps to at least one test.
3. Run the checks for that layer. If a test fails, fix the code, not the test.
4. Commit the slice as one conventional commit (feature + its tests together).

Create the root Makefile in the first slice and add each target when the thing
it runs exists, so `make test` works from the first commit on.

After the last slice:
- make up, then curl every operation and every error case.
- make e2e: Playwright against the running container, with one happy path per
  operation, division by zero, invalid input, and a mobile viewport check.
- make coverage: reports for backend and frontend.
- Update README.md with the real commands, curl examples and coverage numbers.

Finally, have a fresh subagent review the full diff against docs/plan.md and
CLAUDE.md, reporting deviations, untested edge cases and dead code. Fix what it
finds inside the commit it belongs to, rerun every check, and show me the output.
```
