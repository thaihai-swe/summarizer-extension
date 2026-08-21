(function () {
    function buildWebpageSectionPlan(settings, context) {
        const common = SummarizerPromptCommon;
        const modeInstructions = common.getModeInstructions(common.getPromptMode(settings));
        const sourceText = (context && (context.contentForPrompt || context.content || context.sourceContent)) || "";
        return common.applyModeToSectionPlan(
            common.getSummarySectionPlan("webpage", settings, sourceText),
            modeInstructions
        );
    }

    function buildWebpagePrompt(context, settings) {
        const common = SummarizerPromptCommon;
        const sourceHint = common.getSourceSpecificHint("webpage", settings);
        const modeHint = common.getModeSpecificHint(common.getPromptMode(settings), settings);
        const customInstructions = settings.customPromptInstructions || "";
        const customSystemInstructions = settings.customSystemInstructions || "";
        const modeInstructions = common.getModeInstructions(common.getPromptMode(settings));

        return common.buildPromptEnvelope({
            role: "You are an Expert Deep Summarizer specializing in web content analysis.",
            sourceType: "webpage",
            settings,
            fullContext: context,
            structuralRules: modeInstructions.structuralRules,
            customInstructions,
            customSystemInstructions,
            taskAugmentations: modeInstructions.taskAugmentations,
            sourceHint,
            sourceHintLabel: "Webpage-specific guidance",
            modeHint,
            sourceContext: [
                "Source: Full webpage or site content",
                "May include primary content, supporting sections, and useful on-page context."
            ],
            task: [
                modeInstructions.primaryGoal,
                "Focus on main arguments, important facts, evidence, conclusions, and useful context from the page.",
                "If the page leaves a claim under-supported, note that gap instead of filling it with outside knowledge.",
                "The output should let a user understand the page without reading the original, while remaining strictly faithful to the extracted content."
            ],
            sectionPlan: buildWebpageSectionPlan(settings, context),
            detailsSection: [
                "=== PAGE DETAILS ===",
                `Title: ${context.title}`,
                `URL: ${context.url}`
            ],
            contentSection: [
                "=== CONTENT ===",
                context.content
            ]
        });
    }

    function buildWebpageChunkPrompt(context, chunk, index, total, settings) {
        const common = SummarizerPromptCommon;
        const modeInstructions = common.getModeInstructions(common.getPromptMode(settings));

        return common.buildPromptEnvelope({
            role: "You are summarizing one chunk of a long webpage or document for later synthesis.",
            sourceType: "webpage",
            settings,
            fullContext: context,
            structuralRules: modeInstructions.structuralRules,
            taskAugmentations: modeInstructions.taskAugmentations,
            sourceContext: [
                `Chunk label: ${common.buildChunkHeader("Webpage", index, total)}.`,
                "Summarize only this chunk and preserve claims, evidence, examples, names, numbers, and useful context."
            ],
            task: [
                modeInstructions.primaryGoal,
                "Do not optimize for brevity if it would lose important information needed for final synthesis."
            ],
            sectionPlan: common.buildInternalSectionPlan("webpageChunk"),
            detailsSection: [
                "=== PAGE DETAILS ===",
                `Title: ${context.title}`,
                `URL: ${context.url}`
            ],
            contentSection: [
                "=== CHUNK CONTENT ===",
                chunk
            ]
        });
    }

    function buildWebpageSynthesisPrompt(context, chunkSummaries, settings) {
        const common = SummarizerPromptCommon;
        const modeInstructions = common.getModeInstructions(common.getPromptMode(settings));

        return common.buildPromptEnvelope({
            role: "You are synthesizing chunk summaries from a long webpage or document into one final answer.",
            sourceType: "webpage",
            settings,
            fullContext: context,
            structuralRules: modeInstructions.structuralRules,
            taskAugmentations: modeInstructions.taskAugmentations,
            sourceContext: [
                "Source: Chunk summaries from one webpage or document.",
                "Combine them into a cohesive final summary while preserving argument structure, evidence, and nuance."
            ],
            task: [
                modeInstructions.primaryGoal,
                "These chunks appear sequentially in the source. Treat each chunk summary as an authoritative coverage record.",
                "Collect every unique claim, definition, example, name, number, step, and caveat across all chunks before building the walkthrough.",
                "First reconcile the chunks into an internal coverage ledger: source heading, claim, supporting detail, example, procedure step, qualification, and unresolved conflict.",
                "Do not discard a detail from one chunk merely because another chunk contains a broader summary of the same topic.",
                "Do not collapse lists, examples, or steps into category-level language such as 'several examples' or 'various factors'.",
                "Explicitly weave overlapping narrative or logical arcs together instead of just pasting them side-by-side.",
                "Produce one final answer that reads as a complete summary rather than stitched chunk notes.",
                "Merge overlapping chunk content without deleting distinct details, evidence, or examples.",
                "If chunk summaries conflict, preserve the disagreement or uncertainty instead of resolving it by invention.",
                "Before finalizing, verify that every chunk contributed at least one supported detail and that every major source heading is represented in the walkthrough.",
                "Keep the final structure faithful to the evidence and topic flow found across the chunk summaries.",
                "The final output must follow the section contract (canonical learning-first layout), not a generic chunk stitcher plan."
            ],
            sectionPlan: buildWebpageSectionPlan(settings, context),
            detailsSection: [
                "=== PAGE DETAILS ===",
                `Title: ${context.title}`,
                `URL: ${context.url}`
            ],
            contentSection: [
                "=== CHUNK SUMMARIES TO COMBINE ===",
                chunkSummaries.map((item, summaryIndex) => `### Chunk ${summaryIndex + 1}\n${item}`).join("\n\n")
            ]
        });
    }

    globalThis.SummarizerWebpagePromptTemplate = {
        buildWebpagePrompt,
        buildWebpageChunkPrompt,
        buildWebpageSynthesisPrompt
    };
})();
