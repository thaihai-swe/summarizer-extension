(function () {
    const LONG_CONTENT_THRESHOLDS = {
        webpage: 60000,
        course: 50000,
        youtube: 24000,
        pdf: 60000
    };
    const MAX_REQUESTS = { webpage: 4, course: 4, youtube: 4, pdf: 4 };
    const CHUNK_TARGET_LENGTH = 12000;
    const STREAM_THROTTLE_MS = 250;

    function createCancelledError(providerId) {
        const error = new Error("Generation cancelled.");
        error.code = "CANCELLED";
        error.provider = providerId;
        return error;
    }

    function throwIfCancelled(signal, providerId) {
        if (signal && signal.aborted) throw createCancelledError(providerId);
    }

    function waitForRetry(signal, delayMs) {
        return new Promise((resolve, reject) => {
            let timer = null;
            const finish = () => {
                if (signal) signal.removeEventListener("abort", cancel);
                resolve();
            };
            const cancel = () => {
                if (timer) clearTimeout(timer);
                if (signal) signal.removeEventListener("abort", cancel);
                reject(createCancelledError());
            };
            timer = setTimeout(finish, delayMs);
            if (signal) signal.addEventListener("abort", cancel, { once: true });
        });
    }

    async function generateTextWithRetry(providerId, prompt, settings, onChunk, options) {
        const config = options || {};
        const signal = config.signal;
        const requestContext = config.requestContext || {};
        throwIfCancelled(signal, providerId);
        try {
            return await SummarizerProviders.generateText(
                providerId,
                prompt,
                settings,
                onChunk,
                Object.assign(requestContext, { signal })
            );
        } catch (error) {
            if (error && error.code === "CANCELLED") throw error;
            throwIfCancelled(signal, providerId);
            // A streamed response has already been shown to the user. Retrying
            // it as a hidden non-stream request can leave the panel in a
            // confusing partial/busy state and duplicate expensive work.
            if (requestContext.streamedOutput) throw error;
            // The five-minute request ceiling is also the retry ceiling for a
            // timeout. Retrying another five-minute request would turn a
            // bounded failure into an unexpectedly long hang.
            if (error && error.code === "NETWORK_TIMEOUT") throw error;
            if (!SummarizerProviders.isTransientProviderError
                || !SummarizerProviders.isTransientProviderError(error)) {
                throw error;
            }
            SummarizerDebug.logExtraction("Transient error, retrying once", { error });
            await waitForRetry(signal, 2000);
            throwIfCancelled(signal, providerId);
            return SummarizerProviders.generateText(
                providerId,
                prompt,
                settings,
                undefined,
                Object.assign(requestContext, { signal })
            );
        }
    }

    function splitIntoChunks(text, targetLength) {
        const source = SummarizerCleaners.cleanText(text);
        if (!source) return [];
        const chunks = [];
        const units = source.includes("\n") ? source.split(/\n+/) : source.split(/(?<=\.)\s+/);
        let current = "";

        units.forEach((unit) => {
            const part = SummarizerCleaners.cleanText(unit);
            if (!part) return;
            const candidate = current ? current + "\n" + part : part;
            if (candidate.length > targetLength && current) {
                chunks.push(current);
                current = part;
                return;
            }
            if (part.length > targetLength) {
                if (current) chunks.push(current);
                current = "";
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
        if (current) chunks.push(current);
        return chunks.filter(Boolean);
    }

    function splitIntoBalancedChunks(text, maxChunks) {
        const source = SummarizerCleaners.cleanText(text);
        const limit = Math.max(1, Number(maxChunks || 1));
        if (!source) return [];
        if (globalThis.SummarizerSemanticChunker) {
            const semanticChunks = SummarizerSemanticChunker.chunkContent(source, {
                targetLength: CHUNK_TARGET_LENGTH,
                maxLength: CHUNK_TARGET_LENGTH * 1.35,
                maxChunks: limit,
                sourceType: "webpage",
                preserveOverlap: true,
                overlapSentences: 1
            });
            if (semanticChunks.length) return semanticChunks.map((chunk) => chunk.text);
        }

        const initialChunks = splitIntoChunks(source, Math.max(1, Math.ceil(source.length / limit)));
        if (initialChunks.length <= limit) return initialChunks;
        const mergedChunks = [];
        let startIndex = 0;
        for (let slot = 0; slot < limit; slot += 1) {
            const takeCount = Math.ceil((initialChunks.length - startIndex) / (limit - slot));
            mergedChunks.push(SummarizerCleaners.cleanText(
                initialChunks.slice(startIndex, startIndex + takeCount).join("\n\n")
            ));
            startIndex += takeCount;
        }
        return mergedChunks.filter(Boolean);
    }

    function shouldChunk(extracted) {
        const threshold = LONG_CONTENT_THRESHOLDS[extracted && extracted.sourceType];
        if (!threshold) return false;
        const source = extracted.contentRaw || extracted.contentForPrompt || extracted.content || "";
        return source.length > threshold;
    }

    function createStreamEmitter(context) {
        const config = context || {};
        let lastEmitAt = 0;
        return function onChunk(accumulatedText) {
            if (!config.tabId || !accumulatedText) return;
            const now = Date.now();
            if (now - lastEmitAt < STREAM_THROTTLE_MS) return;
            lastEmitAt = now;
            try {
                const parsed = SummarizerCleaners.parseStructuredSummary(accumulatedText);
                const result = SummarizerResultBuilder.buildStreamResult(
                    parsed,
                    config.extracted,
                    config.settings,
                    config.providerId,
                    config.tabId,
                    config.executionDetails
                );
                SummarizerUiNotifier.notifyChunk(result, config.tabId);
            } catch (error) {
                SummarizerDebug.logExtraction("Stream chunk render skipped", {
                    error: error && error.message
                });
            }
        };
    }

    function addUsage(total, current) {
        if (!current || !current.available) return;
        total.available = true;
        total.inputTokens += current.inputTokens || 0;
        total.outputTokens += current.outputTokens || 0;
        total.totalTokens += current.totalTokens || 0;
    }

    async function generateSingle(extracted, settings, providerId, options) {
        const config = options || {};
        const requestContext = { usage: {} };
        const startedAt = Date.now();
        const text = await generateTextWithRetry(
            providerId,
            SummarizerPrompts.buildSummaryPrompt(extracted, settings),
            settings,
            createStreamEmitter({
                tabId: config.tabId,
                extracted,
                settings,
                providerId,
                executionDetails: { strategy: "single", requestCount: 1, chunkCount: 0 }
            }),
            { signal: config.signal, requestContext }
        );
        return {
            text,
            strategy: "single",
            requestCount: 1,
            chunkCount: 0,
            durationMs: Date.now() - startedAt,
            usage: requestContext.usage
        };
    }

    async function generateChunked(extracted, settings, providerId, options) {
        const config = options || {};
        const source = extracted.contentRaw || extracted.contentForPrompt || extracted.content || "";
        const maxRequests = Math.max(2, Number(config.maxRequests || 4));
        const maxChunks = maxRequests - 1;
        const chunks = globalThis.SummarizerSemanticChunker
            ? SummarizerSemanticChunker.chunkContent(source, {
                targetLength: CHUNK_TARGET_LENGTH,
                maxLength: CHUNK_TARGET_LENGTH * 1.35,
                maxChunks,
                sourceType: extracted.sourceType,
                transcriptSegments: extracted.transcriptSegments || null,
                preserveOverlap: true,
                overlapSentences: 1
            })
            : splitIntoBalancedChunks(source, maxChunks).map((text, index) => ({ index, text }));

        if (chunks.length <= 1) return generateSingle(extracted, settings, providerId, config);

        const summaries = [];
        let durationMs = 0;
        const usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0, available: false };
        for (let index = 0; index < chunks.length; index += 1) {
            throwIfCancelled(config.signal, providerId);
            const requestContext = { usage: {} };
            const startedAt = Date.now();
            const text = await generateTextWithRetry(
                providerId,
                SummarizerPrompts.buildChunkSummaryPrompt(extracted, chunks[index].text, index, chunks.length, settings),
                settings,
                undefined,
                { signal: config.signal, requestContext }
            );
            durationMs += Date.now() - startedAt;
            addUsage(usage, requestContext.usage);
            summaries.push(SummarizerCleaners.cleanText(text));
        }

        const finalContext = { usage: {} };
        const finalStartedAt = Date.now();
        const text = await generateTextWithRetry(
            providerId,
            SummarizerPrompts.buildSynthesisPrompt(extracted, summaries, settings),
            settings,
            createStreamEmitter({
                tabId: config.tabId,
                extracted,
                settings,
                providerId,
                executionDetails: {
                    strategy: "bounded-chunking",
                    requestCount: chunks.length + 1,
                    chunkCount: chunks.length
                }
            }),
            { signal: config.signal, requestContext: finalContext }
        );
        durationMs += Date.now() - finalStartedAt;
        addUsage(usage, finalContext.usage);
        return {
            text,
            strategy: "bounded-chunking",
            requestCount: chunks.length + 1,
            chunkCount: chunks.length,
            durationMs,
            usage
        };
    }

    async function generateDirectVideo(extracted, settings, providerId, options) {
        const config = options || {};
        const videoUrl = extracted.url;
        const prompt = SummarizerPrompts.buildSummaryPrompt(Object.assign({}, extracted, {
            content: `[VIDEO_URL:${videoUrl}]`,
            sourceType: "youtube"
        }), settings);
        const providerSettings = Object.assign({}, settings.gemini || {}, {
            summaryLength: settings.summaryLength,
            signal: config.signal
        });
        const requestContext = { usage: {} };
        const startedAt = Date.now();
        const text = await SummarizerProviderGemini.generateTextFromYouTubeUrl(
            prompt,
            videoUrl,
            providerSettings,
            createStreamEmitter({
                tabId: config.tabId,
                extracted,
                settings,
                providerId,
                executionDetails: { strategy: "direct-video", requestCount: 1, chunkCount: 0 }
            }),
            requestContext
        );
        return {
            text,
            strategy: "direct-video",
            requestCount: 1,
            chunkCount: 0,
            durationMs: Date.now() - startedAt,
            usage: requestContext.usage
        };
    }

    async function generateSummary(extracted, settings, providerId, options) {
        const config = options || {};
        const useDirectVideo = extracted.sourceType === "youtube"
            && providerId === "gemini"
            && settings.gemini
            && settings.gemini.useGeminiDirectVideo
            && extracted.url
            && !shouldChunk(extracted);

        if (useDirectVideo) {
            try {
                return await generateDirectVideo(extracted, settings, providerId, config);
            } catch (error) {
                throwIfCancelled(config.signal, providerId);
                if (error && error.code === "CANCELLED") throw error;
                console.warn("[Summarizer] Direct video failed, falling back to transcript:", error.message);
            }
        }

        if (shouldChunk(extracted)) {
            return generateChunked(extracted, settings, providerId, Object.assign({}, config, {
                maxRequests: MAX_REQUESTS[extracted.sourceType] || 4
            }));
        }
        return generateSingle(extracted, settings, providerId, config);
    }

    globalThis.SummarizerGenerationService = {
        generateSummary,
        generateTextWithRetry
    };
})();
