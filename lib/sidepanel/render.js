(function () {
    const transcriptResults = new WeakMap();
    const transcriptLines = new WeakMap();
    const transcriptClickHosts = new WeakSet();

    function normalizeListText(value) {
        return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
    }
    function normalizeSectionContent(value) {
        if (Array.isArray(value)) {
            return value
                .filter((item) => item !== null && item !== undefined)
                .map((item) => String(item).trim())
                .filter(Boolean)
                .join("\n");
        }
        return String(value || "").trim();
    }
    function isSectionHeading(value) {
        return /^(main summary|executive takeaways|details of the video|complete guided walkthrough|concepts, definitions & mental models|reasoning, evidence & claim audit|connections, causes & tradeoffs|practical application|caveats, biases & open questions|memory & review kit|follow-up questions|concept map|core definitions|prerequisites & misconceptions|practical steps|pitfalls & warnings|resources & tools)\s*:?$/i.test(String(value || "").trim());
    }
    function setExpanded(element, isVisible) { if (!element) return; element.hidden = !Boolean(isVisible); }
    function getExpansionMode(result) {
        if (!result) return "standard";
        const size = String(result.summarySize || "").toLowerCase();
        const length = String(result.summaryLength || "").toLowerCase();
        const mode = String(result.expansionMode || "").toLowerCase();
        const promptMode = String(result.promptMode || "").toLowerCase();
        const isBrief = size === "brief" && length !== "long";
        const deepPromptMode = new Set(["analyze", "explain", "study", "debate", "concepts"]).has(promptMode);
        if (mode === "deep" || size === "deep" || length === "long" || (!isBrief && deepPromptMode)) return "deep";
        return "standard";
    }
    function getRequestedSectionMap(result) {
        const mode = String(result && result.promptMode || "summarize").toLowerCase();
        if (mode === "concepts") {
            return [
                { key: "conceptMap", label: "Concept Map" },
                { key: "coreDefinitions", label: "Core Definitions" },
                { key: "prerequisitesMisconceptions", label: "Prerequisites & Misconceptions" },
                { key: "practicalSteps", label: "Practical Steps" },
                { key: "pitfallsWarnings", label: "Pitfalls & Warnings" },
                { key: "resourcesTools", label: "Resources & Tools" }
            ];
        }

        const sourceType = String(result && result.sourceType || "").toLowerCase();
        const size = String(result && result.summarySize || "Medium").toLowerCase();
        const isBrief = size === "brief";
        const deepModes = new Set(["analyze", "explain", "study", "debate"]);
        const includesDeepSections = !isBrief && (size === "deep" || deepModes.has(mode));
        const sections = [];
        if (!isBrief && sourceType === "youtube") {
            sections.push({ key: "detailsOfVideo", label: "Details of the Video" });
        }
        sections.push({ key: "detailedBreakdown", label: "Complete Guided Walkthrough" });
        if (!isBrief && (sourceType === "course" || mode === "study" || mode === "explain" || includesDeepSections)) {
            sections.push({ key: "conceptMapAndPrerequisites", label: "Concepts, Definitions & Mental Models" });
        }
        if (!isBrief) {
            sections.push(
                { key: "evidenceAndDetails", label: "Reasoning, Evidence & Claim Audit" },
                { key: "argumentAndInsight", label: "Connections, Causes & Tradeoffs" }
            );
            if (sourceType === "course" || mode === "study" || mode === "analyze") {
                sections.push({ key: "practicalSteps", label: "Practical Application" });
            }
        }
        sections.push({ key: "expertCommentary", label: "Caveats, Biases & Open Questions" });
        if (!isBrief && (mode === "study" || includesDeepSections)) {
            sections.push({ key: "reviewKit", label: "Memory & Review Kit" });
        }
        return sections;
    }
    function getCustomSectionMap(result) {
        const sections = Array.isArray(result && result.sections) ? result.sections : [];
        return sections
            .filter((section) => section && !section.canonicalKey && section.heading && section.content)
            .map((section, index) => ({
                key: String(section.id || `custom-${index + 1}`),
                label: String(section.heading).trim(),
                content: String(section.content).trim(),
                custom: true
            }));
    }
    function captureExpandedKeys(deepDive) {
        const keys = [];
        if (!deepDive) return keys;
        deepDive.querySelectorAll(".collapsible-section").forEach((article) => {
            const toggle = article.querySelector(".section-toggle");
            const body = article.querySelector(".section-body");
            if (toggle && body && toggle.getAttribute("aria-expanded") === "true" && body.id) {
                keys.push(body.id.replace("section-content-", ""));
            }
        });
        return keys;
    }
    
    function prepareTranscript(elements, result) {
        const host = elements.transcriptContent;
        const section = elements.transcriptSection || document.getElementById("transcript-section");
        if (!host) return;
        const hasSegments = Boolean(result && Array.isArray(result.transcriptSegments) && result.transcriptSegments.length);
        const hasSource = Boolean(result && (result.sourceContentRaw || result.sourceContentForPrompt));
        const hasTranscript = Boolean(result && result.sourceType === "youtube" && (hasSegments || hasSource));
        if (section) section.hidden = !hasTranscript;
        if (elements.transcriptCopyBtn) elements.transcriptCopyBtn.disabled = !hasTranscript;
        if (elements.transcriptSrtBtn) elements.transcriptSrtBtn.disabled = !hasTranscript;
        host.replaceChildren();
        host.hidden = true;
        transcriptResults.set(host, hasTranscript ? result : null);
        transcriptLines.delete(host);
        const toggle = document.getElementById("transcript-toggle");
        if (toggle) {
            toggle.setAttribute("aria-expanded", "false");
            const icon = toggle.querySelector(".transcript-toggle-icon");
            if (icon) icon.textContent = "\u25b6";
            const hint = toggle.querySelector(".transcript-toggle-hint");
            if (hint) hint.textContent = hint.dataset.collapsedLabel || "Click to show";
        }
    }

    function renderTranscript(elements) {
        const host = elements.transcriptContent;
        if (!host || host.childElementCount) return;
        const result = transcriptResults.get(host);
        if (!result) return;
        const transcript = globalThis.SummarizerTranscriptExport
            ? SummarizerTranscriptExport.buildPlainTranscript(result)
            : (result.sourceContentRaw || result.sourceContentForPrompt || "");
        const lines = String(transcript || "").split("\n");
        transcriptLines.set(host, lines);
        const fragment = document.createDocumentFragment();
        lines.forEach((line, index) => {
            const cleaned = stripDurationLabel(line);
            const row = document.createElement("div");
            row.className = "transcript-line";
            row.dataset.lineIndex = String(index);
            row.textContent = cleaned || " ";
            row.title = "Click to copy line";
            fragment.appendChild(row);
        });
        host.appendChild(fragment);
        if (!transcriptClickHosts.has(host)) {
            transcriptClickHosts.add(host);
            host.addEventListener("click", async (event) => {
                const row = event.target.closest(".transcript-line");
                if (!row || !host.contains(row)) return;
                const values = transcriptLines.get(host) || [];
                const line = values[Number(row.dataset.lineIndex)] || row.textContent || "";
                try { await navigator.clipboard.writeText(line); } catch (_) {}
            });
        }
    }
    function stripDurationLabel(text) {
        // Keep [MM:SS]/[HH:MM:SS], strip localized spoken duration labels like
        // "1 phút, 1 giây" / "1 minute, 1 second" that YouTube sometimes prefixes.
        // Vietnamese UI often glues the label to caption text: "20 giâyCu thể...".
        const value = String(text || "");
        const match = value.match(/^(\[[\d:]{4,8}\]\s*)?(.*)$/);
        if (!match) return value.trim();
        const stamp = match[1] || "";
        let body = String(match[2] || "").trim();
        body = stripDurationLabelFromBody(body);
        return (stamp + body).trim();
    }
    function stripDurationLabelFromBody(text) {
        return String(text || "")
            .replace(/^\d+\s*(?:phút|phut|minutes?|mins?|menit|minuut)(?:\s*,\s*|\s+and\s+|\s+)?(?:\d+\s*(?:giây|giay|seconds?|secs?|detik|seconde))?[\s,.:;\-]*/i, "")
            .replace(/^\d+\s*(?:giây|giay|seconds?|secs?|detik|seconde)[\s,.:;\-]*/i, "")
            .trim();
    }
    function filterTranscript(elements, filterText) {
        const host = elements.transcriptContent;
        if (!host) return;
        const query = String(filterText || "").trim().toLowerCase();
        host.querySelectorAll(".transcript-line").forEach((row) => {
            const text = String(row.textContent || "").toLowerCase();
            const matches = !query || text.includes(query);
            row.hidden = !matches;
            row.classList.toggle("is-match", Boolean(query && matches));
        });
    }
    function renderFollowUpQuestions(questions, elements, askFollowUp) {
        if (!elements.followUpQuestions || !elements.followUpQuestionsWrap) return;
        elements.followUpQuestions.replaceChildren();
        const visibleQuestions = (questions || []).slice(0, 6);
        setExpanded(elements.followUpQuestionsWrap, visibleQuestions.length > 0);
        visibleQuestions.forEach((question) => {
            const button = document.createElement("button");
            button.className = "follow-up-btn";
            button.type = "button";
            button.textContent = question;
            button.addEventListener("click", () => {
                if (elements.chatInput) { elements.chatInput.value = question; elements.chatInput.focus(); }
                if (typeof askFollowUp === "function") askFollowUp();
            });
            elements.followUpQuestions.appendChild(button);
        });
    }

    function clearAllContent(elements) {
        if (elements.emptyState) elements.emptyState.hidden = true;
        if (elements.summaryContent) elements.summaryContent.hidden = false;
        if (elements.title) elements.title.textContent = "Summarizing...";

        // 1. Summary Skeleton
        if (elements.summary) {
            elements.summary.className = "text-block skeleton skeleton-text";
            elements.summary.replaceChildren();
            ["100%", "92%", "75%"].forEach((width, index) => {
                const line = document.createElement("div");
                line.className = "skeleton-body";
                line.style.height = "14px";
                line.style.width = width;
                if (index < 2) line.style.marginBottom = "8px";
                elements.summary.appendChild(line);
            });
        }

        // 2. Takeaways Skeleton
        if (elements.takeaways) {
            elements.takeaways.replaceChildren();
            for (let i = 0; i < 3; i++) {
                const li = document.createElement("li");
                li.className = "placeholder skeleton skeleton-text";
                li.style.width = i === 0 ? "85%" : i === 1 ? "95%" : "70%";
                const skeleton = document.createElement("span");
                skeleton.className = "skeleton-body";
                skeleton.style.display = "inline-block";
                skeleton.style.height = "12px";
                skeleton.style.width = "100%";
                li.appendChild(skeleton);
                elements.takeaways.appendChild(li);
            }
        }

        // 3. Deep Dive Placeholder Sections
        if (elements.deepDiveSections) {
            elements.deepDiveSections.replaceChildren();
            const expectedKeys = [
                { label: "Complete Guided Walkthrough", key: "guided-walkthrough" },
                { label: "Concepts & Definitions", key: "concepts-definitions" },
                { label: "Evidence & Claim Audit", key: "claim-audit" },
                { label: "Connections & Tradeoffs", key: "connections-tradeoffs" },
                { label: "Caveats & Open Questions", key: "caveats-questions" }
            ];
            expectedKeys.forEach((sec) => {
                const article = document.createElement("article");
                article.className = "content-card flat-section";
                const heading = document.createElement("h3");
                heading.id = sec.key;
                heading.textContent = sec.label;
                const body = document.createElement("div");
                body.className = "text-block skeleton skeleton-text";
                ["95%", "88%", "60%"].forEach((width, index) => {
                    const line = document.createElement("div");
                    line.className = "skeleton-body";
                    line.style.height = "12px";
                    line.style.width = width;
                    if (index < 2) line.style.marginBottom = "8px";
                    body.appendChild(line);
                });
                article.append(heading, body);
                elements.deepDiveSections.appendChild(article);
            });
        }

        // 4. Suggested Questions Skeleton
        if (elements.followUpQuestionsWrap) elements.followUpQuestionsWrap.hidden = false;
        if (elements.followUpQuestions) {
            elements.followUpQuestions.replaceChildren();
            for (let i = 0; i < 3; i++) {
                const btn = document.createElement("button");
                btn.className = "follow-up-btn skeleton skeleton-text";
                btn.style.width = i === 0 ? "110px" : i === 1 ? "140px" : "95px";
                btn.style.height = "32px";
                btn.style.border = "none";
                btn.disabled = true;
                elements.followUpQuestions.appendChild(btn);
            }
        }

        if (elements.transcriptContent) elements.transcriptContent.replaceChildren();
        const transcriptSection = document.getElementById("transcript-section");
        if (transcriptSection) transcriptSection.hidden = true;
        if (elements.transcriptCopyBtn) elements.transcriptCopyBtn.disabled = true;
        if (elements.transcriptSrtBtn) elements.transcriptSrtBtn.disabled = true;
        if (globalThis.SummarizerSidepanelToc && typeof SummarizerSidepanelToc.reset === "function") {
            SummarizerSidepanelToc.reset(elements);
        }
        if (elements.chatLog) elements.chatLog.replaceChildren();
        if (elements.floatingActions) elements.floatingActions.hidden = true;

    }
    function createToggleBtns(deepDive) {
        if (!deepDive) return;
        const controls = document.createElement("div");
        controls.className = "section-toggle-controls";
        controls.setAttribute("role", "toolbar");
        controls.setAttribute("aria-label", "Section controls");
        const expandAll = document.createElement("button");
        expandAll.type = "button";
        expandAll.className = "btn-ghost btn-sm";
        expandAll.textContent = "Expand all";
        expandAll.addEventListener("click", () => {
            deepDive.querySelectorAll(".collapsible-section").forEach((sec) => {
                const body = sec.querySelector(".section-body");
                const toggle = sec.querySelector(".section-toggle");
                if (body) body.hidden = false;
                if (toggle) {
                    toggle.setAttribute("aria-expanded", "true");
                    const icon = toggle.querySelector(".toggle-icon");
                    if (icon) icon.textContent = "\u25bc";
                }
            });
        });
        const collapseAll = document.createElement("button");
        collapseAll.type = "button";
        collapseAll.className = "btn-ghost btn-sm";
        collapseAll.textContent = "Collapse all";
        collapseAll.addEventListener("click", () => {
            deepDive.querySelectorAll(".collapsible-section").forEach((sec) => {
                const body = sec.querySelector(".section-body");
                const toggle = sec.querySelector(".section-toggle");
                if (body) body.hidden = true;
                if (toggle) {
                    toggle.setAttribute("aria-expanded", "false");
                    const icon = toggle.querySelector(".toggle-icon");
                    if (icon) icon.textContent = "\u25b6";
                }
            });
        });
        controls.appendChild(expandAll);
        controls.appendChild(collapseAll);
        deepDive.appendChild(controls);
    }

    function renderResult(result, elements, askFollowUp) {
        const emptyState = elements.emptyState || document.getElementById("empty-state");
        const summaryContent = elements.summaryContent || document.getElementById("summary-content");
        const summaryOverview = elements.summaryOverview || document.getElementById("summary-overview");
        const deepDive = elements.deepDiveSections || document.getElementById("deep-dive-sections");
        if (!result) {
            if (emptyState) emptyState.hidden = false;
            if (summaryContent) summaryContent.hidden = true;
            if (elements.floatingActions) elements.floatingActions.hidden = true;
            if (summaryOverview) summaryOverview.hidden = false;
            if (elements.title) elements.title.textContent = "No summary yet";
            if (elements.summary) { elements.summary.classList.remove("skeleton", "skeleton-text"); elements.summary.textContent = ""; }
            if (elements.takeaways) elements.takeaways.replaceChildren();
            if (deepDive) deepDive.replaceChildren();
            prepareTranscript(elements, null);
            renderFollowUpQuestions([], elements, askFollowUp);
            if (globalThis.SummarizerSidepanelToc && typeof SummarizerSidepanelToc.reset === "function") {
                SummarizerSidepanelToc.reset(elements);
            }
            return;
        }
        if (emptyState) emptyState.hidden = true;
        if (summaryContent) summaryContent.hidden = false;
        if (elements.floatingActions) elements.floatingActions.hidden = false;
        const showOverview = String(result.promptMode || "summarize").toLowerCase() !== "concepts";
        if (summaryOverview) summaryOverview.hidden = !showOverview;
        if (elements.title) elements.title.textContent = result.title || "Summary";
        if (elements.summary) {
            elements.summary.classList.remove("skeleton", "skeleton-text");
            elements.summary.replaceChildren();
            if (showOverview) elements.summary.appendChild(SummarizerMarkdown.renderMarkdown(result.summary || ""));
        }
        if (elements.takeaways) {
            elements.takeaways.replaceChildren();
            const takeawaysCard = elements.takeaways.closest("article");
            if (takeawaysCard) takeawaysCard.hidden = !showOverview;
            const seen = new Set();
            const items = showOverview && result.keyTakeaways && result.keyTakeaways.length
                ? result.keyTakeaways.filter((item) => {
                    const normalized = normalizeListText(item);
                    if (!normalized || isSectionHeading(item) || seen.has(normalized)) return false;
                    seen.add(normalized);
                    return true;
                })
                : ["No takeaways returned."];
            items.forEach((item) => {
                const listItem = document.createElement("li");
                if (item === "No takeaways returned.") { listItem.className = "placeholder"; listItem.textContent = item; }
                else { listItem.appendChild(SummarizerMarkdown.renderMarkdown(item)); listItem.title = "Click to copy takeaway"; listItem.addEventListener("click", async () => { try { await navigator.clipboard.writeText(String(item)); } catch (_) {} }); }
                elements.takeaways.appendChild(listItem);
            });
        }
        if (deepDive) {
            // Preserve user expand/collapse state across streaming updates.
            const expandedBefore = captureExpandedKeys(deepDive);
            const userExpandedKeys = new Set(expandedBefore);
            const expansionMode = getExpansionMode(result);
            const weakKeys = new Set(
                result.quality && Array.isArray(result.quality.weakSections)
                    ? result.quality.weakSections
                    : []
            );
            deepDive.replaceChildren();
            const sectionMap = getRequestedSectionMap(result).concat(getCustomSectionMap(result));
            // First non-empty substantive section is the default expand target.
            let expandedKey = null;
            const substantiveKeys = [];
            for (const section of sectionMap) {
                const content = section.custom ? section.content : normalizeSectionContent(result[section.key]);
                if (!content) continue;
                if (section.key !== "detailsOfVideo") substantiveKeys.push(section.key);
                if (!expandedKey && section.key !== "detailsOfVideo") expandedKey = section.key;
            }
            createToggleBtns(deepDive);
            sectionMap.forEach(({ key, label, custom, content: customContent }) => {
                const content = custom ? normalizeSectionContent(customContent) : normalizeSectionContent(result[key]);
                if (!content) return;
                let shouldExpand = key === (expandedKey || "detailedBreakdown");
                // Deep/Long: expand the first three substantive sections.
                if (expansionMode === "deep") {
                    const rank = substantiveKeys.indexOf(key);
                    shouldExpand = rank >= 0 && rank < 3;
                }
                // Long-only expansionMode "deep" with summaryLength Long expands more.
                if (String(result.summaryLength || "").toLowerCase() === "long" && key !== "detailsOfVideo") {
                    shouldExpand = true;
                }
                // Prefer previously expanded keys during streaming updates.
                if (userExpandedKeys.size > 0) {
                    shouldExpand = userExpandedKeys.has(key);
                }
                // Highlight weak sections for Deep/Long quality feedback.
                if (weakKeys.has(key) && expansionMode === "deep" && userExpandedKeys.size === 0) {
                    shouldExpand = true;
                }

                const article = document.createElement("article");
                article.className = "content-card collapsible-section";
                article.id = custom ? key : "result-section-" + key;
                article.dataset.tocLabel = label;
                article.setAttribute("aria-labelledby", "section-heading-" + key);
                if (weakKeys.has(key)) article.classList.add("is-weak-section");

                const sectionToggle = document.createElement("button");
                sectionToggle.type = "button";
                sectionToggle.className = "section-toggle";
                sectionToggle.setAttribute("aria-expanded", shouldExpand ? "true" : "false");
                sectionToggle.setAttribute("aria-controls", "section-content-" + key);
                sectionToggle.setAttribute("aria-label", (shouldExpand ? "Collapse " : "Expand ") + label);
                const icon = document.createElement("span");
                icon.className = "toggle-icon";
                icon.setAttribute("aria-hidden", "true");
                icon.textContent = shouldExpand ? "\u25bc" : "\u25b6";
                const labelNode = document.createElement("span");
                labelNode.className = "toggle-label";
                labelNode.id = "section-heading-" + key;
                labelNode.textContent = label;
                sectionToggle.appendChild(icon);
                sectionToggle.appendChild(document.createTextNode(" "));
                sectionToggle.appendChild(labelNode);

                const sectionBody = document.createElement("div");
                sectionBody.className = "section-body text-block";
                sectionBody.id = "section-content-" + key;
                sectionBody.setAttribute("role", "region");
                sectionBody.setAttribute("aria-labelledby", "section-heading-" + key);
                sectionBody.hidden = !shouldExpand;
                sectionBody.appendChild(SummarizerMarkdown.renderMarkdown(content));

                if (globalThis.SummarizerVisualRenderers && typeof SummarizerVisualRenderers.enhanceSectionBody === "function") {
                    SummarizerVisualRenderers.enhanceSectionBody(key, content, sectionBody, result);
                }

                const copySecBtn = document.createElement("button");
                copySecBtn.type = "button";
                copySecBtn.className = "btn-ghost btn-xs section-copy-btn";
                copySecBtn.textContent = "Copy";
                copySecBtn.setAttribute("aria-label", "Copy " + label);
                copySecBtn.addEventListener("click", async (e) => {
                    e.stopPropagation();
                    try {
                        await navigator.clipboard.writeText(content);
                        copySecBtn.textContent = "Copied!";
                        setTimeout(() => (copySecBtn.textContent = "Copy"), 1200);
                    } catch (_) {}
                });
                sectionBody.appendChild(copySecBtn);

                sectionToggle.addEventListener("click", () => {
                    const isNowExpanded = sectionBody.hidden;
                    sectionBody.hidden = !isNowExpanded;
                    sectionToggle.setAttribute("aria-expanded", String(isNowExpanded));
                    sectionToggle.setAttribute("aria-label", (isNowExpanded ? "Collapse " : "Expand ") + label);
                    const icon = sectionToggle.querySelector(".toggle-icon");
                    if (icon) icon.textContent = isNowExpanded ? "\u25bc" : "\u25b6";
                });

                article.appendChild(sectionToggle);
                article.appendChild(sectionBody);
                deepDive.appendChild(article);
            });
        }
        if (!result.streaming) prepareTranscript(elements, result);
        if (!result.streaming) {
            const followUps = String(result.promptMode || "").toLowerCase() === "concepts"
                ? []
                : (result.followUpQuestions || []);
            renderFollowUpQuestions(followUps, elements, askFollowUp);
        }
        if (!result.streaming && globalThis.SummarizerSidepanelToc && typeof SummarizerSidepanelToc.build === "function") {
            SummarizerSidepanelToc.build(elements, result);
        }
    }
    globalThis.SummarizerRender = {
        normalizeListText,
        normalizeSectionContent,
        getRequestedSectionMap,
        getCustomSectionMap,
        isSectionHeading,
        setExpanded,
        prepareTranscript,
        renderTranscript,
        filterTranscript,
        renderFollowUpQuestions,
        clearAllContent,
        renderResult
    };
})();
