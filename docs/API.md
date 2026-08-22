# Internal API

This document describes message types, normalized data objects, streaming contracts, and metadata exchanged inside the extension.

## Message Types

Defined in `lib/messages.js`:

```js
SUMMARIZE_ACTIVE_TAB    // Side panel → background: start summary
EXTRACT_CONTENT         // Background → content script: extract source
FETCH_COURSE_CONTENT    // Background → content script: extract course lesson
SUMMARY_CHUNK           // Background → side panel: incremental streaming text
SUMMARY_UPDATED         // Background → side panel: final parsed result ready
SUMMARY_ERROR           // Background → side panel: error during workflow
GET_ACTIVE_TAB_RESULT   // Side panel → background: request saved result
GET_ACTIVE_TAB_WORKFLOW // Side panel → background: request workflow phase
CANCEL_SUMMARIZE        // Side panel → background: abort active request
CLEAR_TAB_DATA          // Cleanup on tab close
OPEN_SIDE_PANEL         // Extension icon click → open side panel
DEEP_DIVE_ACTIVE_TAB    // Side panel → background: send follow-up question
SETTINGS_UPDATED        // Options page → background: settings changed
```

The background service also handles the `deepdigest-summarize` context-menu item and the
`summarize_page` keyboard command. Both routes open the side panel synchronously for the
target tab, then start the asynchronous summary workflow.

## Streaming Contract

When the provider supports streaming and the request is the final pass (not an intermediate chunk), the background sends one or more `SUMMARY_CHUNK` messages:

```js
// SUMMARY_CHUNK payload (per chunk event)
{
  chunkText: string,    // Full accumulated text so far (not delta)
  done: boolean,        // true if this is the final chunk
  tabId: number
}
```

The side panel renders incrementally by re-parsing `chunkText` on each event. When `done` is true, the panel waits for the final `SUMMARY_UPDATED` message to overlay quality metadata and expansion state.

Cancellation (`CANCEL_SUMMARIZE`) aborts the provider request via an `AbortController` scoped to the tab job and discards any partial result.

## Normalized Extraction Object

Every extractor returns at least:

```js
{
  sourceType: "youtube" | "webpage" | "course" | "selectedText" | "pdf",
  title: string,
  url: string,
  content: string,
  contentRaw: string,           // Full-length original content before truncation
  contentForPrompt: string,     // Content as inserted into prompts
  sourceContentRaw: string,     // Preserved raw source
  sourceContentForPrompt: string,
  transcriptSegments?: [{       // YouTube only
    index: number,
    text: string,
    startSeconds: number,
    startLabel: string          // Formatted timestamp, e.g. "01:23"
  }],
  videoDetails?: {              // YouTube only
    duration: number,
    durationLabel: string,
    channelName: string,
    channelUrl: string,
    publishDate: string,
    viewCount: number,
    transcriptLanguage: string
  }
}
```

## Summary Result Object

Results are stored by tab ID and include source/provider metadata, content snapshots, and parsed output:

```js
{
  id: string,                        // UUID generated per summary
  tabId: number,
  generatedAt: string,               // ISO timestamp
  sourceType: "youtube" | "webpage" | "course" | "selectedText" | "pdf",
  title: string,
  url: string,
  provider: "gemini" | "openai" | "local",
  providerLabel: string,             // Human-readable provider name
  model: string,                     // Model identifier
  promptMode: string,                // see promptMode in settings
  summarySize: "Brief" | "Medium" | "Deep",
  summaryLength: "Short" | "Medium" | "Long",
  expansionMode: "standard" | "deep",
  sourceContent: string,
  sourceContentRaw: string,
  sourceContentForPrompt: string,
  summary: string,                   // "Main Summary" section content
  keyTakeaways: string[],            // Bulleted list items
  mainPoints: string,                // "Main Points" section
  detailsOfVideo: string,            // "Details of the Video" (YouTube only)
  detailedBreakdown: string,         // "Detailed Breakdown" / "Complete Guided Walkthrough"
  expertCommentary: string,          // "Expert Commentary" / analysis
  followUpQuestions: string[],       // Auto-generated follow-up suggestions
  evidenceAndDetails: string,        // Deep: "Evidence and Details"
  argumentAndInsight: string,        // Deep: "Connections, Causes & Tradeoffs"
  conceptMapAndPrerequisites: string,// Deep: "Concept Map and Prerequisites"
  causalAndKnowledgeFlow: string,    // Deep: "Causal and Knowledge Flow"
  perspectivesAndUncertainty: string,// Deep: "Perspectives and Uncertainty"
  rawText: string,                   // Unparsed model output
  quality: {                         // Quality gate metadata
    score: number,                   // 0.0 – 1.0 coverage score
    passed: boolean,                 // true if score meets threshold
    issues: string[],                // Description of each failing check
    weakSections: string[],          // Section keys that scored poorly
    repaired: boolean                // true if repair pass was run
  }
}
```

## Workflow Phase Values

Per-tab workflow state, stored via `workflow-store.js`:

```js
"extracting" | "summarizing" | "completed" | "error" | "cancelled"
```

## Settings Shape

Full settings object after schema normalization (see `lib/settings-schema.js`):

```js
{
  provider: "gemini" | "openai" | "local",
  promptMode: "summarize" | "analyze" | "explain" | "debate" | "study" | "outline" | "timeline" | "concepts",
  summarySize: "Brief" | "Medium" | "Deep",
  summaryLength: "Short" | "Medium" | "Long",
  customFormulaEnabled: boolean,
  sizeMultiplierBrief: number,
  sizeMultiplierMedium: number,
  sizeMultiplierDeep: number,
  lengthMultiplierShort: number,
  lengthMultiplierMedium: number,
  lengthMultiplierLong: number,
  charsPerWord: number,
  minTargetWords: number,
  maxTargetWords: number,
  customTargetTemplate: string,
  summaryLanguage: string, // Output language (default "English", configurable with customLanguages)
  customLanguages: string, // Comma-separated list of additional languages
  summaryTone: "Simple" | "Expert" | "Academic" | "Professional" | "Friendly",
  generateFollowUpQuestions: boolean,
  theme: "system" | "light" | "dark",
  density: "comfortable" | "compact",
  fontScale: "sm" | "md" | "lg" | "xl",
  gemini: { apiKey, model },
  openai: { apiKey, model, baseUrl },
  local: { baseUrl, model, endpointType: "ollama" | "openai" }
}
```

## Provider Interface

`lib/provider-registry.js` dispatches:

```js
await generateText(prompt, providerSettings, onChunk?)
```

Providers do not know about source types, section parsing, or UI state. Cancellation is passed through `providerSettings.signal` (an `AbortSignal` merged from the timeout and the per-tab job `AbortController`).

## Workflow

`summary-service.js` emits `SUMMARY_CHUNK` (streaming), `SUMMARY_UPDATED` (final), and `SUMMARY_ERROR` messages while `workflow-store.js` persists per-tab phases. The main path is:

1. **Extraction** – content script sends normalized source object.
2. **Prompt building** – `lib/prompts/builders.js` assembles the final prompt (or chunk prompts + synthesis).
3. **Provider generation** – `generateText()` streams or buffers the response.
4. **Parsing** – `lib/cleaners.js` extracts section fields by heading.
5. **Quality gate** – `lib/summary-quality.js` scores, optionally repairs Deep/Long output.
6. **Save & notify** – Result stored, `SUMMARY_UPDATED` sent to side panel.

On the side panel, the result renders with collapsible sections, a quality badge (Deep/Long only), and auto-expansion per the Deep/Long policy. Transcript segments are collapsed by default with `[mm:ss]` timestamps.
