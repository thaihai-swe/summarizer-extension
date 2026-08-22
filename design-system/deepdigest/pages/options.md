# Options Page Overrides — DeepDigest Studio Settings

> **PROJECT:** DeepDigest
> **Page Type:** Studio Dashboard / Configuration Workbench
> **Overrides:** Layout, Density, and Interaction only. Brand tokens remain locked to Warm Ink & Ember.

---

## Page-Specific Rules

### Layout Overrides
- **Max Width:** 1240px studio workbench (not 800px single-column)
- **Layout:** Sticky 240px left rail + fluid canvas
- **Density:** High-density dashboard (8/10)
- **Motion:** Subtle 140–220ms ease-out only

### Color Overrides
- No overrides. Use Master Warm Ember tokens (`#EA580C` / `#F97316`).
- Do **not** apply the generated purple/cyan AI-native palette.

### Component Overrides
- Sticky top tab index + matching left rail links
- Interactive provider cards with Active badge
- Live formula simulator and prompt inspector
- Persistent save dock with `⌘S` / `Ctrl+S` hint
- Keyboard-accessible tabs, provider cards, and password visibility toggles

### Avoid
- Emoji as structural icons
- Heavy chrome or decorative illustrations
- Changing storage keys, field IDs, or save/load contracts
