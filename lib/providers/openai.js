(function () {
    const shared = globalThis.SummarizerProviderShared;
    async function requestOpenAI(prompt, providerSettings, onChunk, requestContext) {
        const apiKey = (providerSettings.apiKey || "").trim();
        if (!apiKey) {
            const error = new Error("OpenAI API key is missing.");
            error.code = "AUTH_ERROR";
            error.provider = "openai";
            throw error;
        }
        const model = (providerSettings.model || "gpt-4o-mini").trim();
        const baseUrl = (providerSettings.baseUrl || "https://api.openai.com/v1")
            .trim()
            .replace(/\/$/, "");
        const isStream = typeof onChunk === "function";
        const timeoutMs = shared.getTimeoutMs(providerSettings.summaryLength, providerSettings.summarySize);
        const controller = shared.createAbortController(timeoutMs, providerSettings.signal);
        let response;
        try {
            response = await shared.executeFetch(
                baseUrl + "/chat/completions",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: "Bearer " + apiKey
                    },
                    body: JSON.stringify({
                        model,
                        temperature: 0.4,
                                                messages: [{ role: "user", content: prompt }],
                        stream: isStream
                    })
                },
                controller.signal,
                "openai",
                model
            );
        } finally {
            controller.clear();
        }
        if (!response.ok) {
            await shared.handleResponseError(response, "openai", model, "OpenAI request failed.");
        }
        if (!isStream) {
            const data = await response.json().catch(() => ({}));
        if (data && data.usage) shared.recordUsage(requestContext, data.usage);
            const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
            return shared.validateNonEmptyResponse(
                Array.isArray(text) ? text.map((part) => part.text || "").join("\n") : String(text || ""),
                "openai",
                model,
                "OpenAI"
            );
        }
        const text = await shared.readStream(response, onChunk, (line) => {
            try {
                if (line.startsWith("data:")) {
                    const jsonStr = line.slice(5).trim();
                    if (jsonStr && jsonStr !== "[DONE]") {
                        const parsed = JSON.parse(jsonStr);
                        if (parsed.usage) shared.recordUsage(requestContext, parsed.usage);
                    }
                }
            } catch (_) {}
            return shared.parseOpenAiSseLine(line);
        });
        return shared.validateNonEmptyResponse(text, "openai", model, "OpenAI");
    }
    async function generateText(prompt, providerSettings, onChunk, requestContext) {
        return requestOpenAI(prompt, providerSettings, onChunk, requestContext);
    }
    globalThis.SummarizerProviderOpenAI = { generateText };
})();
