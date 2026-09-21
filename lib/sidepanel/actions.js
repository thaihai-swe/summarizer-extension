(function () {
    function buildExportBody(result) {
        const isConcepts = String(result && result.promptMode || "").toLowerCase() === "concepts";
        const parts = [];
        const sections = isConcepts
            ? [
                ["Concept Map", result.conceptMap],
                ["Core Definitions", result.coreDefinitions],
                ["Prerequisites & Misconceptions", result.prerequisitesMisconceptions],
                ["Practical Steps", result.practicalSteps],
                ["Pitfalls & Warnings", result.pitfallsWarnings],
                ["Resources & Tools", result.resourcesTools]
            ]
            : [
                ["Main Summary", result.summary],
                ["Executive Takeaways", result.keyTakeaways && result.keyTakeaways.length
                    ? result.keyTakeaways.map((item) => "- " + item).join("\n") : ""],
                ["Details of the Video", result.detailsOfVideo],
                ["Complete Guided Walkthrough", result.detailedBreakdown],
                ["Concepts, Definitions & Mental Models", result.conceptMapAndPrerequisites],
                ["Reasoning, Evidence & Claim Audit", result.evidenceAndDetails],
                ["Connections, Causes & Tradeoffs", result.argumentAndInsight],
                ["Practical Application", result.practicalSteps],
                ["Caveats, Biases & Open Questions", result.expertCommentary],
                ["Memory & Review Kit", result.reviewKit]
            ];
        sections.forEach(([title, content]) => {
            if (content) parts.push("", "## " + title, content);
        });
        const customSections = Array.isArray(result && result.sections)
            ? result.sections.filter((section) => section && !section.canonicalKey && section.heading && section.content)
            : [];
        customSections.forEach((section) => {
            const title = String(section.heading)
                .replace(/[\r\n]+/g, " ")
                .replace(/^#+\s*/, "")
                .trim();
            const content = String(section.content || "").trim();
            if (title && content) parts.push("", "## " + title, content);
        });
        return parts.join("\n\n").trim();
    }

    function filename(title, fallback) {
        return globalThis.SummarizerCleaners
            ? SummarizerCleaners.sanitizeFilename(title || fallback)
            : String(title || fallback).replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "") || fallback;
    }

    function download(text, name, type) {
        SummarizerTranscriptExport.downloadTextFile(text, name, type);
    }

    function create(config) {
        function current() { return config.getLatestResult(); }

        async function copySummary() {
            const result = current();
            if (!result) {
                config.setStatus("No summary available.", "error");
                return;
            }
            await navigator.clipboard.writeText("# " + result.title + "\n\n" + buildExportBody(result));
            config.setStatus("Copied to clipboard.", "ready");
        }

        function exportMarkdown() {
            const result = current();
            if (!result) return;
            download(
                "# " + result.title + "\n\n" + buildExportBody(result),
                filename(result.title, "summary") + ".md",
                "text/markdown;charset=utf-8"
            );
        }

        function exportText() {
            const result = current();
            if (!result) return;
            const text = result.title + "\n\n" + buildExportBody(result).replace(/## /g, "").trim();
            download(text, filename(result.title, "summary") + ".txt", "text/plain;charset=utf-8");
        }

        async function copyTranscript() {
            const result = current();
            const text = result && result.sourceType === "youtube"
                ? SummarizerTranscriptExport.buildPlainTranscript(result)
                : "";
            if (!text) {
                config.setStatus("No transcript available.", "error");
                return;
            }
            try {
                await navigator.clipboard.writeText(text);
                config.setStatus("Transcript copied.", "ready");
            } catch (_) {
                config.setStatus("Could not copy transcript.", "error");
            }
        }

        function downloadTranscriptSrt() {
            const result = current();
            const text = result && result.sourceType === "youtube"
                ? SummarizerTranscriptExport.buildSrt(result)
                : "";
            if (!text) {
                config.setStatus("No transcript available.", "error");
                return;
            }
            download(text, filename(result.title, "transcript") + ".srt", "application/x-subrip;charset=utf-8");
            config.setStatus("SRT download started.", "ready");
        }

        return { copySummary, exportMarkdown, exportText, copyTranscript, downloadTranscriptSrt };
    }

    globalThis.SummarizerSidepanelActions = { create, buildExportBody };
})();
