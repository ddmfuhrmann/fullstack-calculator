# Calculator design handoff

- [`tokens.css`](tokens.css): design tokens as CSS custom properties, light and dark.
- [`index.html`](index.html): every state rendered with those tokens, plus reference
  CSS for each component. Open it in a browser; "Switch theme" flips light/dark.

The frontend computes nothing: `=` and `√x` send a request and the UI waits for
the answer, so every screen below has a loading and an error path.

## Layout

One card, three stacked regions, always in this order:

1. **Display**: expression line (small, muted) over the result line (large).
2. **ErrorBanner slot**: fixed 44px tall even when empty, so the keypad never
   shifts under the thumb when an error appears.
3. **Keypad**: 4 columns.

```
[   √x    ] [    xʸ   ]     function row: 2 keys, each spans 2 columns
[ AC ] [ ⌫ ] [ % ] [ ÷ ]
[ 7  ] [ 8 ] [ 9 ] [ × ]
[ 4  ] [ 5 ] [ 6 ] [ − ]
[ 1  ] [ 2 ] [ 3 ] [ + ]
[ ±  ] [ 0 ] [ . ] [ = ]
```

## Tokens

All values live in `tokens.css`; this is the summary.

### Color

| Token | Light | Dark | Used for |
| --- | --- | --- | --- |
| `--color-bg` | `#f3f4f7` | `#0e1014` | Page background |
| `--color-surface` | `#ffffff` | `#171a21` | Calculator card |
| `--color-border` | `#d5d9e0` | `#323845` | Display divider |
| `--color-text` | `#14161a` | `#f2f4f7` | Result, digit keys |
| `--color-text-muted` | `#5b6270` | `#a3abba` | Expression, idle/error result |
| `--color-key` / `-hover` | `#eef0f3` / `#e1e4ea` | `#232731` / `#2d323e` | Digit keys |
| `--color-key-fn` / `-hover` | `#dfe3e9` / `#d0d5de` | `#2f3541` / `#3a414f` | AC, ⌫, ± |
| `--color-accent` / `-hover` | `#4338ca` / `#3730a3` | `#8b93ff` / `#a5abff` | Equals key, loading bar |
| `--color-on-accent` | `#ffffff` | `#0e1014` | Text on accent |
| `--color-accent-soft` / `-hover` | `#e8e7fb` / `#d9d7f7` | `#25284d` / `#303461` | Operator keys |
| `--color-accent-text` | `#3730a3` | `#c7caff` | Operator key labels |
| `--color-focus` | `#4338ca` | `#8b93ff` | Focus ring |
| `--color-danger-bg` / `-text` / `-border` | `#fdecea` / `#a11b12` / `#f3b8b2` | `#3a1614` / `#ffb4ab` / `#6b2a25` | ErrorBanner, API error |
| `--color-warning-bg` / `-text` / `-border` | `#fff4d6` / `#7a4d00` / `#ecd08a` | `#33270a` / `#f5c563` / `#5c4712` | ErrorBanner, validation error |

Indigo is the single accent. Danger and warning are semantic and appear only in
the ErrorBanner.

Contrast (WCAG 2.1): every text pair is at least 5.5:1 in both themes (AA needs
4.5:1); the focus ring is 7.9:1 (light) and 6.4:1 (dark) against the surface
(AA needs 3:1).

Theme: follows `prefers-color-scheme`. `<html data-theme="light|dark">` forces
one. No in-app toggle is designed.

### Spacing, radius, sizing

| Token | Value |
| --- | --- |
| `--space-1` … `--space-6` | 4, 8, 12, 16, 24, 32px |
| `--radius-key` / `--radius-banner` / `--radius-card` | 12 / 10 / 20px |
| `--key-height` | 56px (64px from 768px) |
| `--key-height-fn-row` | 48px (52px from 768px) |
| `--key-gap` | 8px (10px from 480px) |
| `--banner-slot-height` | 44px |
| `--focus-ring-width` / `--focus-ring-offset` | 2px / 2px |

### Type

System font stack (`--font-sans`), `font-variant-numeric: tabular-nums` on the
display and keys.

| Token | Value | Used for |
| --- | --- | --- |
| `--font-expression` | 400 16/24 | Expression line |
| `--font-result` | 500 40/48 (48/56 from 768px) | Result up to 10 characters |
| `--font-result-md` | 500 32/48 (36/56) | Result of 11 to 14 characters |
| `--font-result-sm` | 500 24/32 (28/36) | Result over 14 characters; wraps onto more lines, never truncated |
| `--font-key` | 500 20/24 | Key labels |
| `--font-banner` | 400 14/20 | ErrorBanner |

