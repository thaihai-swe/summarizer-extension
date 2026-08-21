(function () {
    const WEBPAGE_LONG_CONTENT_THRESHOLD = 60000;
    const COURSE_LONG_CONTENT_THRESHOLD = 50000;
    const YOUTUBE_LONG_CONTENT_THRESHOLD = 24000;
    const CHUNK_TARGET_LENGTH = 12000;
    const YOUTUBE_MAX_REQUESTS = 4;
    const YOUTUBE_MAX_CHUNKS = YOUTUBE_MAX_REQUESTS - 1;
    const WEBPAGE_MAX_REQUESTS = 4;
    const COURSE_MAX_REQUESTS = 4;
    const inFlightSummaries = new Map();
    const activeControllers = new Map();

    function cancelSummaryForTab(tabId) {
        const controller = activeControllers.get(tabId);
        if (controller) {
            controller.abort();
            activeControllers.delete(tabId);
        }
        inFlightSummaries.delete(tabId);
    }

    function buildResultFromExtraction(parsed, extracted, settings, providerId, tabId, executionDetails) {
        const providerLabel =
            (SummarizerProviders.providers[providerId] || {}).label || providerId;
        const details = executionDetails || {};
        const execMeta = {
            durationMs: details.durationMs || 0,
            inputTokens: details.usage && details.usage.inputTokens || 0,
            outputTokens: details.usage && details.usage.outputTokens || 0,
            totalTokens: details.usage && details.usage.totalTokens || 0,
            tokenUsageAvailable: !!(details.usage && details.usage.available),
            requestCount: details.requestCount || 1,
            chunkCount: details.chunkCount || 0,
            strategy: details.strategy || "single"
        };

        return {
            id: Date.now(),
            tabId,
            provider: providerId,
            providerLabel,
            model: ((settings[providerId] || {}).model || "").trim(),
            title: extracted.title,
            url: extracted.url,
            sourceType: extracted.sourceType,
            promptMode: settings.promptMode,
            summarySize: settings.summarySize || "Medium",
            summaryLength: settings.summaryLength || "Medium",
            expansionMode: settings.summarySize === "Deep" || settings.summaryLength === "Long" ? "deep" : "standard",
            sourceContent: extracted.content,
            sourceContentRaw: extracted.contentRaw || extracted.content || "",
            sourceContentForPrompt: extracted.contentForPrompt || extracted.content || "",
            transcriptSegments: extracted.transcriptSegments || [],
            videoDetails: extracted.videoDetails || null,
            summary: parsed.summary,
            keyTakeaways: parsed.keyTakeaways,
            mainPoints: parsed.mainPoints,
            detailsOfVideo: parsed.detailsOfVideo,
            detailedBreakdown: parsed.detailedBreakdown,
            expertCommentary: parsed.expertCommentary,
            evidenceAndDetails: parsed.evidenceAndDetails,
            argumentAndInsight: parsed.argumentAndInsight,
            conceptMapAndPrerequisites: parsed.conceptMapAndPrerequisites,
            causalAndKnowledgeFlow: parsed.causalAndKnowledgeFlow,
            perspectivesAndUncertainty: parsed.perspectivesAndUncertainty,
            reviewKit: parsed.reviewKit,
            // Course Concepts sections
            conceptMap: parsed.conceptMap,
            coreDefinitions: parsed.coreDefinitions,
            prerequisitesMisconceptions: parsed.prerequisitesMisconceptions,
            practicalSteps: parsed.practicalSteps,
            pitfallsWarnings: parsed.pitfallsWarnings,
            resourcesTools: parsed.resourcesTools,
            followUpQuestions: parsed.followUpQuestions || [],
            rawText: parsed.rawText,
            summaryStrategy: details.strategy || "single",
            requestCount: details.requestCount || 1,
            chunkCount: details.chunkCount || 0,
            quality: details.quality || null,
            generatedAt: new Date().toISOString(),
            execution: execMeta
        };
    }

    function splitIntoChunks(text, targetLength) {
        const source = SummarizerCleaners.cleanText(text);
        if (!source) {
            return [];
        }

        const chunks = [];
        const units = source.includes("\n") ? source.split(/\n+/) : source.split(/(?<=\.)\s+/);
        let current = "";

        units.forEach((unit) => {
            const part = SummarizerCleaners.cleanText(unit);
            if (!part) {
                return;
            }

            const candidate = current ? current + "\n" + part : part;
            if (candidate.length > targetLength && current) {
                chunks.push(current);
                current = part;
                return;
            }

            if (part.length > targetLength) {
                if (current) {
                    chunks.push(current);
                    current = "";
                }
                let remaining = part;
                while (remaining.length > targetLength) {
                    chunks.push(remaining.slice(0, targetLength));
                    remaining = remaining.slice(targetLength);
                }
                current = remaining;
                return;
            }

            current = candidate;
        });

        if (current) {
            chunks.push(current);
        }

        return chunks.filter(Boolean);
    }

    function splitIntoBalancedChunks(text, maxChunks) {
        const source = SummarizerCleaners.cleanText(text);
        const limit = Math.max(1, Number(maxChunks || 1));
        if (!source) {
            return [];
        }

        if (globalThis.SummarizerSemanticChunker) {
            const semanticChunks = SummarizerSemanticChunker.chunkContent(source, {
                targetLength: CHUNK_TARGET_LENGTH,
                maxLength: CHUNK_TARGET_LENGTH * 1.35,
                maxChunks: limit,
                sourceType: "webpage",
                preserveOverlap: true,
                overlapSentences: 1
            });
            if (semanticChunks.length > 0) {
                return semanticChunks.map((chunk) => chunk.text);
            }
        }

        const initialChunks = splitIntoChunks(source, Math.max(1, Math.ceil(source.length / limit)));
        if (initialChunks.length <= limit) {
            return initialChunks;
        }

        const mergedChunks = [];
        let startIndex = 0;
        for (let slot = 0; slot < limit; slot += 1) {
            const remainingChunks = initialChunks.length - startIndex;
            const remainingSlots = limit - slot;
            const takeCount = Math.ceil(remainingChunks / remainingSlots);
            mergedChunks.push(
                SummarizerCleaners.cleanText(
                    initialChunks.slice(startIndex, startIndex + takeCount).filter(Boolean).join("\n\n")
                )
            );
            startIndex += takeCount;
        }

        return mergedChunks.filter(Boolean);
    }

    function shouldUseProgressiveSummarization(extracted) {
        const sourceType = extracted.sourceType;
        const sourceText = extracted.contentRaw || extracted.contentForPrompt || extracted.content || "";
        if (!sourceText) {
            return false;
        }

        if (sourceType === "webpage") {
            return sourceText.length > WEBPAGE_LONG_CONTENT_THRESHOLD;
        }
        if (sourceType === "course") {
            return sourceText.length > COURSE_LONG_CONTENT_THRESHOLD;
        }

        return false;
    }

    function shouldUseYoutubeChunking(extracted) {
        if (!extracted || extracted.sourceType !== "youtube") {
            return false;
        }

        const sourceText = extracted.contentRaw || extracted.contentForPrompt || extracted.content || "";
        return sourceText.length > YOUTUBE_LONG_CONTENT_THRESHOLD;
    }

    function getSourceLabel(extracted) {
        if (!extracted) {
            return "content";
        }
        if (extracted.sourceType === "youtube") {
            return "YouTube transcript";
        }
        if (extracted.sourceType === "course") {
            return "course lesson";
        }
        if (extracted.sourceType === "selectedText") {
            return "selected text";
        }
        return "webpage content";
    }

    function getExtractionStatusLabel(tabUrl) {
        const url = String(tabUrl || "");
        if (/https?:\/\/(www\.)?youtube\.com\/(watch|live)/i.test(url)) {
            return "Fetching YouTube transcript...";
        }
        if (/coursera\.org\/learn\/.+\/(lecture|supplement)\//i.test(url)) {
            return "Reading Coursera lesson...";
        }
        if (/udemy\.com\/course\/.+\/learn\//i.test(url)) {
            return "Reading Udemy lesson...";
        }
        return "Extracting webpage content...";
    }

    
    function createStreamEmitter(context) {
        const ctx = context || {};
        let lastEmitAt = 0;
        const throttleMs = 50;

        function emit(text) {
            if (!ctx.tabId || typeof SummarizerUiNotifier.notifyChunk !== "function") {
                return;
            }
            const now = Date.now();
            if (now - lastEmitAt < throttleMs) return;
            lastEmitAt = now;

            try {
                const parsed = SummarizerCleaners.parseStructuredSummary(text || "");
                const result = buildResultFromExtraction(
                    parsed,
                    ctx.extracted,
                    ctx.settings,
                    ctx.providerId,
                    ctx.tabId,
                    Object.assign({}, ctx.executionDetails || {}, { streamed: true })
                );
                result.streaming = true;
                SummarizerUiNotifier.notifyChunk(result, ctx.tabId, text || "");
            } catch (error) {
                SummarizerDebug.logExtraction("Stream chunk render skipped", { error: error && error.message });
            }
        }

        return function onChunk(accumulatedText) {
            emit(accumulatedText);
        };
    }

    async function generateTextWithRetry(providerId, prompt, settings, onChunk, tabId, requestContext) {
        const controller = tabId ? activeControllers.get(tabId) : null;
        const signal = controller ? controller.signal : null;
        function checkCancelled() {
            if (signal && signal.aborted) {
                const err = new Error("Generation cancelled.");
                err.code = "CANCELLED";
                err.provider = providerId;
                throw err;
            }
        }
        try {
            checkCancelled();
            return await SummarizerProviders.generateText(providerId, prompt, settings, onChunk, Object.assign(requestContext || {}, { signal }));
        } catch (error) {
            if (error && error.code === "CANCELLED") throw error;
            if (signal && signal.aborted) {
                const err = new Error("Generation cancelled.");
                err.code = "CANCELLED";
                err.provider = providerId;
                throw err;
            }
            if (SummarizerProviders.isTransientProviderError && SummarizerProviders.isTransientProviderError(error)) {
                SummarizerDebug.logExtraction("Transient error, retrying once", { error });
                try {
                    await new Promise((resolve, reject) => {
                        const t = setTimeout(resolve, 2000);
                        if (signal) {
                            const handler = () => {
                                clearTimeout(t);
                                reject(new Error("Generation cancelled."));
                            };
                            signal.addEventListener("abort", handler, { once: true });
                        }
                    });
                } catch (_) {
                    const err = new Error("Generation cancelled.");
                    err.code = "CANCELLED";
                    err.provider = providerId;
                    throw err;
                }
                checkCancelled();
                return await SummarizerProviders.generateText(providerId, prompt, settings, undefined, Object.assign(requestContext || {}, { signal }));
            }
            throw error;
        }
    }

    async function summarizeWithBoundedChunking(extracted, settings, providerId, options) {
        const config = options || {};
        const sourceText = extracted.contentRaw || extracted.contentForPrompt || extracted.content || "";
        const maxRequests = Math.max(2, Number(config.maxRequests || 4));
        const maxChunks = Math.max(1, maxRequests - 1);
        const chunks = globalThis.SummarizerSemanticChunker
            ? SummarizerSemanticChunker.chunkContent(sourceText, {
                targetLength: CHUNK_TARGET_LENGTH,
                maxLength: CHUNK_TARGET_LENGTH * 1.35,
                maxChunks,
                sourceType: extracted.sourceType,
                transcriptSegments: extracted.transcriptSegments || null,
                preserveOverlap: true,
                overlapSentences: 1
            })
            : splitIntoBalancedChunks(sourceText, maxChunks).map((text, index) => ({ index, text }));

        if (chunks.length <= 1) {
            const prompt = SummarizerPrompts.buildSummaryPrompt(extracted, settings);
            await SummarizerWorkflowStore.markSummarizing(config.tabId, {
                stage: "preparing",
                statusMessage: `Preparing ${getSourceLabel(extracted)} summary...`,
                requestCount: 1,
                requestTotal: 1,
                chunkIndex: 0,
                chunkTotal: 0
            });
            const onChunk = createStreamEmitter({
                tabId: config.tabId,
                extracted,
                settings,
                providerId,
                executionDetails: { strategy: "single", requestCount: 1, chunkCount: 0 }
            });
            const reqCtx = { usage: {} };
            const startTime = Date.now();
            const text = await generateTextWithRetry(providerId, prompt, settings, onChunk, config.tabId, reqCtx);
            const durationMs = Date.now() - startTime;
            return {
                text,
                strategy: "single",
                requestCount: 1,
                chunkCount: 0,
                durationMs,
                usage: reqCtx.usage
            };
        }

        const chunkSummaries = [];
        let totalDuration = 0;
        const totalUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0, available: false };
        for (let index = 0; index < chunks.length; index += 1) {
            await SummarizerWorkflowStore.markSummarizing(config.tabId, {
                stage: "summarizing",
                statusMessage: `Summarizing chunk ${index + 1} of ${chunks.length}...`,
                requestCount: index + 1,
                requestTotal: chunks.length + 1,
                chunkIndex: index + 1,
                chunkTotal: chunks.length
            });
            const chunkPrompt = SummarizerPrompts.buildChunkSummaryPrompt(
                extracted,
                chunks[index].text,
                index,
                chunks.length,
                settings
            );
            const reqCtx = { usage: {} };
            const start = Date.now();
            const chunkSummary = await generateTextWithRetry(providerId, chunkPrompt, settings, undefined, config.tabId, reqCtx);
            totalDuration += (Date.now() - start);
            if (reqCtx.usage && reqCtx.usage.available) {
                totalUsage.available = true;
                totalUsage.inputTokens += reqCtx.usage.inputTokens;
                totalUsage.outputTokens += reqCtx.usage.outputTokens;
                totalUsage.totalTokens += reqCtx.usage.totalTokens;
            }
            chunkSummaries.push(SummarizerCleaners.cleanText(chunkSummary));
        }

        await SummarizerWorkflowStore.markSummarizing(config.tabId, {
            stage: "summarizing",
            statusMessage: `Combining ${chunks.length} chunk summaries...`,
            requestCount: chunks.length + 1,
            requestTotal: chunks.length + 1,
            chunkIndex: chunks.length,
            chunkTotal: chunks.length
        });
        const finalPrompt = SummarizerPrompts.buildSynthesisPrompt(extracted, chunkSummaries, settings);
        const onChunk = createStreamEmitter({
            tabId: config.tabId,
            extracted,
            settings,
            providerId,
            executionDetails: {
                strategy: "bounded-chunking",
                requestCount: chunks.length + 1,
                chunkCount: chunks.length
            }
        });
        const finalContext = { usage: {} };
        const finalStart = Date.now();
        const text = await generateTextWithRetry(providerId, finalPrompt, settings, onChunk, config.tabId, finalContext);
        totalDuration += Date.now() - finalStart;
        if (finalContext.usage && finalContext.usage.available) {
            totalUsage.available = true;
            totalUsage.inputTokens += finalContext.usage.inputTokens;
            totalUsage.outputTokens += finalContext.usage.outputTokens;
            totalUsage.totalTokens += finalContext.usage.totalTokens;
        }
        return {
            text,
            strategy: "bounded-chunking",
            requestCount: chunks.length + 1,
            chunkCount: chunks.length,
            durationMs: totalDuration,
            usage: totalUsage
        };
    }

    async function summarizeYoutubeWithCap(extracted, settings, providerId) {
        return summarizeWithBoundedChunking(extracted, settings, providerId, {
            tabId: extracted.tabId,
            maxRequests: YOUTUBE_MAX_REQUESTS
        });
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

    async function generateSummaryText(extracted, settings, providerId, tabId) {
        // Gemini direct-video understanding for YouTube (enabled in settings)
        const useDirectVideo = extracted.sourceType === "youtube"
            && providerId === "gemini"
            && settings.gemini
            && settings.gemini.useGeminiDirectVideo
            && extracted.url
            && !shouldUseYoutubeChunking(extracted);

        if (useDirectVideo) {
            try {
                await SummarizerWorkflowStore.markSummarizing(tabId, {
                    stage: "summarizing",
                    statusMessage: "Analyzing video directly with Gemini...",
                    requestCount: 1,
                    requestTotal: 1,
                    chunkIndex: 0,
                    chunkTotal: 0
                });

                const videoUrl = extracted.url;
                const geminiPrompt = SummarizerPrompts.buildSummaryPrompt({
                    ...extracted,
                    content: `[VIDEO_URL:${videoUrl}]`,
                    sourceType: "youtube"
                }, settings);

                const onChunk = createStreamEmitter({
                    tabId,
                    extracted,
                    settings,
                    providerId,
                    executionDetails: { strategy: "direct-video", requestCount: 1, chunkCount: 0 }
                });
                const geminiSettings = Object.assign({}, settings.gemini || {}, {
                    summaryLength: settings.summaryLength,
                    signal: activeControllers.get(tabId) ? activeControllers.get(tabId).signal : undefined
                });
                const directContext = { usage: {} };
                const directStart = Date.now();
                const text = await SummarizerProviderGemini.generateTextFromYouTubeUrl(
                    geminiPrompt,
                    videoUrl,
                    geminiSettings,
                    onChunk,
                    directContext
                );

                return { text, strategy: "direct-video", requestCount: 1, chunkCount: 0, durationMs: Date.now() - directStart, usage: directContext.usage };
            } catch (directError) {
                console.warn("[Summarizer] Direct video failed, falling back to transcript:", directError.message);
                // Fall through to transcript-based summarization
            }
        }

        if (shouldUseYoutubeChunking(extracted)) {
            return summarizeYoutubeWithCap({ ...extracted, tabId }, settings, providerId);
        }

        if (shouldUseProgressiveSummarization(extracted)) {
            return summarizeWithBoundedChunking(extracted, settings, providerId, {
                tabId,
                maxRequests: extracted.sourceType === "course" ? COURSE_MAX_REQUESTS : WEBPAGE_MAX_REQUESTS
            });
        }

        await SummarizerWorkflowStore.markSummarizing(tabId, {
            stage: "preparing",
            statusMessage: `Preparing ${getSourceLabel(extracted)} summary...`,
            requestCount: 1,
            requestTotal: 1,
            chunkIndex: 0,
            chunkTotal: 0
        });
        const onChunk = createStreamEmitter({
            tabId,
            extracted,
            settings,
            providerId,
            executionDetails: { strategy: "single", requestCount: 1, chunkCount: 0 }
        });
        const singleContext = { usage: {} };
        const singleStart = Date.now();
        const text = await generateTextWithRetry(
            providerId,
            SummarizerPrompts.buildSummaryPrompt(extracted, settings),
            settings,
            onChunk,
            tabId,
            singleContext
        );
        return {
            text,
            strategy: "single",
            requestCount: 1,
            chunkCount: 0,
            durationMs: Date.now() - singleStart,
            usage: singleContext.usage
        };
    }

    async function summarizeForTab(tabId) {
        if (inFlightSummaries.has(tabId)) {
            return inFlightSummaries.get(tabId);
        }
        const controller = new AbortController();
        activeControllers.set(tabId, controller);

        const job = (async () => {
            const startTime = Date.now();
            try {
                const settings = await SummarizerStorage.getSettings();
                await SummarizerWorkflowStore.markExtracting(tabId, {
                    lastMode: settings.promptMode,
                    sourceType: "",
                    hasTranscript: false,
                    statusMessage: "Inspecting current tab..."
                });
                let tabUrl = "";
                try {
                    const tab = await ensureTabIsOpen(tabId);
                    tabUrl = tab.url || "";
                } catch (_) {
                    tabUrl = "";
                }
                if (controller.signal.aborted) {
                    throw Object.assign(new Error("Summary cancelled."), { code: "CANCELLED" });
                }
                await SummarizerWorkflowStore.markExtracting(tabId, {
                    lastMode: settings.promptMode,
                    sourceType: "",
                    hasTranscript: false,
                    statusMessage: getExtractionStatusLabel(tabUrl)
                });
                const extracted = await SummarizerTabManager.requestExtraction(tabId);
                if (controller.signal.aborted) {
                    throw Object.assign(new Error("Summary cancelled."), { code: "CANCELLED" });
                }
                const providerId = settings.provider;
                await SummarizerWorkflowStore.markSummarizing(tabId, {
                    stage: "preparing",
                    lastMode: settings.promptMode,
                    sourceType: extracted.sourceType,
                    hasTranscript: Boolean(extracted.transcriptSegments && extracted.transcriptSegments.length),
                    title: extracted.title,
                    statusMessage: `Preparing ${getSourceLabel(extracted)} summary...`
                });
                const execution = await generateSummaryText(extracted, settings, providerId, tabId);
                if (controller.signal.aborted) {
                    throw Object.assign(new Error("Summary cancelled."), { code: "CANCELLED" });
                }
                await SummarizerWorkflowStore.markSummarizing(tabId, {
                    stage: "saving",
                    lastMode: settings.promptMode,
                    sourceType: extracted.sourceType,
                    hasTranscript: Boolean(extracted.transcriptSegments && extracted.transcriptSegments.length),
                    title: extracted.title,
                    statusMessage: "Saving result...",
                    requestCount: execution.requestCount,
                    requestTotal: execution.requestCount
                });
                const rawResponse = execution.text;
                const parsed = SummarizerCleaners.parseStructuredSummary(rawResponse);
                let quality = null;
                let finalParsed = parsed;
                if (globalThis.SummarizerQuality) {
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
                    quality = SummarizerQuality.evaluateSummary(parsed, qualityContext);
                    if (SummarizerQuality.shouldRepair(quality, qualityContext)) {
                        try {
                            const repairPrompt = SummarizerQuality.buildRepairPrompt(qualityContext, parsed, quality, settings);
                            const repairedRaw = await generateTextWithRetry(providerId, repairPrompt, settings, undefined, tabId);
                            const repairedParsed = SummarizerCleaners.parseStructuredSummary(repairedRaw);
                            finalParsed = SummarizerQuality.mergeRepairedSections(parsed, repairedParsed, quality);
                            const repairedQuality = SummarizerQuality.evaluateSummary(finalParsed, qualityContext);
                            quality = Object.assign({}, repairedQuality, { repaired: true, initialScore: quality.score });
                        } catch (repairError) {
                            quality = Object.assign({}, quality, { repaired: false, repairError: repairError.message });
                        }
                    }
                }
                const result = buildResultFromExtraction(finalParsed, extracted, settings, providerId, tabId, Object.assign({}, execution, { quality }));

                await ensureTabIsOpen(tabId);
                await SummarizerStorage.saveResultForTab(tabId, result);
                await SummarizerStorage.clearConversationForTab(tabId);
                await SummarizerWorkflowStore.markCompleted(tabId, {
                    lastMode: settings.promptMode,
                    sourceType: extracted.sourceType,
                    hasTranscript: Boolean(extracted.transcriptSegments && extracted.transcriptSegments.length),
                    title: extracted.title,
                    statusMessage: "Summary ready.",
                    requestCount: execution.requestCount,
                    requestTotal: execution.requestCount
                });
                SummarizerUiNotifier.notifyUi(result, tabId);
                return result;
            } catch (error) {
                if (error && (error.code === "CANCELLED" || /cancelled/i.test(String(error.message || "")))) {
                    await SummarizerWorkflowStore.markFailed(tabId, "Summary cancelled.", {
                        stage: "cancelled",
                        statusMessage: "Summary cancelled."
                    });
                    SummarizerUiNotifier.notifyError({ message: "Summary cancelled.", code: "CANCELLED" }, tabId);
                }
                throw error;
            }
        })();

        inFlightSummaries.set(tabId, job);
        try {
            return await job;
        } finally {
            inFlightSummaries.delete(tabId);
            activeControllers.delete(tabId);
        }
    }

    async function answerFollowUp(tabId, question) {
        const settings = await SummarizerStorage.getSettings();
        const result = await SummarizerStorage.getResultForTab(tabId);
        if (!result) {
            throw new Error("Summarize this tab before asking a follow-up question.");
        }

        const conversationHistory = await SummarizerStorage.getConversationForTab(tabId);
        const prompt = SummarizerPrompts.buildDeepDivePrompt(
            { ...result, conversationHistory },
            question,
            settings
        );
        const answer = await generateTextWithRetry(settings.provider, prompt, settings, undefined, tabId);
        const conversation = {
            question,
            answer: SummarizerCleaners.cleanText(answer),
            type: "user-question"
        };

        await SummarizerStorage.addMessageToConversation(tabId, conversation);
        return conversation;
    }

    globalThis.SummarizerSummaryService = {
        summarizeForTab,
        cancelSummaryForTab,
        releaseTab: function releaseTab(tabId) {
            cancelSummaryForTab(tabId);
        },
        answerFollowUp
    };
})();
