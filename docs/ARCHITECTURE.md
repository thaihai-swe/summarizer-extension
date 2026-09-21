# Architecture

## Overview

The extension is a Manifest V3 extension with Chrome and Firefox runtime packages. Chrome uses
the Side Panel API; the Firefox package uses `sidebar_action` and the native sidebar. A small
browser compatibility facade keeps callback-style legacy modules working against Firefox's
Promise-based APIs.

1. content-script extraction
2. background orchestration and active request state
3. prompt construction and provider generation
4. side-panel rendering and options management

## Runtime Flow

```text
side panel -> background -> content script -> extractor
           -> prompt builder -> provider -> cleaner/parser
           -> quality gate -> side panel
```

Extraction priority is:

1. selected text
2. PDF / academic paper
3. YouTube transcript
4. course lesson
5. webpage

## Core Modules

### Entrypoints

- `background.js`: service-worker message routing, context-menu/command launch, synchronous side-panel open
- `content.js`: page extraction and floating UI
- `sidepanel.js`: side-panel controller
- `options.js`: settings page controller

### Background

- `lib/background/summary-service.js`: summary orchestration, quality repair, cancellation ownership, follow-ups
- `lib/background/generation-service.js`: provider execution, retry, semantic chunking, synthesis, and throttled streaming
- `lib/background/result-builder.js`: full results and compact stream/floating-UI projections
- `lib/background/tab-manager.js`: active-tab routing, content-script injection, side-panel open, tab cleanup
- `lib/background/ui-notifier.js`: progress and result notifications

### Extraction

- `lib/extractors.js`: source-priority dispatcher (selected text → PDF/paper → YouTube → course → webpage)
- `lib/extractors/selected-text.js`: selected excerpt
- `lib/extractors/pdf.js`: PDFs, arXiv, PubMed, OpenReview, IEEE paper pages, Chrome PDF viewer text layers
- `lib/extractors/youtube.js`: transcript, timestamps, chapters, metadata
- `lib/extractors/course.js`: course lesson content
- `lib/extractors/webpage.js`: semantic webpage extraction
- `lib/extractors/core.js` and `accessibility-tree.js`: shared extraction helpers

### Prompting

- `lib/prompts/builders.js`: routes summary, chunk, synthesis, and deep-dive prompts
- `lib/prompts/common.js`: shared envelope, section plans, modes, grounding, and output rules
- `lib/prompts/templates/`: source-specific YouTube, webpage, course, selected-text, and PDF/paper templates
- `lib/prompts/templates/pdf.js`: academic paper & PDF document prompt builder
- `lib/prompts/templates/prompt-enhance.js`: options-page prompt enhancement helper
- `docs/PROMPTS.md`: canonical prompt inventory

### Providers and parsing

- `lib/provider-registry.js`: provider descriptors, dispatch, and normalized errors
- `lib/providers/shared.js`: shared provider transport, timeouts, response extraction, and stream readers
- `lib/providers/gemini.js`, `openai.js`, `local.js`: endpoint-specific provider implementations (the local provider covers Ollama and OpenAI-compatible/LM Studio-style endpoints)
- `lib/cleaners.js`: response cleaning and heading-based parsing
- `lib/markdown.js`: rendered Markdown
- `lib/sidepanel/chat.js`: grounding, bounded follow-up context, and in-session conversation
- `lib/sidepanel/actions.js`: summary/transcript copy and export actions

### Quality, chunking, and settings

- `lib/semantic-chunker.js`: boundary-aware chunking with timestamp/paragraph/sentence priority and overlap
- `lib/summary-quality.js`: section contract scoring, Deep/Long repair prompt, merge of repaired sections
- `lib/settings-schema.js`: single source of truth for defaults, valid enums, and normalization

### UI and persistence

- `lib/storage.js`: cached browser-local settings with serialized writes and schema normalization
- `lib/sidepanel/state.js`, `lib/sidepanel/render.js`: side-panel state/render helpers
- `lib/sidepanel/toc.js`: Deep/Long result table of contents and scroll tracking
- `lib/transcript-export.js`: timestamped transcript copy and SRT serialization
- `lib/ui/theme.js`: theme support
- `sidepanel.html`, `sidepanel.css`: side-panel markup and styles
- `options.html`, `options.css`: options page markup and styles

## Prompt Architecture

All providers receive one final string through `generateText(prompt, providerSettings, onChunk?)`. When `onChunk` is provided, providers stream incremental text.

