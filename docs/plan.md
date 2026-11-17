# Implementation plan

Source of truth for behavior. Rules come from [CLAUDE.md](../CLAUDE.md), visuals
from [design/](../design/README.md). Every Given/When/Then below maps to at least
one test. IDs (`B-xx` backend, `F-xx` frontend) are referenced by the slices.

## 1. Decisions

Confirmed with the author before writing this plan:

| Topic | Decision |
| --- | --- |
| Precision | `divide`, `sqrt` and negative exponents round to **34 decimal places**, half away from zero. Every other operation is exact. |
| Power | Exponent must be an **integer with absolute value ≤ 1000**. Anything else is a 422. `0^0 = 1`. `0^-n` is division by zero. |
| Oversized input | Body over **1024 bytes** → `413`. Operand over **64 characters** → `400`. |
| Chaining | With `12 + 3` typed, pressing another operator sends `12 + 3`, and the result becomes the first operand with the new operator selected. |

Decided here (assumptions, cheap to change):

- **Operand grammar**: `^-?[0-9]+(\.[0-9]+)?$`. No exponent notation, no leading
  `+`, no whitespace, no `.5` or `5.`. Operands are JSON strings; JSON numbers
  are rejected as a malformed body.
- **Result format**: plain decimal string, no exponent notation, no trailing
  zeros, no trailing `.`, never `-0`.
- **Validation order**: body size → JSON decode → operation → operand count →
  operand length → operand grammar → math. The first failure is the one reported.
- **sqrt** is computed as an integer square root (`math/big`) of the scaled
  value at 35 places, then rounded to 34. No `float64` anywhere.
- **Percentage** `[a, b]` is `a × b ÷ 100`, exact.
- **Method and path**: Go's router answers a wrong method with its default 405
  and an unknown path with 404. No `Content-Type` enforcement.
- **API messages** are lower-case technical English. The frontend never shows
  them: it maps `code` to the copy in the design.
- **Client timeout**: 10 s, treated as a network failure.
- **Entry limit**: the UI accepts at most 16 digits per operand.

Deviations and design gaps (reported, not silently adapted):

1. **413 is new.** CLAUDE.md lists only 400 and 422. The error contract line
   there should mention 413 for an oversized body.
2. **Enter key conflict.** The design says Enter is the Equals shortcut anywhere
   inside the calculator and also that Enter activates the focused key. Resolved
   as: on a focused key, Enter and Space activate that key; Enter means Equals
   only when focus is on the calculator container (which is focusable).
3. **Power "selected" state.** The mock in `design/index.html` omits
   `aria-pressed` on `xʸ`; the README says all binary operators get it. The
   README wins: `xʸ` and `%` show the selected state.
4. **`√x` while a binary operation is pending** is not designed. It shows a
   validation error (F-14) instead of nesting operations.
5. **A long result reused as an operand** (over 64 characters, e.g. `2 ^ 1000`)
   is rejected by the API with `OPERAND_TOO_LONG`; the UI shows F-24.

Out of scope: expression parsing, operator precedence, history, memory keys,
auth, persistence, an in-app theme toggle, i18n.

## 2. API contract

`POST /api/v1/calculate`

```
Request   {"operation": "add", "operands": ["0.1", "0.2"]}
200       {"result": "0.3"}
4xx/5xx   {"error": {"code": "DIVISION_BY_ZERO", "message": "division by zero"}}
```

| Operation | Operands | Meaning |
| --- | --- | --- |
| `add` | 2 | `a + b` |
| `subtract` | 2 | `a − b` |
| `multiply` | 2 | `a × b` |
| `divide` | 2 | `a ÷ b` |
| `power` | 2 | `a ^ b` |
| `sqrt` | 1 | `√a` |
| `percentage` | 2 | `a`% of `b` |

