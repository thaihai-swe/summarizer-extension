# Changelog

All notable changes to the **DeepDigest** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.1] - 2026-09-27

### 🎨 Brand & Icon Identity
- **New Brand Identity**: Introduced **The Illuminated Folio & Distillation Spark**—an open geometric book foundation symbolizing human knowledge with a radiant 4-point AI distillation spark symbolizing clarity and synthesis.
- **Multi-Resolution Icons**: Generated pixel-crisp PNG icons with high-contrast silhouettes for all extension targets:
  - `public/icons/icon-16.png`: Optimized for browser toolbar visibility.
  - `public/icons/icon-48.png`: Formatted for Chrome/Firefox extension management dashboards.
  - `public/icons/icon-128.png`: HiDPI showcase icon for Chrome Web Store & Firefox Add-on listings.
- **Master Vector Asset**: Added master vector SVG source at `public/icons/icon.svg`.
- **In-App Brand Lockup**: Replaced outdated placeholder marks across the side panel header, options rail, and showcase pages with the new brand mark.

### 📐 System Design & Token Architecture
- **Three-Layer Token Architecture**: Rebuilt `tokens.css` with foundational Layer 1 (Primitive), Layer 2 (Semantic), and Layer 3 (Component) tokens.
- **Precision Studio Dual Themes**:
  - **Light Theme (Warm Parchment & Terracotta Ember)**: High-legibility warm paper canvas (`#FAF8F5`), pure elevated cards (`#FFFFFF`), rich ink typography (`#1C1917` with 15.3:1 contrast ratio), and terracotta brand accent (`#C2410C`).
  - **Dark Theme (Nocturne Obsidian & Radiant Spark)**: Deep obsidian canvas (`#12100E`), elevated dark surfaces (`#1F1C1A`), soft ivory text (`#F7F4EE` with 16.1:1 contrast ratio), and warm ember brand accent (`#FB923C`).
- **Dynamic Font Scaling**: Native support for dynamic user font multipliers (`0.90×` sm, `1.00×` md, `1.12×` lg, `1.25×` xl).
- **Mathematical Spacing Rhythm**: Standardized 4px spacing scale (`--space-0-5` [2px] to `--space-16` [64px]).
- **Design System Documentation**: Added formal specification documents at `docs/DESIGN_SYSTEM.md` and `design-system/deepdigest/MASTER.md`.

### 🖥️ Side Panel Workspace UI/UX
- **Glassmorphic Sticky Header**: Added `backdrop-filter: blur(16px)` frosted glass styling with live pulsing status badge (`Ready`, `Busy`, `Error`).
- **Custom Select Chevrons**: Replaced default browser select dropdown arrows with custom SVG chevrons styled for both light and dark themes.
- **Redesigned Studio Empty State**:
  - Added an orbital vector illustration with a radiant distillation halo.
  - Added source capability pills (*YouTube & Timestamps*, *Articles & News*, *Research PDFs*, *Course Lessons*).
  - Clean 3-step numbered workflow with keyboard shortcut badge (`⌘⇧S`).
- **Executive Takeaways**: Upgraded with glowing emerald accent bullet pips and click-to-copy feedback.
- **Main Summary Brief**: Enhanced reading typography with serif pairing (`Newsreader`/`Lora`) and comfortable 1.55 line height.
- **Deep Dive Accordions**: Smooth 90-degree rotating chevrons on expand/collapse, toolbar controls (*Expand all* / *Collapse all*), and highlighted warning borders for weak sections flagged by quality audits.
- **Follow-up Chat Studio**:
  - Added segmented grounding pill toggle (**Source** vs **General**).
  - Differentiated message bubbles with role avatars, source badges, and response copy buttons.
  - Auto-expanding textarea with focus glow.
- **Floating Action Bar (FAB)**: Centered bottom floating pill dock with frosted glass blur (`blur(14px)`), elevated drop shadows, and quick export actions (*Copy*, *Markdown*, *Text*, *Clear*, *Generate*).

### ⚙️ Options & Settings Studio
- **Sidebar Rail Navigation**: Clean sticky rail navigation with section icons, active indicator pills, and live engine status summary.
- **Refined Form Fields**: Modernized text inputs, API key visibility toggles, prompt editors, and custom styled select menus.

### ♿ Accessibility (WCAG 2.2 AA / AAA)
- **Contrast Ratios**: Body text contrast exceeds 15:1 in both light and dark modes (exceeding AAA standard of 7:1).
- **Keyboard Navigation**: Universal `:focus-visible` high-contrast outline (`3px solid var(--color-border-focus); outline-offset: 2px`).
- **Reduced Motion**: Complete `@media (prefers-reduced-motion: reduce)` overrides across all shimmers, transitions, and animations.

---

## [0.1.0] - 2026-09-22

### Added
- Initial extension release with Chrome Side Panel and Firefox Sidebar support.
- Multi-source extractors for YouTube transcripts, webpages, PDFs, and course lessons (Coursera, Udemy).
- Provider integrations for Gemini, OpenAI, and Local LLMs (Ollama, LM Studio).
- Markdown and plain text export capabilities.
