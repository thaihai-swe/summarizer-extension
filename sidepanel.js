(function () {
    const MSG = SummarizerMessages.types;
    let latestResult = null;
    let activeTabId = null;
    let refreshSequence = 0;
    let conversationHistory = [];
    let currentGroundingMode = "source";

    const SOURCE_CHAT_HINT = "Grounded in this tab’s summary";
    const OPEN_CHAT_HINT = "Not limited to this source";
    const SOURCE_CHAT_PLACEHOLDER = "Ask a deeper question about this source. Enter to send, Shift+Enter for a new line.";
    const OPEN_CHAT_PLACEHOLDER = "Ask anything. This answer will not use the page. Enter to send, Shift+Enter for a new line.";

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
        deepDiveSections: document.getElementById("deep-dive-sections"),
        transcriptSection: document.getElementById("transcript-section"),
        followUpQuestionsSection: document.getElementById("panel-follow-up-questions-wrap"),
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
        summaryLength: document.getElementById("panel-summaryLength"),
    };

    function setStatus(message, type) {
        if (!elements.status) return;
        const liveStatus = document.getElementById("panel-live-status");
        if (liveStatus && String(message || "") !== liveStatus.textContent) liveStatus.textContent = String(message || "");
        elements.status.textContent = message;
        elements.status.className = "status-badge-compact";
        if (type) elements.status.classList.add("is-" + type);
        if (elements.shell) {
            elements.shell.classList.toggle("is-busy", type === "busy");
            elements.shell.classList.toggle("is-error", type === "error");
            elements.shell.classList.toggle("is-ready", type === "ready" || !type);
        }
        if (elements.summarizeBtn) {
            elements.summarizeBtn.setAttribute("aria-busy", type === "busy" ? "true" : "false");
        }
    }

    function setButtonBusy(button, isBusy, busyLabel, defaultLabel) {
        if (!button) return;
        button.disabled = isBusy;
        button.textContent = isBusy ? busyLabel : defaultLabel;
        button.classList.toggle("is-busy", Boolean(isBusy));
        button.setAttribute("aria-busy", isBusy ? "true" : "false");
    }

    async function sendRuntimeMessage(message) {
        return new Promise((resolve) => {
            try {
                chrome.runtime.sendMessage(message, (response) => {
                    resolve(chrome.runtime.lastError ? { ok: false, error: chrome.runtime.lastError.message } : response);
                });
            } catch (error) {
                resolve({ ok: false, error: error.message });
            }
        });
    }

    function normalizeGrounding(value) {
        return value === "open" ? "open" : "source";
    }

    function setGroundingMode(mode) {
        currentGroundingMode = normalizeGrounding(mode);
        const isOpen = currentGroundingMode === "open";
        if (elements.groundingSourceBtn) {
            elements.groundingSourceBtn.classList.toggle("is-active", !isOpen);
            elements.groundingSourceBtn.setAttribute("aria-checked", String(!isOpen));
        }
        if (elements.groundingOpenBtn) {
            elements.groundingOpenBtn.classList.toggle("is-active", isOpen);
            elements.groundingOpenBtn.setAttribute("aria-checked", String(isOpen));
        }
        if (elements.chatHint) {
            elements.chatHint.textContent = isOpen ? OPEN_CHAT_HINT : SOURCE_CHAT_HINT;
        }
        if (elements.chatInput) {
            elements.chatInput.placeholder = isOpen ? OPEN_CHAT_PLACEHOLDER : SOURCE_CHAT_PLACEHOLDER;
        }
        if (elements.chatSection) {
            elements.chatSection.classList.toggle("is-open-grounding", isOpen);
        }
    }

    function appendChatEntry(role, text, grounding) {
        const div = document.createElement("div");
        const isUser = role === "user" || role === "question";
        div.className = "chat-entry " + (isUser ? "user" : "assistant");

        if (!isUser) {
            const badge = document.createElement("span");
            const mode = normalizeGrounding(grounding);
            badge.className = "chat-badge " + (mode === "open" ? "is-open" : "is-source");
            badge.textContent = mode === "open" ? "General" : "Source";
            div.appendChild(badge);
        }

        const body = document.createElement("div");
        body.className = "chat-entry-body";
        body.innerHTML = SummarizerMarkdown.renderMarkdown(text);
        div.appendChild(body);

        const copyBtn = document.createElement("button");
        copyBtn.className = "copy-msg";
        copyBtn.type = "button";
        copyBtn.textContent = "Copy";
        copyBtn.addEventListener("click", async () => {
            await navigator.clipboard.writeText(text);
            copyBtn.textContent = "Copied!";
            setTimeout(() => copyBtn.textContent = "Copy", 1200);
        });
        div.appendChild(copyBtn);

        elements.chatLog.appendChild(div);
        div.scrollIntoView({ behavior: "smooth" });
    }

    function renderResult(result) {
        latestResult = result;
        SummarizerRender.renderResult(result, elements, askFollowUp);

        elements.floatingActions.hidden = !result;
        elements.summaryContent.hidden = !result;
        elements.emptyState.hidden = !!result;
    }

    // Follow-up prompts only need parsed sections and a bounded source window.
    // Avoid cloning a full transcript through runtime messaging on every question.
    const FOLLOW_UP_RESULT_FIELDS = [
        "tabId", "sourceType", "title", "url", "summary", "keyTakeaways", "mainPoints",
        "detailsOfVideo", "detailedBreakdown", "expertCommentary", "evidenceAndDetails",
        "argumentAndInsight", "conceptMapAndPrerequisites", "causalAndKnowledgeFlow",
        "perspectivesAndUncertainty", "reviewKit", "practicalSteps", "conceptMap",
        "coreDefinitions", "prerequisitesMisconceptions", "pitfallsWarnings", "resourcesTools",
        "videoDetails"
    ];

    function compactSourceForFollowUp(value, limit = 16000) {
        const source = String(value || "");
        if (source.length <= limit) return source;
        const headLength = Math.floor(limit * 0.7);
        const tailLength = Math.max(0, limit - headLength);
        return source.slice(0, headLength)
            + "\n\n[Middle of source omitted for message efficiency.]\n\n"
            + source.slice(-tailLength);
    }

    function buildFollowUpContext(result) {
        if (!result) return null;
        const context = {};
        FOLLOW_UP_RESULT_FIELDS.forEach((field) => {
            if (result[field] !== undefined && result[field] !== null) context[field] = result[field];
        });
        const source = result.sourceContentForPrompt || result.sourceContentRaw || result.sourceContent || "";
        context.sourceContentForPrompt = compactSourceForFollowUp(source);
        return context;
    }

    async function refreshActiveTabView() {
        const mySeq = ++refreshSequence;
        const tabs = await new Promise((resolve) => {
            try {
                chrome.tabs.query({ active: true, currentWindow: true }, resolve);
            } catch (_) {
                resolve([]);
            }
        });
        if (mySeq !== refreshSequence) return;
        const nextTabId = tabs && tabs[0] && tabs[0].id ? tabs[0].id : null;
        if (latestResult && latestResult.tabId === nextTabId && activeTabId === nextTabId) {
            return;
        }
        activeTabId = nextTabId;
        latestResult = null;
        conversationHistory = [];
        renderResult(null);
        elements.chatLog.innerHTML = "";
        if (elements.cancelBtn) elements.cancelBtn.hidden = true;
        setStatus("Ready.", "ready");
    }

    async function summarize() {
        setStatus("Starting summary...", "busy");
        setButtonBusy(elements.summarizeBtn, true, "Running...", "Generate");
        if (elements.fabSummarize) setButtonBusy(elements.fabSummarize, true, "Running...", "Generate");

        SummarizerRender.clearAllContent(elements, { lastMode: elements.modeSelect.value });
        elements.floatingActions.hidden = true;
        if (elements.cancelBtn) elements.cancelBtn.hidden = false;

        const response = await sendRuntimeMessage({
            type: MSG.SUMMARIZE_ACTIVE_TAB,
            promptMode: elements.modeSelect.value
        });
        if (!response || !response.ok) {
            setStatus((response && response.error) || "Summary failed.", "error");
            setButtonBusy(elements.summarizeBtn, false, "Running...", "Generate");
            if (elements.fabSummarize) setButtonBusy(elements.fabSummarize, false, "Running...", "Generate");
            if (elements.cancelBtn) elements.cancelBtn.hidden = true;
            return;
        }

        setButtonBusy(elements.summarizeBtn, false, "Running...", "Generate");
        if (elements.fabSummarize) setButtonBusy(elements.fabSummarize, false, "Running...", "Generate");
    }

    async function askFollowUp(forcedGrounding) {
        const question = elements.chatInput.value.trim();
        if (!question) return;

        const grounding = normalizeGrounding(forcedGrounding || currentGroundingMode);
        elements.chatInput.value = "";
        appendChatEntry("user", question, grounding);
        setStatus(grounding === "open" ? "Asking (general)..." : "Asking...", "busy");
        setButtonBusy(elements.chatSend, true, "...", "Send");

        const response = await sendRuntimeMessage({
            type: MSG.DEEP_DIVE_ACTIVE_TAB,
            question,
            grounding,
            result: grounding === "source" ? buildFollowUpContext(latestResult) : null,
            conversationHistory
        });
        if (!response || !response.ok) {
            setStatus((response && response.error) || "Follow-up failed.", "error");
            setButtonBusy(elements.chatSend, false, "...", "Send");
            return;
        }

        appendChatEntry(
            "assistant",
            (response.result && response.result.answer) || response.answer || "No response.",
            (response.result && response.result.grounding) || grounding
        );
        conversationHistory.push(response.result || response);
        conversationHistory = conversationHistory.slice(-6);
        setStatus("Answer received.", "ready");
        setButtonBusy(elements.chatSend, false, "...", "Send");
    }

    function buildExportBody(r) {
        const parts = [];
        parts.push("## Main Summary", r.summary || "");
        if (r.keyTakeaways && r.keyTakeaways.length)
            parts.push("", "## Executive Takeaways", r.keyTakeaways.map((t) => "- " + t).join("\n"));
        if (r.detailsOfVideo)
            parts.push("", "## Details of the Video", r.detailsOfVideo);
        if (r.detailedBreakdown)
            parts.push("", "## Complete Guided Walkthrough", r.detailedBreakdown);
        if (r.conceptMapAndPrerequisites)
            parts.push("", "## Concepts, Definitions & Mental Models", r.conceptMapAndPrerequisites);
        if (r.evidenceAndDetails)
            parts.push("", "## Reasoning, Evidence & Claim Audit", r.evidenceAndDetails);
        if (r.argumentAndInsight)
            parts.push("", "## Connections, Causes & Tradeoffs", r.argumentAndInsight);
        if (r.practicalSteps)
            parts.push("", "## Practical Application", r.practicalSteps);
        if (r.expertCommentary)
            parts.push("", "## Caveats, Biases & Open Questions", r.expertCommentary);
        if (r.reviewKit)
            parts.push("", "## Memory & Review Kit", r.reviewKit);
        return parts.join("\n\n");
    }

    async function copySummary() {
        if (!latestResult) { setStatus("No summary available.", "error"); return; }
        const text = "# " + latestResult.title + "\n\n" + buildExportBody(latestResult);
        await navigator.clipboard.writeText(text);
        setStatus("Copied to clipboard.", "ready");
    }

    function exportMarkdown() {
        if (!latestResult) return;
        const text = "# " + latestResult.title + "\n\n" + buildExportBody(latestResult);
        const blob = new Blob([text], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = (globalThis.SummarizerCleaners ? SummarizerCleaners.sanitizeFilename(latestResult.title) : (latestResult.title || "summary").replace(/[^a-z0-9]/gi, "_")) + ".md";
        a.click();
        URL.revokeObjectURL(url);
    }

    function exportText() {
        if (!latestResult) return;
        // Strip markdown heading markers for plain text, keep section labels as plain text
        const body = buildExportBody(latestResult).replace(/## /g, "").trim();
        const text = latestResult.title + "\n\n" + body;
        const blob = new Blob([text], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = (globalThis.SummarizerCleaners ? SummarizerCleaners.sanitizeFilename(latestResult.title) : (latestResult.title || "summary").replace(/[^a-z0-9]/gi, "_")) + ".txt";
        a.click();
        URL.revokeObjectURL(url);
    }

    function transcriptFileBaseName(result) {
        const title = result && result.title || "transcript";
        return globalThis.SummarizerCleaners && typeof SummarizerCleaners.sanitizeFilename === "function"
            ? SummarizerCleaners.sanitizeFilename(title)
            : String(title).replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "") || "transcript";
    }

    async function copyTranscript() {
        if (!latestResult || latestResult.sourceType !== "youtube") {
            setStatus("No transcript available.", "error");
            return;
        }
        const text = SummarizerTranscriptExport.buildPlainTranscript(latestResult);
        if (!text) {
            setStatus("No transcript available.", "error");
            return;
        }
        try {
            await navigator.clipboard.writeText(text);
            setStatus("Transcript copied.", "ready");
        } catch (_) {
            setStatus("Could not copy transcript.", "error");
        }
    }

    function downloadTranscriptSrt() {
        if (!latestResult || latestResult.sourceType !== "youtube") {
            setStatus("No transcript available.", "error");
            return;
        }
        const text = SummarizerTranscriptExport.buildSrt(latestResult);
        if (!text) {
            setStatus("No transcript available.", "error");
            return;
        }
        SummarizerTranscriptExport.downloadTextFile(
            text,
            transcriptFileBaseName(latestResult) + ".srt",
            "application/x-subrip;charset=utf-8"
        );
        setStatus("SRT download started.", "ready");
    }

    async function clearCurrentTabData() {
        latestResult = null;
        conversationHistory = [];
        renderResult(null);
        elements.chatLog.innerHTML = "";
        setStatus("Cleared.", "ready");
    }

    function setupReadingProgress() {
        const progressBar = document.getElementById("reading-progress-bar");
        const shell = elements.shell;
        if (!progressBar || !shell) return;
        shell.addEventListener("scroll", () => {
            const maxScroll = shell.scrollHeight - shell.clientHeight;
            const progress = maxScroll > 0 ? (shell.scrollTop / maxScroll) * 100 : 0;
            progressBar.style.width = Math.min(100, Math.max(0, progress)) + "%";
            if (activeTabId) sessionStorage.setItem(`scroll_${activeTabId}`, shell.scrollTop);
        });
    }

    function setupHighlightToAsk() {
        const tooltip = elements.highlightTooltip;
        const shell = elements.shell;
        if (!tooltip || !shell) return;

        shell.addEventListener("mouseup", () => {
            const selection = window.getSelection();
            const text = selection.toString().trim();
            if (text && text.length > 5) {
                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                const shellRect = shell.getBoundingClientRect();
                tooltip.style.left = (rect.left + rect.width / 2) + "px";
                tooltip.style.top = (rect.top - shellRect.top + shell.scrollTop - 4) + "px";
                tooltip.style.display = "block";
                tooltip.onclick = () => {
                    elements.chatInput.value = `Tell me more about: "${text}"`;
                    elements.chatInput.focus();
                    tooltip.style.display = "none";
                    askFollowUp("source");
                };
            } else {
                tooltip.style.display = "none";
            }
        });
        document.addEventListener("mousedown", (e) => { if (e.target !== tooltip) tooltip.style.display = "none"; });
    }

    function setupTranscriptToggle() {
        const toggle = document.getElementById("transcript-toggle");
        const content = document.getElementById("panel-transcript-content");
        if (!toggle || !content) return;
        toggle.addEventListener("click", () => {
            const expanded = toggle.getAttribute("aria-expanded") === "true";
            toggle.setAttribute("aria-expanded", String(!expanded));
            content.hidden = expanded;
            toggle.querySelector(".transcript-toggle-icon").textContent = expanded ? "\u25b6" : "\u25bc";
            const hint = toggle.querySelector(".transcript-toggle-hint");
            if (hint) hint.textContent = expanded ? hint.dataset.collapsedLabel : hint.dataset.expandedLabel;
        });
    }
    function setupTranscriptFilter() {
        if (!elements.transcriptFilter) return;
        elements.transcriptFilter.addEventListener("input", () => {
            SummarizerRender.filterTranscript(elements, elements.transcriptFilter.value);
        });
    }

    function setupKeyboardShortcuts() {
        document.addEventListener("keydown", (e) => {
            if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable) return;
            if (e.key === "j") { elements.shell.scrollBy({ top: 80, behavior: "smooth" }); e.preventDefault(); }
            if (e.key === "k") { elements.shell.scrollBy({ top: -80, behavior: "smooth" }); e.preventDefault(); }
            if (e.key === "/") { elements.transcriptFilter?.focus(); e.preventDefault(); }
            if (e.key === "Escape") { elements.highlightTooltip.style.display = "none"; }
        });
    }

    // Event Listeners
    if (elements.modeSelect) {
        elements.modeSelect.addEventListener("change", async () => {
            try { await SummarizerStorage.saveSettings({ promptMode: elements.modeSelect.value }); } catch (_) {}
        });
    }
    elements.summarizeBtn.addEventListener("click", summarize);
    if (elements.cancelBtn) {
        elements.cancelBtn.addEventListener("click", async () => {
            if (activeTabId) {
                await sendRuntimeMessage({ type: MSG.CANCEL_SUMMARIZE, tabId: activeTabId });
            }
            setButtonBusy(elements.summarizeBtn, false, "Running...", "Generate");
            setStatus("Cancelled.", "ready");
            elements.cancelBtn.hidden = true;
        });
    }
    elements.fabSummarize?.addEventListener("click", summarize);
    elements.copyBtn?.addEventListener("click", copySummary);
    elements.exportMdBtn?.addEventListener("click", exportMarkdown);
    elements.exportTxtBtn?.addEventListener("click", exportText);
    elements.transcriptCopyBtn?.addEventListener("click", copyTranscript);
    elements.transcriptSrtBtn?.addEventListener("click", downloadTranscriptSrt);
    elements.clearBtn?.addEventListener("click", clearCurrentTabData);
    elements.settingsBtn?.addEventListener("click", () => chrome.runtime.openOptionsPage());

    elements.chatSend.addEventListener("click", () => askFollowUp());
    elements.chatInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); askFollowUp(); }
    });
    if (elements.groundingSourceBtn) {
        elements.groundingSourceBtn.addEventListener("click", () => setGroundingMode("source"));
    }
    if (elements.groundingOpenBtn) {
        elements.groundingOpenBtn.addEventListener("click", () => setGroundingMode("open"));
    }

    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === MSG.SUMMARY_UPDATED) {
            if (message.tabId && activeTabId && message.tabId !== activeTabId) return;
            if (elements.cancelBtn) elements.cancelBtn.hidden = true;
            renderResult(message.result);
            if (elements.transcriptFilter) elements.transcriptFilter.value = "";
            elements.chatLog.innerHTML = "";
            conversationHistory = [];
            if (message.tabId) {
                activeTabId = message.tabId;
            }
            setStatus("Summary updated.", "ready");
        }
        if (message.type === MSG.SUMMARY_ERROR) {
            if (elements.cancelBtn) elements.cancelBtn.hidden = true;
            if (message.tabId && activeTabId && message.tabId !== activeTabId) return;
            let errorMessage = message.error || "Summary failed.";
            if (message.code === "AUTH_ERROR" || (errorMessage && errorMessage.includes("API key"))) {
                errorMessage = "Invalid API key. Please update it in Settings.";
            } else if (message.code === "RATE_LIMIT" || (errorMessage && errorMessage.includes("rate limit"))) {
                errorMessage = "Provider rate limit reached. Wait a moment or switch providers.";
            } else if (message.code === "CANCELLED" || (errorMessage && errorMessage.includes("cancelled"))) {
                errorMessage = "Summary cancelled.";
            }
            setStatus(errorMessage, "error");
        }
        if (message.type === MSG.SETTINGS_UPDATED) {
            const t = message.settings;
            if (t) {
                if (t.theme !== undefined) {
                    SummarizerTheme.applyThemeToDocument(t.theme);
                    if (elements.panelTheme) elements.panelTheme.value = t.theme;
                }
                if (t.fontScale !== undefined) {
                    SummarizerTheme.applyFontScaleToDocument(t.fontScale);
                    if (elements.panelFontScale) elements.panelFontScale.value = t.fontScale;
                }
            }
            SummarizerSidepanelState.loadSettings(elements).catch(() => {});
        }
        if (message.type === MSG.SUMMARY_CHUNK) {
            if (message.tabId && activeTabId && message.tabId !== activeTabId) return;
            if (message.tabId) activeTabId = message.tabId;
            renderResult(message.result);
            setStatus("Generating summary...", "busy");
        }
    });

    chrome.tabs.onActivated.addListener(() => refreshActiveTabView().catch(() => {}));
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (tab.active && (changeInfo.status === "loading" || changeInfo.status === "complete")) {
            refreshActiveTabView().catch(() => {});
        }
    });


    async function setupDisplayControls() {
        const themeEl = elements.panelTheme;
        const fontEl = elements.panelFontScale;
        const languageEl = elements.summaryLanguage;
        const toneEl = elements.summaryTone;
        const sizeEl = elements.summarySize;
        const lengthEl = elements.summaryLength;
        if (!themeEl && !fontEl && !languageEl && !toneEl && !sizeEl && !lengthEl) return;

        function populateSettingOptions(selectEl, settingKey) {
            if (!selectEl) return;
            const values = SummarizerSettingsSchema.getValidValues(settingKey);
            if (!values) return;
            selectEl.innerHTML = "";
            Array.from(values).forEach((value) => {
                const opt = document.createElement("option");
                opt.value = value;
                opt.textContent = value;
                selectEl.appendChild(opt);
            });
        }

        populateSettingOptions(toneEl, "summaryTone");
        populateSettingOptions(sizeEl, "summarySize");
        populateSettingOptions(lengthEl, "summaryLength");

        try {
            const settings = await SummarizerStorage.getSettings();
            if (themeEl) themeEl.value = settings.theme || "system";
            if (fontEl) fontEl.value = settings.fontScale || "md";
            if (languageEl) {
                populateLanguageOptions(languageEl, settings);
                languageEl.value = settings.summaryLanguage || "English";
                if (!languageEl.value) languageEl.value = "English";
            }
            if (toneEl) toneEl.value = settings.summaryTone || "Simple";
            if (sizeEl) sizeEl.value = settings.summarySize || "Medium";
            if (lengthEl) lengthEl.value = settings.summaryLength || "Medium";
            SummarizerTheme.applyThemeToDocument(settings.theme || "system");
            SummarizerTheme.applyFontScaleToDocument(settings.fontScale || "md");
        } catch (_) {}

        function populateLanguageOptions(selectEl, settings) {
            const customList = String(settings.customLanguages || "").split(",").map((l) => String(l || "").trim()).filter(Boolean);
            const langs = Array.from(new Set(["English", "Vietnamese", ...customList]));
            selectEl.innerHTML = "";
            langs.forEach((lang) => {
                const opt = document.createElement("option");
                opt.value = lang;
                opt.textContent = lang;
                selectEl.appendChild(opt);
            });
        }

        async function persistSetting(partial) {
            try {
                await SummarizerStorage.saveSettings(partial);
            } catch (_) {}
        }

        if (themeEl) {
            themeEl.addEventListener("change", async () => {
                SummarizerTheme.applyThemeToDocument(themeEl.value);
                await persistSetting({ theme: themeEl.value });
            });
        }
        if (fontEl) {
            fontEl.addEventListener("change", async () => {
                SummarizerTheme.applyFontScaleToDocument(fontEl.value);
                await persistSetting({ fontScale: fontEl.value });
            });
        }
        if (languageEl) {
            languageEl.addEventListener("change", async () => {
                await persistSetting({ summaryLanguage: languageEl.value });
            });
        }
        if (toneEl) {
            toneEl.addEventListener("change", async () => {
                await persistSetting({ summaryTone: toneEl.value });
            });
        }
        if (sizeEl) {
            sizeEl.addEventListener("change", async () => {
                await persistSetting({ summarySize: sizeEl.value });
            });
        }
        if (lengthEl) {
            lengthEl.addEventListener("change", async () => {
                await persistSetting({ summaryLength: lengthEl.value });
            });
        }
    }

    // Init
    setGroundingMode("source");
    setupReadingProgress();
    setupDisplayControls();
    setupHighlightToAsk();
    setupTranscriptToggle();
    setupTranscriptFilter();
    setupKeyboardShortcuts();
    SummarizerSidepanelState.loadSettings(elements).catch(() => {});
    SummarizerTheme.watchSystemTheme(() => {
        SummarizerStorage.getSettings().then((settings) => {
            if ((settings.theme || "system") === "system") SummarizerTheme.applyThemeToDocument("system");
        }).catch(() => {});
    });
    refreshActiveTabView().catch(() => {});
})();