| Status | Code | When |
| --- | --- | --- |
| 400 | `INVALID_JSON` | Body is not valid JSON, has wrong types, unknown fields or trailing data |
| 400 | `UNKNOWN_OPERATION` | `operation` is not in the registry (including missing or empty) |
| 400 | `INVALID_OPERAND_COUNT` | Wrong number of operands for the operation (including missing) |
| 400 | `OPERAND_TOO_LONG` | An operand is longer than 64 characters |
| 400 | `INVALID_OPERAND` | An operand does not match the grammar |
| 413 | `PAYLOAD_TOO_LARGE` | Body is larger than 1024 bytes |
| 422 | `DIVISION_BY_ZERO` | `divide` by zero, or `power` of zero to a negative exponent |
| 422 | `NEGATIVE_SQRT` | `sqrt` of a negative number |
| 422 | `UNSUPPORTED_EXPONENT` | Exponent is not an integer in `[-1000, 1000]` |
| 500 | `INTERNAL` | Anything unexpected |

All responses, including errors, are `Content-Type: application/json`.

## 3. Backend behaviors

### Operations (`internal/calculator`)

- **B-01 add.** Given operands `2` and `3`, when `add` runs, then the result is `5`.
  Also: `-1.5 + 1.5 = 0`.
- **B-02 add precision.** Given operands `0.1` and `0.2`, when `add` runs, then
  the result is exactly `0.3`.
- **B-03 subtract.** Given `5` and `3`, when `subtract` runs, then the result is
  `2`. Also: `3 − 5 = -2`, `0.3 − 0.1 = 0.2`.
- **B-04 multiply.** Given `4` and `2.5`, when `multiply` runs, then the result
  is `10`. Also: `-2 × 3 = -6`, `0.1 × 0.2 = 0.02`.
- **B-05 divide.** Given `10` and `4`, when `divide` runs, then the result is
  `2.5`. Also: `-7 ÷ 2 = -3.5`.
- **B-06 divide precision.** Given `1` and `3`, when `divide` runs, then the
  result is `0.3333333333333333333333333333333333` (34 places). Given `2` and
  `3`, then `0.6666666666666666666666666666666667`. Given `-2` and `3`, then
  `-0.6666666666666666666666666666666667`.
- **B-07 division by zero.** Given `8` and `0` (or `0.0`), when `divide` runs,
  then it fails with `ErrDivisionByZero`.
- **B-08 power.** Given `2` and `10`, when `power` runs, then the result is
  `1024`. Also: `1.5 ^ 2 = 2.25`, `-2 ^ 3 = -8`, `5 ^ 0 = 1`, `0 ^ 0 = 1`,
  `2 ^ 100 = 1267650600228229401496703205376`, and an exponent written as
  `2.0` counts as an integer.
- **B-09 negative exponent.** Given `2` and `-2`, when `power` runs, then the
  result is `0.25`. Given `3` and `-1`, then
  `0.3333333333333333333333333333333333`.
- **B-10 zero to a negative exponent.** Given `0` and `-1`, when `power` runs,
  then it fails with `ErrDivisionByZero`.
- **B-11 unsupported exponent.** Given `2` and `0.5`, or `2` and `1001`, or `2`
  and `-1001`, when `power` runs, then it fails with `ErrUnsupportedExponent`.
  Exponents `1000` and `-1000` succeed.
- **B-12 sqrt.** Given `9`, when `sqrt` runs, then the result is `3`. Also:
  `√0 = 0`, `√2.25 = 1.5`, `√2 = 1.4142135623730950488016887242096981`.
- **B-13 sqrt of a negative.** Given `-9`, when `sqrt` runs, then it fails with
  `ErrNegativeSqrt`.
- **B-14 percentage.** Given `15` and `200`, when `percentage` runs, then the
  result is `30`. Also: `50% of 0.5 = 0.25`, `-10% of 50 = -5`, `0% of 9 = 0`.
- **B-15 unknown operation.** Given the name `modulo`, when it is looked up,
  then it fails with `ErrUnknownOperation`.
- **B-16 operand count.** Given `add` with 1 or 3 operands, or `sqrt` with 0 or
  2, when it runs, then it fails with `ErrOperandCount`.
- **B-17 result format.** Given `1.50` and `1.50`, when `add` runs, then the
  result is `3` (not `3.00`). Given `-0.5` and `0.5`, then `0` (not `-0`).

### HTTP (`internal/httpapi`)

- **B-20 success.** Given a valid request for each of the seven operations, when
  it is posted, then the status is 200 and the body is `{"result": "<value>"}`.
