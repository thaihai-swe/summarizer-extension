# Storage & Data Management

The extension uses `chrome.storage.local` through `lib/storage.js` for persistent settings and data. In-memory caching for faster tab switching is managed by `lib/tab-cache-service.js`.

## Storage Keys

- `summarizerSettings`: global settings
- `summarizerResultsByTab`: saved results keyed by tab ID
- `summarizerConversationsByTab`: follow-up history keyed by tab ID
- `summarizerWorkflowByTab`: workflow status keyed by tab ID

## In-Memory Cache Keys

`lib/tab-cache-service.js` keeps an in-memory map of saved results keyed by tab ID.

## Settings

The settings object includes the following prompt and output controls:

- `promptMode`, `summarySize`, and `summaryLength` select the summary strategy and depth.
- `customFormulaEnabled`, `sizeMultiplierBrief`, `sizeMultiplierMedium`, `sizeMultiplierDeep`, `lengthMultiplierShort`, `lengthMultiplierMedium`, `lengthMultiplierLong`, `charsPerWord`, `minTargetWords`, `maxTargetWords`, and `customTargetTemplate` configure the source-aware word-target formula.
- `summaryLanguage` controls the output language (defaults to "English"). Additional languages can be added via `customLanguages`.
- `summaryTone` controls writing style.
- `customPromptPresets` stores named `{ id, name, systemPrompt, userPrompt, createdAt, updatedAt }` entries.

Preset IDs are exposed as side-panel mode options. Selecting one updates `promptMode`; the
prompt builder applies the selected instructions inside the shared prompt envelope while
preserving source grounding, safety rules, output language, and parser-safe headings.

## Result execution metadata

Saved results may include an `execution` object:

```js
{
  durationMs,
  inputTokens,
  outputTokens,
  totalTokens,
  tokenUsageAvailable,
  requestCount,
  chunkCount,
  strategy
}
```

Token fields are populated only when the provider reports usage. `requestCount`, `chunkCount`,
and `strategy` describe whether the result used a direct, chunked, or synthesis workflow.

## Settings Object

Full schema-normalized settings layout:

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
  summaryLanguage: string,
  customLanguages: string,
  summaryTone: "Simple" | "Expert" | "Academic" | "Professional" | "Friendly",
  customPromptInstructions: string,
  customSystemInstructions: string,
  youtubePromptHint: string,
  webpagePromptHint: string,
  coursePromptHint: string,
  selectedTextPromptHint: string,
  analyzePromptHint: string,
  explainPromptHint: string,
  debatePromptHint: string,
  studyPromptHint: string,
  outlinePromptHint: string,
  timelinePromptHint: string,
  conceptsPromptHint: string,
  showFloatingUi: boolean,
  generateFollowUpQuestions: boolean,
  theme: "system" | "light" | "dark",
  density: "comfortable" | "compact",
  fontScale: "sm" | "md" | "lg" | "xl",
  gemini: { apiKey: string, model: string },
  openai: { apiKey: string, model: string, baseUrl: string },
  local: { baseUrl: string, model: string, endpointType: "ollama" | "openai" }
}
```

Defaults are defined in `lib/settings-schema.js` and fall back to `lib/storage.js` values: Gemini `gemini-3.5-flash-lite`, OpenAI `gpt-4o-mini`, local `llama3.1` at `http://127.0.0.1:11434`.

## Results Object

Results contain source metadata, content snapshots, parsed standard sections, and Deep sections. See `docs/API.md` and `lib/cleaners.js` for the complete result shape.

## Lifecycle

- Follow-up conversation entries store `{ question, answer, type: "user-question", grounding: "source" | "open", timestamp }`. Older entries without `grounding` are treated as source-grounded.
- A new summary clears the follow-up conversation for that tab.
- Closing a tab clears its result, conversation, workflow, and in-memory cache.
- Switching tabs restores cached data. Results and conversations are isolated by tab ID.
- Settings are global.

## Settings Validation and Schema Helpers

`lib/settings-schema.js` is the single source of truth for:

- defaults
- valid enums (`summarySize`, `summaryLength`, `theme`, `provider`, etc.)
- normalization rules


## Result Metadata and Quality Block

Saved results include:

```js
{
  summarySize: "Brief" | "Medium" | "Deep",
  summaryLength: "Short" | "Medium" | "Long",
  expansionMode: "standard" | "deep",
  quality: {
    score: number,
    passed: boolean,
    issues: string[],
    weakSections: string[],
    repaired: boolean
  }
}
```

Older saved results without quality metadata continue to render normally without a quality badge.
