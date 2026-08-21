(function () {
    const shared = globalThis.SummarizerProviderShared;
    async function requestLocal(prompt, providerSettings, onChunk, requestContext) {
        const baseUrl = (providerSettings.baseUrl || "http://127.0.0.1:11434")
            .trim()
            .replace(/\/$/, "");
        const model = (providerSettings.model || "llama3.1").trim();
        const endpointType = (providerSettings.endpointType || "ollama").trim().toLowerCase();
        const isOpenAiCompatible = endpointType === "openai" || baseUrl.includes("1234");
        const isStream = typeof onChunk === "function";
        const timeoutMs = shared.getTimeoutMs(providerSettings.summaryLength, providerSettings.summarySize);
        const controller = shared.createAbortController(timeoutMs, providerSettings.signal);
        const requestUrl = isOpenAiCompatible ? baseUrl + "/chat/completions" : baseUrl + "/api/chat";
        const requestBody = isOpenAiCompatible
            ? {
                model,
                temperature: 0.4,
                                messages: [{ role: "user", content: prompt }],
                stream: isStream
            }
            : {
                model,
                stream: isStream,
                                messages: [{ role: "user", content: prompt }]
            };
        let response;
        try {
            response = await shared.executeFetch(
                requestUrl,
                {
                    method: "POST",
                    headers: isOpenAiCompatible
                        ? { "Content-Type": "application/json", Authorization: "Bearer lm-studio" }
                        : { "Content-Type": "application/json" },
                    body: JSON.stringify(requestBody)
                },
                controller.signal,
                "local",
                model
            );
        } finally {
            controller.clear();
        }
        if (!response.ok) {
            await shared.handleResponseError(response, "local", model, "Local endpoint request failed.");
        }
        if (!isStream) {
            const data = await response.json().catch(() => ({}));
            const text = isOpenAiCompatible
                ? data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content
                : data.message && data.message.content;
            return shared.validateNonEmptyResponse(
                Array.isArray(text) ? text.map((part) => part.text || "").join("\n") : String(text || ""),
                "local",
                model,
                isOpenAiCompatible ? "Local OpenAI-compatible endpoint" : "Local Ollama endpoint"
            );
        }
        const parser = isOpenAiCompatible ? shared.parseOpenAiSseLine : shared.parseOllamaJsonlLine;
        const text = await shared.readStream(response, onChunk, (line) => {
            try {
                const parsed = JSON.parse(line.startsWith("data:") ? line.slice(5).trim() : line);
                if (parsed && parsed.usage) shared.recordUsage(requestContext, parsed.usage);
                if (parsed && (parsed.prompt_eval_count || parsed.eval_count)) {
                    shared.recordUsage(requestContext, { prompt_tokens: parsed.prompt_eval_count || 0, completion_tokens: parsed.eval_count || 0 });
                }
            } catch (_) {}
            return parser(line);
        });
        return shared.validateNonEmptyResponse(text, "local", model, "Local endpoint");
    }
    async function generateText(prompt, providerSettings, onChunk, requestContext) {
        return requestLocal(prompt, providerSettings, onChunk, requestContext);
    }
    globalThis.SummarizerProviderLocal = { generateText };
})();
