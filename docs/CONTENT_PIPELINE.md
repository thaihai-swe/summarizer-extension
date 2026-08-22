# Content to Summary Pipeline

## Extraction

`lib/extractors.js` receives an extraction request and dispatches it in this priority:

1. `lib/extractors/selected-text.js`
2. `lib/extractors/pdf.js` (PDFs, arXiv, PubMed, OpenReview, IEEE paper pages)
3. `lib/extractors/youtube.js`
4. `lib/extractors/course.js`
5. `lib/extractors/webpage.js` (with `core.js` and `accessibility-tree.js` helpers)

All extractors return a normalized source object with `sourceType`, `title`, `url`, and prompt-ready `content`. YouTube sources additionally preserve transcript segments and real timestamps. PDF sources carry `isAcademic: true` when detected as a research paper. Source metadata is retained for prompt grounding; it is not rendered as a separate Source Metadata feature.

## Summary Service

`lib/background/summary-service.js` orchestrates:

1. Per-tab workflow updates through `workflow-store.js`.
2. Extraction from the active tab through `tab-manager.js`.
3. Settings normalization and prompt selection.
4. Single-request generation or semantic chunking and synthesis.
5. Parsing, quality evaluation, optional repair, save, and notification.

## Chunk Thresholds

Content is chunked only when it exceeds its source threshold:

| Source | Threshold | Target chunk size | Maximum source chunks |
|---|---:|---:|---:|
| YouTube | 24,000 characters | 12,000 | 4 |
| Webpage | 60,000 characters | 12,000 | 4 |
| Course | 50,000 characters | 12,000 | 4 |
| PDF / Paper | 60,000 characters | 12,000 | 4 |
| Selected text | Usually single request | — | — |

The thresholds decide whether chunking starts. `lib/semantic-chunker.js` enforces target length, natural boundaries, overlap, and the maximum chunk count. Intermediate chunk and synthesis requests remain buffered.

## Semantic Chunking

`lib/semantic-chunker.js` replaces character-only splitting with this boundary priority:

1. YouTube timestamp segments
2. Paragraphs
3. Sentences
4. Clauses
5. Word boundaries as a last resort

Chunks carry metadata such as `index`, `text`, `startTimestamp`, `endTimestamp`, `heading`, and `sourceType`. Adjacent chunks may include one previous sentence or segment as overlap so a boundary does not lose context. Oversized single segments are split by sentence/word boundaries. If the module is unavailable, the summary service falls back to its balanced splitter.

## Prompt Assembly

`lib/prompts/builders.js` routes the normalized context to source-specific templates:

- `buildSummaryPrompt()` → YouTube, course, webpage, or selected-text template
- `buildChunkSummaryPrompt()` → source chunk template
- `buildSynthesisPrompt()` → sequential synthesis of chunk outputs
- `buildDeepDivePrompt()` → follow-up question grounded in the saved summary and source

`lib/prompts/common.js` supplies the shared envelope, output language, mode instructions, section contract, grounding rules, and custom prompt guidance.

## Provider Execution and Streaming

The assembled prompt is passed to `lib/provider-registry.js` as:

```js
generateText(prompt, providerSettings, onChunk?)
```

For the final pass, providers can call `onChunk(accumulatedText)`. The background emits `SUMMARY_CHUNK` to the matching tab. The side panel re-parses accumulated text and renders partial sections while preserving expansion state. The completed result arrives as `SUMMARY_UPDATED`. Chunking and synthesis requests do not stream into the UI.

## Parsing

`lib/cleaners.js` parses the complete response by matching heading aliases.

Standard headings mapped to state:

- Main Summary / Summary
- Key Takeaways
- Main Points
- Details of the Video (YouTube)
- Detailed Breakdown / Complete Guided Walkthrough
- Expert Commentary
- Follow-up Questions

Deep headings mapped to state:

- Evidence and Details
- Connections, Causes & Tradeoffs → `argumentAndInsight`
- Concept Map and Prerequisites / Concepts, Definitions & Mental Models
- Causal and Knowledge Flow
- Perspectives and Uncertainty

Output heading changes require updates to `lib/cleaners.js`, prompt section plans, and side-panel rendering together.

## Quality Gate and Repair

`lib/summary-quality.js` evaluates parsed output before saving:

- Builds required and recommended sections based on source, size, and length.
- Scores section length, list counts, timestamp coverage for YouTube, placeholders, and source/output coverage.
- For Deep/Long failures, sends one targeted repair prompt containing only weak or missing sections.
- Merges repaired sections with healthy original sections and re-scores once.

Quality metadata (`score`, `passed`, `issues`, `weakSections`, `repaired`) is saved in the result and displayed as a compact side-panel badge.

## Storage and Rendering

`lib/storage.js` saves results, conversations, and workflow state by tab ID. `lib/tab-cache-service.js` keeps an in-memory cache for fast tab switching; persistent storage remains the source of truth.

The side panel renders collapsible sections, keeps the transcript collapsed by default, uses only `[mm:ss]` or `[hh:mm:ss]` labels, and auto-expands substantive sections for Deep/Long output.
