(function () {
    function buildYoutubeSectionPlan(settings, context) {
        const common = SummarizerPromptCommon;
        const modeInstructions = common.getModeInstructions(common.getPromptMode(settings));
        const sourceText = (context && (context.contentForPrompt || context.content || context.sourceContent)) || "";
        return common.applyModeToSectionPlan(
            common.getSummarySectionPlan("youtube", settings, sourceText),
            modeInstructions
        );
    }

    function buildYoutubePrompt(context, settings) {
        const common = SummarizerPromptCommon;
        const sourceHint = common.getSourceSpecificHint("youtube", settings);
        const modeHint = common.getModeSpecificHint(common.getPromptMode(settings), settings);
        const customInstructions = settings.customPromptInstructions || "";
        const customSystemInstructions = settings.customSystemInstructions || "";
        const modeInstructions = common.getModeInstructions(common.getPromptMode(settings));
        const transcriptForPrompt = context.contentForPrompt || context.content || "";

        return common.buildPromptEnvelope({
            role: "You are an expert content summarizer specializing in YouTube video transcripts.",
            sourceType: "youtube",
            settings,
            fullContext: context,
            structuralRules: modeInstructions.structuralRules,
            customInstructions,
            customSystemInstructions,
            taskAugmentations: modeInstructions.taskAugmentations,
            sourceHint,
            sourceHintLabel: "YouTube-specific guidance",
            modeHint,
            sourceContext: [
                "Source: YouTube video transcript",
                "Format: Timestamped video transcript with optional chapters and metadata",
                "Use only timestamps that appear in the provided transcript or chapter metadata.",
                "If the transcript contains chapter markers, structure your summary around them."
            ],
            task: [
                modeInstructions.primaryGoal,
                "Focus on main topics, supporting evidence, important examples, technical details, and practical applications.",
                "Preserve important names, numbers, terms, and examples.",
                "Remove filler and repetition, but do not lose important context.",
                "When the transcript is ambiguous or incomplete, say so instead of inventing missing transitions or scenes.",
                "The output should let a user understand the video without watching it, while remaining strictly faithful to the transcript."
            ],
            sectionPlan: buildYoutubeSectionPlan(settings, context),
            detailsSection: [
                "=== VIDEO DETAILS ===",
                common.buildYoutubeMetadataBlock(context)
            ],
            contentSection: [
                "=== TRANSCRIPT ===",
                transcriptForPrompt
            ]
        });
    }

    function buildYoutubeChunkPrompt(context, chunk, index, total, settings) {
        const common = SummarizerPromptCommon;
        const modeInstructions = common.getModeInstructions(common.getPromptMode(settings));

        return common.buildPromptEnvelope({
            role: "You are summarizing one chunk of a long YouTube transcript for later synthesis.",
            sourceType: "youtube",
            settings,
            fullContext: context,
            structuralRules: modeInstructions.structuralRules,
            taskAugmentations: modeInstructions.taskAugmentations,
            sourceContext: [
                `Chunk label: ${common.buildChunkHeader("YouTube transcript", index, total)}.`,
                "Summarize only this chunk. Preserve timestamps, transitions, examples, names, numbers, and technical details.",
                "Use only timestamps that appear in this chunk."
            ],
            task: [
                modeInstructions.primaryGoal,
                "Capture the key content of this chunk so a later synthesis pass can combine it without losing timeline flow."
            ],
            sectionPlan: common.buildInternalSectionPlan("youtubeChunk"),
            detailsSection: [
                "=== VIDEO DETAILS ===",
                common.buildYoutubeMetadataBlock(context)
            ],
            contentSection: [
                "=== CHUNK TRANSCRIPT ===",
                chunk
            ]
        });
    }

    function buildYoutubeSynthesisPrompt(context, chunkSummaries, settings) {
        const common = SummarizerPromptCommon;
        const modeInstructions = common.getModeInstructions(common.getPromptMode(settings));

        return common.buildPromptEnvelope({
            role: "You are synthesizing chunk summaries from a long YouTube transcript into one final answer.",
            sourceType: "youtube",
            settings,
            fullContext: context,
            structuralRules: modeInstructions.structuralRules,
            taskAugmentations: modeInstructions.taskAugmentations,
            sourceContext: [
                "Source: Chunk summaries from one YouTube transcript.",
                "Combine them into one cohesive final summary without losing the overall flow of the video."
            ],
            task: [
                modeInstructions.primaryGoal,
                "These chunks appear sequentially in the source. Treat each chunk summary as an authoritative coverage record.",
                "Collect every unique claim, definition, example, name, number, step, and caveat across all chunks before building the walkthrough.",
                "First reconcile the chunks into an internal timeline coverage ledger: timestamp range, topic, claim, supporting detail, example, transition, qualification, and unresolved conflict.",
                "Do not discard a detail from one chunk merely because another chunk contains a broader summary of the same topic.",
                "Do not collapse multiple examples, demonstrations, or transcript segments into generic phrases.",
                "Explicitly weave overlapping narrative or logical arcs together instead of just pasting them side-by-side.",
                "Preserve timeline structure for major segments.",
                "Merge overlapping chunk content without deleting distinct details, evidence, or examples.",
                "If chunk summaries appear to conflict or leave gaps, preserve that uncertainty instead of inventing continuity.",
                "Before finalizing, verify that every chunk and every meaningful timestamp range contributed to the final timeline or walkthrough.",
                "Only describe transitions or chronology that are supported by the chunk summaries.",
                "The final output must follow the section contract (new canonical layout). Avoid generic deep cards produced by chunk stitchers."
            ],
            sectionPlan: buildYoutubeSectionPlan(settings, context),
            detailsSection: [
                "=== VIDEO DETAILS ===",
                common.buildYoutubeMetadataBlock(context)
            ],
            contentSection: [
                "=== CHUNK SUMMARIES TO COMBINE ===",
                chunkSummaries.map((item, summaryIndex) => `### Chunk ${summaryIndex + 1}\n${item}`).join("\n\n")
            ]
        });
    }

    globalThis.SummarizerYoutubePromptTemplate = {
        buildYoutubePrompt,
        buildYoutubeChunkPrompt,
        buildYoutubeSynthesisPrompt
    };
})();