- **B-21 precision over HTTP.** Given `{"operation":"add","operands":["0.1","0.2"]}`,
  when posted, then the body is exactly `{"result":"0.3"}`.
- **B-22 division by zero.** Given `divide` with `["1","0"]`, when posted, then
  the status is 422 and the code is `DIVISION_BY_ZERO`.
- **B-23 sqrt of a negative.** Given `sqrt` with `["-9"]`, when posted, then the
  status is 422 and the code is `NEGATIVE_SQRT`.
- **B-24 unsupported exponent.** Given `power` with `["2","0.5"]`, when posted,
  then the status is 422 and the code is `UNSUPPORTED_EXPONENT`.
- **B-25 invalid JSON.** Given a body of `{"operation":`, an empty body, `[]`,
  operands as JSON numbers, or two JSON documents in a row, when posted, then
  the status is 400 and the code is `INVALID_JSON`.
- **B-26 unknown field.** Given a valid request plus an extra field, when posted,
  then the status is 400 and the code is `INVALID_JSON`.
- **B-27 unknown operation.** Given `"operation":"modulo"` or no `operation`,
  when posted, then the status is 400 and the code is `UNKNOWN_OPERATION`.
- **B-28 wrong operand count.** Given `add` with one operand, `sqrt` with two, or
  no `operands`, when posted, then the status is 400 and the code is
  `INVALID_OPERAND_COUNT`.
- **B-29 non-numeric operand.** Given an operand of `abc`, `""`, `1e3`, `+1`,
  `.5`, `5.`, `" 1"`, `NaN` or `1,5`, when posted, then the status is 400 and
  the code is `INVALID_OPERAND`.
- **B-30 operand too long.** Given an operand of 65 digits, when posted, then the
  status is 400 and the code is `OPERAND_TOO_LONG`. An operand of 64 digits
  succeeds.
- **B-31 oversized body.** Given a body of 1025 bytes or more, when posted, then
  the status is 413 and the code is `PAYLOAD_TOO_LARGE`.
- **B-32 error shape.** Given any failing request above, then the body is
  `{"error":{"code":"...","message":"..."}}` with a non-empty message and the
  content type is JSON.
- **B-33 wrong method.** Given `GET /api/v1/calculate`, then the status is 405.
- **B-34 static frontend.** Given a file system with `index.html`, when `GET /`
  is requested, then that file is served. `GET /api/unknown` is a 404, not the
  frontend.

### Server (`cmd/server`)

Not unit tested; covered by e2e. Listens on `:8080`. Read header timeout 5 s,
read and write timeouts 10 s, idle timeout 60 s. On SIGINT or SIGTERM it stops
accepting connections and waits up to 10 s for in-flight requests.

## 4. Frontend behaviors

### State model

One `useReducer`. Display states match the design: `idle`, `typing`, `loading`,
`result`, `error`.

| Field | Meaning |
| --- | --- |
| `status` | One of the five states |
| `entry` | The number being typed, as a string (`"0"` when empty) |
| `first` | First operand once a binary operator is chosen |
| `operator` | Selected binary operator, if any |
| `expression` | Text of the expression line |
| `request` | The request in flight or last sent, kept for Retry |
| `nextOperator` | Operator to select after a chained request succeeds |
| `error` | `{kind: validation or api, message, retryable}` or none |

The reducer is pure. Sending the request is an effect in the root component:
when `status` becomes `loading` it calls the API client and dispatches the
outcome. The client returns `ok | api error (code) | network error`.

Display formatting: `-` is rendered as `−`. Expression formats are `a + b`,
`a − b`, `a × b`, `a ÷ b`, `a ^ b`, `√(a)`, `a% of b`, with ` =` appended once
the request is sent. A trailing `.` in an entry is dropped before sending.

### Entering numbers

- **F-01 idle.** Given the app just loaded, then the expression is empty, the
  result shows a muted `0`, the banner slot is empty and every key is enabled.
- **F-02 first digit.** Given idle, when `7` is pressed, then the state is
  typing and the result shows `7` in full color.
- **F-03 more digits.** Given `7` is typed, when `5` is pressed, then the result
  shows `75`. Given `0`, when `0` is pressed, it stays `0`; when `5` is pressed,
  it becomes `5`.