### Motion

- `--duration-fast` (100ms): key background and press scale.
- `--loading-delay` (150ms): the loading indicator only appears if the request
  takes longer than this, so fast responses do not flicker.
- `prefers-reduced-motion: reduce`: no key transition; the loading bar is static.

## Breakpoints

Mobile-first. Three sizes, two media queries.

| Range | Layout |
| --- | --- |
| Base (360px, usable down to 320px) | Card fills the width with 16px page gutters. Keys 56px tall, 8px gap. |
| `min-width: 480px` | Card centered, `max-width: 400px`. Gap 10px. |
| `min-width: 768px` | Card centered horizontally and vertically, `max-width: 420px`. Keys 64px tall, result 48px. |

The keypad never grows past 420px wide: on desktop it stays the same shape, not
a stretched grid. Every key is at least 48px in both dimensions at every size.

## Components

### Display

Two right-aligned lines. The result is an `<output aria-live="polite">`, so
screen readers announce new results. The expression has `aria-label="Expression"`.

| State | Expression line | Result line |
| --- | --- | --- |
| Idle | Empty (keeps its 24px height) | `0`, muted |
| Typing | First operand and operator, e.g. `12 ×` | Current entry, full color |
| Loading | Full expression, e.g. `12 × 4 =` | Previous value at 40% opacity; 2px accent bar animating on the bottom edge; `aria-busy="true"` |
| Result | Full expression, e.g. `12 × 4 =` | API result, full color |
| Error (validation or API) | What the user entered, unchanged | Last entry, muted |

Expression formats: `a + b`, `a − b`, `a × b`, `a ÷ b`, `a ^ b`, `√(a)`,
`a% of b`.

### Keypad

`role="group"` with `aria-label="Keypad"`, CSS grid of 4 equal columns. DOM order
is the visual order, so Tab moves left to right, top to bottom.

| State | Behavior |
| --- | --- |
| Enabled | All keys interactive |
| Loading | All keys disabled until the response arrives |

### Key

A `<button type="button">`. Four variants:

| Variant | Keys | Background / text |
| --- | --- | --- |
| Digit | `0`–`9`, `.` | `--color-key` / `--color-text` |
| Function | `AC`, `⌫`, `±` | `--color-key-fn` / `--color-text` |
| Operator | `+`, `−`, `×`, `÷`, `%`, `xʸ`, `√x` | `--color-accent-soft` / `--color-accent-text` |
| Equals | `=` | `--color-accent` / `--color-on-accent` |

| State | Visual |
| --- | --- |
| Default | Variant background |
| Hover | Variant `-hover` background |
| Pressed | `-hover` background and `transform: scale(0.97)` |
| Focus (`:focus-visible`) | 2px `--color-focus` outline, 2px offset |
| Disabled | 45% opacity, `cursor: not-allowed` |
| Selected (binary operators only) | 2px inset `--color-accent` ring, `aria-pressed="true"`, while waiting for the second operand |

Disabled keys use `aria-disabled="true"` and ignore activation instead of the
`disabled` attribute, so keyboard focus is not lost while a request is pending.

Accessible names and keyboard shortcuts:

| Key | `aria-label` | Keyboard |
| --- | --- | --- |
| `0`–`9` | (the digit) | `0`–`9` |
| `.` | Decimal point | `.` or `,` |
| `+` | Add | `+` |
| `−` | Subtract | `-` |
| `×` | Multiply | `*` |
| `÷` | Divide | `/` |
| `xʸ` | Power | `^` |
| `√x` | Square root | `r` |
| `%` | Percent of | `%` |
| `±` | Toggle sign | `F9` |
| `=` | Equals | `Enter` or `=` |
| `⌫` | Backspace | `Backspace` |
| `AC` | Clear | `Escape` |

Shortcuts work wherever focus is inside the calculator. Every key is also
reachable with Tab and activated with Space or Enter.

### ErrorBanner

Sits in the fixed slot between Display and Keypad. `role="alert"`, icon plus one
line of text (wraps to two at 360px if needed), optional action button on the
right. Errors are never signaled by color alone: the icon and the message carry
the meaning.

| State | Visual | Example message |
| --- | --- | --- |
| Hidden | Empty 44px slot | |
| Validation error | Warning colors | "Enter a second number." |
| API error, math | Danger colors | "Can't divide by zero." / "Can't take the square root of a negative number." |
| API error, network | Danger colors plus a **Retry** button | "Couldn't reach the server." |

The banner clears on the next key press. Keys stay enabled in every error state.
Retry resends the same request and takes the app back to Loading.
