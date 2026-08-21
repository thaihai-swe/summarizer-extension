(function () {
    const THEME_VALUES = new Set(["system", "light", "dark"]);
    const DENSITY_VALUES = new Set(["compact", "comfortable"]);
    const FONT_SCALE_VALUES = new Set(["sm", "md", "lg"]);

    function normalizeTheme(theme) {
        const value = String(theme || "system").toLowerCase();
        return THEME_VALUES.has(value) ? value : "system";
    }

    function normalizeDensity(density) {
        const value = String(density || "comfortable").toLowerCase();
        return DENSITY_VALUES.has(value) ? value : "comfortable";
    }

    function normalizeFontScale(scale) {
        const value = String(scale || "md").toLowerCase();
        return FONT_SCALE_VALUES.has(value) ? value : "md";
    }

    function resolveTheme(theme) {
        const normalized = normalizeTheme(theme);
        if (normalized !== "system") {
            return normalized;
        }
        if (typeof window !== "undefined" && window.matchMedia) {
            return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        }
        return "light";
    }

    function applyThemeToDocument(theme, root) {
        const target = root || document.documentElement;
        const resolved = resolveTheme(theme);
        target.dataset.theme = resolved;
        target.style.colorScheme = resolved;
        return resolved;
    }

    function applyDensityToDocument(density, root) {
        const target = root || document.documentElement;
        const normalized = normalizeDensity(density);
        target.dataset.density = normalized;
        return normalized;
    }

    function applyFontScaleToDocument(scale, root) {
        const target = root || document.documentElement;
        const normalized = normalizeFontScale(scale);
        target.dataset.fontScale = normalized;
        return normalized;
    }

    function watchSystemTheme(callback) {
        if (typeof window === "undefined" || !window.matchMedia) {
            return function () {};
        }
        const media = window.matchMedia("(prefers-color-scheme: dark)");
        const handler = () => callback(media.matches ? "dark" : "light");
        if (typeof media.addEventListener === "function") {
            media.addEventListener("change", handler);
            return function () {
                media.removeEventListener("change", handler);
            };
        }
        media.addListener(handler);
        return function () {
            media.removeListener(handler);
        };
    }

    const sharedTokens = `
:host, :root {
  --font-display: "Inter Tight", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-sans: var(--font-display);
  --font-body: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-mono: "JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
  --text-display: clamp(1.75rem, 2.5vw + 1rem, 2.5rem) / 1.15 var(--font-display);
  --text-h1: clamp(1.375rem, 1.5vw + 1rem, 1.875rem) / 1.25 var(--font-display);
  --text-h2: clamp(1.125rem, 1vw + 0.875rem, 1.5rem) / 1.3 var(--font-display);
  --text-body: 1rem / 1.6 var(--font-body);
  --text-caption: 0.8125rem / 1.5 var(--font-body);
  --text-code: 0.875rem / 1.5 var(--font-mono);
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
  --space-5: 20px; --space-6: 24px; --space-8: 32px; --space-10: 40px; --space-12: 48px;
  --color-paper: oklch(98.8% 0.003 240);
  --color-paper-2: oklch(96.2% 0.006 240);
  --color-paper-elevated: oklch(100% 0 0);
  --color-ink: oklch(16% 0.02 240);
  --color-ink-2: oklch(40% 0.02 240);
  --color-ink-tertiary: oklch(56% 0.015 240);
  --color-rule: oklch(90% 0.008 240);
  --color-rule-strong: oklch(82% 0.015 240);
  --color-accent: oklch(56% 0.23 262);
  --color-accent-hover: oklch(50% 0.25 262);
  --color-accent-light: oklch(95% 0.035 262);
  --color-accent-subtle: oklch(97.5% 0.015 262);
  --color-focus: oklch(58% 0.23 262);
  --color-success: oklch(58% 0.18 152); --color-success-hover: oklch(52% 0.20 152); --color-success-light: oklch(96% 0.04 152);
  --color-warning: oklch(72% 0.17 72); --color-warning-hover: oklch(66% 0.19 72); --color-warning-light: oklch(96% 0.045 72);
  --color-error: oklch(58% 0.23 25); --color-error-hover: oklch(52% 0.25 25); --color-error-light: oklch(95.5% 0.045 25);
  --bg: var(--color-paper); --surface: var(--color-paper-elevated); --surface-hover: var(--color-accent-light); --surface-muted: var(--color-paper-2);
  --text: var(--color-ink); --text-secondary: var(--color-ink-2); --text-tertiary: var(--color-ink-tertiary);
  --border: var(--color-rule); --border-light: var(--color-rule-strong);
  --accent-primary: var(--color-accent); --accent-secondary: var(--color-accent-hover); --accent-light: var(--color-accent-light);
  --accent-muted: var(--color-accent-light); --success: var(--color-success); --success-light: var(--color-success-light);
  --warning: var(--color-warning); --warning-light: var(--color-warning-light); --error: var(--color-error); --error-light: var(--color-error-light);
  --shadow-xs: 0 1px 2px color-mix(in oklab, var(--color-ink) 5%, transparent);
  --shadow-sm: 0 2px 5px color-mix(in oklab, var(--color-ink) 7%, transparent), 0 1px 2px color-mix(in oklab, var(--color-ink) 4%, transparent);
  --shadow-md: 0 6px 16px -2px color-mix(in oklab, var(--color-ink) 9%, transparent);
  --elevation-1: 0 8px 22px color-mix(in oklab, var(--color-ink) 12%, transparent);
  --elevation-2: 0 16px 36px color-mix(in oklab, var(--color-ink) 16%, transparent);
  --elevation-3: 0 24px 48px -8px color-mix(in oklab, var(--color-ink) 16%, transparent);
  --radius-xs: 4px; --radius-sm: 6px; --radius-md: 10px; --radius-lg: 14px; --radius-xl: 18px; --radius-full: 999px;
  --motion-fast: 150ms; --motion-normal: 240ms; --motion-ease: cubic-bezier(0.16, 1, 0.3, 1);
  --focus-ring: 0 0 0 3px color-mix(in srgb, var(--color-accent) 28%, transparent);
}
:host([data-theme="dark"]), :root[data-theme="dark"] {
  --color-paper: oklch(13.5% 0.012 245); --color-paper-2: oklch(17.5% 0.016 245); --color-paper-elevated: oklch(21.5% 0.02 245);
  --color-ink: oklch(98.5% 0.005 240); --color-ink-2: oklch(79% 0.01 240); --color-ink-tertiary: oklch(62% 0.015 240);
  --color-rule: oklch(27% 0.016 245); --color-rule-strong: oklch(35% 0.022 245);
  --color-accent: oklch(68% 0.21 260); --color-accent-hover: oklch(74% 0.19 260); --color-accent-light: oklch(25% 0.08 260); --color-accent-subtle: oklch(20% 0.04 260); --color-focus: oklch(72% 0.21 260);
  --color-success: oklch(73% 0.17 152); --color-success-hover: oklch(78% 0.15 152); --color-success-light: oklch(24% 0.065 152);
  --color-warning: oklch(80% 0.16 72); --color-warning-hover: oklch(85% 0.14 72); --color-warning-light: oklch(26% 0.065 72);
  --color-error: oklch(70% 0.21 25); --color-error-hover: oklch(76% 0.19 25); --color-error-light: oklch(25% 0.08 25);
  --bg: var(--color-paper); --surface: var(--color-paper-elevated); --surface-hover: var(--color-accent-light); --surface-muted: var(--color-paper-2);
  --text: var(--color-ink); --text-secondary: var(--color-ink-2); --text-tertiary: var(--color-ink-tertiary);
  --border: var(--color-rule); --border-light: var(--color-rule-strong);
  --accent-primary: var(--color-accent); --accent-secondary: var(--color-accent-hover); --accent-light: var(--color-accent-light); --accent-muted: var(--color-accent-light);
  --success: var(--color-success); --success-light: var(--color-success-light);
  --warning: var(--color-warning); --warning-light: var(--color-warning-light);
  --error: var(--color-error); --error-light: var(--color-error-light);
  --shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.4);
  --shadow-sm: 0 2px 6px rgba(0, 0, 0, 0.45);
  --shadow-md: 0 8px 20px -3px rgba(0, 0, 0, 0.6);
  --elevation-1: 0 8px 22px rgba(0, 0, 0, 0.5);
  --elevation-2: 0 16px 36px rgba(0, 0, 0, 0.65);
  --elevation-3: 0 28px 56px -10px rgba(0, 0, 0, 0.85);
  --focus-ring: 0 0 0 3px color-mix(in srgb, var(--color-accent) 35%, transparent);
}
body { font: var(--text-body); color: var(--text); background: var(--bg); margin: 0; -webkit-font-smoothing: antialiased; }
*:focus-visible { outline: 3px solid var(--color-focus); outline-offset: 2px; }
`;

    globalThis.SummarizerTheme = {
        THEME_VALUES,
        DENSITY_VALUES,
        FONT_SCALE_VALUES,
        normalizeTheme,
        normalizeDensity,
        normalizeFontScale,
        resolveTheme,
        applyThemeToDocument,
        applyDensityToDocument,
        applyFontScaleToDocument,
        watchSystemTheme,
        sharedTokens
    };
})();
