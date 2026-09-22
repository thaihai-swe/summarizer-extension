(function () {
    const MSG = SummarizerMessages.types;
    let latestResult = null;
    let activeTabId = null;
    let refreshSequence = 0;
    let pendingStreamResult = null;
    let streamRenderFrame = 0;
    let streamActive = false;
    const resultCache = SummarizerSidepanelResultCache.create(4);

    const elements = {
        status: document.getElementById("panel-status"),
        title: document.getElementById("panel-title"),
        modeSelect: document.getElementById("panel-mode"),
        summary: document.getElementById("panel-summary"),
        takeaways: document.getElementById("panel-takeaways"),
        followUpQuestionsWrap: document.getElementById("panel-follow-up-questions-wrap"),
        followUpQuestions: document.getElementById("panel-follow-up-questions"),
        transcriptContent: document.getElementById("panel-transcript-content"),
        transcriptFilter: document.getElementById("panel-transcript-filter"),
        transcriptCopyBtn: document.getElementById("transcript-copy"),
        transcriptSrtBtn: document.getElementById("transcript-download-srt"),
        resultToc: document.getElementById("result-toc"),
        resultTocList: document.getElementById("result-toc-list"),
        chatLog: document.getElementById("chat-log"),
        chatInput: document.getElementById("chat-input"),
        chatSend: document.getElementById("chat-send"),
        summarizeBtn: document.getElementById("panel-summarize"),
        settingsBtn: document.getElementById("panel-settings"),
        copyBtn: document.getElementById("panel-copy"),
        exportMdBtn: document.getElementById("panel-export-md"),
        exportTxtBtn: document.getElementById("panel-export-txt"),
        clearBtn: document.getElementById("panel-clear"),
        cancelBtn: document.getElementById("panel-cancel"),
        fabSummarize: document.getElementById("fab-summarize"),
        floatingActions: document.getElementById("floating-actions"),
        emptyState: document.getElementById("empty-state"),
        summaryContent: document.getElementById("summary-content"),
        summaryOverview: document.getElementById("summary-overview"),
        deepDiveSections: document.getElementById("deep-dive-sections"),
        transcriptSection: document.getElementById("transcript-section"),
        highlightTooltip: document.getElementById("highlight-tooltip"),
        chatHint: document.getElementById("chat-hint"),
        chatSection: document.getElementById("chat-section"),
        groundingSourceBtn: document.getElementById("grounding-source-btn"),
        groundingOpenBtn: document.getElementById("grounding-open-btn"),
        shell: document.getElementById("panel-shell"),
        panelTheme: document.getElementById("panel-theme"),
        panelFontScale: document.getElementById("panel-fontScale"),
        summaryLanguage: document.getElementById("panel-summaryLanguage"),
        summaryTone: document.getElementById("panel-summaryTone"),
        summarySize: document.getElementById("panel-summarySize"),
        summaryLength: document.getElementById("panel-summaryLength")
    };

    function setStatus(message, type) {
        if (!elements.status) return;
        const text = String(message || "");
        const liveStatus = document.getElementById("panel-live-status");
        if (liveStatus && liveStatus.textContent !== text) liveStatus.textContent = text;
        elements.status.textContent = text;
        elements.status.className = "status-badge-compact";
        if (type) elements.status.classList.add("is-" + type);
        if (elements.shell) {
            elements.shell.classList.toggle("is-busy", type === "busy");
            elements.shell.classList.toggle("is-error", type === "error");
            elements.shell.classList.toggle("is-ready", type === "ready" || !type);
        }
        if (elements.summarizeBtn) elements.summarizeBtn.setAttribute("aria-busy", type === "busy" ? "true" : "false");
    }

    function setButtonBusy(button, isBusy, busyLabel, defaultLabel) {
        if (!button) return;
        button.disabled = isBusy;
        button.textContent = isBusy ? busyLabel : defaultLabel;
        button.classList.toggle("is-busy", Boolean(isBusy));
        button.setAttribute("aria-busy", isBusy ? "true" : "false");
    }

    function sendRuntimeMessage(message) {
        return new Promise((resolve) => {
            try {
                chrome.runtime.sendMessage(message, (response) => {
                    resolve(chrome.runtime.lastError
                        ? { ok: false, error: chrome.runtime.lastError.message }
                        : response);
                });
            } catch (error) {
                resolve({ ok: false, error: error.message });
            }
        });
    }

    const chat = SummarizerSidepanelChat.create({
        elements,
        messageType: MSG.DEEP_DIVE_ACTIVE_TAB,
        sendRuntimeMessage,
        getLatestResult: () => latestResult,
        setStatus,
        setButtonBusy
    });
    const actions = SummarizerSidepanelActions.create({
        getLatestResult: () => latestResult,
        setStatus
    });

    function renderResult(result) {
        latestResult = result;
        SummarizerRender.renderResult(result, elements, chat.ask);
        if (elements.floatingActions) elements.floatingActions.hidden = !result;
        if (elements.summaryContent) elements.summaryContent.hidden = !result;
        if (elements.emptyState) elements.emptyState.hidden = Boolean(result);
    }

    function resetSession() {
        latestResult = null;
        pendingStreamResult = null;
        streamActive = false;
        if (streamRenderFrame) cancelAnimationFrame(streamRenderFrame);
        streamRenderFrame = 0;
        chat.reset();
        renderResult(null);
        if (elements.cancelBtn) elements.cancelBtn.hidden = true;
    }

    async function refreshActiveTabView() {
        const sequence = ++refreshSequence;
        const tabs = await new Promise((resolve) => {
            try { chrome.tabs.query({ active: true, currentWindow: true }, resolve); }
            catch (_) { resolve([]); }
        });
        if (sequence !== refreshSequence) return;
        const nextTabId = tabs && tabs[0] && tabs[0].id ? tabs[0].id : null;
        if (latestResult && latestResult.tabId === nextTabId && activeTabId === nextTabId) return;
        activeTabId = nextTabId;
        resetSession();
        const cachedResult = resultCache.get(nextTabId);
        if (cachedResult) {
            renderResult(cachedResult);
            setStatus("Summary restored.", "ready");
        } else {
            setStatus("Ready.", "ready");
        }
    }

    async function summarize() {
        latestResult = null;
        resultCache.remove(activeTabId);
        streamActive = true;
        setStatus("Starting summary...", "busy");
        setButtonBusy(elements.summarizeBtn, true, "Running...", "Generate");
        setButtonBusy(elements.fabSummarize, true, "Running...", "Generate");
        SummarizerRender.clearAllContent(elements, { lastMode: elements.modeSelect.value });
        if (elements.floatingActions) elements.floatingActions.hidden = true;
        if (elements.cancelBtn) elements.cancelBtn.hidden = false;
        if (elements.chatSend) elements.chatSend.disabled = true;
        chat.reset();
        const response = await sendRuntimeMessage({
            type: MSG.SUMMARIZE_ACTIVE_TAB,
            promptMode: elements.modeSelect.value
        });
        if (!response || !response.ok) {
            streamActive = false;
            setStatus((response && response.error) || "Summary failed.", "error");
            if (elements.cancelBtn) elements.cancelBtn.hidden = true;
            if (elements.chatSend) elements.chatSend.disabled = false;
        }
        setButtonBusy(elements.summarizeBtn, false, "Running...", "Generate");
        setButtonBusy(elements.fabSummarize, false, "Running...", "Generate");
    }

    function scheduleStreamRender(result) {
        if (!streamActive) {
            streamActive = true;
            latestResult = null;
            chat.reset();
            SummarizerRender.prepareTranscript(elements, null);
            SummarizerRender.renderFollowUpQuestions([], elements, chat.ask);
            if (globalThis.SummarizerSidepanelToc) SummarizerSidepanelToc.reset(elements);
            if (elements.chatSend) elements.chatSend.disabled = true;
        }
        pendingStreamResult = result;
        if (streamRenderFrame) return;
        streamRenderFrame = requestAnimationFrame(() => {
            streamRenderFrame = 0;
            const next = pendingStreamResult;
            pendingStreamResult = null;
            if (!next) return;
            renderResult(next);
            setStatus("Generating summary...", "busy");
        });
    }

    function setupReadingProgress() {
        const progressBar = document.getElementById("reading-progress-bar");
        if (!progressBar || !elements.shell) return;
        let frame = 0;
        elements.shell.addEventListener("scroll", () => {
            if (frame) return;
            frame = requestAnimationFrame(() => {
                frame = 0;
                const maxScroll = elements.shell.scrollHeight - elements.shell.clientHeight;
                const progress = maxScroll > 0 ? elements.shell.scrollTop / maxScroll * 100 : 0;
                progressBar.style.width = Math.min(100, Math.max(0, progress)) + "%";
            });
        }, { passive: true });
    }

    function setupHighlightToAsk() {
        const tooltip = elements.highlightTooltip;
        if (!tooltip || !elements.shell) return;
        elements.shell.addEventListener("mouseup", () => {
            const selection = window.getSelection();
            const text = selection.toString().trim();
            if (!text || text.length <= 5 || !selection.rangeCount) {
                tooltip.style.display = "none";
                return;
            }
            const rect = selection.getRangeAt(0).getBoundingClientRect();
            const shellRect = elements.shell.getBoundingClientRect();
            tooltip.style.left = (rect.left + rect.width / 2) + "px";
            tooltip.style.top = (rect.top - shellRect.top + elements.shell.scrollTop - 4) + "px";
            tooltip.style.display = "block";
            tooltip.onclick = () => {
                elements.chatInput.value = `Tell me more about: "${text}"`;
                elements.chatInput.focus();
                tooltip.style.display = "none";
                chat.ask("source");
            };
        });
        document.addEventListener("mousedown", (event) => {
            if (event.target !== tooltip) tooltip.style.display = "none";
        });
    }

    function setupTranscript() {
        const toggle = document.getElementById("transcript-toggle");
        if (!toggle || !elements.transcriptContent) return;
        toggle.addEventListener("click", () => {
            const expanded = toggle.getAttribute("aria-expanded") === "true";
            if (expanded) {
                elements.transcriptContent.hidden = true;
            } else {
                SummarizerRender.renderTranscript(elements);
                elements.transcriptContent.hidden = false;
            }
            toggle.setAttribute("aria-expanded", String(!expanded));
            const icon = toggle.querySelector(".transcript-toggle-icon");
            if (icon) icon.textContent = expanded ? "\u25b6" : "\u25bc";
            const hint = toggle.querySelector(".transcript-toggle-hint");
            if (hint) hint.textContent = expanded ? hint.dataset.collapsedLabel : hint.dataset.expandedLabel;
        });
        if (elements.transcriptFilter) {
            let timer = 0;
            elements.transcriptFilter.addEventListener("input", () => {
                clearTimeout(timer);
                timer = setTimeout(() => {
                    SummarizerRender.renderTranscript(elements);
                    SummarizerRender.filterTranscript(elements, elements.transcriptFilter.value);
                }, 120);
            });
        }
    }

    function setupKeyboardShortcuts() {
        document.addEventListener("keydown", (event) => {
            const target = event.target;
            if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
            if (event.key === "j") { elements.shell.scrollBy({ top: 80, behavior: "smooth" }); event.preventDefault(); }
            if (event.key === "k") { elements.shell.scrollBy({ top: -80, behavior: "smooth" }); event.preventDefault(); }
            if (event.key === "/") { elements.transcriptFilter?.focus(); event.preventDefault(); }
            if (event.key === "Escape" && elements.highlightTooltip) elements.highlightTooltip.style.display = "none";
        });
    }

    function populateOptions(select, settingKey) {
        if (!select) return;
        const values = SummarizerSettingsSchema.getValidValues(settingKey);
        if (!values) return;
        const fragment = document.createDocumentFragment();
        Array.from(values).forEach((value) => {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = value;
            fragment.appendChild(option);
        });
        select.replaceChildren(fragment);
    }

    async function setupDisplayControls() {
        populateOptions(elements.summaryTone, "summaryTone");
        populateOptions(elements.summarySize, "summarySize");
        populateOptions(elements.summaryLength, "summaryLength");
        try {
            const settings = await SummarizerStorage.getSettings();
            if (elements.panelTheme) elements.panelTheme.value = settings.theme || "system";
            if (elements.panelFontScale) elements.panelFontScale.value = settings.fontScale || "md";
            if (elements.summaryLanguage) {
                const languages = Array.from(new Set(["English", "Vietnamese"].concat(
                    String(settings.customLanguages || "").split(",").map((item) => item.trim()).filter(Boolean)
                )));
                const fragment = document.createDocumentFragment();
                languages.forEach((language) => {
                    const option = document.createElement("option");
                    option.value = language;
                    option.textContent = language;
                    fragment.appendChild(option);
                });
                elements.summaryLanguage.replaceChildren(fragment);
                elements.summaryLanguage.value = settings.summaryLanguage || "English";
            }
            if (elements.summaryTone) elements.summaryTone.value = settings.summaryTone || "Simple";
            if (elements.summarySize) elements.summarySize.value = settings.summarySize || "Medium";
            if (elements.summaryLength) elements.summaryLength.value = settings.summaryLength || "Medium";
            SummarizerTheme.applyThemeToDocument(settings.theme || "system");
            SummarizerTheme.applyFontScaleToDocument(settings.fontScale || "md");
        } catch (_) {}

        const persist = (element, key, apply) => {
            if (!element) return;
            element.addEventListener("change", async () => {
                if (apply) apply(element.value);
                try {
                    const settings = await SummarizerStorage.saveSettings({ [key]: element.value });
                    await sendRuntimeMessage({ type: MSG.SETTINGS_UPDATED, settings });
                } catch (_) {}
            });
        };
        persist(elements.panelTheme, "theme", SummarizerTheme.applyThemeToDocument);
        persist(elements.panelFontScale, "fontScale", SummarizerTheme.applyFontScaleToDocument);
        persist(elements.summaryLanguage, "summaryLanguage");
        persist(elements.summaryTone, "summaryTone");
        persist(elements.summarySize, "summarySize");
        persist(elements.summaryLength, "summaryLength");
    }

    elements.modeSelect?.addEventListener("change", async () => {
        try { await SummarizerStorage.saveSettings({ promptMode: elements.modeSelect.value }); } catch (_) {}
    });
    elements.summarizeBtn?.addEventListener("click", summarize);
    elements.fabSummarize?.addEventListener("click", summarize);
    elements.cancelBtn?.addEventListener("click", async () => {
        if (activeTabId) await sendRuntimeMessage({ type: MSG.CANCEL_SUMMARIZE, tabId: activeTabId });
        setButtonBusy(elements.summarizeBtn, false, "Running...", "Generate");
        setButtonBusy(elements.fabSummarize, false, "Running...", "Generate");
        setStatus("Cancelled.", "ready");
        elements.cancelBtn.hidden = true;
    });
    elements.copyBtn?.addEventListener("click", actions.copySummary);
    elements.exportMdBtn?.addEventListener("click", actions.exportMarkdown);
    elements.exportTxtBtn?.addEventListener("click", actions.exportText);
    elements.transcriptCopyBtn?.addEventListener("click", actions.copyTranscript);
    elements.transcriptSrtBtn?.addEventListener("click", actions.downloadTranscriptSrt);
    elements.clearBtn?.addEventListener("click", () => {
        resultCache.remove(activeTabId);
        resetSession();
        setStatus("Cleared.", "ready");
    });
    elements.settingsBtn?.addEventListener("click", () => chrome.runtime.openOptionsPage());
    elements.chatSend?.addEventListener("click", () => chat.ask());
    elements.chatInput?.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); chat.ask(); }
    });
    elements.groundingSourceBtn?.addEventListener("click", () => chat.setGroundingMode("source"));
    elements.groundingOpenBtn?.addEventListener("click", () => chat.setGroundingMode("open"));

    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === MSG.SUMMARY_UPDATED) {
            if (message.tabId) resultCache.remember(message.tabId, message.result);
            if (message.tabId && activeTabId && message.tabId !== activeTabId) return;
            if (streamRenderFrame) cancelAnimationFrame(streamRenderFrame);
            streamRenderFrame = 0;
            pendingStreamResult = null;
            if (message.tabId) activeTabId = message.tabId;
            streamActive = false;
            if (elements.cancelBtn) elements.cancelBtn.hidden = true;
            if (elements.chatSend) elements.chatSend.disabled = false;
            if (elements.transcriptFilter) elements.transcriptFilter.value = "";
            chat.reset();
            renderResult(message.result);
            setStatus("Summary updated.", "ready");
            setButtonBusy(elements.summarizeBtn, false, "Running...", "Generate");
            setButtonBusy(elements.fabSummarize, false, "Running...", "Generate");
        } else if (message.type === MSG.SUMMARY_CHUNK) {
            if (message.tabId && activeTabId && message.tabId !== activeTabId) return;
            if (message.tabId) activeTabId = message.tabId;
            scheduleStreamRender(message.result);
        } else if (message.type === MSG.SUMMARY_ERROR) {
            if (message.tabId && activeTabId && message.tabId !== activeTabId) return;
            const hadPartialResult = streamActive;
            if (streamRenderFrame) cancelAnimationFrame(streamRenderFrame);
            streamRenderFrame = 0;
            pendingStreamResult = null;
            streamActive = false;
            if (hadPartialResult) renderResult(null);
            if (elements.cancelBtn) elements.cancelBtn.hidden = true;
            if (elements.chatSend) elements.chatSend.disabled = false;
            let text = message.error || "Summary failed.";
            if (message.code === "AUTH_ERROR" || text.includes("API key")) text = "Invalid API key. Please update it in Settings.";
            else if (message.code === "RATE_LIMIT" || text.includes("rate limit")) text = "Provider rate limit reached. Wait a moment or switch providers.";
            else if (message.code === "CANCELLED" || text.toLowerCase().includes("cancelled")) text = "Summary cancelled.";
            setStatus(text, message.code === "CANCELLED" ? "ready" : "error");
            setButtonBusy(elements.summarizeBtn, false, "Running...", "Generate");
            setButtonBusy(elements.fabSummarize, false, "Running...", "Generate");
        } else if (message.type === MSG.SETTINGS_UPDATED) {
            const settings = message.settings || {};
            if (settings.theme !== undefined) {
                SummarizerTheme.applyThemeToDocument(settings.theme);
                if (elements.panelTheme) elements.panelTheme.value = settings.theme;
            }
            if (settings.fontScale !== undefined) {
                SummarizerTheme.applyFontScaleToDocument(settings.fontScale);
                if (elements.panelFontScale) elements.panelFontScale.value = settings.fontScale;
            }
            SummarizerSidepanelState.loadSettings(elements).catch(() => {});
        }
    });

    chrome.tabs.onActivated.addListener(() => refreshActiveTabView().catch(() => {}));
    chrome.tabs.onRemoved.addListener((tabId) => resultCache.remove(tabId));
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (tab.active && (changeInfo.status === "loading" || changeInfo.status === "complete")) {
            refreshActiveTabView().catch(() => {});
        }
    });

    chat.setGroundingMode("source");
    setupReadingProgress();
    setupHighlightToAsk();
    setupTranscript();
    setupKeyboardShortcuts();
    setupDisplayControls();
    SummarizerSidepanelState.loadSettings(elements).catch(() => {});
    SummarizerTheme.watchSystemTheme(() => {
        SummarizerStorage.getSettings().then((settings) => {
            if ((settings.theme || "system") === "system") SummarizerTheme.applyThemeToDocument("system");
        }).catch(() => {});
    });
    refreshActiveTabView().catch(() => {});
})();
import "../../lib/ui/theme.js";
import "../../lib/cleaners.js";
import "../../lib/markdown.js";
import "../../lib/messages.js";
import "../../lib/settings-schema.js";
import "../../lib/browser-api.js";
import "../../lib/storage.js";
import "../../lib/sidepanel/state.js";
import "../../lib/sidepanel/visual-renderers.js";
import "../../lib/sidepanel/toc.js";
import "../../lib/sidepanel/result-cache.js";
import "../../lib/transcript-export.js";
import "../../lib/sidepanel/render.js";
import "../../lib/sidepanel/chat.js";
import "../../lib/sidepanel/actions.js";
