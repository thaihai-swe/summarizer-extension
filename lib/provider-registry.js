(function () {
    function withSummaryLength(providerSettings, settings) {
        return {
            ...(providerSettings || {}),
            summaryLength: settings && settings.summaryLength
                    };
    }

    const providers = {
        gemini: {
            id: "gemini",
            label: "Gemini",
            capabilities: { streaming: true, directYouTube: true, apiKey: true, endpoint: false },
            getSettings: (settings) => withSummaryLength(settings && settings.gemini, settings),
            generate: (prompt, providerSettings, onChunk, requestContext) =>
                SummarizerProviderGemini.generateText(prompt, providerSettings, onChunk, requestContext)
        },
        openai: {
            id: "openai",
            label: "OpenAI",
            capabilities: { streaming: true, directYouTube: false, apiKey: true, endpoint: true },
            getSettings: (settings) => withSummaryLength(settings && settings.openai, settings),
            generate: (prompt, providerSettings, onChunk, requestContext) =>
                SummarizerProviderOpenAI.generateText(prompt, providerSettings, onChunk, requestContext)
        },
        local: {
            id: "local",
            label: "Local LLM",
            capabilities: { streaming: true, directYouTube: false, apiKey: false, endpoint: true },
            getSettings: (settings) => withSummaryLength(settings && settings.local, settings),
            generate: (prompt, providerSettings, onChunk, requestContext) =>
                SummarizerProviderLocal.generateText(prompt, providerSettings, onChunk, requestContext)
        }
    };

    function normalizeProviderError(error, providerId) {
        const next = error instanceof Error ? error : new Error(String(error || "Provider request failed."));
        const status = Number(next.status || 0) || undefined;
        const rawMessage = String(next.message || "Provider request failed.");
        const lower = rawMessage.toLowerCase();

        let code = next.code || "PROVIDER_ERROR";
        if (!next.code) {
            if (status === 401 || status === 403 || lower.includes("api key") || lower.includes("unauthorized") || lower.includes("permission")) {
                code = "AUTH_ERROR";
            } else if (status === 429 || lower.includes("rate limit") || lower.includes("too many requests")) {
                code = "RATE_LIMIT";
            } else if (status === 500 || status === 502 || status === 503 || status === 504) {
                code = "TRANSIENT_ERROR";
            } else if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("network") || lower.includes("fetch failed") || lower.includes("failed to fetch")) {
                code = lower.includes("timeout") || lower.includes("timed out") ? "NETWORK_TIMEOUT" : "NETWORK_ERROR";
            }
        }

        let message = rawMessage;
        if (code === "AUTH_ERROR") {
            message = "Invalid or missing API key. Update it in Settings, then try again.";
        } else if (code === "RATE_LIMIT") {
            message = "Provider rate limit reached. Wait a moment or switch providers in Settings.";
        } else if (code === "NETWORK_TIMEOUT") {
            message = "Provider request timed out. Check your connection or try again.";
        } else if (code === "NETWORK_ERROR") {
            message = "Network error while contacting the provider. Check your connection or endpoint URL.";
        }

        next.code = code;
        next.status = status;
        next.provider = next.provider || providerId;
        next.message = message;
        return next;
    }

    function isTransientProviderError(error) {
        if (!error) {
            return false;
        }
        const code = error.code || "";
        const status = Number(error.status || 0);
        return (
            code === "RATE_LIMIT" ||
            code === "TRANSIENT_ERROR" ||
            code === "NETWORK_TIMEOUT" ||
            code === "NETWORK_ERROR" ||
            status === 429 ||
            status === 500 ||
            status === 502 ||
            status === 503 ||
            status === 504
        );
    }

    async function generateText(providerId, prompt, settings, onChunk, requestContext) {
        const provider = providers[providerId];
        if (!provider) {
            const error = new Error("Unsupported provider: " + providerId);
            error.code = "PROVIDER_ERROR";
            error.provider = providerId;
            throw error;
        }

        const providerSettings = provider.getSettings(settings);
        if (requestContext && requestContext.signal) providerSettings.signal = requestContext.signal;
        SummarizerDebug.logProviderRequest(providerId, prompt, providerSettings);
        try {
            const text = await provider.generate(prompt, providerSettings, onChunk, requestContext);
            SummarizerDebug.logProviderResponse(providerId, text);
            return text;
        } catch (error) {
            const normalized = normalizeProviderError(error, providerId);
            SummarizerDebug.logProviderError(providerId, normalized);
            throw normalized;
        }
    }

    globalThis.SummarizerProviders = {
        providers,
        generateText,
        isTransientProviderError
    };
})();
