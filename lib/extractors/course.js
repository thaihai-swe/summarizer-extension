(function () {
    const MAX_CONTENT_LENGTH = SummarizerExtractorCore.MAX_CONTENT_LENGTH;
    const COURSE_WAIT_TIMEOUT = 6000;

    function isCourseraPage(url) {
        return /https?:\/\/(www\.)?coursera\.org\/learn\/.*\/(lecture|supplement)\//i.test(url || "");
    }

    function isUdemyPage(url) {
        return /https?:\/\/(www\.)?udemy\.com\/course\/.*\/learn\//i.test(url || "");
    }

    function isCoursePage(url) {
        return isCourseraPage(url) || isUdemyPage(url);
    }

    function extractCourseTitle() {
        let title = document.title;
        if (isCourseraPage(location.href)) {
            const heading = document.querySelector('[data-testid="hero-title"], h1');
            if (heading) title = heading.textContent.trim();
        } else if (isUdemyPage(location.href)) {
            const heading = document.querySelector("h1[data-purpose='course-header-title'], h1");
            if (heading) title = heading.textContent.trim();
        }
        return title;
    }

    function waitForElement(selector, timeout = 3000, initialInterval = 50) {
        const immediateElement = document.querySelector(selector);
        if (immediateElement) {
            return Promise.resolve(immediateElement);
        }

        const startTime = Date.now();
        return new Promise((resolve) => {
            let currentInterval = initialInterval;
            const maxInterval = 200;

            function check() {
                const element = document.querySelector(selector);
                if (element) {
                    resolve(element);
                    return;
                }

                if (Date.now() - startTime > timeout) {
                    resolve(null);
                    return;
                }

                currentInterval = Math.min(currentInterval * 1.2, maxInterval);
                setTimeout(check, currentInterval);
            }

            setTimeout(check, currentInterval);
        });
    }

    function cleanCourseraContentText(text) {
        return String(text || "")
            .replace(/\n/g, " ")
            .replace(/♪|'|"|\.{2,}|\<[\s\S]*?\>|\{[\s\S]*?\}|\[[\s\S]*?\]/g, "")
            .replace(/\s+/g, " ")
            .trim();
    }

    function extractTranscriptText(container) {
        const transcriptText = Array.from(container.querySelectorAll(".rc-Phrase span"))
            .map((element) => element.textContent && element.textContent.trim())
            .filter(Boolean)
            .join("\n");

        if (transcriptText) {
            return transcriptText;
        }

        return (container.textContent || "").trim();
    }

    function extractImmediateCourseraContent() {
        const contentFinders = [
            { type: "transcript", selector: ".rc-Transcript" },
            { type: "transcript", selector: ".rc-TranscriptHighlighter" },
            { type: "reading", selector: '[data-testid="cml-viewer"]' }
        ];

        for (const finder of contentFinders) {
            const immediateElement = document.querySelector(finder.selector);
            if (!immediateElement) {
                continue;
            }

            if (finder.type === "transcript") {
                const transcriptText = extractTranscriptText(immediateElement);
                if (transcriptText) {
                    return {
                        type: finder.type,
                        text: transcriptText
                    };
                }
            } else {
                const readingText = immediateElement.textContent && immediateElement.textContent.trim();
                if (readingText) {
                    return {
                        type: finder.type,
                        text: readingText
                    };
                }
            }
        }

        return null;
    }

    async function extractCourseraTranscriptOrReading() {
        const immediate = extractImmediateCourseraContent();
        if (immediate && immediate.text) {
            return cleanCourseraContentText(immediate.text);
        }

        const contentFinders = [
            { type: "transcript", selector: ".rc-Transcript" },
            { type: "transcript", selector: ".rc-TranscriptHighlighter" },
            { type: "reading", selector: '[data-testid="cml-viewer"]' }
        ];

        const results = await Promise.all(
            contentFinders.map((finder) => waitForElement(finder.selector, COURSE_WAIT_TIMEOUT))
        );

        for (let index = 0; index < results.length; index += 1) {
            const element = results[index];
            if (!element) {
                continue;
            }

            const finder = contentFinders[index];
            const rawText =
                finder.type === "transcript"
                    ? extractTranscriptText(element)
                    : (element.textContent || "").trim();

            if (rawText) {
                return cleanCourseraContentText(rawText);
            }
        }

        return "";
    }

    async function extractUdemyTranscriptText() {
        const transcriptButton = await waitForElement("button[data-purpose='transcript-toggle']", COURSE_WAIT_TIMEOUT);
        if (!transcriptButton) {
            return "";
        }

        if (transcriptButton.getAttribute("aria-expanded") !== "true") {
            transcriptButton.click();
            await new Promise((resolve) => setTimeout(resolve, 800));
        }

        const transcriptContainer = await waitForElement("div[data-purpose='transcript-panel']", COURSE_WAIT_TIMEOUT);
        if (!transcriptContainer) {
            return "";
        }

        const transcriptText = Array.from(
            transcriptContainer.querySelectorAll(".transcript--cue-container--Vuwj6, [data-purpose='transcript-cue']")
        )
            .map((element) => element.textContent && element.textContent.trim())
            .filter(Boolean)
            .join("\n");

        return cleanCourseraContentText(transcriptText);
    }

    async function extractCourseTextWithRetry(extractor) {
        const attempts = 3;
        let lastText = "";

        for (let attempt = 0; attempt < attempts; attempt += 1) {
            const text = await extractor();
            if (text && text.length >= 100) {
                return text;
            }
            lastText = text || "";
            if (attempt < attempts - 1) {
                await new Promise((resolve) => setTimeout(resolve, 900));
            }
        }

        return lastText;
    }

    async function extractCourseData() {
        const url = location.href;
        if (!isCoursePage(url)) {
            return null;
        }

        const courseContent = isCourseraPage(url)
            ? await extractCourseTextWithRetry(extractCourseraTranscriptOrReading)
            : await extractCourseTextWithRetry(extractUdemyTranscriptText);
        if (!courseContent || courseContent.length < 100) {
            return null;
        }

        return {
            sourceType: "course",
            title: extractCourseTitle(),
            url,
            content: SummarizerCleaners.truncateText(courseContent, MAX_CONTENT_LENGTH)
        };
    }

    async function fetchCourseContent() {
        const courseData = await extractCourseData();
        if (!courseData) {
            throw new Error("No transcript or lesson content found for this course page.");
        }
        return courseData;
    }

    globalThis.SummarizerCourseExtractor = {
        extractCourseData,
        fetchCourseContent
    };
})();