- **F-04 decimal point.** Given idle, when `.` is pressed, then the result shows
  `0.`. Given `1.5`, when `.` is pressed, nothing changes.
- **F-05 entry limit.** Given an entry with 16 digits, when a digit is pressed,
  nothing changes.
- **F-06 toggle sign.** Given `12`, when `±` is pressed, then the result shows
  `−12`; pressed again, `12`. Given `0`, nothing changes.
- **F-07 backspace.** Given `123`, when `⌫` is pressed, then the result shows
  `12`. Given `7` or `−7`, then `0`. In idle and result states nothing changes.
- **F-08 clear.** Given any state except loading, when `AC` is pressed, then the
  app is back to F-01.

### Choosing an operation

- **F-09 binary operator.** Given `12` is typed, when `×` is pressed, then the
  expression shows `12 ×`, the result shows `0`, and the `×` key has
  `aria-pressed="true"`. Same for `+`, `−`, `÷`, `xʸ` (`12 ^`) and `%` (`12% of`).
- **F-10 change operator.** Given `12 ×` with no second operand, when `+` is
  pressed, then the expression shows `12 +` and only `+` is pressed.
- **F-11 second operand.** Given `12 ×`, when `4` is pressed, then the
  expression still shows `12 ×` and the result shows `4`.
- **F-12 equals.** Given `12 × 4`, when `=` is pressed, then the state is
  loading, the expression shows `12 × 4 =`, and one request
  `{multiply, ["12","4"]}` is sent. Each binary operator sends its own
  operation name with `[first, second]`.
- **F-13 square root.** Given `9` is typed with no operator, when `√x` is
  pressed, then the state is loading, the expression shows `√(9) =`, and
  `{sqrt, ["9"]}` is sent. From idle it sends `["0"]`.
- **F-14 square root with a pending operator.** Given `12 ×` or `12 × 4`, when
  `√x` is pressed, then no request is sent and a validation banner says
  "Finish the current operation first."
- **F-15 equals without a second operand.** Given `12 ×`, when `=` is pressed,
  then no request is sent, the state is error, a validation (warning) banner
  says "Enter a second number.", the expression still shows `12 ×`, the result
  shows a muted `0`, and `×` stays pressed.
- **F-16 equals without an operator.** Given idle, typing with no operator, or
  result, when `=` is pressed, then nothing happens.
- **F-17 chaining.** Given `12 + 3`, when `×` is pressed, then the state is
  loading, the expression shows `12 + 3 =`, and `{add, ["12","3"]}` is sent.
  When the response is `15`, then the state is typing, the expression shows
  `15 ×`, the result shows `0` and `×` is pressed.

### Loading

- **F-18 keys locked.** Given a request is pending, then the display has
  `aria-busy="true"`, the previous value is dimmed, every key has
  `aria-disabled="true"` and keeps focus, and clicks and shortcuts do nothing.
- **F-19 delayed indicator.** Given a request is pending, when less than 150 ms
  have passed, then no progress bar is shown; after 150 ms it is shown.

### Result

- **F-20 success.** Given `12 × 4 =` is pending, when the API answers `48`, then
  the state is result, the expression shows `12 × 4 =`, the result shows `48`
  in full color, the keys are enabled and no operator is pressed.
- **F-21 new entry after a result.** Given a result of `48`, when `7` is
  pressed, then the expression is empty and the result shows `7`.
- **F-22 operator after a result.** Given a result of `48`, when `−` is pressed,
  then the expression shows `48 −` and `−` is pressed. When `√x` is pressed
  instead, then `{sqrt, ["48"]}` is sent.
- **F-23 result size.** Given a result of up to 10 characters, then it uses the
  large size; 11 to 14, the medium size; over 14, the small size and it wraps
  without being cut off.

### Errors

- **F-24 API error.** Given a pending request, when the API answers with an
  error code, then the state is error, a danger banner with `role="alert"`
  shows the message below with no Retry button, the expression is unchanged,
  the result shows the last entry muted, and the keys are enabled.

  | Code | Banner message |
  | --- | --- |
  | `DIVISION_BY_ZERO` | Can't divide by zero. |
  | `NEGATIVE_SQRT` | Can't take the square root of a negative number. |
  | `UNSUPPORTED_EXPONENT` | Exponent must be a whole number between −1000 and 1000. |
  | `OPERAND_TOO_LONG` | That number is too long. |
  | anything else | Something went wrong. Try again. |

