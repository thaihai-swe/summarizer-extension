(function () {
    function escapeHtml(text) {
        return String(text || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function applyInlineMarkdown(text) {
        return String(text || "")
            .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
            .replace(/__(.+?)__/g, "<strong>$1</strong>")
            .replace(/`([^`]+)`/g, "<code>$1</code>")
            .replace(/\*(.+?)\*/g, "<em>$1</em>")
            .replace(/_(.+?)_/g, "<em>$1</em>");
    }

    function renderMarkdown(markdown) {
        const source = String(markdown || "").replace(/\r/g, "");
        if (!source.trim()) {
            return "";
        }

        const lines = source.split("\n");
        const output = [];
        let listBuffer = [];

        function flushList() {
            if (!listBuffer.length) {
                return;
            }
            output.push("<ul>");
            listBuffer.forEach((item) => {
                output.push(`<li>${applyInlineMarkdown(item)}</li>`);
            });
            output.push("</ul>");
            listBuffer = [];
        }

        for (const rawLine of lines) {
            const line = rawLine.trimEnd();
            const trimmed = line.trim();

            if (!trimmed) {
                flushList();
                continue;
            }

            const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
            if (headingMatch) {
                flushList();
                const level = Math.min(headingMatch[1].length + 1, 6);
                output.push(
                    `<h${level}>${applyInlineMarkdown(headingMatch[2])}</h${level}>`
                );
                continue;
            }

            const listMatch = trimmed.match(/^[-*•]\s+(.+)$/);
            if (listMatch) {
                listBuffer.push(listMatch[1]);
                continue;
            }

            flushList();
            output.push(`<p>${applyInlineMarkdown(trimmed)}</p>`);
        }

        flushList();
        return output.join("");
    }

    globalThis.SummarizerMarkdown = {
        renderMarkdown,
        escapeHtml
    };
})();
