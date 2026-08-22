(function () {
    const CORE_RE = /(?:🔥|core\s+concepts?|fundamental)/i;
    const IMPORTANT_RE = /(?:⭐|important\s+concepts?|key\s+concepts?)/i;
    const SUPPORTING_RE = /(?:💡|supporting|prerequisite|related)/i;
    const HEADING_RE = /^(?:#{1,6}\s+|[-*+]\s+|\d+\.\s+)/;
    const TIMESTAMP_RE = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/;
    const PHASE_RE = /^(?:phase|step|stage|part)\s*(\d+|[ivxlcdm]+)?[:.\-–—]?\s*/i;
    const DATE_RE = /\b((?:19|20)\d{2}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}(?:,?\s+\d{4})?)\b/i;

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function stripMarkdown(value) {
        return String(value || "")
            .replace(/[#*_`]/g, "")
            .replace(/^\s*[-*+]\s+/, "")
            .replace(/^\s*\d+\.\s+/, "")
            .trim();
    }

    function splitBlocks(text) {
        return String(text || "")
            .split(/\n{2,}/)
            .map((block) => block.trim())
            .filter(Boolean);
    }

    function detectTier(heading, index) {
        const value = String(heading || "");
        if (CORE_RE.test(value)) return "core";
        if (IMPORTANT_RE.test(value)) return "important";
        if (SUPPORTING_RE.test(value)) return "supporting";
        if (index === 0) return "core";
        if (index === 1) return "important";
        return "supporting";
    }

    function parseConceptNodes(text) {
        const blocks = splitBlocks(text);
        if (!blocks.length) return [];

        const nodes = [];
        let currentTier = "core";
        let currentGroup = "";

        blocks.forEach((block, index) => {
            const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
            if (!lines.length) return;
            const heading = stripMarkdown(lines[0]);
            if (!heading || /^none\.?$/i.test(heading)) return;

            if (CORE_RE.test(heading) || IMPORTANT_RE.test(heading) || SUPPORTING_RE.test(heading)) {
                currentTier = detectTier(heading, index);
                currentGroup = heading;
                const rest = lines.slice(1);
                if (!rest.length) return;
                rest.forEach((line) => {
                    const term = stripMarkdown(line);
                    if (!term) return;
                    nodes.push({
                        term: term.split(/[:—–-]/)[0].trim().slice(0, 80),
                        definition: term.includes(":") || term.includes("—") || term.includes("–")
                            ? term.replace(/^[^::—–-]+[:—–-]\s*/, "").trim()
                            : "",
                        tier: currentTier,
                        group: currentGroup
                    });
                });
                return;
            }

            const definition = lines.slice(1).map(stripMarkdown).join(" ").trim();
            nodes.push({
                term: heading.replace(/^[-*+]\s+/, "").split(/[:—–]/)[0].trim().slice(0, 90),
                definition: definition || heading.replace(/^[^:]+[:—–]\s*/, "").trim(),
                tier: currentTier || detectTier(heading, index),
                group: currentGroup
            });
        });

        return nodes.slice(0, 36);
    }

    function parseTimelineEvents(text) {
        const lines = String(text || "")
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);

        const events = [];
        let current = null;

        lines.forEach((line) => {
            const cleaned = stripMarkdown(line);
            if (!cleaned || /^none\.?$/i.test(cleaned)) return;
            const stampMatch = cleaned.match(TIMESTAMP_RE);
            const phaseMatch = cleaned.match(PHASE_RE);
            const dateMatch = cleaned.match(DATE_RE);
            const isHeading = HEADING_RE.test(line) || stampMatch || phaseMatch || /^#{1,6}\s+/.test(line);

            if (isHeading || !current) {
                if (current) events.push(current);
                current = {
                    stamp: stampMatch ? stampMatch[1] : (dateMatch ? dateMatch[1] : (phaseMatch ? (phaseMatch[0] || "").replace(/[:.\-–—]\s*$/, "").trim() : "")),
                    title: cleaned.replace(TIMESTAMP_RE, "").replace(PHASE_RE, "").trim().slice(0, 110) || "Event",
                    detail: ""
                };
                return;
            }

            current.detail = current.detail
                ? current.detail + " " + cleaned
                : cleaned;
        });

        if (current) events.push(current);
        return events.filter((event) => event.title).slice(0, 24);
    }

    function renderConceptTree(text, host) {
        const nodes = parseConceptNodes(text);
        if (!nodes.length || !host) return false;

        const wrap = document.createElement("div");
        wrap.className = "concept-tree";
        wrap.setAttribute("role", "list");

        const filters = document.createElement("div");
        filters.className = "concept-tree-filters";
        filters.setAttribute("role", "toolbar");
        filters.setAttribute("aria-label", "Filter concepts");
        [
            { id: "all", label: "All" },
            { id: "core", label: "Core" },
            { id: "important", label: "Important" },
            { id: "supporting", label: "Supporting" }
        ].forEach((item, index) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "concept-filter" + (index === 0 ? " is-active" : "");
            button.dataset.filter = item.id;
            button.textContent = item.label;
            button.addEventListener("click", () => {
                filters.querySelectorAll(".concept-filter").forEach((el) => el.classList.remove("is-active"));
                button.classList.add("is-active");
                wrap.querySelectorAll(".concept-node").forEach((node) => {
                    node.hidden = item.id !== "all" && node.dataset.tier !== item.id;
                });
            });
            filters.appendChild(button);
        });
        wrap.appendChild(filters);

        const grid = document.createElement("div");
        grid.className = "concept-tree-grid";
        nodes.forEach((node) => {
            const card = document.createElement("article");
            card.className = "concept-node is-" + node.tier;
            card.dataset.tier = node.tier;
            card.setAttribute("role", "listitem");
            card.innerHTML =
                "<p class=\"concept-tier\">" + escapeHtml(node.tier) + "</p>" +
                "<h4 class=\"concept-term\">" + escapeHtml(node.term) + "</h4>" +
                (node.definition ? "<p class=\"concept-def\">" + escapeHtml(node.definition.slice(0, 220)) + "</p>" : "");
            grid.appendChild(card);
        });
        wrap.appendChild(grid);
        host.appendChild(wrap);
        return true;
    }

    function renderTimelineRail(text, host) {
        const events = parseTimelineEvents(text);
        if (events.length < 2 || !host) return false;

        const rail = document.createElement("ol");
        rail.className = "timeline-rail";
        events.forEach((event) => {
            const item = document.createElement("li");
            item.className = "timeline-event";
            item.innerHTML =
                "<div class=\"timeline-marker\" aria-hidden=\"true\"></div>" +
                "<div class=\"timeline-card\">" +
                    (event.stamp ? "<p class=\"timeline-stamp\">" + escapeHtml(event.stamp) + "</p>" : "") +
                    "<h4 class=\"timeline-title\">" + escapeHtml(event.title) + "</h4>" +
                    (event.detail ? "<p class=\"timeline-detail\">" + escapeHtml(event.detail.slice(0, 280)) + "</p>" : "") +
                "</div>";
            rail.appendChild(item);
        });
        host.appendChild(rail);
        return true;
    }

    function enhanceSectionBody(key, content, host, result) {
        if (!host || !content) return;
        const mode = String((result && result.promptMode) || "").toLowerCase();
        const conceptKeys = new Set(["conceptMap", "conceptMapAndPrerequisites", "coreDefinitions"]);
        const timelineKeys = new Set(["detailsOfVideo", "detailedBreakdown", "practicalSteps"]);

        if (mode === "concepts" && conceptKeys.has(key)) {
            renderConceptTree(content, host);
            return;
        }
        if ((mode === "timeline" || (result && result.sourceType === "youtube" && key === "detailsOfVideo")) && timelineKeys.has(key)) {
            renderTimelineRail(content, host);
        }
    }

    globalThis.SummarizerVisualRenderers = {
        parseConceptNodes,
        parseTimelineEvents,
        renderConceptTree,
        renderTimelineRail,
        enhanceSectionBody
    };
})();
