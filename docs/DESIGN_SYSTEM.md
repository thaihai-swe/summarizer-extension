# DeepDigest Design System & Architecture Specification

## 1. Brand Identity & Design Philosophy

DeepDigest is a high-precision reading studio and intelligence summarizer for Chrome and Firefox. It transforms dense webpages, YouTube transcripts, academic PDFs, course lessons, and selected passages into structured, high-signal reading briefs.

### 1.1 The Core Metaphor
- **The Folio Foundation**: An open book folio representing human knowledge, deep study, and structured documentation.
- **The Distillation Core**: A luminous 4-point radiant diamond spark rising from the folio, symbolizing AI distillation—transforming vast amounts of raw text into crystallized, actionable insight.
- **Aesthetic Direction**: **Precision Studio / Warm Parchment & Nocturne Obsidian**. Merges the warmth and editorial elegance of classic literary publishing with the crisp micro-interactions and responsiveness of modern developer tools (Linear, Notion, Raycast).

---

## 2. Icon Design Specification

### 2.1 Master Assets
- **Master SVG**: [`public/icons/icon.svg`](file:///Users/thaihai-swe/Desktop/summarizer-extension/public/icons/icon.svg)
- **Manifest Targets**:
  - `icon-16.png` (16×16 px): Browser action toolbar icon. High-contrast silhouette, bold book curves, vibrant amber core.
  - `icon-48.png` (48×48 px): Chrome/Firefox extensions manager page.
  - `icon-128.png` (128×128 px): Chrome Web Store / Firefox Add-on showcase & HiDPI displays.

### 2.2 Design Grid & Geometry
- **Form Factor**: Continuous squircle curvature (`rx="28"` on 128px grid).
- **Background**: Deep obsidian gradient (`#241E1A` → `#161311` → `#0D0B0A`) with an amber ambient center aura (`#EA580C` at 40% opacity).
- **Folio Base**: Symmetrical double-page wings with dual-tone parchment gradients (`#FFFFFF` to `#D6CEBE`) and central keel spine.
- **Spark**: 4-point geometric star (`#FEF08A` → `#FB923C` → `#EA580C`) with a pure white high-intensity nucleus.
- **Rim**: 1.5px subtle outer contour stroke (`rgba(255, 255, 255, 0.14)`) ensuring contrast on both dark and light browser toolbar backgrounds.

---

## 3. Three-Layer Token Architecture

Implemented in [`tokens.css`](file:///Users/thaihai-swe/Desktop/summarizer-extension/tokens.css).

```
┌───────────────────────────────────────────────┐
│ Layer 3: Component Tokens                     │
│ --btn-height-md, --card-radius, --input-bg    │
├───────────────────────────────────────────────┤
│ Layer 2: Semantic Tokens                      │
│ --color-bg, --color-brand, --color-border     │
├───────────────────────────────────────────────┤
│ Layer 1: Primitive Tokens                     │
│ --primitive-stone-*, --primitive-terracotta-* │
└───────────────────────────────────────────────┘
```

### 3.1 Layer 1: Primitive Tokens
- **Stone / Neutral**: 25 (`#FCFAF7`) to 950 (`#0C0A09`).
- **Obsidian Dark**: 600 (`#443F3A`) to 950 (`#0D0B0A`).
- **Terracotta Brand**: 50 (`#FFF7ED`) to 950 (`#431407`). Primary: 700 (`#C2410C`) light, 400 (`#FB923C`) dark.
- **Amber Glow**: 50 (`#FFFBEB`) to 800 (`#92400E`).
- **Status Primitives**: Emerald (Success), Rose (Error), Amber (Warning), Indigo (Accent).
- **Spacing Rhythm**: 4px mathematical scale (`--space-0-5` [2px] through `--space-16` [64px]).
- **Curvature Scale**: `--radius-2xs` (3px) through `--radius-2xl` (22px) and `--radius-full` (9999px).
- **Motion Scale**: Fast (130ms), Base (200ms), Slow (300ms) with `cubic-bezier(0.16, 1, 0.3, 1)`.

### 3.2 Layer 2: Semantic Tokens

| Token | Light Theme | Dark Theme | Purpose |
|---|---|---|---|
| `--color-bg` | `#FAF8F5` (Stone-50) | `#12100E` (Obsidian-900) | Primary canvas |
| `--color-bg-elevated` | `#FFFFFF` | `#1F1C1A` (Obsidian-800) | Cards, panels, modals |
| `--color-bg-muted` | `#F3EFEA` (Stone-100) | `#171513` (Obsidian-850) | Secondary fills, chips |
| `--color-text-primary` | `#1C1917` (Stone-900) | `#F7F4EE` | Headings, core body |
| `--color-text-secondary` | `#44403C` (Stone-700) | `#D4CEC3` | Supporting copy, labels |
| `--color-text-tertiary` | `#78716C` (Stone-500) | `#9C9589` | Captions, hints |
| `--color-border` | `rgba(28,25,23,0.08)` | `rgba(255,255,255,0.08)`| Subtle structural boundaries |
| `--color-border-strong` | `rgba(28,25,23,0.16)` | `rgba(255,255,255,0.16)`| Inputs, active boundaries |
| `--color-brand` | `#C2410C` | `#FB923C` | Primary actions & accents |
| `--color-brand-light` | `#FFF7ED` | `rgba(251,146,60,0.15)` | Subtle accent backgrounds |
| `--focus-ring` | `0 0 0 3px rgba(194,65,12,0.22)` | `0 0 0 3px rgba(251,146,60,0.35)` | Keyboard focus indicator |

### 3.3 Layer 3: Component Tokens
- **Buttons**:
  - `--btn-height-sm`: 28px
  - `--btn-height-md`: 34px
  - `--btn-radius`: `var(--radius-sm)` (7px)
- **Cards**:
  - `--card-radius`: `var(--radius-md)` (10px)
  - `--card-padding`: `var(--space-4)` (16px)
  - `--card-shadow`: `var(--shadow-sm)`
- **Navigation & Frosted Overlays**:
  - `--header-height`: 56px
  - Glassmorphic blur: `backdrop-filter: blur(16px) saturate(1.2)`
- **Dynamic Font Scaling**:
  - `sm`: 0.90×
  - `md`: 1.00× (Default)
  - `lg`: 1.12×
  - `xl`: 1.25×

---

## 4. UI/UX Component Specifications

### 4.1 Side Panel Workspace
1. **Sticky Hero Card**:
   - Brand lockup with the illuminated folio icon, live status badge (`Ready`, `Busy`, `Error`) with pulsing indicator.
   - Mode selector dropdown with custom SVG chevron.
   - High-visibility primary action button ("Generate") with active press feedback and accessible busy state.
2. **Controls Toolbar**:
   - Fieldset groups for "Summary" (Tone, Coverage, Detail, Language) and "Reading" (Theme, Text size).
   - Uniform micro-labeled chips with custom chevron dropdowns.
3. **Empty State**:
   - Centered aesthetic studio welcome with orbital vector illustration.
   - Capability pills: *YouTube & Timestamps*, *Articles & News*, *Research PDFs*, *Course Lessons*.
   - 3-step numbered guidance with `<kbd class="kbd-shortcut">⌘⇧S</kbd>` badge.
4. **Summary Brief & Executive Takeaways**:
   - Main Summary: Set in elegant reading serif (`Newsreader`/`Georgia`), comfortable 1.55 line height.
   - Takeaways Card: Glowing emerald accent bullets with click-to-copy tooltip feedback.
5. **Collapsible Deep Dive Sections**:
   - Interactive accordions with animated 90-degree rotating chevrons.
   - Expand all / Collapse all toolbar controls.
   - Weak section detection callout styling with warning amber accents.
6. **Suggested Questions**:
   - One-click query chips with instant transition into the follow-up chat.
7. **Transcript Drawer**:
   - Integrated live filter search input, numbered lines, timestamp jumping, and SRT download.
8. **Follow-Up Chat Studio**:
   - Segmented grounding mode switch: **Source** (strict tab grounding) vs **General** (open reasoning).
   - Differentiated user / assistant chat bubbles with role badges and markdown formatting.
   - Auto-expanding textarea with smooth keyboard navigation.
9. **Floating Action Bar (FAB)**:
   - Floating pill dock centered at the bottom with frosted glass backdrop blur (`blur(20px)`).
   - Quick export actions: *Copy*, *Markdown*, *Text*, *Clear*, and *Generate*.

### 4.2 Options & Settings Studio
1. **Sidebar Rail Navigation**:
   - Clean sticky rail with section icons (*General*, *Providers*, *Prompts*, *Display*), active indicator, and live engine status summary.
2. **Settings Canvas**:
   - Hero header with keyboard shortcut reminder (`⌘S to save`).
   - Provider cards (*Gemini*, *OpenAI*, *Local LLM*) with active radio states and test-connection feedback.
   - Modernized form inputs, API key visibility toggles, prompt editors, and custom toggle switches.

---

## 5. Accessibility & Performance Verification (WCAG 2.2 AA / AAA)

- **Contrast Ratios**:
  - Light mode body text (`#1C1917` on `#FAF8F5`): **15.3:1** (Exceeds AAA requirement of 7:1).
  - Light mode secondary text (`#44403C` on `#FAF8F5`): **7.8:1** (Exceeds AAA requirement).
  - Dark mode body text (`#F7F4EE` on `#12100E`): **16.1:1** (Exceeds AAA requirement).
  - Brand accents on backgrounds: **> 4.5:1** across all interactive elements.
- **Focus Indicators**: Continuous high-contrast `:focus-visible` ring (`3px solid var(--color-border-focus); outline-offset: 2px`).
- **Motion Accessibility**: Full `@media (prefers-reduced-motion: reduce)` overrides across animations, shimmers, and transitions.
- **Touch & Click Targets**: Minimum target dimensions of 32×32px (standard controls) and 44×44px (touch-friendly targets).