1. `buildSummaryPrompt()` selects the source template.
2. Long content uses `buildChunkSummaryPrompt()` repeatedly via the semantic chunker.
3. Chunk outputs are merged by `buildSynthesisPrompt()`.
4. Source-grounded follow-up questions use `buildDeepDivePrompt()`.
5. General-knowledge follow-up questions use `buildOpenFollowUpPrompt()`.
6. Every template calls `buildPromptEnvelope()`.
7. Deep/Long quality failures may trigger one targeted repair prompt from `lib/summary-quality.js`.

The envelope applies safety rules, settings (including output language), source grounding, anti-hallucination rules, mode rules, section contracts, and source content. See `docs/PROMPTS.md` for the complete inventory.

## Output Contract

Standard summaries use the canonical headings `Main Summary`, `Executive Takeaways`, `Complete Guided Walkthrough`, `Caveats, Biases & Open Questions`, `Memory & Review Kit`, and `Follow-up Questions`. YouTube also uses `Details of the Video`. Custom prompt-requested `##` sections are preserved and rendered after these canonical sections without entering the quality repair contract.

Analysis and deep summaries add:

- `Reasoning, Evidence & Claim Audit`
- `Connections, Causes & Tradeoffs` (parsed into `argumentAndInsight`)
- `Concepts, Definitions & Mental Models`
- `Practical Application` when the source or mode supports it

`lib/cleaners.js` maps these headings to the result object held by the active side-panel session. Heading changes require parser and UI review.

Session results may also include:

```js
{
  summarySize, summaryLength, expansionMode,
  quality: { score, passed, issues, weakSections, repaired },
  execution: {
    durationMs, inputTokens, outputTokens, totalTokens,
    tokenUsageAvailable, requestCount, chunkCount, strategy
  }
}
```

## Settings Architecture

`lib/settings-schema.js` owns defaults, valid enums, and field normalization. `lib/storage.js` delegates to the schema when loaded and exposes:

- `getSettings()` / `saveSettings()`
Unknown settings keys pass through so older preferences remain intact. Legacy result, conversation, and workflow keys are removed during extension install/update.

## Quality Gate and Repair

After parsing, `lib/summary-quality.js` evaluates output before notifying the side panel:

1. Builds a required/recommended section contract from source type, size, and length.
2. Scores section length, list counts, timestamps (YouTube), placeholders, and coverage.
3. For Deep/Long failures, runs one targeted repair request for weak/missing sections only.
4. Merges repaired sections without discarding healthy ones.
5. Attaches quality metadata for internal repair and weak-section styling; redundant quality badges are not shown in the side panel.


## User Gestures and Side Panel Opening

To open the Chrome side panel from a context menu or keyboard command, the call to `chrome.sidePanel.open()` must execute synchronously within the user-gesture context. If there is an `await` before the API call, Chrome discards the user gesture token and blocks the side panel from opening. DeepDigest centralizes this in `background.js` via a synchronous `openSidePanelForTab` call before starting the summary process.

## Side Panel Lifecycle

- The active panel keeps the current result and follow-up conversation in memory for the current session.
- Switching tabs clears the panel result and conversation; stale messages whose `tabId` does not match are ignored.
- Reloading the panel or extension does not restore result, conversation, or workflow state.
- Transcript is collapsed by default and shows only `[mm:ss]` / `[hh:mm:ss]` timestamps.
- Transcript rows are created only on first expansion, avoiding hidden long-list DOM work during result rendering.
- Section expansion policy:
  - Brief/Medium: first substantive section expanded
  - Deep: first three substantive sections expanded
  - Long: all substantive sections expanded except `Details of the Video`
- Streaming updates preserve the user's expand/collapse choices.
- Accessibility: live status region, collapsible section ARIA labels, stronger `:focus-visible` rings, and reduced-motion support.

## Storage and Lifecycle

Only settings are persisted. Results, conversations, and workflow progress are session-only; the side panel keeps a bounded in-memory cache of recent results for tab switching and clears entries when tabs close.

The extension uses `chrome.storage.local` for settings; provider credentials and preferences remain local to the browser profile.

## Provider Interface

Providers remain prompt-agnostic. The registry supplies provider-specific settings plus the shared `summaryLength` value:

```js
generateText(prompt, providerSettings, onChunk?)
```

Final generation passes stream tokens when the provider supports it. Chunking/synthesis intermediate requests stay buffered. Accumulated text is parsed and emitted as a compact `SUMMARY_CHUNK` projection at most every 250 ms, then finalized with `SUMMARY_UPDATED`. Cancellation uses an identity-checked per-tab `AbortController` merged into the provider signal.

The manifest loads only the lightweight page UI/message shell on ordinary pages. The shell requests only public `theme` and `showFloatingUi` values from the background; provider settings remain in extension contexts. `tab-manager.js` injects extractor modules on the first extraction request for each document, then retries the request once. This keeps extraction code off pages that are never summarized.
