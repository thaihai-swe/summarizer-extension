(function () {
    function getRole(element) {
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

    function isVisible(element) {
        if (!element || element.nodeType !== Node.ELEMENT_NODE) {
            return false;
        }
        if (!element.offsetParent && String(element.tagName || "").toUpperCase() !== "BODY") {
            return false;
        }

        const style = window.getComputedStyle(element);
        return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
    }

    function shouldSkip(element) {
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
        const skipPatterns = [
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
        return skipPatterns.some((pattern) => className.includes(pattern) || id.includes(pattern));
    }

    function getHeadingLevel(element) {
        const match = String(element.tagName || "").match(/^H([1-6])$/i);
        return match ? Number(match[1]) : null;
    }

    function extractPageContent(options) {
        const settings = options || {};
        const maxLength = Math.max(1000, Number(settings.maxLength || 80000));
        const parts = [];
        let totalLength = 0;

        function push(text) {
            const cleaned = SummarizerCleaners.cleanText(text);
            if (!cleaned) {
                return;
            }
            parts.push(cleaned);
            totalLength += cleaned.length;
        }

        function processElement(element) {
            if (!element || element.nodeType !== Node.ELEMENT_NODE || totalLength >= maxLength) {
                return;
            }
            if (!isVisible(element) || shouldSkip(element)) {
                return;
            }

            const tagName = String(element.tagName || "").toLowerCase();
            const role = getRole(element);

            if (role === "heading") {
                const level = getHeadingLevel(element) || 2;
                push("#".repeat(level) + " " + (element.textContent || ""));
                return;
            }

            if (tagName === "p" || tagName === "blockquote") {
                const text = element.textContent || "";
                if (SummarizerCleaners.cleanText(text).length > 20) {
                    push(text);
                }
                return;
            }

            if (tagName === "li") {
                const text = element.textContent || "";
                if (SummarizerCleaners.cleanText(text).length > 10) {
                    push("- " + text);
                }
                return;
            }

            if (tagName === "pre" || tagName === "code") {
                push(element.textContent || "");
                return;
            }

            Array.from(element.children || []).forEach(processElement);
        }

        processElement(document.body);
        return SummarizerCleaners.truncateText(
            SummarizerCleaners.cleanText(parts.join("\n\n")),
            maxLength
        );
    }

    globalThis.SummarizerAccessibilityTreeExtractor = {
        extractPageContent
    };
})();
