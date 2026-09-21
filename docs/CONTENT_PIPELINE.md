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

1. Extraction from the active tab through `tab-manager.js`.
2. Settings normalization and prompt selection.
3. Single-request generation or semantic chunking and synthesis.
4. Parsing, quality evaluation, optional repair, and notification.

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
- `buildDeepDivePrompt()` → follow-up question grounded in the current session summary and source
- `buildOpenFollowUpPrompt()` → general-knowledge follow-up that omits summary and source content

`lib/prompts/common.js` supplies the shared envelope, output language, mode instructions, section contract, grounding rules, and custom prompt guidance.

## Provider Execution and Streaming

The assembled prompt is passed to `lib/provider-registry.js` as:

```js
generateText(prompt, providerSettings, onChunk?)
```

For the final pass, providers can call `onChunk(accumulatedText)`. The generation service parses at most once every 250 ms and emits a compact `SUMMARY_CHUNK` projection without source or transcript payloads. The side panel batches partial DOM work with `requestAnimationFrame`; the completed result arrives as `SUMMARY_UPDATED`. Chunking and synthesis requests do not stream into the UI.

Only a lightweight message/floating-UI shell is registered on every page. On the first extraction request, the shell returns `EXTRACTORS_NOT_READY`, the background injects source-specific extractors, and the request is retried once.

## Parsing

`lib/cleaners.js` parses the complete response by matching the canonical headings in the prompt contract.

Standard headings mapped to state:

- Main Summary
- Executive Takeaways
- Details of the Video (YouTube)
- Complete Guided Walkthrough
- Caveats, Biases & Open Questions
- Memory & Review Kit (when enabled)
- Follow-up Questions

Analysis headings mapped to state:

- Reasoning, Evidence & Claim Audit
- Connections, Causes & Tradeoffs → `argumentAndInsight`
- Concepts, Definitions & Mental Models
- Practical Application → `practicalSteps`

Concepts-mode headings map to `conceptMap`, `coreDefinitions`, `prerequisitesMisconceptions`, `practicalSteps`, `pitfallsWarnings`, and `resourcesTools`.

Output heading changes require updates to `lib/cleaners.js`, prompt section plans, and side-panel rendering together.

## Quality Gate and Repair

`lib/summary-quality.js` evaluates parsed output before notifying the side panel:

- Builds required and recommended sections based on source, size, and length.
- Scores section length, list counts, timestamp coverage for YouTube, placeholders, and source/output coverage.
- For Deep/Long failures, sends one targeted repair prompt containing only weak or missing sections.
- Merges repaired sections with healthy original sections and re-scores once.

Quality metadata (`score`, `passed`, `issues`, `weakSections`, `repaired`) is attached to the session result and displayed as a compact side-panel badge.

## Storage and Rendering

`lib/storage.js` persists settings only. Results, conversations, and workflow progress stay in the active session and are not restored after a panel or extension restart.

The side panel renders collapsible sections, keeps the transcript collapsed by default, uses only `[mm:ss]` or `[hh:mm:ss]` labels, and auto-expands substantive sections for Deep/Long output.
