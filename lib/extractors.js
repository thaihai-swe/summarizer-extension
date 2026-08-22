(function () {
    async function extractBestContent() {
        const selectedText = SummarizerSelectedTextExtractor.extractSelectedText();
        if (selectedText) {
            SummarizerDebug.logExtraction("content-script local extract", selectedText);
            return selectedText;
        }

        if (globalThis.SummarizerPdfExtractor && SummarizerPdfExtractor.isPdfDocument(location.href, document)) {
            const pdfData = SummarizerPdfExtractor.extractPdfContent();
            if (pdfData) {
                SummarizerDebug.logExtraction("content-script local extract", pdfData);
                return pdfData;
            }
        }

        if (SummarizerYoutubeExtractor.isYouTubeWatchPage(location.href)) {
            const youtubeData = await SummarizerYoutubeExtractor.extractYouTubeTranscript();
            SummarizerDebug.logExtraction("content-script local extract", youtubeData);
            return youtubeData;
        }

        const courseData = await SummarizerCourseExtractor.extractCourseData();
        if (courseData) {
            SummarizerDebug.logExtraction("content-script local extract", courseData);
            return courseData;
        }

        const webpage = SummarizerWebpageExtractor.extractWebpageText();
        if (webpage) {
            SummarizerDebug.logExtraction("content-script local extract", webpage);
            return webpage;
        }

        throw new Error("No usable content found on this page.");
    }

    globalThis.SummarizerExtractors = {
        extractBestContent
    };
})();
