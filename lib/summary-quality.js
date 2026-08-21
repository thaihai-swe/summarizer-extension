(function () {
    /**
     * Summary quality gate.
     * Scores structured summary results and identifies weak/missing sections.
     * Used for Deep/Long modes to trigger targeted repair.
     */

    const MIN_SECTION_CHARS = {
        Brief: 40,
        Medium: 80,
        Deep: 160
    };

    const MIN_TAKEAWAYS = {
        Brief: 2,
        Medium: 3,
        Deep: 4
    };

    const MIN_FOLLOWUPS = {
        Brief: 0,
        Medium: 2,
        Deep: 3
    };

    // Canonical section keys used by cleaners + render
    const CANONICAL_SECTIONS = [
        "summary",
        "keyTakeaways",
        "detailsOfVideo",
        "detailedBreakdown",
        "conceptMapAndPrerequisites",
        "evidenceAndDetails",
        "argumentAndInsight",
        "practicalSteps",
        "expertCommentary",
        "reviewKit",
        "followUpQuestions",
        // legacy / mode-specific
        "mainPoints",
        "causalAndKnowledgeFlow",
        "perspectivesAndUncertainty",
        "conceptMap",
        "coreDefinitions",
        "prerequisitesMisconceptions",
        "pitfallsWarnings",
        "resourcesTools"
    ];

    const SECTION_LABELS = {
        summary: "Main Summary",
        keyTakeaways: "Executive Takeaways",
        detailsOfVideo: "Details of the Video",
        detailedBreakdown: "Complete Guided Walkthrough",
        conceptMapAndPrerequisites: "Concepts, Definitions & Mental Models",
        evidenceAndDetails: "Reasoning, Evidence & Claim Audit",
        argumentAndInsight: "Connections, Causes & Tradeoffs",
        practicalSteps: "Practical Application",
        expertCommentary: "Caveats, Biases & Open Questions",
        reviewKit: "Memory & Review Kit",
        followUpQuestions: "Follow-up Questions",
        mainPoints: "Main Points",
        causalAndKnowledgeFlow: "Causal & Knowledge Flow",
        perspectivesAndUncertainty: "Perspectives & Uncertainty",
        conceptMap: "Concept Map",
        coreDefinitions: "Core Definitions",
        prerequisitesMisconceptions: "Prerequisites & Misconceptions",
        pitfallsWarnings: "Pitfalls & Warnings",
        resourcesTools: "Resources & Tools"
    };

    function normalizeSize(size) {
        const s = String(size || "Medium").trim();
        if (/^brief$/i.test(s)) return "Brief";
        if (/^deep$/i.test(s)) return "Deep";
        return "Medium";
    }

    function normalizeLength(length) {
        const s = String(length || "Medium").trim();
        if (/^short$/i.test(s)) return "Short";
        if (/^long$/i.test(s)) return "Long";
        return "Medium";
    }

    function contentLength(value) {
        if (Array.isArray(value)) {
            return value.map((item) => String(item || "").trim()).filter(Boolean).join("\n").length;
        }
        return String(value || "").trim().length;
    }

    function isPlaceholderContent(value) {
        const text = Array.isArray(value)
            ? value.join("\n")
            : String(value || "");
        const lower = text.toLowerCase();
        if (!text.trim()) return true;
        if (/information not found in the provided content/i.test(text) && text.trim().length < 80) return true;
        if (/no (takeaways|details|content|summary) (returned|available|provided)/i.test(lower)) return true;
        if (/^\s*n\/a\s*$/i.test(text.trim())) return true;
        return false;
    }

    function countTimestamps(text) {
        const matches = String(text || "").match(/\[\d{1,2}:\d{2}(?::\d{2})?\]/g);
        return matches ? matches.length : 0;
    }

    function countListItems(value) {
        if (Array.isArray(value)) return value.filter((item) => String(item || "").trim()).length;
        const text = String(value || "");
        const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
        const bullets = lines.filter((l) => /^[-*•]\s+/.test(l) || /^\d+[.)]\s+/.test(l));
        return bullets.length || (text.trim() ? 1 : 0);
    }

    function normalizeCoverageText(value) {
        return String(value || "")
            .toLowerCase()
            .replace(/[`*_~]/g, "")
            .replace(/\s+/g, " ")
            .trim();
    }

    function collectCoverageSignals(sourceText) {
        const source = String(sourceText || "").replace(/\r/g, "");
        const signals = [];
        const add = (type, value) => {
            const text = String(value || "").replace(/\s+/g, " ").trim();
            if (!text || text.length < 2) return;
            const key = `${type}:${normalizeCoverageText(text)}`;
            if (!signals.some((item) => item.key === key)) {
                signals.push({ type, value: text, key });
            }
        };

        source.split("\n").forEach((line) => {
            const text = line.trim();
            if (/^#{1,6}\s+/.test(text) || /^\[[0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?\]/.test(text)) {
                add("heading_or_timestamp", text);
            }
        });

        (source.match(/\b\d+(?:[.,]\d+)*(?:%|[a-zA-Z]+)?\b/g) || [])
            .filter((value) => value.length >= 2)
            .slice(0, 120)
            .forEach((value) => add("number_or_term", value));

        (source.match(/\b(?:[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,}){0,3})\b/g) || [])
            .filter((value) => !/^(The|This|That|These|Those|When|What|How|Why|For|And|But|With|From|Into|After|Before|Chapter|Section)$/.test(value))
            .slice(0, 100)
            .forEach((value) => add("named_term", value));

        source
            .split(/(?<=[.!?])\s+|\n+/)
            .map((part) => part.trim())
            .filter((part) => part.length >= 45)
            .slice(0, 80)
            .forEach((part) => add("source_sentence", part));

        return signals.slice(0, 220);
    }

    function assessCoverageSignals(parsed, sourceText) {
        const output = parsed ? [
            parsed.rawText,
            parsed.summary,
            parsed.keyTakeaways,
            parsed.mainPoints,
            parsed.detailsOfVideo,
            parsed.detailedBreakdown,
            parsed.expertCommentary,
            parsed.evidenceAndDetails,
            parsed.argumentAndInsight,
            parsed.conceptMapAndPrerequisites,
            parsed.causalAndKnowledgeFlow,
            parsed.perspectivesAndUncertainty,
            parsed.reviewKit,
            parsed.practicalSteps,
            parsed.conceptMap,
            parsed.coreDefinitions,
            parsed.prerequisitesMisconceptions,
            parsed.pitfallsWarnings,
            parsed.resourcesTools
        ].flat().join("\n") : "";
        const normalizedOutput = normalizeCoverageText(output);
        const signals = collectCoverageSignals(sourceText);
        const missing = signals.filter((signal) => {
            if (signal.type === "source_sentence") {
                const words = signal.value.toLowerCase().match(/[a-z0-9]{4,}/g) || [];
                const distinctive = Array.from(new Set(words)).slice(0, 8);
                return distinctive.length >= 4
                    && distinctive.filter((word) => normalizedOutput.includes(word)).length < Math.ceil(distinctive.length * 0.35);
            }
            return !normalizedOutput.includes(normalizeCoverageText(signal.value));
        });
        const meaningful = signals.filter((signal) => signal.type !== "source_sentence");
        const coveredMeaningful = meaningful.length - missing.filter((signal) => signal.type !== "source_sentence").length;
        const signalRatio = meaningful.length ? coveredMeaningful / meaningful.length : null;
        return {
            signals,
            missing: missing.slice(0, 40),
            signalRatio
        };
    }

    /**
     * Build the required/recommended section contract for a given result context.
     */
    function buildQualityContract(context) {
        const sourceType = (context && context.sourceType) || "webpage";
        const size = normalizeSize(context && context.summarySize);
        const length = normalizeLength(context && context.summaryLength);
        const mode = String((context && context.promptMode) || "summarize").toLowerCase();
        const isDeep = size === "Deep" || length === "Long";
        const isBrief = size === "Brief" && length !== "Long";

        const required = ["summary", "keyTakeaways"];
        const recommended = [];

        if (!isBrief) {
            required.push("detailedBreakdown");
            required.push("evidenceAndDetails");
            required.push("argumentAndInsight");
            required.push("expertCommentary");
        }

        if (sourceType === "youtube") {
            if (isDeep) required.push("detailsOfVideo");
            else recommended.push("detailsOfVideo");
        }

        if (isDeep) {
            recommended.push("conceptMapAndPrerequisites");
            recommended.push("practicalSteps");
            recommended.push("reviewKit");
        }

        if (mode === "study" || mode === "concepts") {
            recommended.push("conceptMapAndPrerequisites");
            recommended.push("reviewKit");
        }
        if (mode === "analyze" || mode === "debate") {
            recommended.push("evidenceAndDetails");
            recommended.push("argumentAndInsight");
        }

        // Follow-ups only when enabled
        if (context && context.generateFollowUpQuestions !== false && !isBrief) {
            recommended.push("followUpQuestions");
            if (isDeep) required.push("followUpQuestions");
        }

        return {
            sourceType,
            size,
            length,
            mode,
            isDeep,
            isBrief,
            required: Array.from(new Set(required)),
            recommended: Array.from(new Set(recommended.filter((k) => !required.includes(k))))
        };
    }

    /**
     * Score a single section.
     */
    function scoreSection(key, value, contract) {
        const minChars = MIN_SECTION_CHARS[contract.size] || MIN_SECTION_CHARS.Medium;
        const len = contentLength(value);
        const placeholder = isPlaceholderContent(value);
        const issues = [];
        let score = 1;

        if (!value || len === 0 || placeholder) {
            return { key, score: 0, length: len, issues: ["missing_or_empty"], weak: true };
        }

        if (len < minChars * 0.5) {
            score = 0.25;
            issues.push("very_short");
        } else if (len < minChars) {
            score = 0.55;
            issues.push("short");
        } else if (len < minChars * 1.5) {
            score = 0.8;
        } else {
            score = 1;
        }

        // Extra checks for list-like sections
        if (key === "keyTakeaways") {
            const count = countListItems(value);
            const min = MIN_TAKEAWAYS[contract.size] || 3;
            if (count < min) {
                score = Math.min(score, 0.5);
                issues.push("few_takeaways");
            }
        }
        if (key === "followUpQuestions") {
            const count = countListItems(value);
            const min = MIN_FOLLOWUPS[contract.size] || 2;
            if (count < min) {
                score = Math.min(score, 0.5);
                issues.push("few_followups");
            }
        }
        if (key === "detailsOfVideo" && contract.sourceType === "youtube") {
            const ts = countTimestamps(Array.isArray(value) ? value.join("\n") : value);
            if (contract.isDeep && ts === 0) {
                score = Math.min(score, 0.6);
                issues.push("no_timestamps");
            }
        }

        return {
            key,
            score,
            length: len,
            issues,
            weak: score < 0.7
        };
    }

    /**
     * Evaluate a parsed summary result.
     * @param {object} parsed - result from parseStructuredSummary or buildResultFromExtraction
     * @param {object} context - { sourceType, summarySize, summaryLength, promptMode, generateFollowUpQuestions, sourceLength }
     */
    function evaluateSummary(parsed, context) {
        const contract = buildQualityContract(context || {});
        const sectionScores = {};
        const missingSections = [];
        const weakSections = [];
        const issues = [];

        // Score required
        contract.required.forEach((key) => {
            const value = parsed ? parsed[key] : null;
            const result = scoreSection(key, value, contract);
            sectionScores[key] = result;
            if (result.score === 0) {
                missingSections.push(key);
                issues.push(`Missing required section: ${SECTION_LABELS[key] || key}`);
            } else if (result.weak) {
                weakSections.push(key);
                issues.push(`Weak section: ${SECTION_LABELS[key] || key} (${result.issues.join(", ")})`);
            }
        });

        // Score recommended (lower weight)
        contract.recommended.forEach((key) => {
            const value = parsed ? parsed[key] : null;
            const result = scoreSection(key, value, contract);
            sectionScores[key] = result;
            if (result.weak && result.score > 0) {
                // recommended weak is advisory only for Medium; counts for Deep
                if (contract.isDeep) {
                    weakSections.push(key);
                    issues.push(`Thin recommended section: ${SECTION_LABELS[key] || key}`);
                }
            }
        });

        // Overall coverage
        const requiredScores = contract.required.map((k) => (sectionScores[k] ? sectionScores[k].score : 0));
        const avgRequired = requiredScores.length
            ? requiredScores.reduce((a, b) => a + b, 0) / requiredScores.length
            : 1;

        const recommendedScores = contract.recommended.map((k) => (sectionScores[k] ? sectionScores[k].score : 0));
        const avgRecommended = recommendedScores.length
            ? recommendedScores.reduce((a, b) => a + b, 0) / recommendedScores.length
            : 1;

        // Weighted score
        const score = Math.round((avgRequired * 0.8 + avgRecommended * 0.2) * 100) / 100;

        // Pass thresholds
        let passThreshold = 0.55;
        if (contract.isDeep) passThreshold = 0.75;
        else if (contract.size === "Medium") passThreshold = 0.65;

        const passed = score >= passThreshold && missingSections.length === 0;

        // Source coverage heuristic
        const sourceLength = Number((context && context.sourceLength) || 0);
        const outputLength = CANONICAL_SECTIONS.reduce((total, key) => {
            return total + contentLength(parsed ? parsed[key] : "");
        }, 0);
        const coverageRatio = sourceLength > 0 ? outputLength / sourceLength : null;
        const signalCoverage = assessCoverageSignals(
            parsed,
            (context && (context.sourceContentForPrompt || context.sourceContentRaw || context.sourceContent)) || ""
        );

        // For Deep/Long on long sources, flag low coverage
        if (contract.isDeep && sourceLength > 8000 && coverageRatio !== null && coverageRatio < 0.04) {
            issues.push("Output may be too short relative to source length");
            if (contract.length === "Long" && coverageRatio < 0.025) {
                weakSections.push("detailedBreakdown");
            }
        }
        if (contract.isDeep && signalCoverage.signalRatio !== null && signalCoverage.signalRatio < 0.55) {
            issues.push("Important source signals may be missing from the output");
            weakSections.push("detailedBreakdown");
        }

        return {
            score,
            passed,
            passThreshold,
            issues,
            sectionScores,
            missingSections,
            weakSections: Array.from(new Set(weakSections)),
            contract,
            coverage: {
                sourceLength,
                outputLength,
                coverageRatio,
                signalRatio: signalCoverage.signalRatio,
                missingSignals: signalCoverage.missing,
                timestampCount: countTimestamps(parsed && (parsed.detailsOfVideo || parsed.rawText || ""))
            },
            evaluatedAt: new Date().toISOString()
        };
    }

    /**
     * Decide whether a repair pass should run.
     */
    function shouldRepair(quality, context) {
        if (!quality) return false;
        if (quality.passed) return false;
        const size = normalizeSize(context && context.summarySize);
        const length = normalizeLength(context && context.summaryLength);
        // Only auto-repair Deep or Long
        if (size !== "Deep" && length !== "Long") return false;
        // Need something actionable
        return (quality.missingSections && quality.missingSections.length > 0)
            || (quality.weakSections && quality.weakSections.length > 0);
    }

    /**
     * Build a focused repair prompt for weak/missing sections only.
     */
    function buildRepairPrompt(context, parsed, quality, settings) {
        const labels = (quality.missingSections || []).concat(quality.weakSections || []);
        const uniqueKeys = Array.from(new Set(labels));
        const sectionLines = uniqueKeys.map((key) => {
            const label = SECTION_LABELS[key] || key;
            const existing = parsed && parsed[key]
                ? (Array.isArray(parsed[key]) ? parsed[key].join("\n") : String(parsed[key]))
                : "(missing)";
            return `### ${label}\nCurrent content:\n${existing.slice(0, 1200)}`;
        });

        const rawSource = String(
            (context && (context.sourceContentForPrompt || context.sourceContentRaw || context.sourceContent)) || ""
        );
        const sourceSnippet = rawSource.length > 24000
            ? `${rawSource.slice(0, 12000)}\n\n[... middle omitted ...]\n\n${rawSource.slice(-12000)}`
            : rawSource.slice(0, 24000);
        const missingSignals = (quality && quality.coverage && quality.coverage.missingSignals) || [];
        const signalHints = missingSignals
            .slice(0, 15)
            .map((item) => `- ${item.value}`)
            .join("\n");

        const language = (settings && settings.summaryLanguage) || "English";
        const size = normalizeSize(settings && settings.summarySize);
        const length = normalizeLength(settings && settings.summaryLength);
        const customLanguages = String(settings && settings.customLanguages || "").split(",").map((l) => String(l || "").trim()).filter(Boolean);
        const allowed = new Set(["English", "Vietnamese", ...customLanguages]);
        const resolvedLanguage = allowed.has(language) ? language : "English";

        return [
            "You are repairing a structured summary that failed a quality gate.",
            "Rewrite ONLY the weak or missing sections listed below.",
            "Preserve ALL concrete details, names, numbers, dates, examples, definitions, steps, and caveats from the source rather than summarizing broadly.",
            "Keep every other section unchanged — do not regenerate the full summary.",
            "Use the exact section headings provided.",
            "Ground every claim in the source material. If information is absent, write exactly: Information not found in the provided content.",
            "=== CRITICAL LANGUAGE DIRECTIVE ===",
            `You MUST write all response prose, explanations, bullets, tables, and analysis in ${resolvedLanguage}.`,
            `Translate source content into ${resolvedLanguage} instead of copying source sentences in another language.`,
            `Output language: ${resolvedLanguage}.`,
            `Target depth: ${size} / ${length}.`,
            "Do not add greetings, meta commentary, or sections that were not requested.",
            "",
            "Required repaired sections (use these exact headings):",
            uniqueKeys.map((key) => `- ${SECTION_LABELS[key] || key}`).join("\n"),
            "",
            signalHints
                ? "Detected source details that may need to be restored:\n" + signalHints
                : "",
            "",
            "Current weak/missing section drafts:",
            sectionLines.join("\n\n"),
            "",
            "Existing Main Summary (for continuity, do not rewrite unless listed above):",
            String((parsed && parsed.summary) || "").slice(0, 1500),
            "",
            "Source material:",
            sourceSnippet || "None."
        ].join("\n");
    }

    /**
     * Merge repaired section text into an existing parsed result.
     * repairedParsed should come from parseStructuredSummary on the repair response.
     */
    function mergeRepairedSections(originalParsed, repairedParsed, quality) {
        const keys = Array.from(new Set(
            [].concat(quality.missingSections || [], quality.weakSections || [])
        ));
        const merged = Object.assign({}, originalParsed || {});
        keys.forEach((key) => {
            const nextVal = repairedParsed ? repairedParsed[key] : null;
            if (!nextVal) return;
            if (isPlaceholderContent(nextVal)) return;
            // Prefer longer/better content
            const prevLen = contentLength(merged[key]);
            const nextLen = contentLength(nextVal);
            if (nextLen >= prevLen * 0.8) {
                merged[key] = nextVal;
            }
        });
        // Preserve rawText reference
        if (repairedParsed && repairedParsed.rawText) {
            merged.rawText = (originalParsed && originalParsed.rawText ? originalParsed.rawText + "\n\n" : "")
                + "<!-- repaired -->\n" + repairedParsed.rawText;
        }
        return merged;
    }

    function getSectionLabel(key) {
        return SECTION_LABELS[key] || key;
    }

    globalThis.SummarizerQuality = {
        evaluateSummary,
        shouldRepair,
        buildRepairPrompt,
        mergeRepairedSections,
        buildQualityContract,
        getSectionLabel,
        SECTION_LABELS,
        CANONICAL_SECTIONS,
        normalizeSize,
        normalizeLength
    };
})();
