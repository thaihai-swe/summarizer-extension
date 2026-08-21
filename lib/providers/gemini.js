(function () {
    const shared = globalThis.SummarizerProviderShared;
    const FALLBACK_CHAIN = [
        "gemini-3-flash-preview",
        "gemini-2.5-flash",
        "gemini-3.5-flash-lite",
        "gemini-2.5-flash-lite"
    ];
    function sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    function isTransientGeminiError(message, status) {
        const text = String(message || "").toLowerCase();
        return (
            status === 429 ||
            status === 500 ||
            status === 503 ||
            text.includes("high demand") ||
            text.includes("try again later") ||
            text.includes("overloaded") ||
            text.includes("resource_exhausted") ||
            text.includes("too many requests") ||
            text.includes("rate limit") ||
            text.includes("timeout") ||
            text.includes("network") ||
            text.includes("fetch failed")
        );
    }
    function buildModelCandidates(initialModel) {
        const normalized = (initialModel || "gemini-3.5-flash-lite").trim();
        const list = [normalized];
        FALLBACK_CHAIN.forEach((model) => {
            if (!list.includes(model)) list.push(model);
        });
        return list;
    }
    function extractGeminiText(data, model) {
        const text =
            data.candidates &&
            data.candidates[0] &&
            data.candidates[0].content &&
            data.candidates[0].content.parts &&
            data.candidates[0].content.parts
                .map((part) => part.text || "")
                .join("\n");
        return shared.validateNonEmptyResponse(text || "", "gemini", model, "Gemini");
    }
    async function requestGeminiStreamWithParts(parts, apiKey, model, timeoutMs, onChunk, signal, requestContext) {
        const url =
            "https://generativelanguage.googleapis.com/v1beta/models/" +
            encodeURIComponent(model) +
            ":streamGenerateContent?key=" +
            encodeURIComponent(apiKey) +
            "&alt=sse";
        const controller = shared.createAbortController(timeoutMs || 30000, signal);
        let response;
        try {
            response = await shared.executeFetch(
                url,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ role: "user", parts: parts }],
                        generationConfig: {
                            temperature: 0.3,
                                                        responseMimeType: "text/plain"
                        }
                    })
                },
                controller.signal,
                "gemini",
                model
            );
        } finally {
            controller.clear();
        }
        if (!response.ok) {
            await shared.handleResponseError(response, "gemini", model, "Gemini request failed.");
        }
        const text = await shared.readStream(response, onChunk, (line) => {
            try {
                if (line.startsWith("data: ")) {
                    const parsed = JSON.parse(line.slice(6).trim() || "{}");
                    if (parsed.usageMetadata) shared.recordUsage(requestContext, parsed.usageMetadata);
                }
            } catch (_) { }
            return shared.parseGeminiSseLine(line);
        });
        return shared.validateNonEmptyResponse(text, "gemini", model, "Gemini");
    }
    async function requestGeminiNonStreamWithParts(parts, apiKey, model, timeoutMs, signal, requestContext) {
        const url =
            "https://generativelanguage.googleapis.com/v1beta/models/" +
            encodeURIComponent(model) +
            ":generateContent?key=" +
            encodeURIComponent(apiKey);
        const controller = shared.createAbortController(timeoutMs || 90000, signal);
        let response;
        try {
            response = await shared.executeFetch(
                url,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ role: "user", parts: parts }],
                        generationConfig: {
                            temperature: 0.3,
                                                        responseMimeType: "text/plain"
                        }
                    })
                },
                controller.signal,
                "gemini",
                model
            );
        } finally {
            controller.clear();
        }
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            const message = data.error && data.error.message ? data.error.message : "Gemini request failed.";
            const error = new Error(message);
            error.status = response.status;
            error.model = model;
            error.provider = "gemini";
            if (response.status === 401 || response.status === 403) error.code = "AUTH_ERROR";
            else if (response.status === 429) error.code = "RATE_LIMIT";
            throw error;
        }
        if (data.usageMetadata) shared.recordUsage(requestContext, data.usageMetadata);
        return extractGeminiText(data, model);
    }
    async function runWithModelFallback(providerSettings, runner) {
        const apiKey = (providerSettings.apiKey || "").trim();
        if (!apiKey) {
            const error = new Error("Gemini API key is missing.");
            error.code = "AUTH_ERROR";
            error.provider = "gemini";
            throw error;
        }
        const modelCandidates = buildModelCandidates(providerSettings.model);
        let lastError = null;
        for (const model of modelCandidates) {
            for (let attempt = 0; attempt < 3; attempt += 1) {
                try {
                    return await runner(apiKey, model);
                } catch (error) {
                    lastError = error;
                    if (!isTransientGeminiError(error.message, error.status) && error.code !== "NETWORK_TIMEOUT") {
                        throw error;
                    }
                    if (attempt < 2) await sleep(700 * (attempt + 1));
                }
            }
        }
        lastError = lastError || new Error("Gemini is temporarily overloaded.");
        lastError.message = "Gemini is temporarily overloaded. The extension retried and tried fallback Gemini models, but Google still returned a temporary capacity error. Please try again shortly or switch providers.";
        throw lastError;
    }
    async function runWithModelFallbackStream(providerSettings, parts, onChunk, timeoutMs) {
        const apiKey = (providerSettings.apiKey || "").trim();
        if (!apiKey) {
            const error = new Error("Gemini API key is missing.");
            error.code = "AUTH_ERROR";
            error.provider = "gemini";
            throw error;
        }
        const modelCandidates = buildModelCandidates(providerSettings.model);
        let lastError = null;
        for (const model of modelCandidates) {
            for (let attempt = 0; attempt < 3; attempt += 1) {
                try {
                    return await requestGeminiStreamWithParts(parts, apiKey, model, timeoutMs, onChunk, providerSettings.signal, providerSettings.requestContext);
                } catch (error) {
                    lastError = error;
                    if (!isTransientGeminiError(error.message, error.status) && error.code !== "NETWORK_TIMEOUT") {
                        throw error;
                    }
                    if (attempt < 2) await sleep(700 * (attempt + 1));
                }
            }
        }
        lastError = lastError || new Error("Gemini is temporarily overloaded.");
        lastError.message = "Gemini is temporarily overloaded. The extension retried and tried fallback Gemini models, but Google still returned a temporary capacity error. Please try again shortly or switch providers.";
        throw lastError;
    }
    async function generateText(prompt, providerSettings, onChunk, requestContext) {
        providerSettings = Object.assign({}, providerSettings || {}, { requestContext });
        const isLong = String(providerSettings.summaryLength || "").toLowerCase() === "long";
        if (onChunk) {
            return runWithModelFallbackStream(providerSettings, [{ text: prompt }], onChunk, isLong ? 120000 : 60000);
        }
        if (isLong) {
            return runWithModelFallback(providerSettings, (apiKey, model) => requestGeminiNonStreamWithParts([{ text: prompt }], apiKey, model, 120000, providerSettings.signal, providerSettings.requestContext));
        }
        return runWithModelFallback(providerSettings, (apiKey, model) => requestGeminiNonStreamWithParts([{ text: prompt }], apiKey, model, undefined, providerSettings.signal, providerSettings.requestContext));
    }
    async function generateTextFromYouTubeUrl(prompt, youtubeUrl, providerSettings, onChunk, requestContext) {
        providerSettings = Object.assign({}, providerSettings || {}, { requestContext });
        const url = String(youtubeUrl || "").trim();
        if (!url || !/youtube\.com\/(watch|live)|youtu\.be\//i.test(url)) {
            const error = new Error("A valid YouTube URL is required for Gemini direct video understanding.");
            error.code = "PROVIDER_ERROR";
            error.provider = "gemini";
            throw error;
        }
        const parts = [
            { fileData: { fileUri: youtubeUrl, mimeType: "video/*" } },
            { text: prompt }
        ];
        const isLong = String(providerSettings.summaryLength || "").toLowerCase() === "long";
        if (onChunk) {
            return runWithModelFallbackStream(providerSettings, parts, onChunk, isLong ? 120000 : 90000);
        }
        return runWithModelFallback(providerSettings, (apiKey, model) =>
            requestGeminiNonStreamWithParts(parts, apiKey, model, isLong ? 120000 : 90000, providerSettings.signal, providerSettings.requestContext)
        );
    }
    globalThis.SummarizerProviderGemini = {
        generateText,
        generateTextFromYouTubeUrl
    };
})();