- **F-25 network error.** Given a pending request, when the fetch fails, times
  out after 10 s, or the response is not the JSON contract, then the state is
  error and a danger banner says "Couldn't reach the server." with a **Retry**
  button.
- **F-26 retry.** Given F-25, when Retry is pressed, then the same request is
  sent again and the state is loading. A chained operator (F-17) is kept.
- **F-27 error during chaining.** Given F-17 is pending, when the API answers
  with an error, then F-24 applies and the chained operator is dropped.
- **F-28 banner clears.** Given any error banner, when any key is pressed, then
  the banner is removed and the key is applied: after a validation error the
  pending operation is still there (`12 ×` then `4` gives `12 × 4`); after an
  API or network error the key is applied as if from idle.
- **F-29 stable layout.** Given any state, then the banner slot keeps its
  height, so the keypad does not move when a banner appears.

### Keyboard and accessibility

- **F-30 shortcuts.** Given focus is inside the calculator, when a shortcut from
  the design table is pressed (`0`–`9`, `.` or `,`, `+`, `-`, `*`, `/`, `^`,
  `r`, `%`, `F9`, `=`, `Backspace`, `Escape`), then it acts exactly like the
  matching key. With Ctrl, Meta or Alt held, or with focus outside the
  calculator, nothing happens.
- **F-31 Enter.** Given focus is on the calculator container, when Enter is
  pressed, then it acts like `=`. Given focus is on a key, when Enter or Space
  is pressed, then only that key is activated, once.
- **F-32 semantics.** Then the calculator is a labelled region, the keypad is a
  group named "Keypad", every key is a button with the accessible name from the
  design table, the result is an `output` with `aria-live="polite"`, the
  expression is labelled "Expression", and Tab visits keys in visual order.
- **F-33 responsive.** Given a 360 px wide viewport, then the page has no
  horizontal scroll and every key is at least 48 px in both dimensions.
  (Checked in e2e; themes and breakpoints come from `tokens.css` unchanged.)

## 5. Feature slices

In order. Each is one commit that builds and passes the checks existing at that
point. The Makefile grows with the slices: a target is added when the thing it
runs exists.

### Slice 1: core arithmetic

- Files: `backend/go.mod`, `backend/go.sum`,
  `backend/internal/calculator/calculator.go` (registry, lookup, sentinel
  errors, result formatting), `backend/internal/calculator/arithmetic.go`,
  `backend/internal/calculator/calculator_test.go`,
  `backend/internal/calculator/arithmetic_test.go`, `Makefile` (`help`, `test`,
  `coverage` for the backend).
- Behaviors: B-01, B-02, B-03, B-04, B-15, B-16, B-17.
- Commit: `feat(calculator): add operation registry with add, subtract and multiply`

### Slice 2: division and percentage

- Files: `backend/internal/calculator/division.go`,
  `backend/internal/calculator/division_test.go`, registry entries.
- Behaviors: B-05, B-06, B-07, B-14.
- Commit: `feat(calculator): add divide and percentage with fixed precision`

### Slice 3: power and square root

- Files: `backend/internal/calculator/power.go`, `power_test.go`, `sqrt.go`,
  `sqrt_test.go`, registry entries.
- Behaviors: B-08, B-09, B-10, B-11, B-12, B-13.
- Commit: `feat(calculator): add power and sqrt`

### Slice 4: calculate endpoint

- Files: `backend/internal/httpapi/handler.go` (decode, validate, call, encode),
  `backend/internal/httpapi/errors.go` (codes and sentinel mapping),
  `backend/internal/httpapi/handler_test.go`.
- Behaviors: B-20 to B-33.
- Commit: `feat(api): add calculate endpoint with error contract`

### Slice 5: server and static files

