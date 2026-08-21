(function () {
    function cloneForConsole(value) {
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (error) {
            return value;
        }
    }

    function logExtraction(stage, payload) {
        const data = payload || {};
        console.groupCollapsed(
            `[Summarizer][Extraction] ${stage} :: ${data.sourceType || "unknown"} :: ${data.title || "Untitled"}`
        );
        console.log("metadata", {
            sourceType: data.sourceType || "",
            title: data.title || "",
            url: data.url || "",
            contentLength: String(data.content || "").length,
            contentRawLength: String(data.contentRaw || "").length,
            contentForPromptLength: String(data.contentForPrompt || "").length,
            transcriptSegments: Array.isArray(data.transcriptSegments) ? data.transcriptSegments.length : 0
        });
        console.log("payload", cloneForConsole(data));
        if (data.content || data.contentRaw || data.contentForPrompt) {
            console.log("content", data.content || "");
            if (data.contentRaw && data.contentRaw !== data.content) {
                console.log("contentRaw", data.contentRaw);
            }
            if (data.contentForPrompt && data.contentForPrompt !== data.content && data.contentForPrompt !== data.contentRaw) {
                console.log("contentForPrompt", data.contentForPrompt);
            }
        }
        console.groupEnd();
    }

    function logProviderRequest(providerId, prompt, settings) {
        console.groupCollapsed(`[Summarizer][Provider Request] ${providerId}`);
        console.log("provider", providerId);
        console.log("promptLength", String(prompt || "").length);
        console.log("settings", cloneForConsole(settings || {}));
        console.log("prompt", prompt || "");
        console.groupEnd();
    }

    function logProviderResponse(providerId, responseText) {
        console.groupCollapsed(`[Summarizer][Provider Response] ${providerId}`);
        console.log("responseLength", String(responseText || "").length);
        console.log("response", responseText || "");
        console.groupEnd();
    }

    function logProviderError(providerId, error) {
        console.groupCollapsed(`[Summarizer][Provider Error] ${providerId}`);
        console.error(error);
        console.groupEnd();
    }

    globalThis.SummarizerDebug = {
        logExtraction,
        logProviderRequest,
        logProviderResponse,
        logProviderError
    };
})();
