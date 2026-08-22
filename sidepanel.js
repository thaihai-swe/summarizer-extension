(function () {
    const MSG = SummarizerMessages.types;
    let latestResult = null;
    let activeTabId = null;
    let refreshSequence = 0;
    let workflowPollTimer = null;
    let isStreaming = false;
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
        panelDensity: document.getElementById("panel-density"),
        panelFontScale: document.getElementById("panel-fontScale"),
        summaryLanguage: document.getElementById("panel-summaryLanguage"),
        workflowStepper: document.getElementById("workflow-stepper")
    };

    // Stepper step ordering: extract -> chunk -> synthesis -> quality
    const STEPPER_ORDER = ["extract", "chunk", "synthesis", "quality"];

    function updateStepperFromWorkflow(workflow) {
        const stepper = elements.workflowStepper;
        if (!stepper) return;

        const isActive = workflow && (workflow.phase === "extracting" || workflow.phase === "summarizing");
        stepper.hidden = !isActive;

        if (!isActive) return;

        const currentStep = (workflow.step) || (workflow.phase === "extracting" ? "extract" : "chunk");
        const currentIndex = STEPPER_ORDER.indexOf(currentStep);
        const steps = stepper.querySelectorAll(".stepper-step");
        steps.forEach((stepEl, idx) => {
            stepEl.classList.remove("is-active", "is-done");
            if (idx < currentIndex) {
                stepEl.classList.add("is-done");
            } else if (idx === currentIndex) {
                stepEl.classList.add("is-active");
                // Update detail label for chunking step
                const detail = stepEl.querySelector(".step-detail");
                if (detail) {
                    if (currentStep === "chunk" && workflow.chunkTotal > 1) {
                        detail.textContent = `${workflow.chunkIndex || 0}/${workflow.chunkTotal}`;
                    } else if (currentStep === "extract") {
                        detail.textContent = "Reading...";
                    } else if (currentStep === "synthesis") {
                        detail.textContent = "Combining...";
                    } else if (currentStep === "quality") {
                        detail.textContent = "Checking...";
                    } else {
                        detail.textContent = "";
                    }
                }
            }
        });
    }

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

    function formatWorkflowStatus(workflow, fallbackResult) {
        if (!workflow) return fallbackResult ? "Summary ready." : "Ready.";
        if (workflow.phase === "failed") return workflow.lastError || workflow.statusMessage || "Summary failed.";
        if (workflow.phase === "completed") return workflow.statusMessage || "Summary ready.";
        if (workflow.statusMessage) return workflow.statusMessage;
        if (workflow.phase === "extracting") return "Extracting current tab...";
        if (workflow.phase === "summarizing") return "Summarizing current tab...";
        return fallbackResult ? "Summary ready." : "Ready.";
    }

    function getWorkflowStatusType(workflow) {
        if (!workflow || workflow.phase === "completed") return "ready";
        return workflow.phase === "failed" ? "error" : "busy";
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

    async function refreshWorkflowStatusOnly() {
        const workflowResponse = await sendRuntimeMessage({ type: MSG.GET_ACTIVE_TAB_WORKFLOW });
        const workflow = workflowResponse && workflowResponse.ok ? workflowResponse.workflow : null;
        if (workflowResponse && workflowResponse.tabId) activeTabId = workflowResponse.tabId;
        setStatus(formatWorkflowStatus(workflow, latestResult), getWorkflowStatusType(workflow));
        updateStepperFromWorkflow(workflow);
        if (workflow && (workflow.phase === "extracting" || workflow.phase === "summarizing")) {
            if (!isStreaming) {
                SummarizerRender.clearAllContent(elements, workflow);
            }
        }
        if (!workflow || workflow.phase === "completed" || workflow.phase === "failed") stopWorkflowPolling();
    }

    function startWorkflowPolling() {
        if (workflowPollTimer) clearInterval(workflowPollTimer);
        workflowPollTimer = setInterval(() => refreshWorkflowStatusOnly().catch(() => {}), 1000);
    }

    function stopWorkflowPolling() {
        if (workflowPollTimer) { clearInterval(workflowPollTimer); workflowPollTimer = null; }
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

    async function refreshActiveTabView() {
        const mySeq = ++refreshSequence;
        const resultResponse = await sendRuntimeMessage({ type: MSG.GET_ACTIVE_TAB_RESULT });
        if (mySeq !== refreshSequence) return;

        let localTabId = null;
        if (resultResponse && resultResponse.ok) {
            localTabId = resultResponse.tabId;
            renderResult(resultResponse.result);
        } else {
            renderResult(null);
        }

        const workflowResponse = await sendRuntimeMessage({ type: MSG.GET_ACTIVE_TAB_WORKFLOW });
        if (mySeq !== refreshSequence) return;
        const workflow = workflowResponse && workflowResponse.ok ? workflowResponse.workflow : null;
        if (workflowResponse && workflowResponse.tabId) localTabId = workflowResponse.tabId;

        activeTabId = localTabId;
        setStatus(formatWorkflowStatus(workflow, latestResult), getWorkflowStatusType(workflow));
        updateStepperFromWorkflow(workflow);
        if (elements.cancelBtn) {
            elements.cancelBtn.hidden = !(workflow && (workflow.phase === "extracting" || workflow.phase === "summarizing"));
        }

        elements.chatLog.innerHTML = "";
        if (localTabId) {
            SummarizerSidepanelState.loadConversationHistory(localTabId, appendChatEntry, elements.chatLog).catch(() => {});
        }

        if (workflow && workflow.phase !== "completed" && workflow.phase !== "failed") {
            startWorkflowPolling();
            SummarizerRender.clearAllContent(elements, workflow);
        } else {
            stopWorkflowPolling();
        }
    }

    async function summarize() {
        setStatus("Starting summary...", "busy");
        isStreaming = false;
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

        startWorkflowPolling();
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

        const response = await sendRuntimeMessage({ type: MSG.DEEP_DIVE_ACTIVE_TAB, question, grounding });
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

    async function clearCurrentTabData() {
        const response = await sendRuntimeMessage({ type: MSG.CLEAR_TAB_DATA });
        if (response && response.ok) {
            renderResult(null);
            elements.chatLog.innerHTML = "";
            setStatus("Cleared.", "ready");
        } else {
            setStatus((response && response.error) || "Failed to clear.", "error");
        }
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
            stopWorkflowPolling();
            elements.cancelBtn.hidden = true;
        });
    }
    elements.fabSummarize?.addEventListener("click", summarize);
    elements.copyBtn?.addEventListener("click", copySummary);
    elements.exportMdBtn?.addEventListener("click", exportMarkdown);
    elements.exportTxtBtn?.addEventListener("click", exportText);
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
            isStreaming = false;
            if (message.tabId && activeTabId && message.tabId !== activeTabId) return;
            if (elements.cancelBtn) elements.cancelBtn.hidden = true;
            renderResult(message.result);
            if (elements.transcriptFilter) elements.transcriptFilter.value = "";
            elements.chatLog.innerHTML = "";
            if (message.tabId) {
                activeTabId = message.tabId;
                SummarizerSidepanelState.loadConversationHistory(message.tabId, appendChatEntry, elements.chatLog);
            }
            setStatus("Summary updated.", "ready");
            stopWorkflowPolling();
            if (elements.workflowStepper) elements.workflowStepper.hidden = true;
        }
        if (message.type === MSG.SUMMARY_ERROR) {
            isStreaming = false;
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
            stopWorkflowPolling();
            if (elements.workflowStepper) elements.workflowStepper.hidden = true;
        }
        if (message.type === MSG.SETTINGS_UPDATED) {
            const t = message.settings;
            if (t) {
                if (t.theme !== undefined) {
                    SummarizerTheme.applyThemeToDocument(t.theme);
                    if (elements.panelTheme) elements.panelTheme.value = t.theme;
                }
                if (t.density !== undefined) {
                    SummarizerTheme.applyDensityToDocument(t.density);
                    if (elements.panelDensity) elements.panelDensity.value = t.density;
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
            isStreaming = true;
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
        const densityEl = elements.panelDensity;
        const fontEl = elements.panelFontScale;
        const languageEl = elements.summaryLanguage;
        if (!themeEl && !densityEl && !fontEl && !languageEl) return;

        try {
            const settings = await SummarizerStorage.getSettings();
            if (themeEl) themeEl.value = settings.theme || "system";
            if (densityEl) densityEl.value = settings.density || "comfortable";
            if (fontEl) fontEl.value = settings.fontScale || "md";
            if (languageEl) {
                populateLanguageOptions(languageEl, settings);
                languageEl.value = settings.summaryLanguage || "English";
                if (!languageEl.value) languageEl.value = "English";
            }
            SummarizerTheme.applyThemeToDocument(settings.theme || "system");
            SummarizerTheme.applyDensityToDocument(settings.density || "comfortable");
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

        async function persistVisual(partial) {
            try {
                await SummarizerStorage.saveSettings(partial);
            } catch (_) {}
        }

        if (themeEl) {
            themeEl.addEventListener("change", async () => {
                SummarizerTheme.applyThemeToDocument(themeEl.value);
                await persistVisual({ theme: themeEl.value });
            });
        }
        if (densityEl) {
            densityEl.addEventListener("change", async () => {
                SummarizerTheme.applyDensityToDocument(densityEl.value);
                await persistVisual({ density: densityEl.value });
            });
        }
        if (fontEl) {
            fontEl.addEventListener("change", async () => {
                SummarizerTheme.applyFontScaleToDocument(fontEl.value);
                await persistVisual({ fontScale: fontEl.value });
            });
        }
        if (languageEl) {
            languageEl.addEventListener("change", async () => {
                await persistVisual({ summaryLanguage: languageEl.value });
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
