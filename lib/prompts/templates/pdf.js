(function () {
    function buildPdfSectionPlan(settings, context) {
        const common = SummarizerPromptCommon;
        const modeInstructions = common.getModeInstructions(common.getPromptMode(settings));
        const sourceText = (context && (context.contentForPrompt || context.content || context.sourceContent)) || "";
        return common.applyModeToSectionPlan(
            common.getSummarySectionPlan("pdf", settings, sourceText),
            modeInstructions
        );
    }

    function buildPdfPrompt(context, settings) {
        const common = SummarizerPromptCommon;
        const sourceHint = common.getSourceSpecificHint("pdf", settings);
        const modeHint = common.getModeSpecificHint(common.getPromptMode(settings), settings);
        const customInstructions = settings.customPromptInstructions || "";
        const customSystemInstructions = settings.customSystemInstructions || "";
        const modeInstructions = common.getModeInstructions(common.getPromptMode(settings));

        const isAcademic = Boolean(context.isAcademic || (context.url && /arxiv|doi|pubmed|openreview|ieee/i.test(context.url)));

        const taskInstructions = isAcademic ? [
            modeInstructions.primaryGoal,
            "Analyze this academic research paper or technical document with rigorous precision.",
            "Clearly distinguish between the author's primary research question, the core methodology / novel mechanism, empirical benchmark results, and stated limitations or failure modes.",
            "Do not introduce outside claims or inflate benchmark results beyond what the paper presents.",
            "The output should allow a researcher or technical reader to evaluate the paper's contribution and experimental validity without needing to reread the full text."
        ] : [
            modeInstructions.primaryGoal,
            "Analyze this PDF document with clarity and structural fidelity.",
            "Preserve page references, chapter/section flows, key arguments, tables, and quantitative findings.",
            "The output should provide a comprehensive and trustworthy substitute for reading the full document."
        ];

        return common.buildPromptEnvelope({
            role: isAcademic ? "You are a Principal AI & Systems Research Scientist specializing in academic paper peer reviews and deep technical synthesis." : "You are an Expert Deep Document Summarizer specializing in complex multi-page PDF documents.",
            sourceType: "pdf",
            settings,
            fullContext: context,
            structuralRules: modeInstructions.structuralRules,
            customInstructions,
            customSystemInstructions,
            taskAugmentations: modeInstructions.taskAugmentations,
            sourceHint,
            sourceHintLabel: isAcademic ? "Academic paper guidance" : "PDF document guidance",
            modeHint,
            sourceContext: [
                isAcademic ? "Source: Academic research paper or preprint (e.g., arXiv/PubMed/OpenReview)" : "Source: Multi-page PDF document",
                "Contains technical text, empirical findings, and structured sections."
            ],
            task: taskInstructions,
            sectionPlan: buildPdfSectionPlan(settings, context),
            detailsSection: [
                "=== DOCUMENT DETAILS ===",
                `Title: ${context.title}`,
                `URL: ${context.url}`
            ],
            contentSection: [
                "=== DOCUMENT CONTENT ===",
                context.content
            ]
        });
    }

    function buildPdfChunkPrompt(context, chunk, index, total, settings) {
        const common = SummarizerPromptCommon;
        const modeInstructions = common.getModeInstructions(common.getPromptMode(settings));

        return common.buildPromptEnvelope({
            role: "You are summarizing one chunk of a technical PDF or academic paper for subsequent synthesis.",
            sourceType: "pdf",
            settings,
            fullContext: context,
            structuralRules: modeInstructions.structuralRules,
            taskAugmentations: modeInstructions.taskAugmentations,
            sourceContext: [
                `Chunk label: ${common.buildChunkHeader("PDF/Paper", index, total)}.`,
                "Summarize this chunk preserving mathematical definitions, empirical findings, methodology details, and page references."
            ],
            task: [
                modeInstructions.primaryGoal,
                "Do not omit quantitative figures, benchmark percentages, or architectural details needed for final synthesis."
            ],
            sectionPlan: common.buildInternalSectionPlan("webpageChunk"),
            detailsSection: [
                "=== DOCUMENT DETAILS ===",
                `Title: ${context.title}`,
                `URL: ${context.url}`
            ],
            contentSection: [
                "=== CHUNK CONTENT ===",
                chunk
            ]
        });
    }

    function buildPdfSynthesisPrompt(context, chunkSummaries, settings) {
        const common = SummarizerPromptCommon;
        const modeInstructions = common.getModeInstructions(common.getPromptMode(settings));

        return common.buildPromptEnvelope({
            role: "You are synthesizing chunk summaries from an academic paper or PDF document into one unified research-grade analysis.",
            sourceType: "pdf",
            settings,
            fullContext: context,
            structuralRules: modeInstructions.structuralRules,
            taskAugmentations: modeInstructions.taskAugmentations,
            sourceContext: [
                "Source: Sequential chunk summaries from a PDF or academic paper.",
                "Synthesize into an authoritative, structured reading brief."
            ],
            task: [
                modeInstructions.primaryGoal,
                "Unify the theoretical motivation, experimental setup, baseline comparisons, and ablation studies across all chunks.",
                "Ensure every unique finding, benchmark result, and stated limitation is integrated into the final sections.",
                "Follow the canonical section contract strictly."
            ],
            sectionPlan: buildPdfSectionPlan(settings, context),
            detailsSection: [
                "=== DOCUMENT DETAILS ===",
                `Title: ${context.title}`,
                `URL: ${context.url}`
            ],
            contentSection: [
                "=== CHUNK SUMMARIES TO COMBINE ===",
                chunkSummaries.map((item, summaryIndex) => `### Chunk ${summaryIndex + 1}\n${item}`).join("\n\n")
            ]
        });
    }

    globalThis.SummarizerPdfPromptTemplate = {
        buildPdfPrompt,
        buildPdfChunkPrompt,
        buildPdfSynthesisPrompt
    };
})();
