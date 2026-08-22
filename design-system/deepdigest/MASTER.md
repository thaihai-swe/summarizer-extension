# Design System Master File — DeepDigest

> **Genre:** Precision Studio / Warm Ink & Ember Editorial
> **Standards:** WCAG 2.2 AA / AAA Compliant (4.5:1 text, 3:1 non-text controls), Reduced Motion First, Dynamic Keyboard Traversal
> **Design Dials:** Variance 5/10 (Balanced / Modern) | Motion 3/10 (Subtle Fast Microinteractions) | Density 8/10 (Studio Dense Workbench)

---

## 1. Global Tokens

### Brand & Surface Colors (Light)
- **Brand Primary Accent:** `#EA580C` (Warm Ember / Vermillion)
- **Brand Hover:** `#C2410C`
- **Brand Subtle / Wash:** `#FFF7ED`
- **Brand Light / Chip:** `#FFEDD5`
- **Text Primary (Ink):** `#18181B`
- **Text Secondary:** `#3F3F46`
- **Text Tertiary:** `#71717A`
- **Canvas Paper:** `#FBFBFA`
- **Surface Elevated:** `#FFFFFF`
- **Surface Muted:** `#F3F3F0`
- **Border / Rule:** `#E4E4E7`
- **Border Strong:** `#D4D4D8`
- **Focus Ring:** `#EA580C` (3px perimeter aura `rgba(234, 88, 12, 0.24)`)

### Brand & Surface Colors (Dark)
- **Brand Primary Accent:** `#F97316` (Luminescent Ember)
- **Brand Hover:** `#FB923C`
- **Brand Subtle / Wash:** `#27140B`
- **Brand Light / Chip:** `#431407`
- **Text Primary (Ink):** `#FAFAFA`
- **Text Secondary:** `#D4D4D8`
- **Text Tertiary:** `#A1A1AA`
- **Canvas Paper:** `#09090B`
- **Surface Elevated:** `#18181B`
- **Surface Muted:** `#121215`
- **Border / Rule:** `#27272A`
- **Border Strong:** `#3F3F46`
- **Focus Ring:** `#F97316` (3px perimeter aura `rgba(249, 115, 22, 0.35)`)

### Typography
- **Display & Headings:** `Plus Jakarta Sans`, `Inter`, -apple-system, sans-serif
- **Body & Controls:** `Inter`, -apple-system, sans-serif
- **Monospace & Code:** `JetBrains Mono`, `Fira Code`, monospace

---

## 2. Options / Settings Specific Guidelines

1. **Header Hero:** Compact, informative studio banner with subtle metadata chip and quick status summary.
2. **Tabbed Navigation:** Sticky top index with animated active pill indicator, responsive horizontal scroll, keyboard Left/Right arrow cycling, Home/End navigation.
3. **Card Architecture:** Clean dual-column grid on desktop, single-column reflow under 820px, visual grouping with subtle kicker labels, refined hover lift, and clear hierarchical boundaries.
4. **Provider Cards:** 3-way interactive cards with instant active states, keyboard activation, status badge, model sub-labels, and integrated test/docs quick action.
5. **Prompt Engine & Multiplier Matrix:** High-density mathematical formula builder with interactive range slider simulation, live word-count calculation, and responsive preset manager.
6. **Live System Prompt Inspector:** Full real-time syntax view with auto-syncing source selector and one-click copy feedback.
7. **Reading Experience Live Preview:** Reactive viewport showing real-time density, font-scale, and theme transformations.
8. **Persistent Save Dock:** Sticky bottom drawer with non-obscured scroll padding (`scroll-padding-bottom: 96px`), keyboard shortcut badge (`⌘S` / `Ctrl+S`), loading state, and accessible toast notifications.
