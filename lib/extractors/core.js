(function () {
    const MAX_CONTENT_LENGTH = 180000;
    const WEBPAGE_ACCESSIBILITY_MAX_LENGTH = 80000;

    function cleanJoinedText(parts, separator) {
        return SummarizerCleaners.cleanText((parts || []).filter(Boolean).join(separator || "\n\n"));
    }

    function decodeYouTubeUrl(rawUrl) {
        return String(rawUrl || "")
            .replace(/\\u0026/g, "&")
            .replace(/\\\//g, "/")
            .replace(/&amp;/g, "&");
    }

    function extractJsonObject(rawText, startIndex) {
        let depth = 0;
        let inString = false;
        let isEscaped = false;

        for (let index = startIndex; index < rawText.length; index += 1) {
            const char = rawText[index];

            if (inString) {
                if (isEscaped) {
                    isEscaped = false;
                    continue;
                }
                if (char === "\\") {
                    isEscaped = true;
                    continue;
                }
                if (char === "\"") {
                    inString = false;
                }
                continue;
            }

            if (char === "\"") {
                inString = true;
                continue;
            }

            if (char === "{") {
                depth += 1;
                continue;
            }

            if (char === "}") {
                depth -= 1;
                if (depth === 0) {
                    return rawText.slice(startIndex, index + 1);
                }
            }
        }

        return "";
    }

    function findScriptJsonObject(markers) {
        const scripts = Array.from(document.scripts || []);

        for (const script of scripts) {
            const text = script.textContent || "";
            for (const marker of markers || []) {
                const markerIndex = text.indexOf(marker);
                if (markerIndex === -1) {
                    continue;
                }
                const objectStart = text.indexOf("{", markerIndex);
                if (objectStart === -1) {
                    continue;
                }
                const jsonText = extractJsonObject(text, objectStart);
                if (!jsonText) {
                    continue;
                }
                try {
                    return JSON.parse(jsonText);
                } catch (error) {
                    console.log("Failed to parse embedded JSON marker:", marker, error);
                }
            }
        }

        return null;
    }

    function getTextFromRuns(value) {
        if (!value) {
            return "";
        }
        if (typeof value === "string") {
            return value;
        }
        if (Array.isArray(value)) {
            return value.map(getTextFromRuns).filter(Boolean).join("");
        }
        if (typeof value.simpleText === "string") {
            return value.simpleText;
        }
        if (typeof value.text === "string") {
            return value.text;
        }
        if (Array.isArray(value.runs)) {
            return value.runs.map((item) => item.text || "").join("");
        }
        return "";
    }

    function formatTimestamp(totalSeconds) {
        const seconds = Math.max(0, Math.floor(Number(totalSeconds || 0)));
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainder = seconds % 60;

        if (hours > 0) {
            return [
                String(hours).padStart(2, "0"),
                String(minutes).padStart(2, "0"),
                String(remainder).padStart(2, "0")
            ].join(":");
        }

        return [
            String(minutes).padStart(2, "0"),
            String(remainder).padStart(2, "0")
        ].join(":");
    }

    function removeNoisyNodes(root) {
        const clone = root.cloneNode(true);
        const selectors = [
            "script",
            "style",
            "noscript",
            "template",
            "svg",
            "canvas",
            "iframe",
            "video",
            "audio",
            "[aria-hidden='true']",
            "[hidden]"
        ];
        clone.querySelectorAll(selectors.join(",")).forEach((node) => node.remove());
        return clone;
    }

    function extractVisibleTextLines(root) {
        const candidateSelector =
            "h1, h2, h3, h4, h5, h6, p, li, blockquote, pre, td, th, figcaption, summary, section, article, main, div";
        const nodes = Array.from(root.querySelectorAll(candidateSelector));
        const seen = new Set();
        const parts = [];

        nodes.forEach((node) => {
            const text = SummarizerCleaners.cleanText(node.innerText || node.textContent || "");
            if (text.length < 20) {
                return;
            }
            const normalized = text.toLowerCase();
            if (seen.has(normalized)) {
                return;
            }
            seen.add(normalized);
            parts.push(text);
        });

        return parts;
    }

    function getSemanticRole(element) {
        if (!element || element.nodeType !== Node.ELEMENT_NODE) {
            return null;
        }

        const explicitRole = element.getAttribute("role");
        if (explicitRole) {
            return explicitRole;
        }

        const tagName = String(element.tagName || "").toLowerCase();
        const inputType = String(element.getAttribute("type") || "").toLowerCase();
        const roleMap = {
            a: "link",
            button: "button",
            h1: "heading",
            h2: "heading",
            h3: "heading",
            h4: "heading",
            h5: "heading",
            h6: "heading",
            p: "paragraph",
            article: "article",
            section: "section",
            main: "main",
            nav: "navigation",
            header: "banner",
            footer: "contentinfo",
            aside: "complementary",
            blockquote: "blockquote",
            ul: "list",
            ol: "list",
            li: "listitem",
            img: "image",
            figure: "figure",
            figcaption: "caption",
            table: "table",
            pre: "code",
            code: "code"
        };

        if (tagName === "input") {
            return inputType === "submit" || inputType === "button" ? "button" : "textbox";
        }

        return roleMap[tagName] || null;
    }

    function isElementVisible(element) {
        if (!element || element.nodeType !== Node.ELEMENT_NODE) {
            return false;
        }
        if (!element.offsetParent && String(element.tagName || "").toUpperCase() !== "BODY") {
            return false;
        }

        const style = window.getComputedStyle(element);
        return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
    }

    function shouldSkipSemanticNode(element) {
        const tagName = String(element.tagName || "").toLowerCase();
        const skipTags = [
            "script",
            "style",
            "meta",
            "link",
            "noscript",
            "svg",
            "path",
            "iframe",
            "embed",
            "object",
            "input",
            "button",
            "select",
            "textarea",
            "form"
        ];
        if (skipTags.includes(tagName)) {
            return true;
        }

        if (element.getAttribute("aria-hidden") === "true" || element.hasAttribute("hidden")) {
            return true;
        }

        const role = String(element.getAttribute("role") || "").toLowerCase();
        if (["navigation", "banner", "contentinfo", "complementary", "menu", "menubar"].includes(role)) {
            return true;
        }

        const className = String(element.className || "").toLowerCase();
        const id = String(element.id || "").toLowerCase();
        const skipParts = [
            "nav",
            "menu",
            "sidebar",
            "footer",
            "header",
            "ad",
            "advertisement",
            "social",
            "share",
            "related",
            "recommended",
            "popup",
            "modal",
            "cookie",
            "newsletter",
            "subscribe"
        ];

        return skipParts.some((part) => className.includes(part) || id.includes(part));
    }

    function getHeadingLevel(element) {
        const match = String(element.tagName || "").match(/^H([1-6])$/i);
        return match ? Number(match[1]) : null;
    }

    function extractSemanticPageText(root, options) {
        const settings = options || {};
        const maxLength = Number(settings.maxLength || WEBPAGE_ACCESSIBILITY_MAX_LENGTH);
        const content = [];
        let totalLength = 0;

        function pushText(value) {
            const cleaned = SummarizerCleaners.cleanText(value);
            if (!cleaned) {
                return;
            }
            content.push(cleaned);
            totalLength += cleaned.length;
        }

        function processElement(element) {
            if (totalLength >= maxLength) {
                return;
            }
            if (!element || element.nodeType !== Node.ELEMENT_NODE) {
                return;
            }
            if (!isElementVisible(element) || shouldSkipSemanticNode(element)) {
                return;
            }

            const tagName = String(element.tagName || "").toLowerCase();
            const role = getSemanticRole(element);

            if (role === "heading") {
                const level = getHeadingLevel(element) || 1;
                const text = SummarizerCleaners.cleanText(element.textContent || "");
                if (text) {
                    pushText("#".repeat(level) + " " + text);
                }
                return;
            }

            if (tagName === "p") {
                const text = SummarizerCleaners.cleanText(element.textContent || "");
                if (text.length > 20) {
                    pushText(text);
                }
                return;
            }

            if (tagName === "blockquote") {
                const text = SummarizerCleaners.cleanText(element.textContent || "");
                if (text) {
                    pushText("> " + text);
                }
                return;
            }

            if (tagName === "pre" || tagName === "code") {
                const text = (element.textContent || "").trim();
                if (text) {
                    pushText(text);
                }
                return;
            }

            if (tagName === "li") {
                const text = SummarizerCleaners.cleanText(element.textContent || "");
                if (text) {
                    pushText("- " + text);
                }
                return;
            }

            if (tagName === "img") {
                const alt = SummarizerCleaners.cleanText(element.getAttribute("alt") || "");
                if (alt.length > 5) {
                    pushText("[Image: " + alt + "]");
                }
                return;
            }

            Array.from(element.children || []).forEach(processElement);
        }

        const mainContent = document.querySelector("main, [role='main'], article, .content, #content, .post, .article");
        processElement(mainContent || root || document.body);

        return SummarizerCleaners.cleanText(content.join("\n\n"));
    }

    globalThis.SummarizerExtractorCore = {
        MAX_CONTENT_LENGTH,
        WEBPAGE_ACCESSIBILITY_MAX_LENGTH,
        cleanJoinedText,
        decodeYouTubeUrl,
        extractJsonObject,
        findScriptJsonObject,
        getTextFromRuns,
        formatTimestamp,
        removeNoisyNodes,
        extractVisibleTextLines,
        extractSemanticPageText
    };
})();
