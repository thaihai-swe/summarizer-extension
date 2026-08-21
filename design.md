# Design — DeepDigest Summarizer Extension

A locked design system for this extension. Every page redesign reads this file before emitting code. Do not regenerate per page — extend or amend this file when the system needs to grow.

## Genre
modern-minimal

## Macrostructure family
- Side Panel (App / Main): Workbench — sticky command dock top, result workspace center, floating action bar bottom.
- Settings / Options (App / Config): Index-First — sticky tab bar, clear progressive disclosure for provider/prompt configuration.
- Content Floating Panel (App / Contextual): Contextual Workbench — floating launcher chip expanding to compact modal summary container.

## Theme
- `--color-paper`: `oklch(98.5% 0.005 240)` (light) / `oklch(14% 0.01 240)` (dark)
- `--color-paper-2`: `oklch(96% 0.008 240)` (light) / `oklch(18% 0.015 240)` (dark)
- `--color-ink`: `oklch(18% 0.02 240)` (light) / `oklch(98% 0.005 240)` (dark)
- `--color-ink-2`: `oklch(42% 0.02 240)` (light) / `oklch(78% 0.01 240)` (dark)
- `--color-rule`: `oklch(90% 0.01 240)` (light) / `oklch(26% 0.015 240)` (dark)
- `--color-accent`: `oklch(58% 0.22 260)` (electric cobalt)
- `--color-focus`: `oklch(62% 0.22 260)`

## Typography
- Display: Inter Tight, Inter, system-ui, sans-serif, weight 600–700
- Body: Inter, system-ui, sans-serif, weight 400–500
- Mono: JetBrains Mono, Fira Code, ui-monospace, monospace, weight 400–500

## Spacing
4-point named scale. `--space-1` (4px), `--space-2` (8px), `--space-3` (12px), `--space-4` (16px), `--space-5` (20px), `--space-6` (24px), `--space-8` (32px), `--space-10` (40px).

## Motion
- Easings: `cubic-bezier(0.16, 1, 0.3, 1)` named `--ease-out`
- Reveal pattern: minimal slide + fade (max 150ms)
- Reduced-motion fallback: opacity-only, ≤ 100 ms.

## Microinteractions stance
- Silent success for inline copy/export actions.
- Hover delay 0–150ms, focus ring instant (0ms).
- Clear state transitions for idle, loading, error, and pass statuses.

## CTA voice
- Primary CTA: Cobalt fill, compact radius, crisp white text (`Generate`, `Save Settings`).
- Secondary CTA: Muted surface with refined hairline border (`Markdown`, `Text`, `Cancel`).

## Per-page allowances
- Side Panel: Workbench layout optimized for narrow viewports (300px–450px).
- Settings Page: Index-First layout optimized for desktop options viewing.
- Content Script UI: Shadow DOM root maintaining independent scope.

## What pages MUST share
- Identical OKLCH / CSS custom property palette mappings across light and dark modes.
- Shared display, body, and monospace font families.
- Focus ring style (`outline: 3px solid var(--color-border-focus); outline-offset: 2px;`).
- Standard status badge colors (success: emerald, warning: amber, error: ruby, busy: cobalt).

## What pages MAY differ on
- Density layouts (side panel uses compact vertical scale; settings page uses relaxed 1180px max-width layout).

## Exports

### tokens.css
The canonical token source is emitted in `tokens.css` at the project root. Existing page styles keep their compatibility aliases so runtime behavior and settings remain stable.
