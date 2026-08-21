(function () {
    const MAX_CONTENT_LENGTH = SummarizerExtractorCore.MAX_CONTENT_LENGTH;
    const NOISE_SELECTORS = [
        "nav",
        "header",
        "footer",
        "aside",
        "[role='navigation']",
        "[role='complementary']",
        "[role='banner']",
        "[role='contentinfo']",
        ".cookie",
        ".cookies",
        ".consent",
        ".newsletter",
        ".subscribe",
        ".promo",
        ".advertisement",
        ".ads",
        ".related",
        ".recommend",
        ".social",
        ".share"
    ];

    function cleanNodeClone(root) {
        const clone = SummarizerExtractorCore.removeNoisyNodes(root);
        clone.querySelectorAll(NOISE_SELECTORS.join(",")).forEach((node) => node.remove());
        return clone;
    }

    function getNodeText(node) {
        return SummarizerCleaners.cleanText((node && (node.innerText || node.textContent)) || "");
    }

    function isLikelyContentContainer(node) {
        if (!node || node.nodeType !== Node.ELEMENT_NODE) {
            return false;
        }

        const tagName = String(node.tagName || "").toLowerCase();
        const role = String(node.getAttribute("role") || "").toLowerCase();
        const className = String(node.className || "").toLowerCase();
        const id = String(node.id || "").toLowerCase();

        if (["main", "article", "section"].includes(tagName)) {
            return true;
        }
        if (["main", "article", "document", "region"].includes(role)) {
            return true;
        }
        return /(content|article|post|story|body|markdown|prose|document|viewer|reader)/i.test(
            className + " " + id
        );
    }

    function scoreContentContainer(node) {
        const text = getNodeText(node);
        if (text.length < 120) {
            return 0;
        }

        const headings = node.querySelectorAll("h1, h2, h3").length;
        const paragraphs = node.querySelectorAll("p, li").length;
        const links = node.querySelectorAll("a").length;
        const buttons = node.querySelectorAll("button").length;
        const codeBlocks = node.querySelectorAll("pre, code").length;
        const textLength = Math.min(text.length, 15000);

        return (
            textLength +
            headings * 300 +
            paragraphs * 120 +
            codeBlocks * 100 -
            links * 25 -
            buttons * 40
        );
    }

    function extractAccessibilityTreeText(root) {
        const candidates = [];
        const seen = new Set();

        if (isLikelyContentContainer(root)) {
            candidates.push(root);
        }

        root.querySelectorAll("*").forEach((node) => {
            if (isLikelyContentContainer(node)) {
                candidates.push(node);
            }
        });

        const ranked = candidates
            .map((node) => ({
                text: getNodeText(node),
                score: scoreContentContainer(node)
            }))
            .filter((item) => item.score > 0 && item.text.length >= 120)
            .sort((left, right) => right.score - left.score);

        const blocks = [];
        ranked.forEach((item) => {
            const normalized = item.text.toLowerCase();
            if (seen.has(normalized)) {
                return;
            }
            seen.add(normalized);
            blocks.push(item.text);
        });

        return SummarizerExtractorCore.cleanJoinedText(blocks.slice(0, 8), "\n\n");
    }

    function extractFullPageText(root) {
        return SummarizerCleaners.cleanText((root && (root.innerText || root.textContent)) || "");
    }

    function extractReadableBlocks(root) {
        const parts = SummarizerExtractorCore.extractVisibleTextLines(root);
        const joined = SummarizerExtractorCore.cleanJoinedText(parts, "\n\n");
        if (joined.length > 200) {
            return joined;
        }
        return extractFullPageText(root);
    }

    function extractAccessibilityLikePageText(root) {
        const prioritySelectors = [
            "main",
            "[role='main']",
            "article",
            "section",
            "[data-testid]",
            "[class*='content']",
            "[class*='article']"
        ];
        const blocks = [];
        const seen = new Set();

        prioritySelectors.forEach((selector) => {
            root.querySelectorAll(selector).forEach((node) => {
                const text = SummarizerCleaners.cleanText(node.innerText || node.textContent || "");
                if (text.length < 50) {
                    return;
                }
                const normalized = text.toLowerCase();
                if (seen.has(normalized)) {
                    return;
                }
                seen.add(normalized);
                blocks.push(text);
            });
        });

        return SummarizerExtractorCore.cleanJoinedText(blocks, "\n\n");
    }

    function extractPageMetadataText() {
        const parts = [];
        const title = SummarizerCleaners.cleanText(document.title || "");
        const descriptionMeta = document.querySelector(
            'meta[name="description"], meta[property="og:description"], meta[name="twitter:description"]'
        );
        const description = SummarizerCleaners.cleanText(
            (descriptionMeta && descriptionMeta.getAttribute("content")) || ""
        );

        if (title) {
            parts.push("Page Title: " + title);
        }
        if (description) {
            parts.push("Page Description: " + description);
        }

        return parts.join("\n\n");
    }

    function scoreContentQuality(text) {
        const normalized = SummarizerCleaners.cleanText(text || "");
        if (!normalized) {
            return -Infinity;
        }

        const lines = normalized.split(/\n+/).map((line) => line.trim()).filter(Boolean);
        const longLines = lines.filter((line) => line.length >= 80).length;
        const shortLines = lines.filter((line) => line.length > 0 && line.length <= 24).length;
        const noiseMatches = (normalized.match(/\b(home|menu|login|sign up|subscribe|cookie|privacy|share|related)\b/gi) || []).length;
        return longLines * 4 - shortLines - noiseMatches * 2 + Math.min(normalized.length / 1000, 12);
    }

    function chooseBestWebpageContent(primaryContent, fallbackContent) {
        const primaryText = SummarizerCleaners.cleanText(primaryContent || "");
        const fallbackText = SummarizerCleaners.cleanText(fallbackContent || "");

        if (!fallbackText) {
            return primaryText;
        }
        if (!primaryText || primaryText.length < 240) {
            return fallbackText;
        }

        const primaryScore = scoreContentQuality(primaryText);
        const fallbackScore = scoreContentQuality(fallbackText);
        const primaryLooksWeak = primaryText.length < 400 || primaryScore < 5;

        if (primaryLooksWeak && fallbackText.length >= 160) {
            return fallbackText;
        }
        if (fallbackScore >= primaryScore + 3 && fallbackText.length >= Math.max(160, Math.floor(primaryText.length * 0.6))) {
            return fallbackText;
        }

        return primaryText;
    }

    function extractWebpageText() {
        const root = document.body;
        if (!root) {
            return null;
        }

        const cleanedRoot = cleanNodeClone(root);
        const semanticPageText = SummarizerExtractorCore.extractSemanticPageText(cleanedRoot, {
            maxLength: SummarizerExtractorCore.WEBPAGE_ACCESSIBILITY_MAX_LENGTH
        });
        const accessibilityTreeText = extractAccessibilityTreeText(cleanedRoot);
        const fullPageText = extractFullPageText(cleanedRoot);
        const readableBlocks = extractReadableBlocks(cleanedRoot);
        const accessibilityLike = extractAccessibilityLikePageText(cleanedRoot);
        const metadataText = extractPageMetadataText();
        const accessibilityFallback =
            globalThis.SummarizerAccessibilityTreeExtractor &&
            typeof globalThis.SummarizerAccessibilityTreeExtractor.extractPageContent === "function"
                ? globalThis.SummarizerAccessibilityTreeExtractor.extractPageContent({
                    maxLength: SummarizerExtractorCore.WEBPAGE_ACCESSIBILITY_MAX_LENGTH
                })
                : "";

        const candidateTexts = [
            semanticPageText,
            metadataText && semanticPageText
                ? SummarizerCleaners.cleanText(metadataText + "\n\n" + semanticPageText)
                : "",
            metadataText && accessibilityTreeText
                ? SummarizerCleaners.cleanText(metadataText + "\n\n" + accessibilityTreeText)
                : "",
            accessibilityTreeText,
            metadataText ? SummarizerCleaners.cleanText(metadataText + "\n\n" + accessibilityLike) : "",
            readableBlocks,
            accessibilityLike,
            metadataText ? SummarizerCleaners.cleanText(metadataText + "\n\n" + fullPageText) : "",
            fullPageText,
        ].filter(Boolean);

        const primaryContent =
            candidateTexts.find((candidate) => candidate.length >= 400) ||
            candidateTexts.find((candidate) => candidate.length >= 160) ||
            candidateTexts[0] ||
            "";
        const content = chooseBestWebpageContent(primaryContent, accessibilityFallback);
        if (!content || content.length < 80) {
            return null;
        }

        return {
            sourceType: "webpage",
            title: document.title || "Web page",
            url: location.href,
            content: SummarizerCleaners.truncateText(content, MAX_CONTENT_LENGTH)
        };
    }

    globalThis.SummarizerWebpageExtractor = {
        extractWebpageText
    };
})();
