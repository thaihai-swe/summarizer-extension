(function () {
    const MAX_CONTENT_LENGTH = SummarizerExtractorCore.MAX_CONTENT_LENGTH;

    function isPdfDocument(url, doc) {
        const href = String(url || location.href || "").toLowerCase();
        if (
            href.endsWith(".pdf") ||
            href.includes(".pdf?") ||
            href.includes("/pdf/") ||
            href.includes("arxiv.org/abs/") ||
            href.includes("arxiv.org/html/") ||
            href.includes("pubmed.ncbi.nlm.nih.gov/") ||
            href.includes("openreview.net/") ||
            href.includes("ieeexplore.ieee.org/")
        ) {
            return true;
        }
        const d = doc || document;
        if (d.contentType === "application/pdf") {
            return true;
        }
        if (d.querySelector("embed[type='application/pdf'], object[type='application/pdf'], #viewer.pdfViewer, .pdfViewer, .textLayer")) {
            return true;
        }
        return false;
    }

    function extractArxivData(doc) {
        const d = doc || document;
        const titleEl = d.querySelector("h1.title, .title.mathjax");
        const title = titleEl ? titleEl.textContent.replace(/^Title:\s*/i, "").trim() : "";
        const abstractEl = d.querySelector("blockquote.abstract, .abstract.mathjax");
        const abstract = abstractEl ? abstractEl.textContent.replace(/^Abstract:\s*/i, "").trim() : "";
        const authorsEl = d.querySelector(".authors");
        const authors = authorsEl ? authorsEl.textContent.replace(/^Authors:\s*/i, "").trim() : "";
        const dateEl = d.querySelector(".dateline");
        const date = dateEl ? dateEl.textContent.trim() : "";

        if (abstract && (title || abstract.length > 100)) {
            const sections = [
                `Title: ${title || document.title}`,
                authors ? `Authors: ${authors}` : "",
                date ? `Date: ${date}` : "",
                `Abstract:\n${abstract}`
            ].filter(Boolean);

            // Also check for full html content if on arxiv HTML view
            const bodyEl = d.querySelector(".ltx_document, article, main");
            if (bodyEl) {
                const bodyText = SummarizerCleaners.cleanText(bodyEl.innerText || "");
                if (bodyText.length > abstract.length + 200) {
                    sections.push(`Full Paper Content:\n${bodyText}`);
                }
            }

            return {
                sourceType: "pdf",
                title: title || d.title || "Academic Paper",
                url: location.href,
                isAcademic: true,
                content: SummarizerCleaners.truncateText(sections.join("\n\n"), MAX_CONTENT_LENGTH)
            };
        }
        return null;
    }

    function extractPdfViewerText(doc) {
        const d = doc || document;
        // Check for PDF.js text layer (Chrome native or web PDF viewers)
        const textLayers = Array.from(d.querySelectorAll(".textLayer, .page .textLayer, .pdfViewer .page"));
        if (textLayers.length > 0) {
            const pages = textLayers.map((layer, index) => {
                const text = SummarizerCleaners.cleanText(layer.innerText || layer.textContent || "");
                return text ? `--- Page ${index + 1} ---\n${text}` : "";
            }).filter(Boolean);

            if (pages.length > 0) {
                const joined = pages.join("\n\n");
                return {
                    sourceType: "pdf",
                    title: d.title && !d.title.endsWith(".pdf") ? d.title : (location.pathname.split("/").pop() || "PDF Document"),
                    url: location.href,
                    content: SummarizerCleaners.truncateText(joined, MAX_CONTENT_LENGTH)
                };
            }
        }

        // Generic academic site metadata (PubMed, OpenReview, IEEE, ScienceDirect)
        const academicTitle = d.querySelector("h1.article-title, h1.c-article-title, .document-title, [data-test='article-title'], h1");
        const academicAbstract = d.querySelector(".abstract, #abstract, .article-abstract, [data-test='abstract'], .c-article-section__content");
        if (academicAbstract && academicTitle) {
            const title = academicTitle.textContent.trim();
            const abstract = academicAbstract.textContent.trim();
            if (abstract.length > 80) {
                return {
                    sourceType: "pdf",
                    title: title || d.title || "Research Paper",
                    url: location.href,
                    isAcademic: true,
                    content: SummarizerCleaners.truncateText(`Title: ${title}\n\nAbstract:\n${abstract}`, MAX_CONTENT_LENGTH)
                };
            }
        }

        return null;
    }

    function extractPdfContent() {
        if (!isPdfDocument(location.href, document)) {
            return null;
        }

        const arxivData = extractArxivData(document);
        if (arxivData) {
            return arxivData;
        }

        const viewerData = extractPdfViewerText(document);
        if (viewerData) {
            return viewerData;
        }

        return null;
    }

    globalThis.SummarizerPdfExtractor = {
        isPdfDocument,
        extractPdfContent
    };
})();
