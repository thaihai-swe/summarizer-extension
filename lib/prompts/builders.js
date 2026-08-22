(function () {
    function extractQuestionKeywords(question) {
        return Array.from(
            new Set(
                String(question || "")
                    .toLowerCase()
                    .match(/[a-z0-9]{4,}/g) || []
            )
        ).slice(0, 12);
    }

    function detectFollowUpIntent(question) {
        const text = String(question || "").toLowerCase();
        if (/\b(compare|difference|different|versus|vs)\b/.test(text)) {
            return "compare";
        }
        if (/\b(why|how does|how do|explain|what does .* mean|clarify|walk me through)\b/.test(text)) {
            return "explain";
        }
        if (/\b(critique|bias|weakness|flaw|assumption|tradeoff|risk|limitation)\b/.test(text)) {
            return "critique";
        }
        if (/\b(action|next step|todo|what should|apply|practical|do next)\b/.test(text)) {
            return "action";
        }
        return "clarify";
    }

    function scorePassageForQuestion(passage, keywords) {
        const text = String(passage || "").toLowerCase();
        if (!text) {
            return 0;
        }
        return keywords.reduce((score, keyword) => {
            const pattern = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
            const matches = text.match(pattern);
            return score + (matches ? matches.length : 0);
        }, 0);
    }

    function getExcerptWindow(units, centerIndex, radius) {
        const start = Math.max(0, centerIndex - radius);
        const end = Math.min(units.length, centerIndex + radius + 1);
        return units
            .slice(start, end)
            .map((item) => String(item || "").trim())
            .filter(Boolean)
            .join("\n\n");
    }

    function selectRelevantSourceExcerpt(context, question, common) {
        const sourceText = common.cleanPromptValue(
            context.sourceContentForPrompt || context.sourceContentRaw || context.sourceContent || ""
        );
        if (!sourceText) {
            return "None.";
        }

        const keywords = extractQuestionKeywords(question);
        const units = sourceText.includes("\n")
            ? sourceText.split(/\n{1,}/)
            : sourceText.split(/(?<=[.!?])\s+/);
        const cleanedUnits = units
            .map((unit) => common.cleanPromptValue(unit))
            .filter(Boolean);
        const ranked = cleanedUnits
            .map((unit, index) => ({
                index,
                text: unit,
                score: scorePassageForQuestion(unit, keywords)
            }))
            .filter((item) => item.text)
            .sort((left, right) => right.score - left.score || left.index - right.index);

        const bestMatches = ranked
            .filter((item) => item.score > 0)
            .slice(0, 5);

        const excerpt = bestMatches.length
            ? bestMatches.map((item) => getExcerptWindow(cleanedUnits, item.index, 2)).join("\n\n---\n\n")
            : cleanedUnits.slice(0, 12).join("\n\n");
        return common.truncatePromptContent(excerpt, 8000) || "None.";
    }

    function buildFollowUpTaskLines(sourceType, intent) {
        const lines = [
            "Answer the user's follow-up question directly and clearly.",
            "Stay grounded in the provided material and clearly separate inference from source-backed claims.",
            "Use the summary and recent conversation to avoid repeating already-covered points unless they are needed for the answer.",
            "Lead with the direct answer, then support it with concise evidence from the source."
        ];

        if (intent === "compare") {
            lines.push("When the user is comparing ideas, explicitly state the important similarities, differences, and tradeoffs.");
        } else if (intent === "explain") {
            lines.push("Prefer a progressive explanation from simpler ideas to more technical detail.");
        } else if (intent === "critique") {
            lines.push("Prioritize assumptions, weaknesses, evidence quality, bias, and practical tradeoffs.");
        } else if (intent === "action") {
            lines.push("Turn the answer into practical next steps, decision guidance, or actionable implications when supported by the source.");
        } else {
            lines.push("Clarify ambiguous points and answer the specific question without drifting too far from the source.");
        }

        if (sourceType === "youtube") {
            lines.push("For YouTube answers, prefer timestamp-backed moments and preserve sequence when the question depends on chronology.");
        } else if (sourceType === "course") {
            lines.push("For course answers, emphasize definitions, misconceptions, what to retain, and what to study or practice next.");
        } else if (sourceType === "webpage") {
            lines.push("For webpage answers, trace important claims back to evidence or supporting context from the page.");
        } else if (sourceType === "selectedText") {
            lines.push("For selected text answers, stay tightly scoped to the excerpt and explain any needed context briefly.");
        } else if (sourceType === "pdf") {
            lines.push("For PDF or academic paper answers, ground claims in the extracted document text, including methodology, results, and stated limitations.");
        }

        return lines;
    }

    function buildSourceSpecificFollowUpGuidance(context, intent) {
        if (context.sourceType === "youtube") {
            return [
                "If the answer refers to moments in the video, cite only timestamps that appear in the provided transcript or metadata.",
                "Use chapter flow or transcript sequence when the question is about progression or narrative order.",
                intent === "compare" ? "If comparing segments of the video, name the timestamps or chapters that support each side." : ""
            ].filter(Boolean).join(" ");
        }
        if (context.sourceType === "course") {
            return [
                "Stay grounded in the lesson content.",
                "Preserve definitions, examples, and what a learner should understand next.",
                intent === "action" ? "If the question asks what to do next, turn the answer into study guidance or practice steps when supported." : ""
            ].filter(Boolean).join(" ");
        }
        if (context.sourceType === "selectedText") {
            return "Stay tightly grounded in the selected excerpt and explain ambiguous terms when useful.";
        }
        if (context.sourceType === "pdf") {
            return [
                "Stay grounded in the extracted PDF or academic paper.",
                "Preserve research questions, methods, quantitative results, and stated limitations.",
                intent === "critique" ? "If the paper does not support a claim, say so instead of filling the gap with outside literature." : ""
            ].filter(Boolean).join(" ");
        }
        return [
            "Trace important claims back to the provided source content and structure when relevant.",
            intent === "critique" ? "Call out missing evidence or unsupported leaps when the source does not fully justify a claim." : ""
        ].filter(Boolean).join(" ");
    }

        function buildSummaryPrompt(context, settings) {
        if (!context) {
            throw new Error("Cannot build summary prompt without context.");
        }
        
        // Force summarySize to 'deep' for deep modes so they get the 5 Deep sections
                const mode = String(settings.promptMode || "summarize").toLowerCase();
        const customPresets = Array.isArray(settings.customPromptPresets) ? settings.customPromptPresets : [];
        const activePreset = mode.startsWith("preset-") ? customPresets.find(p => p.id === mode) : null;
        if (activePreset) {
            settings.customSystemInstructions = activePreset.systemPrompt || "";
            settings.customPromptInstructions = activePreset.userPrompt || "";
        }
        const deepModes = new Set(["analyze", "explain", "study", "debate", "concepts"]);
        const patchedSettings = { ...settings };
        if (deepModes.has(mode) && patchedSettings.summarySize !== "brief") {
            patchedSettings.summarySize = "deep";
        }

        if (mode === "concepts") {
            return SummarizerCoursePromptTemplate.buildConceptsPrompt(context, patchedSettings);
        }
        if (context.sourceType === "youtube") {
            return SummarizerYoutubePromptTemplate.buildYoutubePrompt(context, patchedSettings);
        }
        if (context.sourceType === "course") {
            return SummarizerCoursePromptTemplate.buildCoursePrompt(context, patchedSettings);
        }
        if (context.sourceType === "selectedText") {
            return SummarizerSelectedTextPromptTemplate.buildSelectedTextPrompt(context, patchedSettings);
        }
        if (context.sourceType === "pdf") {
            return SummarizerPdfPromptTemplate.buildPdfPrompt(context, patchedSettings);
        }
        return SummarizerWebpagePromptTemplate.buildWebpagePrompt(context, patchedSettings);
    }

    function buildChunkSummaryPrompt(context, chunk, index, total, settings) {
                const mode = String(settings.promptMode || "summarize").toLowerCase();
        const customPresets = Array.isArray(settings.customPromptPresets) ? settings.customPromptPresets : [];
        const activePreset = mode.startsWith("preset-") ? customPresets.find(p => p.id === mode) : null;
        if (activePreset) {
            settings.customSystemInstructions = activePreset.systemPrompt || "";
            settings.customPromptInstructions = activePreset.userPrompt || "";
        }
        if (mode === "concepts") {
            return SummarizerCoursePromptTemplate.buildConceptsChunkPrompt(context, chunk, index, total, settings);
        }
        if (context.sourceType === "youtube") {
            return SummarizerYoutubePromptTemplate.buildYoutubeChunkPrompt(context, chunk, index, total, settings);
        }
        if (context.sourceType === "course") {
            return SummarizerCoursePromptTemplate.buildCourseChunkPrompt(context, chunk, index, total, settings);
        }
        if (context.sourceType === "pdf") {
            return SummarizerPdfPromptTemplate.buildPdfChunkPrompt(context, chunk, index, total, settings);
        }
        return SummarizerWebpagePromptTemplate.buildWebpageChunkPrompt(context, chunk, index, total, settings);
    }

    function buildSynthesisPrompt(context, chunkSummaries, settings) {
                const mode = String(settings.promptMode || "summarize").toLowerCase();
        const customPresets = Array.isArray(settings.customPromptPresets) ? settings.customPromptPresets : [];
        const activePreset = mode.startsWith("preset-") ? customPresets.find(p => p.id === mode) : null;
        if (activePreset) {
            settings.customSystemInstructions = activePreset.systemPrompt || "";
            settings.customPromptInstructions = activePreset.userPrompt || "";
        }
        if (mode === "concepts") {
            return SummarizerCoursePromptTemplate.buildConceptsSynthesisPrompt(context, chunkSummaries, settings);
        }
        if (context.sourceType === "youtube") {
            return SummarizerYoutubePromptTemplate.buildYoutubeSynthesisPrompt(context, chunkSummaries, settings);
        }
        if (context.sourceType === "course") {
            return SummarizerCoursePromptTemplate.buildCourseSynthesisPrompt(context, chunkSummaries, settings);
        }
        if (context.sourceType === "pdf") {
            return SummarizerPdfPromptTemplate.buildPdfSynthesisPrompt(context, chunkSummaries, settings);
        }
        return SummarizerWebpagePromptTemplate.buildWebpageSynthesisPrompt(context, chunkSummaries, settings);
    }

    function buildDeepDivePrompt(context, question, settings) {
        const common = SummarizerPromptCommon;
        const conversation = Array.isArray(context.conversationHistory)
            ? context.conversationHistory.slice(-6)
            : [];
        const modeHint = common.getModeSpecificHint(common.getPromptMode(settings), settings);
        const intent = detectFollowUpIntent(question);
        const sourceSpecificGuidance = buildSourceSpecificFollowUpGuidance(context, intent);
        const relevantExcerpt = selectRelevantSourceExcerpt(context, question, common);

        return common.buildPromptEnvelope({
            role: "You are answering a follow-up question about previously summarized source material.",
            sourceType: context.sourceType || "webpage",
            settings,
            customInstructions: settings.customPromptInstructions || "",
            customSystemInstructions: settings.customSystemInstructions || "",
            modeHint,
            sourceContext: [
                `Current mode: ${common.getPromptMode(settings)}.`,
                `Detected follow-up intent: ${intent}.`,
                `Title: ${context.title}`,
                `URL: ${context.url}`,
                "Reuse the current summary, source content, and recent follow-up context when relevant.",
                sourceSpecificGuidance
            ],
            task: buildFollowUpTaskLines(context.sourceType || "webpage", intent),
            sectionPlan: common.buildInternalSectionPlan("deepDive"),
            detailsSection: [
                context.videoDetails && context.sourceType === "youtube"
                    ? "=== VIDEO DETAILS ==="
                    : "",
                context.videoDetails && context.sourceType === "youtube"
                    ? common.buildYoutubeMetadataBlock(context)
                    : "",
                "=== CURRENT SUMMARY CONTEXT ===",
                `Main Summary: ${common.cleanPromptValue(context.summary) || "None."}`,
                `Executive Takeaways:\n${(context.keyTakeaways || []).map((item) => `- ${item}`).join("\n") || "None."}`,
                `Complete Guided Walkthrough:\n${common.cleanPromptValue(context.detailedBreakdown) || common.cleanPromptValue(context.mainPoints) || "None."}`,
                `Video Journey / Legacy Timeline:\n${common.cleanPromptValue(context.detailsOfVideo) || "None."}`,
                `Concepts, Definitions & Mental Models:\n${common.cleanPromptValue(context.conceptMapAndPrerequisites) || "None."}`,
                `Reasoning, Evidence & Claim Audit:\n${common.cleanPromptValue(context.evidenceAndDetails) || "None."}`,
                `Connections, Causes & Tradeoffs:\n${common.cleanPromptValue(context.argumentAndInsight) || common.cleanPromptValue(context.causalAndKnowledgeFlow) || "None."}`,
                `Practical Application:\n${common.cleanPromptValue(context.practicalSteps) || "None."}`,
                `Caveats, Biases & Open Questions:\n${common.cleanPromptValue(context.expertCommentary) || common.cleanPromptValue(context.perspectivesAndUncertainty) || "None."}`,
                `Memory & Review Kit:\n${common.cleanPromptValue(context.reviewKit) || "None."}`,
                conversation.length
                    ? `Recent Follow-up History:\n${common.renderConversationHistory(conversation, 6)}`
                    : "Recent Follow-up History:\nNone.",
                `User Question: ${question}`
            ].filter(Boolean),
            contentSection: [
                "=== MOST RELEVANT SOURCE EXCERPTS ===",
                relevantExcerpt,
                "",
                "=== SOURCE CONTENT ===",
                common.truncatePromptContent(context.sourceContentRaw || context.sourceContent || "", 6000)
            ]
        });
    }

    globalThis.SummarizerPromptBuilders = {
        buildSummaryPrompt,
        buildChunkSummaryPrompt,
        buildSynthesisPrompt,
        buildDeepDivePrompt
    };
})();
