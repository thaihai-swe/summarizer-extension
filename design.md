# Design — DeepDigest Summarizer Extension

A locked design system for this extension. Every page redesign reads this file before emitting code. Do not regenerate per page — extend or amend this file when the system needs to grow.

## Genre
Precision Studio / Warm Ink & Amber Editorial

## Macrostructure Family
- **Side Panel (App / Main)**: Reading Studio — sticky frosted command dock top, reading progress bar, 4-way ribbon (theme/density/fontScale/language), progressive result workspace center, sticky floating action dock bottom.
- **Settings / Options (App / Config)**: Index-First Studio Dashboard — sticky dynamic tab index, dual-column settings cards, interactive provider cards, and persistent bottom save dock.
- **Content Floating Panel (App / Contextual)**: Contextual Studio Launcher — pill-shaped floating FAB expanding into a clean modal card in Shadow DOM.

## Theme & Palette
- **Brand Primary & Accent**: `#EA580C` (Warm Ember / Vermillion) (Light) / `#F97316` (Glow Ember) (Dark)
- **Primary Ink**: `#18181B` (Warm Deep Charcoal) (Light) / `#FAFAFA` (Pure White) (Dark)
- **Secondary Ink**: `#3F3F46` (Light) / `#D4D4D8` (Dark)
- **Tertiary Ink**: `#71717A` (Light) / `#A1A1AA` (Dark)
- **Canvas Paper**: `#FBFBFA` (Light) / `#09090B` (Dark)
- **Elevated Surface**: `#FFFFFF` (Light) / `#18181B` (Dark)
- **Muted Surface**: `#F3F3F0` (Light) / `#121215` (Dark)
- **Border / Rule**: `#E4E4E7` (Light) / `#27272A` (Dark)
- **Border Strong**: `#D4D4D8` (Light) / `#3F3F46` (Dark)
- **Focus Ring**: `#EA580C` with 3px offset / translucent aura

## Typography
- **Display & Headings**: `Plus Jakarta Sans`, `Inter`, -apple-system, BlinkMacSystemFont, sans-serif (weight 600–800, tight tracking)
- **Body**: `Inter`, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif (weight 400–500)
- **Monospace / Meta**: `JetBrains Mono`, `Fira Code`, ui-monospace, monospace (weight 400–600)

## Spacing & Density
4-point mathematical rhythm with compact adjustments:
- `--space-1` (4px), `--space-2` (8px), `--space-3` (12px), `--space-4` (16px), `--space-5` (20px), `--space-6` (24px), `--space-8` (32px), `--space-10` (40px).

## Motion & Feedback
- Fast microinteractions: `140ms` ease-out (`cubic-bezier(0.16, 1, 0.3, 1)`).
- Normal card entries: `220ms` ease-out.
- Reduced motion fallback: opacity-only, `0.01ms`.
- Visible keyboard focus ring with 3px perimeter on all interactive elements.

## Preserved Contracts & Functionality
- 100% of DOM IDs (`#panel-mode`, `#panel-summarize`, `#save-settings`, `#provider`, `#geminiApiKey`, etc.) remain identical.
- Chrome storage keys, message types, and extraction priority remain untouched.
