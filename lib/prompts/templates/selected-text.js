(function () {
    function buildSelectedTextSectionPlan(settings, context) {
        const common = SummarizerPromptCommon;
        const modeInstructions = common.getModeInstructions(common.getPromptMode(settings));
        const sourceText = (context && (context.contentForPrompt || context.content || context.sourceContent)) || "";
        return common.applyModeToSectionPlan(
            common.getSummarySectionPlan("selectedText", settings, sourceText),
            modeInstructions
        );
    }

    function buildSelectedTextPrompt(context, settings) {
        const common = SummarizerPromptCommon;
        const sourceHint = common.getSourceSpecificHint("selectedText", settings);
        const modeHint = common.getModeSpecificHint(common.getPromptMode(settings), settings);
        const customInstructions = settings.customPromptInstructions || "";
        const customSystemInstructions = settings.customSystemInstructions || "";
        const modeInstructions = common.getModeInstructions(common.getPromptMode(settings));

        return common.buildPromptEnvelope({
            role: "You are an Expert Analyzer of selected text excerpts.",
            sourceType: "selectedText",
            settings,
            fullContext: context,
            structuralRules: modeInstructions.structuralRules,
            customInstructions,
            customSystemInstructions,
            taskAugmentations: modeInstructions.taskAugmentations,
            sourceHint,
            sourceHintLabel: "Text-specific guidance",
            modeHint,
            sourceContext: [
                "Source: User-selected text excerpt"
            ],
            task: [
                modeInstructions.primaryGoal,
                "Preserve the author's meaning, then add useful context, explanation, or analysis.",
                "Keep any added context brief and tightly anchored to the excerpt.",
                "Do not expand into a page-level or topic-level summary unless the excerpt itself clearly requires that context.",
                "If important surrounding context is not in the excerpt, say so instead of inventing it.",
                "The output should let a reader understand the selected passage without needing to visit the original full context."
            ],
            sectionPlan: buildSelectedTextSectionPlan(settings, context),
            detailsSection: [
                "=== EXCERPT DETAILS ===",
                `Source title: ${context.title}`,
                `Source URL: ${context.url}`
            ],
            contentSection: [
                "=== SELECTED TEXT ===",
                context.content
            ]
        });
    }

    globalThis.SummarizerSelectedTextPromptTemplate = {
        buildSelectedTextPrompt
    };
})();
