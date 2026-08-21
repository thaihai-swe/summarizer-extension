(function () {
    function getTimeoutMs(summaryLength, summarySize) {
        const isLong = String(summaryLength || "").toLowerCase() === "long";
        const isDeep = String(summarySize || "").toLowerCase() === "deep";
        const expanded = isLong || isDeep;
        return expanded ? 90000 : 30000;
    }

    function createAbortController(timeoutMs, externalSignal) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        let onExternalAbort = null;
        if (externalSignal) {
            onExternalAbort = () => controller.abort();
            if (externalSignal.aborted) {
                controller.abort();
            } else if (typeof externalSignal.addEventListener === "function") {
                externalSignal.addEventListener("abort", onExternalAbort, { once: true });
            }
        }
        return {
            signal: controller.signal,
            clear: () => {
                clearTimeout(timeout);
                if (externalSignal && onExternalAbort && typeof externalSignal.removeEventListener === "function") {
                    externalSignal.removeEventListener("abort", onExternalAbort);
                }
            }
        };
    }

    async function executeFetch(url, options, signal, providerId, model) {
        try {
            return await fetch(url, { ...options, signal });
        } catch (fetchError) {
            const error = new Error(fetchError.name === "AbortError" ? "Request timed out." : "Network error: " + fetchError.message);
            error.code = fetchError.name === "AbortError" ? "NETWORK_TIMEOUT" : "NETWORK_ERROR";
            error.provider = providerId;
            error.model = model;
            throw error;
        }
    }

    async function handleResponseError(response, providerId, model, defaultMessage) {
        const data = await response.json().catch(() => ({}));
        const message = data.error && data.error.message ? data.error.message : defaultMessage;
        const error = new Error(message);
        error.status = response.status;
        error.model = model;
        error.provider = providerId;
        if (response.status === 401 || response.status === 403) error.code = "AUTH_ERROR";
        else if (response.status === 429) error.code = "RATE_LIMIT";
        throw error;
    }

    async function readStream(response, onChunk, extractChunkText) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullText = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let newlineIndex;
            while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
                const line = buffer.slice(0, newlineIndex).trim();
                buffer = buffer.slice(newlineIndex + 1);
                if (!line) continue;
                const chunkText = extractChunkText(line);
                if (chunkText) {
                    fullText += chunkText;
                    if (onChunk) onChunk(fullText);
                }
            }
        }
        buffer += decoder.decode();
        if (buffer.trim()) {
            const chunkText = extractChunkText(buffer.trim());
            if (chunkText) {
                fullText += chunkText;
                if (onChunk) onChunk(fullText);
            }
        }
        return fullText;
    }

    function parseOpenAiSseLine(line) {
        if (!line.startsWith("data:")) return "";
        const jsonStr = line.slice(5).trim();
        if (jsonStr === "[DONE]") return "";
        try {
            const parsed = JSON.parse(jsonStr);
            return parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content || "";
        } catch (_) {
            return "";
        }
    }

    function parseOllamaJsonlLine(line) {
        try {
            const parsed = JSON.parse(line);
            return parsed.message && parsed.message.content ? parsed.message.content : "";
        } catch (_) {
            return "";
        }
    }

    function parseGeminiSseLine(line) {
        if (!line.startsWith("data: ")) return "";
        const json = line.slice(6).trim();
        if (!json || json === "[DONE]") return "";
        try {
            const parsed = JSON.parse(json);
            const candidates = parsed.candidates;
            if (!candidates || !candidates.length) return "";
            const content = candidates[0].content;
            if (!content || !content.parts) return "";
            return content.parts.map((part) => part.text || "").join("\n");
        } catch (_) {
            return "";
        }
    }

    function recordUsage(requestContext, usage) {
        if (!requestContext || !usage) return;
        if (!requestContext.usage) requestContext.usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0, available: false };
        const input = Number(usage.inputTokens || usage.promptTokenCount || usage.prompt_tokens || 0) || 0;
        const output = Number(usage.outputTokens || usage.candidatesTokenCount || usage.completion_tokens || 0) || 0;
        let total = Number(usage.totalTokens || usage.totalTokenCount || usage.total_tokens || 0) || 0;
        if (!total && (input || output)) total = input + output;
        if (!input && !output && !total) return;
        requestContext.usage.inputTokens += input;
        requestContext.usage.outputTokens += output;
        requestContext.usage.totalTokens += total;
        requestContext.usage.available = true;
    }

    function validateNonEmptyResponse(text, providerId, model, sourceLabel) {
        if (!text) {
            const error = new Error(`${sourceLabel} returned an empty response.`);
            error.provider = providerId;
            error.model = model;
            throw error;
        }
        return text;
    }

    globalThis.SummarizerProviderShared = {
        getTimeoutMs,
        createAbortController,
        executeFetch,
        handleResponseError,
        readStream,
        parseOpenAiSseLine,
        parseOllamaJsonlLine,
        parseGeminiSseLine,
        validateNonEmptyResponse,
        recordUsage
    };
})();
