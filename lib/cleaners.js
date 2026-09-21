(function () {
    function cleanText(input) {
        return String(input || "")
            .replace(/\r/g, "")
            .replace(/\t+/g, " ")
            .replace(/[ \u00a0]+/g, " ")
            .replace(/\n{3,}/g, "\n\n")
            .replace(/[ ]+\n/g, "\n")
            .trim();
    }

    function truncateText(input, maxLength) {
        const text = cleanText(input);
        if (!maxLength || text.length <= maxLength) {
            return text;
        }
        return text.slice(0, maxLength).trimEnd() + "\n\n[Content truncated]";
    }

    function decodeHtmlEntities(text) {
        const textarea = document.createElement("textarea");
        textarea.innerHTML = text;
        return textarea.value;
    }

    function sanitizeFilename(input) {
        return String(input || "summary")
            .replace(/[\\/:*?"<>|]+/g, "-")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 80);
    }

    function parseListItems(block, maxItems) {
        const lines = cleanText(block)
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);

        if (!lines.length) {
            return [];
        }

        const listItems = lines
            .map((line) => line.replace(/^[-*]\s+/, "").replace(/^\d+[.)]\s+/, "").trim())
            .filter(Boolean)
            .slice(0, maxItems || lines.length);

        return listItems;
    }

    function uniqueItems(items) {
        const seen = new Set();
        return items.filter((item) => {
            const key = cleanText(item).toLowerCase();
            if (!key || seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    function normalizeHeading(line) {
        return String(line || "")
            .replace(/^\s{0,3}#{1,6}\s*/, "")
            .replace(/^\*\*(.*?)\*\*\s*:?$/, "$1")
            .replace(/^__([^_]+)__\s*:?$/, "$1")
            .replace(/\*+/g, "")
            .replace(/_+/g, "")
            .replace(/`+/g, "")
            .replace(/\s*:+\s*$/, "")
            .replace(/^[0-9]+[.)]\s*/, "")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
    }

    function resolveSection(heading) {
        const compact = String(heading || "").replace(/\s+/g, " ").trim();

        if (/^main summary$/.test(compact)) return "summary";
        if (/^executive takeaways$/.test(compact)) return "keyTakeaways";
        if (/^details of the video$/.test(compact)) return "detailsOfVideo";
        if (/^complete guided walkthrough$/.test(compact)) return "detailedBreakdown";
        if (/^concepts, definitions & mental models$/.test(compact)) return "conceptMapAndPrerequisites";
        if (/^reasoning, evidence & claim audit$/.test(compact)) return "evidenceAndDetails";
        if (/^connections, causes & tradeoffs$/.test(compact)) return "argumentAndInsight";
        if (/^practical application$/.test(compact)) return "practicalSteps";
        if (/^caveats, biases & open questions$/.test(compact)) return "expertCommentary";
        if (/^memory & review kit$/.test(compact)) return "reviewKit";
        if (/^follow-up questions$/.test(compact)) return "followUpQuestions";
        if (/^concept map$/.test(compact)) return "conceptMap";
        if (/^core definitions$/.test(compact)) return "coreDefinitions";
        if (/^prerequisites & misconceptions$/.test(compact)) return "prerequisitesMisconceptions";
        if (/^practical steps$/.test(compact)) return "practicalSteps";
        if (/^pitfalls & warnings$/.test(compact)) return "pitfallsWarnings";
        if (/^resources & tools$/.test(compact)) return "resourcesTools";
        return "";
    }

    function parseStructuredSummary(rawText) {
        const text = cleanText(rawText);
        const defaultResult = {
            rawText: text,
            summary: text,
            keyTakeaways: [],
            detailsOfVideo: "",
            detailedBreakdown: "",
            expertCommentary: "",
            followUpQuestions: [],
            evidenceAndDetails: "",
            argumentAndInsight: "",
            conceptMapAndPrerequisites: "",
            reviewKit: "",
            // YouTube Comments
            // Course Concepts
            conceptMap: "",
            coreDefinitions: "",
            prerequisitesMisconceptions: "",
            practicalSteps: "",
            pitfallsWarnings: "",
            resourcesTools: ""
        };

        if (!text) {
            return defaultResult;
        }

        const lines = text.split("\n");
        const buffers = {
            summary: [],
            keyTakeaways: [],
            detailsOfVideo: [],
            detailedBreakdown: [],
            expertCommentary: [],
            followUpQuestions: [],
            evidenceAndDetails: [],
            argumentAndInsight: [],
            conceptMapAndPrerequisites: [],
            reviewKit: [],
            // YouTube Comments
            // Course Concepts
            conceptMap: [],
            coreDefinitions: [],
            prerequisitesMisconceptions: [],
            practicalSteps: [],
            pitfallsWarnings: [],
            resourcesTools: []
        };

        let currentSection = "summary";

        lines.forEach((line) => {
            const section = resolveSection(normalizeHeading(line));
            if (section) {
                currentSection = section;
                return;
            }
            buffers[currentSection].push(line);
        });

        const summary = cleanText(buffers.summary.join("\n"));

        const takeawayBlock = cleanText(buffers.keyTakeaways.join("\n"));
        const keyTakeaways = uniqueItems(parseListItems(takeawayBlock, 15));

        const followUpQuestions = uniqueItems(
            parseListItems(cleanText(buffers.followUpQuestions.join("\n")), 5)
        ).filter((q) => q.length > 5);

        const detailedBreakdown = cleanText(buffers.detailedBreakdown.join("\n"));

        let expertCommentary = cleanText(buffers.expertCommentary.join("\n"));


        return {
            rawText: text,
            summary,
            keyTakeaways,
            detailsOfVideo: cleanText(buffers.detailsOfVideo.join("\n")),
            detailedBreakdown: detailedBreakdown,
            expertCommentary: expertCommentary,
            evidenceAndDetails: cleanText(buffers.evidenceAndDetails.join("\n")),
            argumentAndInsight: cleanText(buffers.argumentAndInsight.join("\n")),
            conceptMapAndPrerequisites: cleanText(buffers.conceptMapAndPrerequisites.join("\n")),
            reviewKit: cleanText(buffers.reviewKit.join("\n")),
            followUpQuestions,
            // YouTube Comments
            // Course Concepts
            conceptMap: cleanText(buffers.conceptMap.join("\n")),
            coreDefinitions: cleanText(buffers.coreDefinitions.join("\n")),
            prerequisitesMisconceptions: cleanText(buffers.prerequisitesMisconceptions.join("\n")),
            practicalSteps: cleanText(buffers.practicalSteps.join("\n")),
            pitfallsWarnings: cleanText(buffers.pitfallsWarnings.join("\n")),
            resourcesTools: cleanText(buffers.resourcesTools.join("\n"))
        };
    }

    globalThis.SummarizerCleaners = {
        cleanText,
        truncateText,
        decodeHtmlEntities,
        sanitizeFilename,
        parseStructuredSummary
    };
})();
