(function () {
    const MSG = SummarizerMessages.types;
    const fields = {
        provider: document.getElementById("provider"),
        promptMode: document.getElementById("promptMode"),
        summarySize: document.getElementById("summarySize"),
        summaryLanguage: document.getElementById("summaryLanguage"),
        customLanguages: document.getElementById("customLanguages"),
        summaryTone: document.getElementById("summaryTone"),
        customPromptInstructions: document.getElementById("customPromptInstructions"),
        customSystemInstructions: document.getElementById("customSystemInstructions"),
        youtubePromptHint: document.getElementById("youtubePromptHint"),
        webpagePromptHint: document.getElementById("webpagePromptHint"),
        coursePromptHint: document.getElementById("coursePromptHint"),
        selectedTextPromptHint: document.getElementById("selectedTextPromptHint"),
        analyzePromptHint: document.getElementById("analyzePromptHint"),
        explainPromptHint: document.getElementById("explainPromptHint"),
        debatePromptHint: document.getElementById("debatePromptHint"),
        studyPromptHint: document.getElementById("studyPromptHint"),
        outlinePromptHint: document.getElementById("outlinePromptHint"),
        timelinePromptHint: document.getElementById("timelinePromptHint"),
        showFloatingUi: document.getElementById("showFloatingUi"),
        theme: document.getElementById("theme"),
        density: document.getElementById("density"),
        fontScale: document.getElementById("fontScale"),
        generateFollowUpQuestions: document.getElementById("generateFollowUpQuestions"),
        geminiApiKey: document.getElementById("geminiApiKey"),
        geminiModel: document.getElementById("geminiModel"),
        openaiApiKey: document.getElementById("openaiApiKey"),
        openaiBaseUrl: document.getElementById("openaiBaseUrl"),
        openaiModel: document.getElementById("openaiModel"),
        localBaseUrl: document.getElementById("localBaseUrl"),
        localModel: document.getElementById("localModel"),
        localEndpointType: document.getElementById("localEndpointType"),
        promptReferenceSource: document.getElementById("promptReferenceSource"),
        promptReferenceSourcePrompts: document.getElementById("promptReferenceSourcePrompts"),
        promptMeta: document.getElementById("prompt-meta"),
        saveBtn: document.getElementById("save-settings"),
        saveStatus: document.getElementById("save-status"),
        summaryLength: document.getElementById("summaryLength"),
        geminiUseDirectVideo: document.getElementById("geminiUseDirectVideo"),
        conceptsPromptHint: document.getElementById("conceptsPromptHint"),
        advancedModeYoutube: document.getElementById("advancedModeYoutube"),
        advancedModeWebpage: document.getElementById("advancedModeWebpage"),
        advancedModeCourse: document.getElementById("advancedModeCourse"),
        advancedModeSelectedText: document.getElementById("advancedModeSelectedText"),
        customSystemPromptYoutube: document.getElementById("customSystemPromptYoutube"),
        customUserPromptYoutube: document.getElementById("customUserPromptYoutube"),
        customSystemPromptWebpage: document.getElementById("customSystemPromptWebpage"),
        customUserPromptWebpage: document.getElementById("customUserPromptWebpage"),
        customSystemPromptCourse: document.getElementById("customSystemPromptCourse"),
        customUserPromptCourse: document.getElementById("customUserPromptCourse"),
        customSystemPromptSelectedText: document.getElementById("customSystemPromptSelectedText"),
        customUserPromptSelectedText: document.getElementById("customUserPromptSelectedText"),
        exportSettingsBtn: document.getElementById("exportSettingsBtn"),
        importSettingsBtn: document.getElementById("importSettingsBtn"),
        importSettingsFile: document.getElementById("importSettingsFile"),
        presetsList: document.getElementById("prompt-presets-list"),
        presetName: document.getElementById("preset-name"),
        presetSystem: document.getElementById("preset-system"),
        presetUser: document.getElementById("preset-user"),
        presetAdd: document.getElementById("preset-add")
    };

    let customPromptPresets = [];
    const previewContent = document.getElementById("preview-content");

    // Dynamic Tab Navigation with active indicator slider
    function setupTabs() {
        const tabBtns = Array.from(document.querySelectorAll(".tab-btn"));
        const tabContents = Array.from(document.querySelectorAll(".tab-panel"));
        const indicator = document.querySelector(".tab-indicator");

        function updateIndicator(activeBtn) {
            if (!indicator || !activeBtn) return;
            indicator.style.setProperty("--tab-indicator-width", `${activeBtn.offsetWidth}px`);
            indicator.style.setProperty("--tab-indicator-x", `${activeBtn.offsetLeft - 5}px`);
        }

        function activateTab(btn, { focusPanel = false } = {}) {
            if (!btn) return;
            const tabId = btn.getAttribute("data-tab");
            tabBtns.forEach((b) => {
                const selected = b === btn;
                b.classList.toggle("active", selected);
                b.setAttribute("aria-selected", selected ? "true" : "false");
                b.setAttribute("tabindex", selected ? "0" : "-1");
            });
            tabContents.forEach((panel) => {
                const selected = panel.id === `tab-${tabId}`;
                panel.classList.toggle("active", selected);
                panel.hidden = !selected;
                if (selected && focusPanel) {
                    panel.focus({ preventScroll: true });
                }
            });
            updateIndicator(btn);
        }

        tabBtns.forEach((btn) => {
            const tabId = btn.getAttribute("data-tab");
            if (tabId) btn.setAttribute("aria-controls", `tab-${tabId}`);
            btn.setAttribute("tabindex", btn.classList.contains("active") ? "0" : "-1");
            btn.addEventListener("click", () => activateTab(btn));
            btn.addEventListener("keydown", (event) => {
                const currentIndex = tabBtns.indexOf(btn);
                if (currentIndex < 0) return;
                let nextIndex = null;
                if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                    nextIndex = (currentIndex + 1) % tabBtns.length;
                } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                    nextIndex = (currentIndex - 1 + tabBtns.length) % tabBtns.length;
                } else if (event.key === "Home") {
                    nextIndex = 0;
                } else if (event.key === "End") {
                    nextIndex = tabBtns.length - 1;
                } else if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    activateTab(btn, { focusPanel: true });
                    return;
                }
                if (nextIndex === null) return;
                event.preventDefault();
                const nextBtn = tabBtns[nextIndex];
                activateTab(nextBtn);
                nextBtn.focus();
            });
        });

        tabContents.forEach((panel) => {
            panel.hidden = !panel.classList.contains("active");
        });

        function refreshIndicator() {
            const activeBtn = document.querySelector(".tab-btn.active") || tabBtns[0];
            updateIndicator(activeBtn);
        }
        setTimeout(refreshIndicator, 50);
        window.addEventListener("resize", refreshIndicator);
    }

    // Input Visibility Toggles
    function setupPasswordToggles() {
        document.querySelectorAll(".toggle-visibility").forEach(btn => {
            btn.addEventListener("click", () => {
                const targetId = btn.getAttribute("data-target");
                const input = document.getElementById(targetId);
                const eyeOpen = btn.querySelector(".icon-eye-open");
                const eyeClosed = btn.querySelector(".icon-eye-closed");
                if (input && eyeOpen && eyeClosed) {
                    if (input.type === "password") {
                        input.type = "text";
                        eyeOpen.setAttribute("hidden", "");
                        eyeClosed.removeAttribute("hidden");
                    } else {
                        input.type = "password";
                        eyeClosed.setAttribute("hidden", "");
                        eyeOpen.removeAttribute("hidden");
                    }
                }
            });
        });
    }

    // Provider choice visual sync
    function setupProviderSync() {
        const cards = document.querySelectorAll(".provider-card");
        const forms = document.querySelectorAll(".provider-form");
        const select = fields.provider;

        function showProviderForm(providerId) {
            cards.forEach(c => c.classList.toggle("active", c.getAttribute("data-provider") === providerId));
            forms.forEach(f => f.classList.toggle("active", f.getAttribute("data-provider") === providerId));
            const nameMap = { gemini: "Gemini", openai: "OpenAI", local: "Local LLM" };
            document.getElementById("form-provider-name").textContent = nameMap[providerId] || providerId;
        }

        cards.forEach(card => {
            card.addEventListener("click", () => {
                const providerId = card.getAttribute("data-provider");
                select.value = providerId;
                showProviderForm(providerId);
            });
        });

        select.addEventListener("change", () => {
            showProviderForm(select.value);
        });

        // Init active state based on select
        if (select.value) {
            showProviderForm(select.value);
        }
    }

    // Live previews for rendering density and scale
    function setupLivePreview() {
        const densitySelect = fields.density;
        const fontScaleSelect = fields.fontScale;

        function updatePreview() {
            if (!previewContent) return;
            previewContent.setAttribute("data-density", densitySelect.value);
            previewContent.setAttribute("data-font-scale", fontScaleSelect.value);
        }

        densitySelect.addEventListener("change", updatePreview);
        fontScaleSelect.addEventListener("change", updatePreview);
        updatePreview();
    }

    function collectFormSettings() {
        return {
            provider: fields.provider.value,
            promptMode: fields.promptMode.value || "summarize",
            summarySize: fields.summarySize.value || "Medium",
            summaryLanguage: fields.summaryLanguage.value || "English",
            customLanguages: fields.customLanguages ? (fields.customLanguages.value || "").trim() : "",
            summaryLength: fields.summaryLength.value || "Medium",
            customPromptInstructions: fields.customPromptInstructions.value.trim(),
            customSystemInstructions: fields.customSystemInstructions.value.trim(),
            youtubePromptHint: normalizeHintValue(fields.youtubePromptHint),
            webpagePromptHint: normalizeHintValue(fields.webpagePromptHint),
            coursePromptHint: normalizeHintValue(fields.coursePromptHint),
            selectedTextPromptHint: normalizeHintValue(fields.selectedTextPromptHint),
            analyzePromptHint: normalizeHintValue(fields.analyzePromptHint),
            explainPromptHint: normalizeHintValue(fields.explainPromptHint),
            debatePromptHint: normalizeHintValue(fields.debatePromptHint),
            studyPromptHint: normalizeHintValue(fields.studyPromptHint),
            outlinePromptHint: normalizeHintValue(fields.outlinePromptHint),
            timelinePromptHint: normalizeHintValue(fields.timelinePromptHint),
            showFloatingUi: fields.showFloatingUi.checked,
            theme: fields.theme.value,
            density: fields.density.value,
            fontScale: fields.fontScale.value,
            generateFollowUpQuestions: fields.generateFollowUpQuestions.checked
        };
    }

    function getPromptSourceType() {
        if (fields.promptReferenceSource && fields.promptReferenceSource.value) {
            return fields.promptReferenceSource.value;
        }
        if (fields.promptReferenceSourcePrompts && fields.promptReferenceSourcePrompts.value) {
            return fields.promptReferenceSourcePrompts.value;
        }
        return "webpage";
    }

    function syncPromptSourceSelectors(sourceType) {
        [fields.promptReferenceSource, fields.promptReferenceSourcePrompts].forEach((select) => {
            if (select && select.value !== sourceType) {
                select.value = sourceType;
            }
        });
    }

    function getSampleContext(sourceType) {
        // Realistic sample source payload so the generated prompt matches production shape.
        // The rest of the prompt (role, rules, section contract, mode, custom instructions) is the actual system prompt.
        if (sourceType === "youtube") {
            const transcript = [
                "[00:00] Welcome back. Today we walk through how the summarizer extension extracts YouTube transcripts.",
                "[00:22] First it detects the active video, then requests caption tracks and normalizes timestamps.",
                "[01:05] The host compares short videos, which use one prompt, against long videos that need chunking plus synthesis.",
                "[02:40] A key claim: keeping section headings stable is more important than clever wording because the cleaner parses by heading.",
                "[04:10] Practical tip: when captions are missing, fall back to page metadata and tell the user the transcript is incomplete.",
                "[05:35] Closing recommendation: prefer grounded bullets with timestamps over generic overviews."
            ].join("\n");
            return {
                sourceType: "youtube",
                title: "How transcript extraction works in practice",
                url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                content: transcript,
                contentForPrompt: transcript,
                videoDetails: {
                    channelName: "Summarizer Labs",
                    durationText: "6:12",
                    publishDate: "2026-03-04",
                    viewCountText: "12,480 views",
                    transcriptLanguage: "en",
                    captionTrackLabel: "English (auto-generated)",
                    transcriptFormat: "timestamped",
                    hasTimestamps: true,
                    description: "A practical walkthrough of transcript extraction, chunking, and grounded summary structure.",
                    chapters: [
                        { title: "Intro", startText: "0:00" },
                        { title: "Extraction flow", startText: "0:22" },
                        { title: "Chunking tradeoffs", startText: "1:05" },
                        { title: "Parsing constraints", startText: "2:40" },
                        { title: "Recommendations", startText: "5:35" }
                    ]
                }
            };
        }
        if (sourceType === "course") {
            return {
                sourceType: "course",
                title: "Lesson 4: Prompt Contracts and Output Sections",
                url: "https://www.coursera.org/learn/example/lecture/prompt-contracts",
                content: [
                    "Learning objectives:",
                    "- Explain why stable section headings matter for downstream parsing.",
                    "- Distinguish safety rules, task rules, and optional custom instructions.",
                    "- Apply grounding rules when source evidence is incomplete.",
                    "",
                    "Key definitions:",
                    "Prompt envelope: shared structure used across webpage, YouTube, course, and selected-text sources.",
                    "Section contract: the exact ordered headings the model must return.",
                    "",
                    "Worked example:",
                    "A medium webpage summary asks for Summary, Key Takeaways, Main Points, Detailed Breakdown, Expert Commentary, and Follow-up Questions.",
                    "",
                    "Practice:",
                    "Rewrite a vague instruction into a grounded section-level instruction that does not invent missing facts."
                ].join("\n")
            };
        }
        if (sourceType === "selectedText") {
            return {
                sourceType: "selectedText",
                title: "Research notes on reading workflows",
                url: "https://example.com/reading-workflows",
                content: [
                    "Selected passage:",
                    "\"Teams retain more from long material when they externalize structure early. A good summary is not just shorter text; it is a navigable map of claims, evidence, and open questions. The cost of compression is lost nuance, so the best systems preserve provenance and make uncertainty visible.\"",
                    "",
                    "Surrounding sentence:",
                    "In practice, this means stable headings, source-grounded bullets, and explicit caveats beat free-form essays for later retrieval."
                ].join("\n")
            };
        }
        return {
            sourceType: "webpage",
            title: "Building better reading workflows with grounded summaries",
            url: "https://example.com/building-better-reading-workflows",
            content: [
                "Readers lose context when research is split across tabs, PDFs, and videos. Summaries help only when they preserve structure instead of collapsing everything into a vague overview.",
                "",
                "The article argues for three design principles:",
                "1. Stable section contracts so tools and humans can scan consistently.",
                "2. Grounding rules that forbid invented names, numbers, and citations.",
                "3. Mode-specific guidance for analyze, explain, debate, study, outline, and timeline tasks.",
                "",
                "Evidence comes from workflow interviews and product telemetry showing higher revisit rates when takeaways remain actionable and uncertainty is labeled.",
                "",
                "Tradeoff: deeper prompts improve faithfulness but increase token cost. The recommended default is a medium summary with optional deep mode for dense sources.",
                "",
                "Conclusion: treat the prompt as product infrastructure. Expose it to users so they can optimize custom instructions against the real system baseline."
            ].join("\n")
        };
    }

    function getBaselineSettings(overrides) {
        return Object.assign(collectFormSettings(), overrides || {});
    }

    function buildSourceBaselinePrompt(sourceType) {
        if (!globalThis.SummarizerPromptBuilders) {
            return "";
        }
        // Baseline = built-in system prompt without user custom overrides for that source/mode layer.
        const settings = getBaselineSettings({
            customPromptInstructions: "",
            customSystemInstructions: "",
            youtubePromptHint: "",
            webpagePromptHint: "",
            coursePromptHint: "",
            selectedTextPromptHint: "",
            analyzePromptHint: "",
            explainPromptHint: "",
            debatePromptHint: "",
            studyPromptHint: "",
            outlinePromptHint: "",
            timelinePromptHint: "",
            conceptsPromptHint: ""
        });
        return SummarizerPromptBuilders.buildSummaryPrompt(getSampleContext(sourceType), settings);
    }

    function buildModeBaselinePrompt(mode) {
        if (!globalThis.SummarizerPromptBuilders) {
            return "";
        }
        const settings = getBaselineSettings({
            promptMode: mode,
            customPromptInstructions: "",
            customSystemInstructions: "",
            youtubePromptHint: "",
            webpagePromptHint: "",
            coursePromptHint: "",
            selectedTextPromptHint: "",
            analyzePromptHint: "",
            explainPromptHint: "",
            debatePromptHint: "",
            studyPromptHint: "",
            outlinePromptHint: "",
            timelinePromptHint: "",
            conceptsPromptHint: ""
        });
        // Use webpage as a neutral carrier so the mode contract is visible in full.
        return SummarizerPromptBuilders.buildSummaryPrompt(getSampleContext("webpage"), settings);
    }

    const sourceHintFields = {
        youtube: () => fields.youtubePromptHint,
        webpage: () => fields.webpagePromptHint,
        course: () => fields.coursePromptHint,
        selectedText: () => fields.selectedTextPromptHint
    };

    const modeHintFields = {
        analyze: () => fields.analyzePromptHint,
        explain: () => fields.explainPromptHint,
        debate: () => fields.debatePromptHint,
        study: () => fields.studyPromptHint,
        outline: () => fields.outlinePromptHint,
        timeline: () => fields.timelinePromptHint,
        concepts: () => fields.conceptsPromptHint
    };

    // Track seeded baselines so Save can store "" when user keeps the default text.
    const seededBaselineByFieldId = new Map();

    function seedEditableBuiltInPrompts(force) {
        Object.keys(sourceHintFields).forEach((sourceType) => {
            const field = sourceHintFields[sourceType]();
            if (!field) return;
            let baseline = "";
            try {
                baseline = buildSourceBaselinePrompt(sourceType) || "";
            } catch (error) {
                baseline = `Unable to build built-in prompt: ${error.message || error}`;
            }
            seededBaselineByFieldId.set(field.id, baseline);
            if (force || !field.value.trim()) {
                field.value = baseline;
            }
        });

        Object.keys(modeHintFields).forEach((mode) => {
            const field = modeHintFields[mode]();
            if (!field) return;
            let baseline = "";
            try {
                baseline = buildModeBaselinePrompt(mode) || "";
            } catch (error) {
                baseline = `Unable to build built-in prompt: ${error.message || error}`;
            }
            seededBaselineByFieldId.set(field.id, baseline);
            if (force || !field.value.trim()) {
                field.value = baseline;
            }
        });
    }

    function normalizeHintValue(field) {
        if (!field) return "";
        const value = field.value.trim();
        const baseline = (seededBaselineByFieldId.get(field.id) || "").trim();
        if (!value || (baseline && value === baseline)) {
            return "";
        }
        return value;
    }

    function refreshBaselinePrompts() {
        // Keep seeded baselines in sync when global settings change, without wiping user edits.
        Object.keys(sourceHintFields).forEach((sourceType) => {
            const field = sourceHintFields[sourceType]();
            if (!field) return;
            const previousBaseline = (seededBaselineByFieldId.get(field.id) || "").trim();
            let baseline = "";
            try {
                baseline = buildSourceBaselinePrompt(sourceType) || "";
            } catch (error) {
                baseline = `Unable to build built-in prompt: ${error.message || error}`;
            }
            const current = field.value;
            const wasShowingBaseline = !current.trim() || current.trim() === previousBaseline;
            seededBaselineByFieldId.set(field.id, baseline);
            if (wasShowingBaseline) {
                field.value = baseline;
            }
        });

        Object.keys(modeHintFields).forEach((mode) => {
            const field = modeHintFields[mode]();
            if (!field) return;
            const previousBaseline = (seededBaselineByFieldId.get(field.id) || "").trim();
            let baseline = "";
            try {
                baseline = buildModeBaselinePrompt(mode) || "";
            } catch (error) {
                baseline = `Unable to build built-in prompt: ${error.message || error}`;
            }
            const current = field.value;
            const wasShowingBaseline = !current.trim() || current.trim() === previousBaseline;
            seededBaselineByFieldId.set(field.id, baseline);
            if (wasShowingBaseline) {
                field.value = baseline;
            }
        });
    }


    function updatePromptMeta(settings, sourceType, promptText) {
        if (!fields.promptMeta) {
            return;
        }
        const chars = promptText ? promptText.length : 0;
        const chips = [
            `Source: ${sourceType}`,
            `Mode: ${settings.promptMode || "summarize"}`,
            `Tone: ${settings.summaryTone || "Simple"}`,
            `Size: ${settings.summarySize || "Medium"}`,
            `Length: ${settings.summaryLength || "Medium"}`,
            `Language: ${settings.summaryLanguage || "English"}`,
            `${chars.toLocaleString()} chars`
        ];
        fields.promptMeta.innerHTML = chips
            .map((chip) => `<span class="prompt-meta-chip">${chip}</span>`)
            .join("");
    }

    function updateCurrentPromptPreview() {
        const previews = document.querySelectorAll("[data-prompt-preview]");
        if (!previews.length) {
            return;
        }

        if (!globalThis.SummarizerPromptBuilders || typeof SummarizerPromptBuilders.buildSummaryPrompt !== "function") {
            previews.forEach((node) => {
                node.textContent = "Prompt builder is unavailable in this page.";
            });
            return;
        }

        try {
            const sourceType = getPromptSourceType();
            syncPromptSourceSelectors(sourceType);
            const settings = collectFormSettings();
            const prompt = SummarizerPromptBuilders.buildSummaryPrompt(
                getSampleContext(sourceType),
                settings
            );
            const text = prompt || "Unable to build full system prompt.";
            previews.forEach((node) => {
                node.textContent = text;
            });
            updatePromptMeta(settings, sourceType, text);
            refreshBaselinePrompts();
        } catch (error) {
            const message = `Unable to build full system prompt: ${error.message || error}`;
            previews.forEach((node) => {
                node.textContent = message;
            });
            if (fields.promptMeta) {
                fields.promptMeta.innerHTML = "";
            }
        }
    }

    async function copyPromptText(text) {
        if (!text) {
            return;
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            return;
        }
        const helper = document.createElement("textarea");
        helper.value = text;
        helper.setAttribute("readonly", "");
        helper.style.position = "absolute";
        helper.style.left = "-9999px";
        document.body.appendChild(helper);
        helper.select();
        document.execCommand("copy");
        helper.remove();
    }

    function setupPromptReference() {
        const previews = document.querySelectorAll("[data-prompt-preview]");
        if (!previews.length) {
            return;
        }

        const watchedFields = [
            fields.promptMode,
            fields.summarySize,
            fields.summaryLanguage,
            fields.summaryTone,
            fields.customPromptInstructions,
            fields.customSystemInstructions,
            fields.youtubePromptHint,
            fields.webpagePromptHint,
            fields.coursePromptHint,
            fields.selectedTextPromptHint,
            fields.analyzePromptHint,
            fields.explainPromptHint,
            fields.debatePromptHint,
            fields.studyPromptHint,
            fields.outlinePromptHint,
            fields.timelinePromptHint,
            fields.promptReferenceSource,
            fields.promptReferenceSourcePrompts
        ].filter(Boolean);

        watchedFields.forEach((field) => {
            field.addEventListener("input", updateCurrentPromptPreview);
            field.addEventListener("change", () => {
                if (field === fields.promptReferenceSource || field === fields.promptReferenceSourcePrompts) {
                    syncPromptSourceSelectors(field.value);
                }
                updateCurrentPromptPreview();
            });
        });

        document.querySelectorAll(".copy-current-prompt").forEach((button) => {
            button.addEventListener("click", async () => {
                const text = (previews[0] && previews[0].textContent) || "";
                try {
                    await copyPromptText(text);
                    showToast("Full system prompt copied", "success");
                } catch (_) {
                    showToast("Could not copy prompt", "error");
                }
            });
        });

        updateCurrentPromptPreview();
    }

    // Toast notification manager
    function showToast(message, type = "success") {
        const container = document.getElementById("toast-container");
        if (!container) return;

        const toast = document.createElement("div");
        toast.className = `toast ${type}`;
        toast.setAttribute("role", "alert");

        const icon = document.createElement("div");
        icon.className = "toast-icon";
        icon.textContent = type === "success" ? "✓" : "✕";

        const label = document.createElement("span");
        label.className = "toast-copy";
        label.textContent = message;

        toast.appendChild(icon);
        toast.appendChild(label);
        container.appendChild(toast);

        // Animate out and remove
        setTimeout(() => {
            toast.classList.add("leaving");
            toast.addEventListener("animationend", () => {
                toast.remove();
            });
        }, 3200);
    }

    function renderPromptPresets() {
        if (!fields.presetsList) return;
        fields.presetsList.innerHTML = "";
        if (!customPromptPresets.length) {
            const empty = document.createElement("p");
            empty.className = "preset-empty-state";
            empty.textContent = "No custom presets yet. Add one to reuse a focused instruction set.";
            fields.presetsList.appendChild(empty);
            return;
        }
        customPromptPresets.forEach((preset, index) => {
            const row = document.createElement("div"); row.className = "preset-row";
            const label = document.createElement("span"); label.textContent = preset.name;
            const remove = document.createElement("button"); remove.type = "button"; remove.className = "btn-ghost btn-sm"; remove.textContent = "Delete";
            remove.setAttribute("aria-label", `Delete preset ${preset.name}`);
            remove.addEventListener("click", () => { customPromptPresets.splice(index, 1); renderPromptPresets(); });
            row.append(label, remove); fields.presetsList.appendChild(row);
        });
    }

    function addPromptPreset() {
        const name = (fields.presetName && fields.presetName.value || "").trim();
        const systemPrompt = (fields.presetSystem && fields.presetSystem.value || "").trim();
        const userPrompt = (fields.presetUser && fields.presetUser.value || "").trim();
        if (!name || (!systemPrompt && !userPrompt)) return;
        customPromptPresets.push({ id: "preset-" + Date.now().toString(36), name, systemPrompt, userPrompt, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        fields.presetName.value = ""; fields.presetSystem.value = ""; fields.presetUser.value = ""; renderPromptPresets();
    }

    async function loadSettings() {
        const settings = await SummarizerStorage.getSettings();
        customPromptPresets = Array.isArray(settings.customPromptPresets) ? settings.customPromptPresets.slice() : [];
        renderPromptPresets();
        SummarizerTheme.applyThemeToDocument(settings.theme || "system");
        SummarizerTheme.applyDensityToDocument(settings.density || "comfortable");
        SummarizerTheme.applyFontScaleToDocument(settings.fontScale || "md");

        function updateLanguageDropdown() {
            if (!fields.summaryLanguage) return;
            const customVal = fields.customLanguages ? fields.customLanguages.value : "";
            const customList = String(customVal || "").split(",").map((l) => String(l || "").trim()).filter(Boolean);
            const langs = Array.from(new Set(["English", "Vietnamese", ...customList]));
            const currVal = fields.summaryLanguage.value || "English";
            fields.summaryLanguage.innerHTML = "";
            langs.forEach((lang) => {
                const opt = document.createElement("option");
                opt.value = lang;
                opt.textContent = lang;
                fields.summaryLanguage.appendChild(opt);
            });
            fields.summaryLanguage.value = langs.includes(currVal) ? currVal : "English";
        }

        if (fields.customLanguages) {
            fields.customLanguages.addEventListener("input", updateLanguageDropdown);
        }

        fields.provider.value = settings.provider || "gemini";
        fields.promptMode.value = settings.promptMode || "summarize";
        fields.summarySize.value = settings.summarySize || "Medium";
        if (fields.customLanguages) fields.customLanguages.value = settings.customLanguages || "";
        updateLanguageDropdown();
        fields.summaryLanguage.value = settings.summaryLanguage || "English";
        fields.summaryTone.value = settings.summaryTone || "Simple";
        fields.customPromptInstructions.value = settings.customPromptInstructions || "";
        fields.customSystemInstructions.value = settings.customSystemInstructions || "";
        fields.youtubePromptHint.value = settings.youtubePromptHint || "";
        fields.webpagePromptHint.value = settings.webpagePromptHint || "";
        fields.coursePromptHint.value = settings.coursePromptHint || "";
        fields.selectedTextPromptHint.value = settings.selectedTextPromptHint || "";
        fields.analyzePromptHint.value = settings.analyzePromptHint || "";
        fields.explainPromptHint.value = settings.explainPromptHint || "";
        fields.debatePromptHint.value = settings.debatePromptHint || "";
        fields.studyPromptHint.value = settings.studyPromptHint || "";
        fields.outlinePromptHint.value = settings.outlinePromptHint || "";
        fields.timelinePromptHint.value = settings.timelinePromptHint || "";
        fields.conceptsPromptHint.value = settings.conceptsPromptHint || "";

        fields.summaryLength.value = settings.summaryLength || "Medium";
        fields.geminiUseDirectVideo.checked = !!(settings.gemini && settings.gemini.useGeminiDirectVideo);

        const advancedMode = settings.promptAdvancedMode || {};
        fields.advancedModeYoutube.checked = !!advancedMode.youtube;
        fields.advancedModeWebpage.checked = !!advancedMode.webpage;
        fields.advancedModeCourse.checked = !!advancedMode.course;
        fields.advancedModeSelectedText.checked = !!advancedMode.selectedText;

        const customSys = settings.customSystemPrompt || {};
        fields.customSystemPromptYoutube.value = customSys.youtube || "";
        fields.customSystemPromptWebpage.value = customSys.webpage || "";
        fields.customSystemPromptCourse.value = customSys.course || "";
        fields.customSystemPromptSelectedText.value = customSys.selectedText || "";

        const customUser = settings.customUserPrompt || {};
        fields.customUserPromptYoutube.value = customUser.youtube || "";
        fields.customUserPromptWebpage.value = customUser.webpage || "";
        fields.customUserPromptCourse.value = customUser.course || "";
        fields.customUserPromptSelectedText.value = customUser.selectedText || "";

        // Trigger advanced field visibility & wire toggle listeners
        ["youtube", "webpage", "course", "selectedText"].forEach(src => {
            const toggle = fields[`advancedMode${src.charAt(0).toUpperCase() + src.slice(1)}`];
            const div = document.querySelector(`[data-advanced-fields="${src}"]`);
            if (div) div.hidden = !toggle.checked;
            if (toggle) {
                toggle.addEventListener("change", () => {
                    if (div) div.hidden = !toggle.checked;
                });
            }
        });
        seedEditableBuiltInPrompts(false);
        fields.showFloatingUi.checked = settings.showFloatingUi !== false;
        fields.theme.value = settings.theme || "system";
        fields.density.value = settings.density || "comfortable";
        fields.fontScale.value = settings.fontScale || "md";
        fields.generateFollowUpQuestions.checked = settings.generateFollowUpQuestions !== false;

        fields.geminiApiKey.value = settings.gemini.apiKey || "";
        fields.geminiModel.value = settings.gemini.model || "";

        fields.openaiApiKey.value = settings.openai.apiKey || "";
        fields.openaiBaseUrl.value = settings.openai.baseUrl || "";
        fields.openaiModel.value = settings.openai.model || "";

        fields.localBaseUrl.value = settings.local.baseUrl || "";
        fields.localModel.value = settings.local.model || "";
        const rawLocalEndpoint = String(settings.local?.endpointType || "ollama").toLowerCase();
        fields.localEndpointType.value = rawLocalEndpoint === "openai" || rawLocalEndpoint === "lmstudio" || rawLocalEndpoint === "custom"
            ? "openai"
            : "ollama";

        // Force provider selection cards/forms to match
        const select = fields.provider;
        const cards = document.querySelectorAll(".provider-card");
        const forms = document.querySelectorAll(".provider-form");
        cards.forEach(c => c.classList.toggle("active", c.getAttribute("data-provider") === select.value));
        forms.forEach(f => f.classList.toggle("active", f.getAttribute("data-provider") === select.value));

        // Update preview state
        if (previewContent) {
            previewContent.setAttribute("data-density", fields.density.value);
            previewContent.setAttribute("data-font-scale", fields.fontScale.value);
        }
        updateCurrentPromptPreview();
    }

    async function saveSettings() {
        if (fields.theme && fields.theme.value) {
            SummarizerTheme.applyThemeToDocument(fields.theme.value);
        }
        fields.saveBtn.disabled = true;
        fields.saveStatus.textContent = "Saving...";
        fields.saveStatus.removeAttribute("data-state");

        try {
            const nextSettings = {
                provider: fields.provider.value,
                promptMode: fields.promptMode.value || "summarize",
                summarySize: fields.summarySize.value || "Medium",
            summaryLanguage: fields.summaryLanguage.value || "English",
            customLanguages: fields.customLanguages ? (fields.customLanguages.value || "").trim() : "",
                summaryTone: fields.summaryTone.value.trim() || "Simple",
                customPromptInstructions: fields.customPromptInstructions.value.trim(),
                customPromptPresets,
                customSystemInstructions: fields.customSystemInstructions.value.trim(),
                youtubePromptHint: normalizeHintValue(fields.youtubePromptHint),
                webpagePromptHint: normalizeHintValue(fields.webpagePromptHint),
                coursePromptHint: normalizeHintValue(fields.coursePromptHint),
                selectedTextPromptHint: normalizeHintValue(fields.selectedTextPromptHint),
                analyzePromptHint: normalizeHintValue(fields.analyzePromptHint),
                explainPromptHint: normalizeHintValue(fields.explainPromptHint),
                debatePromptHint: normalizeHintValue(fields.debatePromptHint),
                studyPromptHint: normalizeHintValue(fields.studyPromptHint),
                outlinePromptHint: normalizeHintValue(fields.outlinePromptHint),
                timelinePromptHint: normalizeHintValue(fields.timelinePromptHint),
                conceptsPromptHint: normalizeHintValue(fields.conceptsPromptHint),
                showFloatingUi: fields.showFloatingUi.checked,
                theme: fields.theme.value,
                density: fields.density.value,
                fontScale: fields.fontScale.value,
                generateFollowUpQuestions: fields.generateFollowUpQuestions.checked,
                summaryLength: fields.summaryLength.value || "Medium",
                promptAdvancedMode: {
                    youtube: fields.advancedModeYoutube.checked,
                    webpage: fields.advancedModeWebpage.checked,
                    course: fields.advancedModeCourse.checked,
                    selectedText: fields.advancedModeSelectedText.checked
                },
                customSystemPrompt: {
                    youtube: fields.customSystemPromptYoutube.value.trim(),
                    webpage: fields.customSystemPromptWebpage.value.trim(),
                    course: fields.customSystemPromptCourse.value.trim(),
                    selectedText: fields.customSystemPromptSelectedText.value.trim()
                },
                customUserPrompt: {
                    youtube: fields.customUserPromptYoutube.value.trim(),
                    webpage: fields.customUserPromptWebpage.value.trim(),
                    course: fields.customUserPromptCourse.value.trim(),
                    selectedText: fields.customUserPromptSelectedText.value.trim()
                },
                gemini: {
                    apiKey: fields.geminiApiKey.value.trim(),
                    model: fields.geminiModel.value.trim() || "gemini-3.5-flash-lite",
                    useGeminiDirectVideo: fields.geminiUseDirectVideo.checked
                },
                openai: {
                    apiKey: fields.openaiApiKey.value.trim(),
                    baseUrl: fields.openaiBaseUrl.value.trim() || "https://api.openai.com/v1",
                    model: fields.openaiModel.value.trim() || "gpt-4o-mini"
                },
                local: {
                    baseUrl: fields.localBaseUrl.value.trim() || "http://127.0.0.1:11434",
                    model: fields.localModel.value.trim() || "llama3.1",
                    endpointType: fields.localEndpointType.value || "ollama"
                }
            };

            const savedSettings = await SummarizerStorage.saveSettings(nextSettings);
            try {
                await chrome.runtime.sendMessage({
                    type: MSG.SETTINGS_UPDATED,
                    settings: savedSettings
                });
            } catch (_) {
                // Background runtime settings notified
            }

            fields.saveStatus.textContent = "✓ Saved";
            fields.saveStatus.setAttribute("data-state", "success");
            showToast("Settings saved successfully!", "success");
        } catch (error) {
            const msg = error.message || "Failed to save settings.";
            fields.saveStatus.textContent = "✕ Error";
            fields.saveStatus.setAttribute("data-state", "error");
            showToast(msg, "error");
        } finally {
            fields.saveBtn.disabled = false;
        }

        setTimeout(() => {
            fields.saveStatus.textContent = "";
            fields.saveStatus.removeAttribute("data-state");
        }, 3000);
    }

    // Event hooks
    // Export Settings
    if (fields.exportSettingsBtn) {
        fields.exportSettingsBtn.addEventListener("click", async () => {
            try {
                const settings = await SummarizerStorage.getSettings();
                const exportSettings = JSON.parse(JSON.stringify(settings));
                // Exclude API keys for security
                if (exportSettings.gemini) exportSettings.gemini.apiKey = "";
                if (exportSettings.openai) exportSettings.openai.apiKey = "";

                const blob = new Blob([JSON.stringify(exportSettings, null, 4)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "summarizer-settings.json";
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                showToast("Settings exported successfully!", "success");
            } catch (error) {
                showToast("Failed to export settings: " + error.message, "error");
            }
        });
    }

    // Import Settings
    if (fields.importSettingsBtn && fields.importSettingsFile) {
        fields.importSettingsBtn.addEventListener("click", () => {
            fields.importSettingsFile.click();
        });

        fields.importSettingsFile.addEventListener("change", async (event) => {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const parsed = JSON.parse(e.target.result);
                    if (typeof parsed !== "object" || parsed === null) {
                        throw new Error("Invalid settings file format.");
                    }
                    // Basic validation: check for at least some known keys
                    const knownKeys = ["provider", "promptMode", "summaryLength", "summaryTone", "summaryLanguage"];
                    const hasSomeKeys = knownKeys.some(key => key in parsed);
                    if (!hasSomeKeys) {
                        throw new Error("JSON file does not appear to contain valid settings.");
                    }

                    // Preserve existing API keys if not present in import
                    const current = await SummarizerStorage.getSettings();
                    if (parsed.gemini && !parsed.gemini.apiKey && current.gemini) {
                        parsed.gemini.apiKey = current.gemini.apiKey || "";
                    }
                    if (parsed.openai && !parsed.openai.apiKey && current.openai) {
                        parsed.openai.apiKey = current.openai.apiKey || "";
                    }

                    await SummarizerStorage.saveSettings(parsed);
                    showToast("Settings imported successfully! Reloading...", "success");
                    setTimeout(() => { window.location.reload(); }, 1000);
                } catch (error) {
                    showToast("Failed to import settings: " + error.message, "error");
                }
            };
            reader.readAsText(file);
            // reset file input so same file can be re-imported
            fields.importSettingsFile.value = "";
        });
    }

    // Enhance Prompt handlers (one per advanced user prompt textarea)
    async function enhancePrompt(targetTextareaId) {
        const target = document.getElementById(targetTextareaId);
        if (!target) return;
        const currentPrompt = target.value.trim();
        if (!currentPrompt) {
            showToast("Nothing to enhance — enter a prompt first.", "warning");
            return;
        }

        // Determine active provider from form
        const provider = fields.provider.value;
        let apiKey = "", model = "", baseUrl = "", endpointType = "";
        if (provider === "gemini") {
            apiKey = fields.geminiApiKey.value.trim();
            model = fields.geminiModel.value.trim() || "gemini-3.5-flash-lite";
        } else if (provider === "openai") {
            apiKey = fields.openaiApiKey.value.trim();
            model = fields.openaiModel.value.trim() || "gpt-4o-mini";
            baseUrl = fields.openaiBaseUrl.value.trim() || "https://api.openai.com/v1";
        } else if (provider === "local") {
            baseUrl = fields.localBaseUrl.value.trim() || "http://127.0.0.1:11434";
            model = fields.localModel.value.trim() || "llama3.1";
            endpointType = fields.localEndpointType.value || "ollama";
        }

        if (provider !== "local" && !apiKey) {
            showToast("API key required for " + provider + " to enhance prompt.", "error");
            return;
        }

        // Show loading state
        const btn = document.querySelector(`[data-enhance-target="${targetTextareaId}"]`);
        const originalBtnText = btn ? btn.textContent : "";
        if (btn) {
            btn.disabled = true;
            btn.textContent = "Enhancing...";
        }

        try {
            // Build enhance prompt using template
            const lang = fields.summaryLanguage.value || "English";
            const template = SummarizerPromptEnhanceTemplate.buildEnhancePrompt(currentPrompt, lang);

            // Call provider directly from options page
            let enhancedPrompt = "";
            if (provider === "gemini") {
                const url = "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(apiKey);
                const res = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ role: "user", parts: [{ text: template.userPrompt }] }],
                        systemInstruction: { parts: [{ text: template.systemInstruction }] },
                        generationConfig: { temperature: 0.2, maxOutputTokens: 4096 }
                    })
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error?.message || "Gemini request failed");
                enhancedPrompt = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
            } else if (provider === "openai") {
                const res = await fetch(baseUrl + "/chat/completions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey },
                    body: JSON.stringify({
                        model: model,
                        messages: [
                            { role: "system", content: template.systemInstruction },
                            { role: "user", content: template.userPrompt }
                        ],
                        temperature: 0.2,
                        max_tokens: 4096
                    })
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error?.message || "OpenAI request failed");
                enhancedPrompt = data.choices?.[0]?.message?.content || "";
            } else if (provider === "local") {
                const res = await fetch(baseUrl + "/api/chat", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        model: model,
                        messages: [
                            { role: "system", content: template.systemInstruction },
                            { role: "user", content: template.userPrompt }
                        ],
                        options: { temperature: 0.2, num_predict: 4096 }
                    })
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || "Local LLM request failed");
                enhancedPrompt = data.message?.content || data.response || "";
            }

            if (!enhancedPrompt) {
                throw new Error("Provider returned empty response.");
            }

            // Preserve placeholders if provider stripped them
            const placeholders = ["__CONTENT__", "__LANG__", "__TITLE__", "__URL__"];
            placeholders.forEach(p => {
                if (!enhancedPrompt.includes(p) && currentPrompt.includes(p)) {
                    // Try to re-insert at a reasonable spot if missing
                    const idx = currentPrompt.indexOf(p);
                    if (idx >= 0) {
                        enhancedPrompt = enhancedPrompt.slice(0, idx) + p + enhancedPrompt.slice(idx);
                    }
                }
            });

            target.value = enhancedPrompt.trim();
            showToast("Prompt enhanced successfully!", "success");
            // Refresh live preview
            updateCurrentPromptPreview();
        } catch (error) {
            console.error("Enhance prompt failed:", error);
            showToast("Enhance failed: " + error.message, "error");
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = originalBtnText || "Enhance Prompt";
            }
        }
    }

    // Attach enhance handlers to all [data-enhance-target] buttons
    document.querySelectorAll("[data-enhance-target]").forEach(button => {
        button.addEventListener("click", () => {
            const target = button.getAttribute("data-enhance-target");
            if (target) enhancePrompt(target);
        });
    });

    fields.saveBtn.addEventListener("click", saveSettings);
    fields.theme.addEventListener("change", () => {
        SummarizerTheme.applyThemeToDocument(fields.theme.value);
    });
    fields.density.addEventListener("change", () => {
        SummarizerTheme.applyDensityToDocument(fields.density.value);
    });
    fields.fontScale.addEventListener("change", () => {
        SummarizerTheme.applyFontScaleToDocument(fields.fontScale.value);
    });
    document.addEventListener("keydown", (event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
            event.preventDefault();
            saveSettings();
        }
    });

    SummarizerTheme.watchSystemTheme(() => {
        if (fields.theme.value === "system") {
            SummarizerTheme.applyThemeToDocument("system");
        }
    });

    setupTabs();
    setupPasswordToggles();
    setupProviderSync();
    setupLivePreview();
    setupPromptReference();

    if (fields.presetAdd) fields.presetAdd.addEventListener("click", addPromptPreset);

    loadSettings().catch(() => {
        fields.saveStatus.textContent = "Failed to load settings.";
        fields.saveStatus.setAttribute("data-state", "error");
    });
})();
