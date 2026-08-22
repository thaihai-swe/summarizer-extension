(function () {
    const MSG = SummarizerMessages.types;
    const state = {
        host: null,
        shadow: null,
        button: null,
        panel: null,
        enabled: true,
        latestResult: null,
        latestError: "",
        theme: "system",
        stopThemeWatch: null
    };

    function resolveTheme(theme) {
        if (globalThis.SummarizerTheme && typeof SummarizerTheme.resolveTheme === "function") {
            return SummarizerTheme.resolveTheme(theme || "system");
        }
        const value = String(theme || "system").toLowerCase();
        if (value === "light" || value === "dark") {
            return value;
        }
        if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
            return "dark";
        }
        return "light";
    }

    function applyTheme(theme) {
        state.theme = theme || "system";
        if (!state.host) {
            return;
        }
        state.host.dataset.theme = resolveTheme(state.theme);
    }

    function setPanelOpen(isOpen) {
        if (!state.panel || !state.button) {
            return;
        }
        state.panel.classList.toggle("visible", isOpen);
        state.button.classList.toggle("open", isOpen);
        state.button.setAttribute("aria-expanded", String(isOpen));
        if (isOpen) {
            const focusable = state.panel.querySelector(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            if (focusable) {
                focusable.focus();
            }
        }
    }

    function renderPanel() {
        if (!state.panel) {
            return;
        }

        if (state.latestError) {
            state.panel.innerHTML = `
        <div class="head">
          <strong>Summary Error</strong>
          <button class="close-btn" type="button" data-close>Close</button>
        </div>
        <p class="error">${SummarizerMarkdown.escapeHtml(state.latestError)}</p>
        <div class="actions">
          <button type="button" data-retry class="btn-primary">Retry</button>
        </div>
      `;
            wirePanelButtons();
            return;
        }

        if (!state.latestResult) {
            state.panel.innerHTML = `
        <div class="head">
          <strong>Floating Summary</strong>
          <button class="close-btn" type="button" data-close>Close</button>
        </div>
        <p>No summary yet. Use the floating button or the side panel.</p>
        <div class="actions">
          <button type="button" data-retry class="btn-primary">Generate</button>
        </div>
      `;
            wirePanelButtons();
            return;
        }

        const takeaways = (state.latestResult.keyTakeaways || [])
            .slice(0, 5)
            .map((item) => `<li>${SummarizerMarkdown.escapeHtml(item)}</li>`)
            .join("");

        state.panel.innerHTML = `
      <div class="head">
        <strong>${SummarizerMarkdown.escapeHtml(state.latestResult.title || "Summary")}</strong>
        <button class="close-btn" type="button" data-close>Close</button>
      </div>
      <p class="meta">${SummarizerMarkdown.escapeHtml(state.latestResult.sourceType || "")}${
            state.latestResult.promptMode ? " · " + SummarizerMarkdown.escapeHtml(state.latestResult.promptMode) : ""
        }</p>
      <section>
        <h4>Summary</h4>
        <div class="summary">${SummarizerMarkdown.renderMarkdown(state.latestResult.summary || "")}</div>
      </section>
      <section>
        <h4>Key Takeaways</h4>
        <ul>${takeaways || "<li>No takeaways returned.</li>"}</ul>
      </section>
      <div class="actions">
        <button type="button" data-copy>Copy</button>
        <button type="button" data-retry>Retry</button>
        <button type="button" data-sidepanel class="btn-primary">Open Side Panel</button>
      </div>
    `;

        wirePanelButtons();
    }

    function wirePanelButtons() {
        if (!state.panel) {
            return;
        }

        const closeBtn = state.panel.querySelector("[data-close]");
        if (closeBtn) {
            closeBtn.onclick = () => setPanelOpen(false);
        }

        const retryBtn = state.panel.querySelector("[data-retry]");
        if (retryBtn) {
            retryBtn.onclick = () => triggerSummarize();
        }

        const copyBtn = state.panel.querySelector("[data-copy]");
        if (copyBtn) {
            copyBtn.onclick = async () => {
                const result = state.latestResult;
                if (!result) {
                    return;
                }
                const text = [
                    result.title || "Summary",
                    "",
                    result.summary || "",
                    "",
                    "Key Takeaways",
                    ...(result.keyTakeaways || []).map((item) => "- " + item)
                ].join("\n");
                await navigator.clipboard.writeText(text);
            };
        }

        const sidePanelBtn = state.panel.querySelector("[data-sidepanel]");
        if (sidePanelBtn) {
            sidePanelBtn.onclick = async () => {
                const response = await chrome.runtime.sendMessage({ type: MSG.OPEN_SIDE_PANEL });
                if (!response || !response.ok) {
                    state.latestError =
                        (response && response.error) ||
                        "Use the extension toolbar button. Chrome restricts opening the side panel from this in-page control.";
                    renderPanel();
                    setPanelOpen(true);
                }
            };
        }
    }

    async function triggerSummarize() {
        state.latestError = "";
        renderPanel();
        setPanelOpen(true);
        if (state.button) {
            state.button.disabled = true;
            state.button.classList.add("loading");
            const label = state.button.querySelector(".fab-label");
            if (label) {
                label.textContent = "Summarizing...";
            }
        }

        try {
            const response = await chrome.runtime.sendMessage({
                type: MSG.SUMMARIZE_ACTIVE_TAB
            });
            if (!response || !response.ok) {
                throw new Error((response && response.error) || "Summary failed.");
            }
            state.latestResult = response.result || null;
            state.latestError = "";
            renderPanel();
            setPanelOpen(true);
        } catch (error) {
            state.latestError = error.message || "Summary failed.";
            renderPanel();
            setPanelOpen(true);
        } finally {
            if (state.button) {
                state.button.disabled = false;
                state.button.classList.remove("loading");
                const label = state.button.querySelector(".fab-label");
                if (label) {
                    label.textContent = "Summarize";
                }
            }
        }
    }

    function createUi() {
        if (state.host || !state.enabled) {
            return;
        }

        state.host = document.createElement("div");
        state.host.style.position = "fixed";
        state.host.style.right = "20px";
        state.host.style.bottom = "20px";
        state.host.style.zIndex = "2147483647";
        state.host.dataset.theme = resolveTheme(state.theme);

        state.shadow = state.host.attachShadow({ mode: "open" });
        const sharedTokens = (globalThis.SummarizerTheme && SummarizerTheme.sharedTokens) || "";

        state.shadow.innerHTML = `
      <style>
        ${sharedTokens}
        :host { all: initial; font-family: var(--font-sans); }
        .fab {
          background: var(--accent-primary, #9A3412);
          color: #fff;
          border: 1px solid transparent;
          border-radius: 999px;
          padding: 9px 15px;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(154, 52, 18, 0.32);
          font: 600 12.5px/1.2 var(--font-display, var(--font-sans));
          display: inline-flex;
          align-items: center;
          gap: 7px;
          transition: background var(--duration-fast, 140ms) ease, transform var(--duration-fast, 140ms) ease, box-shadow var(--duration-fast, 140ms) ease;
        }
        .fab:hover:not(:disabled) {
          background: var(--accent-secondary, #7C2D12);
          transform: translateY(-1px) scale(1.02);
          box-shadow: 0 6px 18px rgba(154, 52, 18, 0.42);
        }
        .fab:active:not(:disabled) {
          transform: scale(0.98);
        }
        .fab:focus-visible {
          outline: 3px solid var(--color-focus, #9A3412);
          outline-offset: 2px;
        }
        .fab.loading {
          opacity: 0.85;
          pointer-events: none;
        }
        .fab.open .fab-icon {
          transform: rotate(45deg);
        }
        .fab-icon {
          display: inline-flex;
          transition: transform var(--duration-base, 220ms) ease;
        }
        .panel {
          display: none;
          width: min(360px, calc(100vw - 24px));
          max-height: calc(100vh - 80px);
          overflow: auto;
          margin-top: 10px;
          background: var(--surface, #FFFFFF);
          color: var(--text, #1C1917);
          border: 1px solid var(--border, #E7E2DA);
          border-radius: var(--radius-md, 10px);
          padding: 16px;
          box-shadow: 0 16px 36px rgba(0, 0, 0, 0.16);
          font: 13.5px/1.55 var(--font-body, var(--font-sans));
          animation: panel-in 220ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .panel.visible { display: block; }
        @keyframes panel-in {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .head {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          align-items: center;
          margin-bottom: 8px;
        }
        .close-btn, .actions button {
          border: 1px solid var(--border, #E7E2DA);
          background: var(--surface-muted, #F2EFE9);
          color: var(--text, #1C1917);
          border-radius: 999px;
          padding: 6px 10px;
          cursor: pointer;
          font: inherit;
          font-size: 12px;
          transition: all 140ms ease;
        }
        .close-btn:hover, .actions button:hover:not(:disabled) {
          border-color: var(--accent-primary, #9A3412);
          background: var(--surface-hover, #FAF4EE);
        }
        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 12px;
        }
        .actions .btn-primary {
          background: var(--accent-primary, #9A3412);
          border-color: transparent;
          color: #fff;
          font-weight: 600;
          font-family: var(--font-display, var(--font-sans));
        }
        h4 {
          font-size: 11px;
          font-weight: 700;
          margin: 16px 0 8px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-tertiary, #78716C);
        }
        .summary { white-space: pre-wrap; word-break: break-word; }
        ul { padding-left: 18px; margin: 0; }
        .meta { color: var(--text-tertiary, #78716C); margin: 0 0 12px; font-size: 12px; }
        .error { color: var(--error, #DC2626); background: #FEE2E2; padding: 12px; border-radius: 8px; font-size: 13px; margin: 12px 0; border: 1px solid rgba(220, 38, 38, 0.2); }
        *:focus-visible {
          outline: 3px solid var(--color-focus, #9A3412);
          outline-offset: 2px;
        }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      </style>
      <button class="fab" type="button" aria-expanded="false" aria-controls="float-panel" aria-label="Open DeepDigest">
        <span class="fab-icon" aria-hidden="true">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            <circle cx="12" cy="12" r="4"/>
          </svg>
        </span>
        <span class="fab-label">Summarize</span>
      </button>
      <div class="panel" id="float-panel" role="dialog" aria-modal="true" aria-label="DeepDigest floating panel"></div>
    `;

        state.button = state.shadow.querySelector(".fab");
        state.panel = state.shadow.querySelector(".panel");

        state.button.addEventListener("click", () => {
            if (state.latestResult || state.latestError) {
                const nextOpen = !state.panel.classList.contains("visible");
                if (nextOpen) {
                    renderPanel();
                }
                setPanelOpen(nextOpen);
            } else {
                triggerSummarize();
            }
        });

        state.shadow.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && state.panel.classList.contains("visible")) {
                setPanelOpen(false);
                state.button.focus();
            }
        });

        document.documentElement.appendChild(state.host);
    }

    function destroyUi() {
        if (state.stopThemeWatch) {
            state.stopThemeWatch();
            state.stopThemeWatch = null;
        }
        if (state.host) {
            state.host.remove();
        }
        state.host = null;
        state.shadow = null;
        state.button = null;
        state.panel = null;
    }

    async function syncUiEnabled() {
        try {
            const settings = await SummarizerStorage.getSettings();
            state.enabled = settings.showFloatingUi !== false;
            state.theme = settings.theme || "system";

            if (state.enabled) {
                createUi();
                applyTheme(state.theme);
                if (!state.stopThemeWatch && globalThis.SummarizerTheme && SummarizerTheme.watchSystemTheme) {
                    state.stopThemeWatch = SummarizerTheme.watchSystemTheme(() => {
                        if ((state.theme || "system") === "system") {
                            applyTheme("system");
                        }
                    });
                }
            } else {
                destroyUi();
            }
        } catch (error) {
            console.warn("[Summarizer] Failed to sync floating UI:", error);
        }
    }

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === MSG.FETCH_COURSE_CONTENT) {
            const selectedText = SummarizerSelectedTextExtractor.extractSelectedText();
            if (selectedText) {
                sendResponse({ ok: true, data: selectedText });
                return true;
            }

            SummarizerCourseExtractor.fetchCourseContent()
                .then((data) => sendResponse({ ok: true, data }))
                .catch((error) =>
                    sendResponse({
                        ok: false,
                        error: error.message || "Course extraction failed."
                    })
                );
            return true;
        }

        if (message.type === MSG.EXTRACT_CONTENT) {
            const extractors = globalThis.SummarizerExtractors;
            if (!extractors || typeof extractors.extractBestContent !== "function") {
                sendResponse({
                    ok: false,
                    error: "The page extraction module is not ready. Refresh the page and try again."
                });
                return true;
            }

            extractors.extractBestContent()
                .then((data) => sendResponse({ ok: true, data }))
                .catch((error) =>
                    sendResponse({
                        ok: false,
                        error: error.message || "Extraction failed."
                    })
                );
            return true;
        }

        if (message.type === MSG.SUMMARY_UPDATED) {
            state.latestError = "";
            state.latestResult = message.result || null;
            renderPanel();
            setPanelOpen(true);
            return;
        }

        if (message.type === MSG.SUMMARY_ERROR) {
            state.latestError = message.error || "Summary failed.";
            renderPanel();
            setPanelOpen(true);
            return;
        }

        if (message.type === MSG.SETTINGS_UPDATED) {
            if (message.settings && message.settings.theme) {
                state.theme = message.settings.theme;
                applyTheme(state.theme);
            }
            syncUiEnabled().catch(() => { });
        }
    });

    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === "local" && changes.summarizerSettings) {
            syncUiEnabled().catch(() => { });
        }
    });

    syncUiEnabled().catch(() => { });
})();
