(function () {
    function buildCourseSectionPlan(settings, context) {
        const common = SummarizerPromptCommon;
        const modeInstructions = common.getModeInstructions(common.getPromptMode(settings));
        const sourceText = (context && (context.contentForPrompt || context.content || context.sourceContent)) || "";
        return common.applyModeToSectionPlan(
            common.getSummarySectionPlan("course", settings, sourceText),
            modeInstructions
        );
    }

    function buildCoursePrompt(context, settings) {
        const common = SummarizerPromptCommon;
        const sourceHint = common.getSourceSpecificHint("course", settings);
        const modeHint = common.getModeSpecificHint(common.getPromptMode(settings), settings);
        const customInstructions = settings.customPromptInstructions || "";
        const customSystemInstructions = settings.customSystemInstructions || "";
        const modeInstructions = common.getModeInstructions(common.getPromptMode(settings));

        return common.buildPromptEnvelope({
            role: "You are an expert learning-content summarizer specializing in course lessons, transcripts, and instructional material.",
            sourceType: "course",
            settings,
            fullContext: context,
            structuralRules: modeInstructions.structuralRules,
            customInstructions,
            customSystemInstructions,
            taskAugmentations: modeInstructions.taskAugmentations,
            sourceHint,
            sourceHintLabel: "Course-specific guidance",
            modeHint,
            sourceContext: [
                "Source: Course lesson or course transcript",
                "Treat the content as educational material and preserve definitions, explanations, examples, and learner-relevant takeaways."
            ],
            task: [
                modeInstructions.primaryGoal,
                "Preserve the core teaching flow, important examples, terminology, and what the learner should understand or retain.",
                "If the lesson skips steps or assumes prior knowledge, label that missing context instead of inventing it.",
                "The output should let a learner study the lesson without reopening the original page, while remaining strictly source-faithful."
            ],
            sectionPlan: buildCourseSectionPlan(settings, context),
            detailsSection: [
                "=== LESSON DETAILS ===",
                `Title: ${context.title}`,
                `URL: ${context.url}`
            ],
            contentSection: [
                "=== LESSON CONTENT ===",
                context.content
            ]
        });
    }

    function buildCourseChunkPrompt(context, chunk, index, total, settings) {
        const common = SummarizerPromptCommon;
        const modeInstructions = common.getModeInstructions(common.getPromptMode(settings));

        return common.buildPromptEnvelope({
            role: "You are summarizing one chunk of a long course lesson or transcript for later synthesis.",
            sourceType: "course",
            settings,
            fullContext: context,
            structuralRules: modeInstructions.structuralRules,
            taskAugmentations: modeInstructions.taskAugmentations,
            sourceContext: [
                `Chunk label: ${common.buildChunkHeader("Course lesson", index, total)}.`,
                "Summarize only this chunk and preserve definitions, examples, instructional steps, names, numbers, and what a learner should retain."
            ],
            task: [
                modeInstructions.primaryGoal,
                "Capture the chunk clearly enough that a later synthesis pass can reconstruct the lesson flow."
            ],
            sectionPlan: common.buildInternalSectionPlan("courseChunk"),
            detailsSection: [
                "=== LESSON DETAILS ===",
                `Title: ${context.title}`,
                `URL: ${context.url}`
            ],
            contentSection: [
                "=== CHUNK CONTENT ===",
                chunk
            ]
        });
    }

    function buildCourseSynthesisPrompt(context, chunkSummaries, settings) {
        const common = SummarizerPromptCommon;
        const modeInstructions = common.getModeInstructions(common.getPromptMode(settings));

        return common.buildPromptEnvelope({
            role: "You are synthesizing chunk summaries from a long course lesson into one final answer.",
            sourceType: "course",
            settings,
            fullContext: context,
            structuralRules: modeInstructions.structuralRules,
            taskAugmentations: modeInstructions.taskAugmentations,
            sourceContext: [
                "Source: Chunk summaries from one course lesson or transcript.",
                "Combine them into a cohesive learning-oriented final summary."
            ],
            task: [
                modeInstructions.primaryGoal,
                "These chunks appear sequentially in the source. Treat each chunk summary as an authoritative coverage record.",
                "Collect every unique claim, definition, example, name, number, step, and caveat across all chunks before building the walkthrough.",
                "Do not discard a detail from one chunk merely because another chunk contains a broader summary of the same topic.",
                "Explicitly weave overlapping narrative or logical arcs together instead of just pasting them side-by-side.",
                "Preserve instructional flow, key concepts, examples, and learner-relevant takeaways.",
                "Merge overlapping chunk content without deleting distinct details, evidence, or examples.",
                "If chunk summaries conflict or omit connective steps, preserve that uncertainty instead of inventing lesson flow.",
                "Favor accurate reconstruction of the teaching sequence over polished but unsupported transitions.",
                "The final output must follow the section contract (canonical learning-first layout), not a generic chunk stitcher plan."
            ],
            sectionPlan: buildCourseSectionPlan(settings, context),
            detailsSection: [
                "=== LESSON DETAILS ===",
                `Title: ${context.title}`,
                `URL: ${context.url}`
            ],
            contentSection: [
                "=== CHUNK SUMMARIES TO COMBINE ===",
                chunkSummaries.map((item, summaryIndex) => `### Chunk ${summaryIndex + 1}\n${item}`).join("\n\n")
            ]
        });
    }

    // ========================================================================
    // COURSE CONCEPTS MODE — Deep concept extraction for learning
    // ========================================================================
    function buildConceptsSectionPlan(settings) {
        return [
            { key: "conceptMap", heading: "Concept Map", instruction: "Create a hierarchical concept map showing how core concepts relate to each other. Group into Core Concepts, Important Concepts, and Supporting Concepts. Include prerequisites for each core concept.", options: { bulletOnly: false } },
            { key: "coreDefinitions", heading: "Core Definitions", instruction: "Provide precise, technical definitions for each Core Concept identified in the concept map. Include the formal definition and a plain-language equivalent.", options: { bulletOnly: false } },
            { key: "prerequisitesMisconceptions", heading: "Prerequisites & Misconceptions", instruction: "List prerequisites needed before learning this material. Add common misconceptions and how to address them.", options: { bulletOnly: false } },
            { key: "practicalSteps", heading: "Practical Steps", instruction: "Extract step-by-step procedures, algorithms, or workflows taught in the lesson. Present as numbered sequences with context.", options: { bulletOnly: false } },
            { key: "pitfallsWarnings", heading: "Pitfalls & Warnings", instruction: "Identify common mistakes, edge cases, anti-patterns, and things to avoid. Explain why each is a pitfall.", options: { bulletOnly: false } },
            { key: "resourcesTools", heading: "Resources & Tools", instruction: "List tools, libraries, frameworks, documentation, or external resources mentioned or implied. Include version-specific notes when relevant.", options: { bulletOnly: false } }
        ];
    }

    function buildConceptsPrompt(context, settings) {
        const common = SummarizerPromptCommon;
        const sourceHint = common.getSourceSpecificHint("course", settings);
        const modeHint = common.getModeSpecificHint("concepts", settings);
        const customInstructions = settings.customPromptInstructions || "";
        const customSystemInstructions = settings.customSystemInstructions || "";
        const conceptsPromptHint = settings.conceptsPromptHint || "";

        return common.buildPromptEnvelope({
            role: "You are a technical course analyst and knowledge architect. Your expertise lies in deconstructing complex educational content into a structured, hierarchical learning path that enables deep understanding and practical application.",
            sourceType: "course",
            settings,
            fullContext: context,
            structuralRules: [],
            customInstructions,
            customSystemInstructions,
            taskAugmentations: [
                "Identify and extract ALL important technical concepts from the content (typically 10-30+ for substantial lessons).",
                "Provide deep, accurate explanations using professional knowledge that goes beyond the provided transcript.",
                "Organize concepts logically, highlighting their relationships to build a comprehensive knowledge map.",
                "Create practical, real-world examples and identify common pitfalls to aid in application.",
                "Prioritize technical accuracy and depth over brevity."
            ],
            sourceHint,
            sourceHintLabel: "Course-specific guidance",
            modeHint,
            sourceContext: [
                "Source: Course lesson or transcript for concept extraction",
                "Treat the content as authoritative educational material. Extract concepts, definitions, procedures, and relationships with precision."
            ],
            task: [
                "Analyze the content to identify and explain key technical concepts in a comprehensive and structured way.",
                "Follow the CONCEPT_ANALYSIS_PROCESS exactly.",
                "Output must use the exact section headings specified in the section contract."
            ],
            sectionPlan: buildConceptsSectionPlan(settings),
            detailsSection: [
                "=== LESSON DETAILS ===",
                `Title: ${context.title}`,
                `URL: ${context.url}`,
                "",
                "=== CONCEPT ANALYSIS PROCESS ===",
                "1. IDENTIFY: Find ALL important technical concepts from the content (typically 10-30+ concepts for substantial lessons)",
                "2. DEEP DIVE: Use professional knowledge for comprehensive explanations (not just transcript-based)",
                "3. PRIORITIZE: Categorize concepts by importance — Core (3-8), Important (5-12), Supporting (remaining)",
                "4. CONNECT: Highlight relationships between concepts to create a learning map",
                "5. STRUCTURE: Organize using the required format for each tier",
                "6. PRACTICAL: Include examples, pitfalls, and practice suggestions",
                "",
                "=== CONCEPT PRIORITIZATION ===",
                "🔥 Core Concepts (3-8): Fundamental concepts requiring deep explanation",
                "⭐ Important Concepts (5-12): Key supporting concepts needing solid understanding",
                "📚 Supporting Concepts (remaining): Additional terms worth knowing",
                "",
                "Use the exact top-level headings in the section contract. Use `###` and deeper subheadings inside those sections for individual concepts, definitions, examples, and relationships."
            ],
            contentSection: [
                "=== LESSON CONTENT ===",
                context.content,
                "",
                conceptsPromptHint ? `Concept-mode guidance: ${conceptsPromptHint}` : ""
            ].filter(Boolean)
        });
    }

    function buildConceptsChunkPrompt(context, chunk, index, total, settings) {
        const common = SummarizerPromptCommon;

        return common.buildPromptEnvelope({
            role: "You are extracting key concepts from one chunk of a long course lesson for later synthesis into a comprehensive concept map.",
            sourceType: "course",
            settings,
            fullContext: context,
            structuralRules: [],
            sourceContext: [
                `Chunk label: ${common.buildChunkHeader("Course lesson", index, total)}.`,
                "Extract all technical concepts, definitions, procedures, and relationships from this chunk only."
            ],
            task: [
                "Identify every technical concept, term, procedure, and relationship in this chunk.",
                "Preserve enough context that a later synthesis can reconstruct the full concept hierarchy."
            ],
            sectionPlan: common.buildInternalSectionPlan("courseChunk"),
            detailsSection: [
                "=== LESSON DETAILS ===",
                `Title: ${context.title}`,
                `URL: ${context.url}`
            ],
            contentSection: [
                "=== CHUNK CONTENT ===",
                chunk
            ]
        });
    }

    function buildConceptsSynthesisPrompt(context, chunkSummaries, settings) {
        const common = SummarizerPromptCommon;

        return common.buildPromptEnvelope({
            role: "You are synthesizing concept extractions from multiple chunks of a course lesson into one comprehensive concept map.",
            sourceType: "course",
            settings,
            fullContext: context,
            structuralRules: [],
            sourceContext: [
                "Source: Concept extractions from sequential chunks of one course lesson.",
                "Combine into a single coherent concept map with deduplicated concepts and explicit relationships."
            ],
            task: [
                "Merge all concept extractions into one comprehensive concept map.",
                "Deduplicate concepts across chunks, preserving the most complete definition and examples.",
                "Explicitly map relationships between concepts from different chunks.",
                "Prioritize concepts by importance: Core, Important, Supporting.",
                "Follow the exact output format required for the Concepts mode."
            ],
            sectionPlan: buildConceptsSectionPlan(settings),
            detailsSection: [
                "=== LESSON DETAILS ===",
                `Title: ${context.title}`,
                `URL: ${context.url}`
            ],
            contentSection: [
                "=== CHUNK CONCEPT EXTRACTIONS TO COMBINE ===",
                chunkSummaries.map((item, summaryIndex) => `### Chunk ${summaryIndex + 1}\n${item}`).join("\n\n")
            ]
        });
    }

    globalThis.SummarizerCoursePromptTemplate = {
        buildCoursePrompt,
        buildCourseChunkPrompt,
        buildCourseSynthesisPrompt,
        buildConceptsPrompt,
        buildConceptsChunkPrompt,
        buildConceptsSynthesisPrompt
    };
})();
