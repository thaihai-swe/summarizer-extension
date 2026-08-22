(function () {
    const THEME_VALUES = new Set(["system", "light", "dark"]);
    const DENSITY_VALUES = new Set(["compact", "comfortable"]);
    const FONT_SCALE_VALUES = new Set(["sm", "md", "lg", "xl"]);

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
  --font-display: "Plus Jakarta Sans", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-body: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-mono: "JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
  --space-5: 20px; --space-6: 24px; --space-8: 32px;
  --radius-xs: 5px; --radius-sm: 7px; --radius-md: 10px; --radius-lg: 14px; --radius-full: 9999px;
  
  --color-paper: #FBFBFA;
  --color-paper-2: #F3F3F0;
  --color-paper-elevated: #FFFFFF;
  --color-ink: #18181B;
  --color-ink-2: #3F3F46;
  --color-ink-tertiary: #71717A;
  --color-rule: #E4E4E7;
  --color-rule-strong: #D4D4D8;
  
  --color-accent: #EA580C;
  --color-accent-hover: #C2410C;
  --color-accent-light: #FFEDD5;
  --color-accent-subtle: #FFF7ED;
  --color-focus: #EA580C;
  --color-focus-ring: 0 0 0 3px rgba(234, 88, 12, 0.22);
  
  --color-success: #16A34A;
  --color-error: #DC2626;
  --color-warning: #D97706;

  --bg: var(--color-paper);
  --surface: var(--color-paper-elevated);
  --surface-hover: var(--color-accent-subtle);
  --surface-muted: var(--color-paper-2);
  --text: var(--color-ink);
  --text-secondary: var(--color-ink-2);
  --text-tertiary: var(--color-ink-tertiary);
  --border: var(--color-rule);
  --accent-primary: var(--color-accent);
  --accent-secondary: var(--color-accent-hover);
  --shadow-xs: 0 1px 2px rgba(24, 24, 27, 0.04);
  --shadow-sm: 0 1px 3px rgba(24, 24, 27, 0.06);
  --shadow-md: 0 4px 12px -2px rgba(24, 24, 27, 0.08);
}
:host([data-theme="dark"]), :root[data-theme="dark"] {
  --color-paper: #09090B;
  --color-paper-2: #121215;
  --color-paper-elevated: #18181B;
  --color-ink: #FAFAFA;
  --color-ink-2: #D4D4D8;
  --color-ink-tertiary: #A1A1AA;
  --color-rule: #27272A;
  --color-rule-strong: #3F3F46;
  
  --color-accent: #F97316;
  --color-accent-hover: #FB923C;
  --color-accent-light: #431407;
  --color-accent-subtle: #27140B;
  --color-focus: #F97316;
  --color-focus-ring: 0 0 0 3px rgba(249, 115, 22, 0.32);
  
  --color-success: #22C55E;
  --color-error: #EF4444;
  --color-warning: #F59E0B;

  --bg: var(--color-paper);
  --surface: var(--color-paper-elevated);
  --surface-hover: var(--color-accent-subtle);
  --surface-muted: var(--color-paper-2);
  --text: var(--color-ink);
  --text-secondary: var(--color-ink-2);
  --text-tertiary: var(--color-ink-tertiary);
  --border: var(--color-rule);
  --accent-primary: var(--color-accent);
  --accent-secondary: var(--color-accent-hover);
  --shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.5);
  --shadow-sm: 0 2px 6px rgba(0, 0, 0, 0.5);
  --shadow-md: 0 6px 18px -2px rgba(0, 0, 0, 0.65);
}
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
