(function () {

    /**
     * Smart semantic chunker that preserves natural boundaries.
     * Splitting priority: paragraphs → sentences → clauses → word boundary.
     */

    const HARD_MAX_CHARS = 14000;
    const TARGET_CHARS = 10000;

    function cleanText(text) {
        return String(text || "")
            .replace(/\r/g, "")
            .replace(/\t+/g, " ")
            .replace(/[ \u00a0]+/g, " ")
            .replace(/\n{4,}/g, "\n\n\n")
            .trim();
    }

    /**
     * Detect whether the text looks like a YouTube transcript (contains bracketed timestamps).
     */
    function isTimedTranscript(text) {
        return /\[\d{1,2}:\d{2}(?::\d{2})?\]/.test(text);
    }

    /**
     * Parse transcript lines with timestamps.
     */
    function parseTranscriptLines(text) {
        const lines = text.split("\n");
        const segments = [];
        let currentTimestamp = null;
        let currentText = [];
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            const tsMatch = trimmed.match(/^\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*(.*)/);
            if (tsMatch) {
                if (currentTimestamp !== null) {
                    segments.push({
                        timestamp: currentTimestamp,
                        text: currentText.join(" ").trim()
                    });
                }
                currentTimestamp = tsMatch[1];
                currentText = [tsMatch[2]];
            } else {
                currentText.push(trimmed);
            }
        }
        if (currentTimestamp !== null && currentText.length > 0) {
            segments.push({
                timestamp: currentTimestamp,
                text: currentText.join(" ").trim()
            });
        }
        return segments.length > 0 ? segments : null;
    }

    /**
     * Split text into paragraphs (separated by double newlines).
     */
    function splitParagraphs(text) {
        return text.split(/\n\n+/).map(s => s.trim()).filter(Boolean);
    }

    /**
     * Split text into sentences (by . ! ? followed by space or end-of-string).
     */
    function splitSentences(text) {
        const result = [];
        const parts = text.split(/(?<=[.!?])\s+/);
        for (const part of parts) {
            const trimmed = part.trim();
            if (trimmed) result.push(trimmed);
        }
        return result.length > 0 ? result : [text.trim()];
    }

    /**
     * Split text into clause-level fragments (by , ; : — followed by space).
     */
    function splitClauses(text) {
        const result = [];
        const parts = text.split(/(?<=[,;:—])\s+/);
        for (const part of parts) {
            const trimmed = part.trim();
            if (trimmed) result.push(trimmed);
        }
        return result.length > 1 ? result : [text.trim()];
    }

    /**
     * Core chunking function.
     * Returns an array of chunk objects with metadata.
     */
    function chunkContent(text, options) {
        const opts = Object.assign({
            targetLength: TARGET_CHARS,
            maxLength: HARD_MAX_CHARS,
            maxChunks: null,          // if set, try to stay within this many chunks
            sourceType: "webpage",
            transcriptSegments: null,  // pre-parsed segments if available
            preserveOverlap: true,     // include one sentence overlap between chunks
            overlapSentences: 1
        }, options || {});

        const source = cleanText(text);
        if (!source) return [];

        const isTranscript = isTimedTranscript(source) || opts.sourceType === "youtube";
        const segments = opts.transcriptSegments || (isTranscript ? parseTranscriptLines(source) : null);

        // Strategy: if we have transcript segments, use those as primary units.
        // Otherwise, use paragraphs, then sentences, then clauses.
        let units;

        if (segments && segments.length > 0) {
            // Group small consecutive segments to hit target size
            return chunkBySegments(segments, opts);
        }

        units = splitParagraphs(source);

        // If no paragraph break, split by sentences
        if (units.length <= 1) {
            units = splitSentences(source);
        }

        return chunkByUnits(units, opts);
    }

    function chunkBySegments(segments, opts) {
        const { targetLength, maxLength, maxChunks, preserveOverlap, overlapSentences } = opts;

        // First pass: group segments into target-sized groups
        const grouped = [];
        let currentGroup = [];
        let currentLength = 0;

        for (const seg of segments) {
            const segText = String(seg.text || "").trim();
            if (!segText) continue;
            const segTimestamp = seg.timestamp || seg.startLabel || null;
            const segLen = segText.length + 10; // + timestamp overhead
            if (currentGroup.length > 0 && currentLength + segLen > targetLength && currentLength > 0) {
                grouped.push(currentGroup);
                currentGroup = [];
                currentLength = 0;
            }
            currentGroup.push(Object.assign({}, seg, { text: segText, timestamp: segTimestamp }));
            currentLength += segLen;

            // If a single segment is huge, split it into sentence-based sub-chunks
            if (currentGroup.length === 1 && segLen > maxLength) {
                // Treat this segment's text as paragraphs and recurse
                const subUnits = splitSentences(seg.text);
                const subChunks = chunkByUnits(subUnits, opts);
                for (const sub of subChunks) {
                    grouped.push([{ timestamp: seg.timestamp, text: sub.text }]);
                }
                currentGroup = [];
                currentLength = 0;
            }
        }
        if (currentGroup.length > 0) {
            grouped.push(currentGroup);
        }

        // If we have too many groups and maxChunks is set, merge adjacent groups
        let finalGroups = grouped;
        if (maxChunks && finalGroups.length > maxChunks) {
            finalGroups = mergeGroups(finalGroups, maxChunks);
        }

        // Build chunk objects
        const chunks = [];
        for (let i = 0; i < finalGroups.length; i++) {
            const group = finalGroups[i];
            const groupText = group.map(s => {
                return s.timestamp ? `[${s.timestamp}] ${s.text}` : s.text;
            }).join("\n");

            const startTs = group[0] ? group[0].timestamp : null;
            const endTs = group[group.length - 1] ? group[group.length - 1].timestamp : null;

            // Add overlap from previous chunk
            let overlapText = "";
            if (preserveOverlap && i > 0 && overlapSentences > 0) {
                const prevGroup = finalGroups[i - 1];
                const overlapSegments = prevGroup.slice(-overlapSentences);
                if (overlapSegments.length > 0) {
                    overlapText = "[Overlap from previous chunk]\n" +
                        overlapSegments.map(s => s.timestamp ? `[${s.timestamp}] ${s.text}` : s.text).join("\n") + "\n\n";
                }
            }

            chunks.push({
                index: i,
                text: overlapText + groupText,
                startTimestamp: startTs,
                endTimestamp: endTs,
                startOffset: -1,
                endOffset: -1,
                heading: null,
                sourceType: opts.sourceType || "webpage"
            });
        }

        return chunks;
    }

    function chunkByUnits(units, opts) {
        const { targetLength, maxLength, maxChunks, preserveOverlap, overlapSentences } = opts;

        const groups = [];
        let currentGroup = [];
        let currentLength = 0;

        for (const unit of units) {
            if (!unit) continue;
            const unitLen = unit.length;

            // If a single unit exceeds maxLength, force-split it by clauses then by chars
            if (unitLen > maxLength) {
                if (currentGroup.length > 0) {
                    groups.push(currentGroup);
                    currentGroup = [];
                    currentLength = 0;
                }
                const forcedParts = forceSplitUnit(unit, maxLength);
                for (const part of forcedParts) {
                    if (part.length > targetLength * 0.3) {
                        groups.push([part]);
                    }
                }
                continue;
            }

            if (currentGroup.length > 0 && currentLength + unitLen > targetLength && currentLength > 0) {
                groups.push(currentGroup);
                currentGroup = [];
                currentLength = 0;
            }
            currentGroup.push(unit);
            currentLength += unitLen;
        }
        if (currentGroup.length > 0) {
            groups.push(currentGroup);
        }

        // Merge groups if too many
        let finalGroups = groups;
        if (maxChunks && finalGroups.length > maxChunks) {
            finalGroups = mergeGroups(finalGroups, maxChunks);
        }

        // Build chunk objects
        const chunks = [];
        for (let i = 0; i < finalGroups.length; i++) {
            const group = finalGroups[i];
            const groupText = group.join("\n");

            let overlapText = "";
            if (preserveOverlap && i > 0 && overlapSentences > 0) {
                const prevGroup = finalGroups[i - 1];
                const lastSentences = typeof prevGroup === "string" ? prevGroup : prevGroup[prevGroup.length - 1];
                const sentences = splitSentences(typeof lastSentences === "string" ? lastSentences : lastSentences.join(" "));
                const overlapSentencesArr = sentences.slice(-overlapSentences);
                if (overlapSentencesArr.length > 0) {
                    overlapText = "[Overlap from previous chunk]\n" + overlapSentencesArr.join(" ") + "\n\n";
                }
            }

            chunks.push({
                index: i,
                text: overlapText + groupText,
                startTimestamp: null,
                endTimestamp: null,
                startOffset: -1,
                endOffset: -1,
                heading: null,
                sourceType: opts.sourceType || "webpage"
            });
        }

        return chunks;
    }

    function mergeGroups(groups, maxGroups) {
        if (groups.length <= maxGroups) return groups;
        const result = [];
        let startIdx = 0;
        const slots = maxGroups;
        for (let slot = 0; slot < slots; slot++) {
            const remaining = groups.length - startIdx;
            const remainingSlots = slots - slot;
            const take = Math.ceil(remaining / remainingSlots);
            const merged = [];
            for (let j = 0; j < take && startIdx < groups.length; j++) {
                const g = groups[startIdx];
                if (Array.isArray(g)) {
                    merged.push(...g);
                } else {
                    merged.push(g);
                }
                startIdx++;
            }
            result.push(merged);
        }
        return result;
    }

    function forceSplitUnit(unit, maxLength) {
        // Try clause split first, then sentence, then word boundary
        let parts = splitClauses(unit);
        if (parts.length <= 1) {
            parts = splitSentences(unit);
        }
        if (parts.length <= 1) {
            // Hard character split at word boundary
            const result = [];
            let remaining = unit;
            while (remaining.length > maxLength) {
                let cut = remaining.lastIndexOf(" ", maxLength);
                if (cut < maxLength * 0.5) cut = maxLength; // fallback
                result.push(remaining.slice(0, cut).trim());
                remaining = remaining.slice(cut).trim();
            }
            if (remaining) result.push(remaining);
            return result;
        }
        // Re-chunk the parts respecting maxLength
        const subGroups = [];
        let current = "";
        for (const p of parts) {
            if (!p) continue;
            if (current.length + p.length > maxLength && current.length > 0) {
                subGroups.push(current);
                current = p;
            } else {
                current = current ? current + " " + p : p;
            }
        }
        if (current) subGroups.push(current);
        return subGroups;
    }

    globalThis.SummarizerSemanticChunker = {
        chunkContent
    };
})();