- Files: `backend/cmd/server/main.go`, `backend/internal/httpapi/router.go`
  (API route plus a file server over an `fs.FS`),
  `backend/internal/httpapi/router_test.go`, `backend/internal/static/static.go`
  (`go:embed` of `dist/`), `backend/internal/static/dist/.gitkeep`,
  `.gitignore` (ignore the rest of `dist/`).
- Behaviors: B-34, server timeouts and graceful shutdown.
- Commit: `feat(api): add server with timeouts, graceful shutdown and embedded static files`

### Slice 6: frontend scaffold

- Files: `frontend/package.json`, `package-lock.json`, `vite.config.ts` (dev
  proxy of `/api` to `:8080`, Vitest config), `tsconfig.json`,
  `eslint.config.js`, `index.html`, `src/main.tsx`, `src/App.tsx` (empty
  labelled calculator region), `src/App.test.tsx`, `src/styles/tokens.css`
  (copied from `design/`), `src/styles/base.css`, `src/test/setup.ts`,
  `Makefile` (`test` and `coverage` also run the frontend).
- Behaviors: the region of F-32 renders; lint, typecheck and Vitest pass.
- Commit: `build(web): scaffold vite react app with design tokens`

### Slice 7: reducer

- Files: `frontend/src/calculator/types.ts`, `reducer.ts`, `format.ts`
  (expression text, request building), `reducer.test.ts`, `format.test.ts`.
- Behaviors: F-01 to F-17, F-20 to F-22, F-24 to F-28 as state transitions
  (no rendering).
- Commit: `feat(web): add calculator reducer state machine`

### Slice 8: API client

- Files: `frontend/src/api/client.ts`, `frontend/src/api/client.test.ts`.
- Behaviors: the client side of F-12, F-13, F-24, F-25: request shape, `ok`,
  API error with code, network failure, timeout, non-contract response. It
  never throws.
- Commit: `feat(web): add api client returning ok or error`

### Slice 9: components

- Files: `frontend/src/components/Display.tsx`, `Keypad.tsx`, `Key.tsx`,
  `ErrorBanner.tsx`, `keys.ts` (key table: label, name, variant, action),
  `calculator.css` (from the reference CSS in `design/index.html`),
  `frontend/src/App.tsx` (reducer, request effect, loading delay),
  `frontend/src/App.test.tsx`.
- Behaviors: F-01, F-09, F-12, F-15, F-18, F-19, F-20, F-23, F-24, F-25, F-26,
  F-29, F-32, tested through the rendered UI by role and label.
- Commit: `feat(web): add display, keypad and error banner`

### Slice 10: keyboard shortcuts

- Files: `frontend/src/calculator/shortcuts.ts` (key event to action),
  `shortcuts.test.ts`, `frontend/src/App.tsx` (key handler on the container),
  `frontend/src/App.test.tsx`.
- Behaviors: F-30, F-31.
- Commit: `feat(web): add keyboard shortcuts`

### Slice 11: Docker

- Files: `Dockerfile` (frontend build, Go build with the frontend copied into
  `internal/static/dist`, minimal final image on port 8080),
  `docker-compose.yml`, `.dockerignore`, `Makefile` (`up`).
- Behaviors: `make up` serves the app and the API on `http://localhost:8080`.
- Commit: `build(docker): add multi-stage image and compose file`

### Slice 12: end-to-end

- Files: `e2e/package.json`, `package-lock.json`, `playwright.config.ts`,
  `e2e/tests/calculator.spec.ts`, `Makefile` (`e2e`: start the stack, run, stop).
- Behaviors: one happy path per operation (F-12, F-13, F-20), chaining (F-17),
  division by zero (F-24), missing second operand (F-15), one keyboard-only
  calculation (F-30), mobile viewport (F-33).
- Commit: `test(e2e): add playwright suite against docker compose`

### Slice 13: documentation

- Files: `README.md` (running without Docker, full examples and error codes,
  coverage numbers, the decisions in section 1), `CLAUDE.md` (413 in the error
  contract).
- Commit: `docs: update readme with commands, api reference and coverage`

## 6. Done when

- `make test`, `make coverage` and `make e2e` pass from a clean clone.
- `make up` followed by a curl of every operation and every error code in
  section 2 returns what this plan says.
- Every `B-xx` and `F-xx` has at least one test.
- No behavior exists in the code that is not in this plan.
