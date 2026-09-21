(function () {
    function cleanText(value) {
        return String(value || "")
            .replace(/\s+/g, " ")
            .trim();
    }

    function timestampToSeconds(value) {
        const match = String(value || "").match(/\[?((?:\d{1,2}:)?\d{1,2}:\d{2})\]?/);
        if (!match) return null;
        const parts = match[1].split(":").map(Number);
        if (parts.some((part) => !Number.isFinite(part))) return null;
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        return parts[0] * 60 + parts[1];
    }

    function normalizeSegments(result) {
        const source = result && Array.isArray(result.transcriptSegments)
            ? result.transcriptSegments
            : [];
        let segments = source.map((segment) => {
            const startSeconds = Number(segment && segment.startSeconds || 0);
            const durationSeconds = Number(segment && segment.durationSeconds || 0);
            return {
                text: cleanText(segment && segment.text),
                startSeconds: Number.isFinite(startSeconds) ? Math.max(0, startSeconds) : 0,
                durationSeconds: Number.isFinite(durationSeconds) ? Math.max(0, durationSeconds) : 0,
                startLabel: cleanText(segment && segment.startLabel)
            };
        }).filter((segment) => segment.text);

        if (!segments.length) {
            const raw = result && (result.sourceContentRaw || result.sourceContentForPrompt || "");
            segments = String(raw).split(/\r?\n/).map((line) => {
                const startSeconds = timestampToSeconds(line);
                const text = cleanText(String(line).replace(/^\s*\[[^\]]+\]\s*/, ""));
                return startSeconds === null || !text ? null : { text, startSeconds, durationSeconds: 0, startLabel: "" };
            }).filter(Boolean);
        }

        return segments.sort((left, right) => left.startSeconds - right.startSeconds);
    }

    function formatTimestamp(seconds, includeMilliseconds) {
        const totalMs = Math.max(0, Math.round(Number(seconds || 0) * 1000));
        const hours = Math.floor(totalMs / 3600000);
        const minutes = Math.floor((totalMs % 3600000) / 60000);
        const secs = Math.floor((totalMs % 60000) / 1000);
        const millis = totalMs % 1000;
        const base = [hours, minutes, secs].map((value) => String(value).padStart(2, "0")).join(":");
        return includeMilliseconds ? `${base},${String(millis).padStart(3, "0")}` : base;
    }

    function buildPlainTranscript(result) {
        const segments = normalizeSegments(result);
        if (segments.length) {
            return segments.map((segment) => `[${segment.startLabel || formatTimestamp(segment.startSeconds, false)}] ${segment.text}`).join("\n");
        }
        return String(result && (result.sourceContentRaw || result.sourceContentForPrompt || "") || "").trim();
    }

    function buildSrt(result) {
        const segments = normalizeSegments(result);
        if (!segments.length) return "";
        const duration = Math.max(0, Number(result && result.videoDetails && result.videoDetails.durationSeconds || 0));
        return segments.map((segment, index) => {
            const start = Math.max(0, segment.startSeconds);
            const nextStart = segments[index + 1] ? Math.max(start, segments[index + 1].startSeconds) : 0;
            let span = segment.durationSeconds > 0 ? segment.durationSeconds : (nextStart > start ? nextStart - start : 5);
            if (nextStart > start) span = Math.min(span, nextStart - start);
            if (duration > start) span = Math.min(span, duration - start);
            span = Math.max(0.5, span);
            const end = duration > start ? Math.min(duration, start + span) : start + span;
            return `${index + 1}\n${formatTimestamp(start, true)} --> ${formatTimestamp(end, true)}\n${segment.text}`;
        }).join("\n\n") + "\n";
    }

    function downloadTextFile(text, filename, mimeType) {
        const blob = new Blob([String(text || "")], { type: mimeType || "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    globalThis.SummarizerTranscriptExport = {
        normalizeSegments,
        buildPlainTranscript,
        buildSrt,
        downloadTextFile
    };
})();
