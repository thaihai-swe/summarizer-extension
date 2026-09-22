(function () {
    const SOURCE_HINT = "Grounded in this tab’s summary";
    const OPEN_HINT = "Not limited to this source";
    const SOURCE_PLACEHOLDER = "Ask a deeper question about this source. Enter to send, Shift+Enter for a new line.";
    const OPEN_PLACEHOLDER = "Ask anything. This answer will not use the page. Enter to send, Shift+Enter for a new line.";
    const RESULT_FIELDS = [
        "tabId", "sourceType", "title", "url", "summary", "keyTakeaways",
        "detailsOfVideo", "detailedBreakdown", "expertCommentary", "evidenceAndDetails",
        "argumentAndInsight", "conceptMapAndPrerequisites", "reviewKit", "practicalSteps", "conceptMap",
        "coreDefinitions", "prerequisitesMisconceptions", "pitfallsWarnings", "resourcesTools",
        "videoDetails"
    ];

    function compactSource(value, limit) {
        const source = String(value || "");
        if (source.length <= limit) return source;
        const headLength = Math.floor(limit * 0.7);
        return source.slice(0, headLength)
            + "\n\n[Middle of source omitted for message efficiency.]\n\n"
            + source.slice(-(limit - headLength));
    }

    function buildTranscriptContext(segments, limit) {
        if (!Array.isArray(segments) || !segments.length) return "";
        const line = (segment) => {
            const label = String(segment && segment.startLabel || "").trim();
            return (label ? "[" + label.replace(/^\[|\]$/g, "") + "] " : "")
                + String(segment && segment.text || "").trim();
        };
        const headLimit = Math.floor(limit * 0.7);
        const tailLimit = limit - headLimit;
        const head = [];
        let headLength = 0;
        for (let index = 0; index < segments.length && headLength < headLimit; index += 1) {
            const value = line(segments[index]);
            if (!value) continue;
            head.push(value);
            headLength += value.length + 1;
        }
        if (head.length === segments.length) return head.join("\n");
        const tail = [];
        let tailLength = 0;
        for (let index = segments.length - 1; index >= head.length && tailLength < tailLimit; index -= 1) {
            const value = line(segments[index]);
            if (!value) continue;
            tail.unshift(value);
            tailLength += value.length + 1;
        }
        return head.join("\n")
            + "\n\n[Middle of source omitted for message efficiency.]\n\n"
            + tail.join("\n");
    }

    function create(config) {
        const elements = config.elements;
        let groundingMode = "source";
        let history = [];

        function buildContext(result) {
            if (!result) return null;
            const context = {};
            RESULT_FIELDS.forEach((field) => {
                if (result[field] !== undefined && result[field] !== null) context[field] = result[field];
            });
            context.sourceContentForPrompt = Array.isArray(result.transcriptSegments)
                && result.transcriptSegments.length
                ? buildTranscriptContext(result.transcriptSegments, 16000)
                : compactSource(result.sourceContentForPrompt || result.sourceContentRaw || "", 16000);
            return context;
        }

        function setGroundingMode(mode) {
            groundingMode = mode === "open" ? "open" : "source";
            const isOpen = groundingMode === "open";
            if (elements.groundingSourceBtn) {
                elements.groundingSourceBtn.classList.toggle("is-active", !isOpen);
                elements.groundingSourceBtn.setAttribute("aria-checked", String(!isOpen));
            }
            if (elements.groundingOpenBtn) {
                elements.groundingOpenBtn.classList.toggle("is-active", isOpen);
                elements.groundingOpenBtn.setAttribute("aria-checked", String(isOpen));
            }
            if (elements.chatHint) elements.chatHint.textContent = isOpen ? OPEN_HINT : SOURCE_HINT;
            if (elements.chatInput) elements.chatInput.placeholder = isOpen ? OPEN_PLACEHOLDER : SOURCE_PLACEHOLDER;
            if (elements.chatSection) elements.chatSection.classList.toggle("is-open-grounding", isOpen);
        }

        function appendEntry(role, text, grounding) {
            const entry = document.createElement("div");
            const isUser = role === "user" || role === "question";
            entry.className = "chat-entry " + (isUser ? "user" : "assistant");
            if (!isUser) {
                const badge = document.createElement("span");
                const mode = grounding === "open" ? "open" : "source";
                badge.className = "chat-badge " + (mode === "open" ? "is-open" : "is-source");
                badge.textContent = mode === "open" ? "General" : "Source";
                entry.appendChild(badge);
            }
            const body = document.createElement("div");
            body.className = "chat-entry-body";
            body.innerHTML = SummarizerMarkdown.renderMarkdown(text);
            entry.appendChild(body);
            const copy = document.createElement("button");
            copy.className = "copy-msg";
            copy.type = "button";
            copy.textContent = "Copy";
            copy.addEventListener("click", async () => {
                try {
                    await navigator.clipboard.writeText(text);
                    copy.textContent = "Copied!";
                    setTimeout(() => { copy.textContent = "Copy"; }, 1200);
                } catch (_) {}
            });
            entry.appendChild(copy);
            elements.chatLog.appendChild(entry);
            entry.scrollIntoView({ behavior: "smooth" });
        }

        async function ask(forcedGrounding) {
            const question = elements.chatInput.value.trim();
            if (!question) return;
            const grounding = forcedGrounding === "open" || forcedGrounding === "source"
                ? forcedGrounding
                : groundingMode;
            elements.chatInput.value = "";
            appendEntry("user", question, grounding);
            config.setStatus(grounding === "open" ? "Asking (general)..." : "Asking...", "busy");
            config.setButtonBusy(elements.chatSend, true, "...", "Send");
            const response = await config.sendRuntimeMessage({
                type: config.messageType,
                question,
                grounding,
                result: grounding === "source" ? buildContext(config.getLatestResult()) : null,
                conversationHistory: history
            });
            if (!response || !response.ok) {
                config.setStatus((response && response.error) || "Follow-up failed.", "error");
                config.setButtonBusy(elements.chatSend, false, "...", "Send");
                return;
            }
            const conversation = response.result || response;
            appendEntry("assistant", conversation.answer || "No response.", conversation.grounding || grounding);
            history = history.concat(conversation).slice(-6);
            config.setStatus("Answer received.", "ready");
            config.setButtonBusy(elements.chatSend, false, "...", "Send");
        }

        function reset() {
            history = [];
            if (elements.chatLog) elements.chatLog.replaceChildren();
        }

        return { ask, reset, setGroundingMode };
    }

    globalThis.SummarizerSidepanelChat = { create };
})();
