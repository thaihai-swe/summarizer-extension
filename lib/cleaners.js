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
        const safeText = String(text || "").replace(/</g, "&lt;");
        const parsed = new DOMParser().parseFromString(`<textarea>${safeText}</textarea>`, "text/html");
        return parsed.querySelector("textarea")?.value || "";
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

    function extractTopLevelHeading(line) {
        const match = String(line || "").match(/^\s{0,3}##(?!#)\s+(.+?)\s*$/);
        if (!match) return "";
        return String(match[1] || "")
            .replace(/^\*\*(.*?)\*\*\s*:?$/, "$1")
            .replace(/^__([^_]+)__\s*:?$/, "$1")
            .replace(/\s*:+\s*$/, "")
            .replace(/\s+/g, " ")
            .trim();
    }

    function createSectionId(heading, index, usedIds) {
        const slug = String(heading || "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 60) || "section";
        const base = "result-section-" + slug;
        let id = base;
        let suffix = 2;
        while (usedIds.has(id)) {
            id = base + "-" + suffix;
            suffix += 1;
        }
        usedIds.add(id);
        return id;
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
            resourcesTools: "",
            sections: [],
            unheadedContent: ""
        };

        if (!text) {
            return defaultResult;
        }

        const lines = text.split("\n");
        const sections = [];
        const usedIds = new Set();
        let current = null;
        const preamble = [];

        const flushCurrent = () => {
            if (!current) return;
            const content = cleanText(current.lines.join("\n"));
            const section = {
                id: createSectionId(current.heading, sections.length, usedIds),
                heading: current.heading,
                content
            };
            if (current.canonicalKey) section.canonicalKey = current.canonicalKey;
            sections.push(section);
            current = null;
        };

        let inFence = false;
        lines.forEach((line) => {
            if (/^\s*(```|~~~)/.test(line)) {
                inFence = !inFence;
                if (current) current.lines.push(line);
                else preamble.push(line);
                return;
            }
            const heading = inFence ? "" : extractTopLevelHeading(line);
            if (heading) {
                flushCurrent();
                current = {
                    heading,
                    canonicalKey: resolveSection(normalizeHeading(heading)),
                    lines: []
                };
                return;
            }
            if (current) current.lines.push(line);
            else preamble.push(line);
        });
        flushCurrent();

        const buffers = {};
        sections.forEach((section) => {
            if (!section.canonicalKey) return;
            buffers[section.canonicalKey] = buffers[section.canonicalKey]
                ? buffers[section.canonicalKey] + "\n\n" + section.content
                : section.content;
        });

        const unheadedContent = cleanText(preamble.join("\n"));
        const summary = buffers.summary || (!sections.length ? unheadedContent : "");
        const takeawayBlock = buffers.keyTakeaways || "";
        const keyTakeaways = uniqueItems(parseListItems(takeawayBlock, 15));

        const followUpQuestions = uniqueItems(
            parseListItems(buffers.followUpQuestions || "", 5)
        ).filter((q) => q.length > 5);

        return {
            rawText: text,
            summary,
            keyTakeaways,
            detailsOfVideo: buffers.detailsOfVideo || "",
            detailedBreakdown: buffers.detailedBreakdown || "",
            expertCommentary: buffers.expertCommentary || "",
            evidenceAndDetails: buffers.evidenceAndDetails || "",
            argumentAndInsight: buffers.argumentAndInsight || "",
            conceptMapAndPrerequisites: buffers.conceptMapAndPrerequisites || "",
            reviewKit: buffers.reviewKit || "",
            followUpQuestions,
            conceptMap: buffers.conceptMap || "",
            coreDefinitions: buffers.coreDefinitions || "",
            prerequisitesMisconceptions: buffers.prerequisitesMisconceptions || "",
            practicalSteps: buffers.practicalSteps || "",
            pitfallsWarnings: buffers.pitfallsWarnings || "",
            resourcesTools: buffers.resourcesTools || "",
            sections,
            unheadedContent
        };
    }

    globalThis.SummarizerCleaners = {
        cleanText,
        truncateText,
        decodeHtmlEntities,
        sanitizeFilename,
        resolveSection,
        parseStructuredSummary
    };
})();
