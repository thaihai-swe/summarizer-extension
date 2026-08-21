(function () {
    const MAX_CONTENT_LENGTH = SummarizerExtractorCore.MAX_CONTENT_LENGTH;

    function extractSelectedText() {
        const selection = window.getSelection();
        const text = selection ? selection.toString() : "";
        const cleaned = SummarizerCleaners.cleanText(text);
        if (cleaned.length < 20) {
            return null;
        }

        return {
            sourceType: "selectedText",
            title: document.title || "Selected text",
            url: location.href,
            content: SummarizerCleaners.truncateText(cleaned, MAX_CONTENT_LENGTH)
        };
    }

    globalThis.SummarizerSelectedTextExtractor = {
        extractSelectedText
    };
})();
