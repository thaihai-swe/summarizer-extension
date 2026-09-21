(function () {
    const inFlightSummaries = new Map();
    const activeControllers = new Map();

    function createCancelledError() {
        const error = new Error("Summary cancelled.");
        error.code = "CANCELLED";
        return error;
    }

    function throwIfCancelled(signal) {
        if (signal && signal.aborted) throw createCancelledError();
    }

    function cancelSummaryForTab(tabId) {
        const controller = activeControllers.get(tabId);
        if (controller) controller.abort();
    }

    function ensureTabIsOpen(tabId) {
        return new Promise((resolve, reject) => {
            chrome.tabs.get(tabId, (tab) => {
                if (chrome.runtime.lastError || !tab || !tab.id) {
                    reject(new Error("Tab was closed before summarization completed."));
                    return;
                }
                resolve(tab);
            });
        });
    }

    async function evaluateAndRepair(parsed, extracted, settings, providerId, signal) {
        if (!globalThis.SummarizerQuality) return { parsed, quality: null };
        const qualityContext = {
            sourceType: extracted.sourceType,
            promptMode: settings.promptMode,
            summarySize: settings.summarySize,
            summaryLength: settings.summaryLength,
            generateFollowUpQuestions: settings.generateFollowUpQuestions,
            sourceLength: (extracted.contentRaw || extracted.content || "").length,
            sourceContentRaw: extracted.contentRaw,
            sourceContentForPrompt: extracted.contentForPrompt
        };
        let quality = SummarizerQuality.evaluateSummary(parsed, qualityContext);
        if (!SummarizerQuality.shouldRepair(quality, qualityContext)) return { parsed, quality };

        try {
            const prompt = SummarizerQuality.buildRepairPrompt(qualityContext, parsed, quality, settings);
            const raw = await SummarizerGenerationService.generateTextWithRetry(
                providerId,
                prompt,
                settings,
                undefined,
                { signal }
            );
            const repaired = SummarizerCleaners.parseStructuredSummary(raw);
            const merged = SummarizerQuality.mergeRepairedSections(parsed, repaired, quality);
            const repairedQuality = SummarizerQuality.evaluateSummary(merged, qualityContext);
            return {
                parsed: merged,
                quality: Object.assign({}, repairedQuality, { repaired: true, initialScore: quality.score })
            };
        } catch (error) {
            throwIfCancelled(signal);
            quality = Object.assign({}, quality, { repaired: false, repairError: error.message });
            return { parsed, quality };
        }
    }

    async function runSummary(tabId, controller) {
        const signal = controller.signal;
        const settings = await SummarizerStorage.getSettings();
        throwIfCancelled(signal);
        const extracted = await SummarizerTabManager.requestExtraction(tabId);
        throwIfCancelled(signal);
        const providerId = settings.provider;
        const execution = await SummarizerGenerationService.generateSummary(
            extracted,
            settings,
            providerId,
            { tabId, signal }
        );
        throwIfCancelled(signal);
        const parsed = SummarizerCleaners.parseStructuredSummary(execution.text);
        const evaluated = await evaluateAndRepair(parsed, extracted, settings, providerId, signal);
        throwIfCancelled(signal);
        const result = SummarizerResultBuilder.buildFullResult(
            evaluated.parsed,
            extracted,
            settings,
            providerId,
            tabId,
            Object.assign({}, execution, { quality: evaluated.quality })
        );
        await ensureTabIsOpen(tabId);
        throwIfCancelled(signal);
        SummarizerUiNotifier.notifyUi(result, tabId);
        return result;
    }

    async function summarizeForTab(tabId) {
        if (inFlightSummaries.has(tabId)) return inFlightSummaries.get(tabId);
        const controller = new AbortController();
        activeControllers.set(tabId, controller);
        const job = runSummary(tabId, controller);
        inFlightSummaries.set(tabId, job);
        try {
            return await job;
        } finally {
            if (inFlightSummaries.get(tabId) === job) inFlightSummaries.delete(tabId);
            if (activeControllers.get(tabId) === controller) activeControllers.delete(tabId);
        }
    }

    async function answerFollowUp(tabId, question, options) {
        const settings = await SummarizerStorage.getSettings();
        const result = options && options.result;
        const grounding = options && options.grounding === "open" ? "open" : "source";
        if (grounding === "source" && !result) {
            throw new Error("Summarize this tab before asking a follow-up question.");
        }
        const history = Array.isArray(options && options.conversationHistory)
            ? options.conversationHistory.slice(-6)
            : [];
        const prompt = grounding === "open"
            ? SummarizerPrompts.buildOpenFollowUpPrompt(question, settings, history)
            : SummarizerPrompts.buildDeepDivePrompt(
                Object.assign({}, result, { conversationHistory: history }),
                question,
                settings
            );
        const answer = await SummarizerGenerationService.generateTextWithRetry(
            settings.provider,
            prompt,
            settings
        );
        return {
            question,
            answer: SummarizerCleaners.cleanText(answer),
            type: "user-question",
            grounding
        };
    }

    globalThis.SummarizerSummaryService = {
        summarizeForTab,
        cancelSummaryForTab,
        releaseTab: cancelSummaryForTab,
        answerFollowUp
    };
})();
