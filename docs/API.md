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
CANCEL_SUMMARIZE        // Side panel → background: abort active request
OPEN_SIDE_PANEL         // Extension icon click → open side panel
GET_PUBLIC_SETTINGS     // Content shell → background: theme/floating-UI settings only
DEEP_DIVE_ACTIVE_TAB    // Side panel → background: send follow-up question plus session context
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
  result: object,       // Parsed render-only projection; no source/transcript/raw output
  tabId: number
}
```

The background parses accumulated provider text at most once every 250 ms and sends only fields required for partial rendering. The side panel coalesces delivery with `requestAnimationFrame`; source data, transcript data, quality metadata, and the table of contents arrive only with final `SUMMARY_UPDATED`.

Cancellation (`CANCEL_SUMMARIZE`) aborts the provider request via an `AbortController` scoped to the tab job and discards any partial result.

If the lightweight content shell receives an extraction request before extractor modules are loaded, it returns `{ ok: false, code: "EXTRACTORS_NOT_READY" }`. The background injects the extractor bundle and retries once.

## Follow-Up Message & Conversation Schema

`DEEP_DIVE_ACTIVE_TAB` payload:

```js
{
  type: "DEEP_DIVE_ACTIVE_TAB",
  question: string,
  grounding?: "source" | "open",  // default "source"
  result: object,                   // current side-panel result; session-only, with bounded in-memory tab switching cache
  conversationHistory?: object[],   // current session turns; not persisted
  tabId?: number
}
```

Conversation history items exist only in the active side-panel session:

```js
{
  question: string,
  answer: string,
  type: "user-question",
  grounding: "source" | "open"   // default "source"
}
```

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
  transcriptSegments?: [{       // YouTube only
    index: number,
    text: string,
    startSeconds: number,
    durationSeconds: number,
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

Results exist in the active side-panel session and include source/provider metadata, content snapshots, and parsed output:

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
  sourceContentRaw: string,          // Canonical non-YouTube source retained for follow-ups
  sourceContentForPrompt?: string,   // Present only when different from sourceContentRaw
  transcriptSegments?: object[],     // Canonical YouTube transcript representation
  summary: string,                   // "Main Summary" section content
  keyTakeaways: string[],            // Bulleted list items
  detailsOfVideo: string,            // "Details of the Video" (YouTube only)
  detailedBreakdown: string,         // "Complete Guided Walkthrough"
  expertCommentary: string,          // "Caveats, Biases & Open Questions"
  followUpQuestions: string[],       // Auto-generated follow-up suggestions
  evidenceAndDetails: string,        // "Reasoning, Evidence & Claim Audit"
  argumentAndInsight: string,        // Deep: "Connections, Causes & Tradeoffs"
  conceptMapAndPrerequisites: string,// "Concepts, Definitions & Mental Models"
  practicalSteps: string,            // "Practical Application" or concepts-mode "Practical Steps"
  reviewKit: string,                 // "Memory & Review Kit" when enabled
  conceptMap: string,                // Concepts mode
  coreDefinitions: string,           // Concepts mode
  prerequisitesMisconceptions: string,// Concepts mode
  pitfallsWarnings: string,          // Concepts mode
  resourcesTools: string,             // Concepts mode
  sections: Array<{                   // requested custom top-level sections (canonical fields are typed above)
    id: string,
    heading: string,
    content: string
  }>,
  quality: {                         // Quality gate metadata
    score: number,                   // 0.0 – 1.0 coverage score
    passed: boolean,                 // true if score meets threshold
    issues: string[],                // Description of each failing check
    weakSections: string[],          // Section keys that scored poorly
    repaired: boolean                // true if repair pass was run
  }
}
```

The page-level floating UI receives a compact `SUMMARY_UPDATED.result` containing only `tabId`, `title`, `sourceType`, `promptMode`, `summary`, and `keyTakeaways`. Full results remain inside extension contexts.

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
  summaryTone: "Simple" | "Concise" | "Friendly" | "Expert" | "Professional" | "Academic" | "Critical" | "Witty" | "Roast",
  generateFollowUpQuestions: boolean,
  theme: "system" | "light" | "dark",
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

`generation-service.js` emits compact `SUMMARY_CHUNK` projections, `summary-service.js` publishes the final `SUMMARY_UPDATED` result, and the background router publishes `SUMMARY_ERROR`. The main path is:

1. **Extraction** – content script sends normalized source object.
2. **Prompt building** – `lib/prompts/builders.js` assembles the final prompt (or chunk prompts + synthesis).
3. **Provider generation** – `generateText()` streams or buffers the response.
4. **Parsing** – `lib/cleaners.js` extracts section fields by heading.
5. **Quality gate** – `lib/summary-quality.js` scores, optionally repairs Deep/Long output.
6. **Notify** – Result sent to the active side panel through `SUMMARY_UPDATED`; no result or workflow persistence occurs.

On the side panel, the result renders with collapsible sections, a quality badge (Deep/Long only), and auto-expansion per the Deep/Long policy. Transcript segments are collapsed by default with `[mm:ss]` timestamps.
