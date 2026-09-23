(function () {
    const INLINE_PATTERN = /(\*\*(.+?)\*\*|__(.+?)__|`([^`]+)`|\*(.+?)\*|_([^_]+)_)/g;

    function appendInlineMarkdown(parent, text) {
        const source = String(text || "");
        let lastIndex = 0;
        let match;

        INLINE_PATTERN.lastIndex = 0;
        while ((match = INLINE_PATTERN.exec(source))) {
            if (match.index > lastIndex) {
                parent.appendChild(document.createTextNode(source.slice(lastIndex, match.index)));
            }

            const tagName = match[2] || match[3] ? "strong" : match[4] ? "code" : "em";
            const value = match[2] || match[3] || match[4] || match[5] || match[6] || "";
            const element = document.createElement(tagName);
            element.textContent = value;
            parent.appendChild(element);
            lastIndex = INLINE_PATTERN.lastIndex;
        }

        if (lastIndex < source.length) {
            parent.appendChild(document.createTextNode(source.slice(lastIndex)));
        }
    }

    function renderMarkdown(markdown) {
        const source = String(markdown || "").replace(/\r/g, "");
        const fragment = document.createDocumentFragment();
        if (!source.trim()) return fragment;

        const lines = source.split("\n");
        let list = null;

        function flushList() {
            if (list) {
                fragment.appendChild(list);
                list = null;
            }
        }

        lines.forEach((rawLine) => {
            const line = rawLine.trimEnd();
            const trimmed = line.trim();
            if (!trimmed) {
                flushList();
                return;
            }

            const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
            if (headingMatch) {
                flushList();
                const heading = document.createElement(`h${Math.min(headingMatch[1].length + 1, 6)}`);
                appendInlineMarkdown(heading, headingMatch[2]);
                fragment.appendChild(heading);
                return;
            }

            const listMatch = trimmed.match(/^[-*•]\s+(.+)$/);
            if (listMatch) {
                if (!list) list = document.createElement("ul");
                const item = document.createElement("li");
                appendInlineMarkdown(item, listMatch[1]);
                list.appendChild(item);
                return;
            }

            flushList();
            const paragraph = document.createElement("p");
            appendInlineMarkdown(paragraph, trimmed);
            fragment.appendChild(paragraph);
        });

        flushList();
        return fragment;
    }

    globalThis.SummarizerMarkdown = { renderMarkdown };
})();
