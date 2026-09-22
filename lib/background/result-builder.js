(function () {
    function buildExecution(details) {
        const value = details || {};
        const usage = value.usage || {};
        return {
            durationMs: value.durationMs || 0,
            inputTokens: usage.inputTokens || 0,
            outputTokens: usage.outputTokens || 0,
            totalTokens: usage.totalTokens || 0,
            tokenUsageAvailable: Boolean(usage.available),
            requestCount: value.requestCount || 1,
            chunkCount: value.chunkCount || 0,
            strategy: value.strategy || "single"
        };
    }

    function buildParsedFields(parsed) {
        const value = parsed || {};
        // Canonical content already has typed fields below. Retain only unknown
        // requested sections here so stream and full results do not duplicate
        // the largest model-generated strings in memory and messages.
        const sections = Array.isArray(value.sections)
            ? value.sections.filter((section) => section && !section.canonicalKey).map((section, index) => {
                const item = section || {};
                const heading = String(item.heading || "").replace(/[\r\n]+/g, " ").trim();
                const content = String(item.content || "").trim();
                if (!heading || !content) return null;
                const output = {
                    id: String(item.id || `result-section-${index + 1}`).replace(/[^a-zA-Z0-9_-]/g, "-") || `result-section-${index + 1}`,
                    heading,
                    content
                };
                return output;
            }).filter(Boolean)
            : [];
        return {
            summary: value.summary || "",
            keyTakeaways: value.keyTakeaways || [],
            detailsOfVideo: value.detailsOfVideo || "",
            detailedBreakdown: value.detailedBreakdown || "",
            expertCommentary: value.expertCommentary || "",
            evidenceAndDetails: value.evidenceAndDetails || "",
            argumentAndInsight: value.argumentAndInsight || "",
            conceptMapAndPrerequisites: value.conceptMapAndPrerequisites || "",
            reviewKit: value.reviewKit || "",
            conceptMap: value.conceptMap || "",
            coreDefinitions: value.coreDefinitions || "",
            prerequisitesMisconceptions: value.prerequisitesMisconceptions || "",
            practicalSteps: value.practicalSteps || "",
            pitfallsWarnings: value.pitfallsWarnings || "",
            resourcesTools: value.resourcesTools || "",
            followUpQuestions: value.followUpQuestions || [],
            sections
        };
    }

    function buildBaseResult(parsed, extracted, settings, providerId, tabId, executionDetails) {
        const details = executionDetails || {};
        const provider = (SummarizerProviders.providers[providerId] || {}).label || providerId;
        const mode = String(settings.promptMode || "summarize").toLowerCase();
        const size = String(settings.summarySize || "Medium").toLowerCase();
        const length = String(settings.summaryLength || "Medium").toLowerCase();
        const isBrief = size === "brief" && length !== "long";
        const deepMode = new Set(["analyze", "explain", "study", "debate", "concepts"]).has(mode);
        return Object.assign({
            id: Date.now(),
            tabId,
            provider: providerId,
            providerLabel: provider,
            model: ((settings[providerId] || {}).model || "").trim(),
            title: extracted.title,
            url: extracted.url,
            sourceType: extracted.sourceType,
            promptMode: settings.promptMode,
            summarySize: settings.summarySize || "Medium",
            summaryLength: settings.summaryLength || "Medium",
            expansionMode: !isBrief && (size === "deep" || length === "long" || deepMode) ? "deep" : "standard",
            summaryStrategy: details.strategy || "single",
            requestCount: details.requestCount || 1,
            chunkCount: details.chunkCount || 0
        }, buildParsedFields(parsed));
    }

    function buildFullResult(parsed, extracted, settings, providerId, tabId, executionDetails) {
        const result = buildBaseResult(parsed, extracted, settings, providerId, tabId, executionDetails);
        const rawSource = extracted.contentRaw || extracted.content || "";
        const promptSource = extracted.contentForPrompt || rawSource;
        const hasTranscriptSegments = extracted.sourceType === "youtube"
            && Array.isArray(extracted.transcriptSegments)
            && extracted.transcriptSegments.length > 0;

        // YouTube transcript text can be reconstructed from segments. Keeping both
        // representations would double the largest value retained by the side panel.
        result.sourceContentRaw = hasTranscriptSegments ? "" : rawSource;
        result.sourceContentForPrompt = !hasTranscriptSegments && promptSource !== rawSource ? promptSource : "";
        result.transcriptSegments = hasTranscriptSegments ? extracted.transcriptSegments : [];
        result.videoDetails = extracted.videoDetails || null;
        result.quality = executionDetails && executionDetails.quality || null;
        result.generatedAt = new Date().toISOString();
        result.execution = buildExecution(executionDetails);
        return result;
    }

    function buildStreamResult(parsed, extracted, settings, providerId, tabId, executionDetails) {
        const result = buildBaseResult(parsed, extracted, settings, providerId, tabId, executionDetails);
        result.streaming = true;
        return result;
    }

    function buildFloatingResult(result) {
        if (!result) return null;
        return {
            tabId: result.tabId,
            title: result.title,
            sourceType: result.sourceType,
            promptMode: result.promptMode,
            summary: result.summary,
            keyTakeaways: result.keyTakeaways || []
        };
    }

    globalThis.SummarizerResultBuilder = {
        buildFullResult,
        buildStreamResult,
        buildFloatingResult
    };
})();
