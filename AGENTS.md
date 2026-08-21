# AGENTS.md

## Purpose

This repository is a Chrome extension that summarizes YouTube videos, webpages, selected text, and course lesson pages using Gemini, OpenAI, or a local LLM endpoint.

Use this file as the working contract for Codex-style agents making changes in this repo.

## Working Style

- Prefer small, surgical edits over broad rewrites.
- Preserve the current architecture: extractor -> prompt builder -> provider -> parse/save -> side panel render.
- Keep the side panel as the primary UI.
- Do not reintroduce streaming summary behavior unless explicitly requested.
- Avoid changing storage keys or message shapes unless the task requires it.
- If you add a new user-visible behavior, update the relevant docs in `docs/`.

## Repo Layout

### Runtime entrypoints

- `manifest.json`: extension manifest
- `background.js`: background/service worker entry
- `content.js`: content script and floating UI hooks
- `sidepanel.js`: side panel entry
- `options.js`: settings page entry

### Core modules

- `lib/extractors.js`: extraction dispatcher
- `lib/extractors/`: source-specific extraction logic
- `lib/prompts/builders.js`: prompt routing and assembly
- `lib/prompts/templates/`: source-specific prompt templates
- `lib/background/summary-service.js`: summary orchestration
- `lib/background/tab-manager.js`: active-tab routing and extraction requests
- `lib/background/workflow-store.js`: workflow phase persistence
- `lib/background/ui-notifier.js`: UI update fanout
- `lib/provider-registry.js`: provider dispatch
- `lib/providers/`: provider implementations
- `lib/storage.js`: Chrome local storage helpers
- `lib/sidepanel/`: side panel state/render helpers

### Prompt Inventory

- The canonical prompt inventory lives in `docs/PROMPTS.md`.
- If you change any runtime prompt behavior, update `docs/PROMPTS.md` in the same task.
- Treat prompt changes broadly: this includes `lib/prompts/common.js`, `lib/prompts/builders.js`, files under `lib/prompts/templates/`, prompt-related settings in `lib/storage.js`, and chunking/follow-up prompt entrypoints in `lib/background/summary-service.js`.
- Preserve the current prompt architecture: shared envelope in `lib/prompts/common.js`, source-specific templates in `lib/prompts/templates/`, routing in `lib/prompts/builders.js`.
- Do not change output section names casually; `lib/cleaners.js` parses model output by heading.
- Keep provider integrations prompt-agnostic. Providers should continue receiving one final prompt string via `generateText(prompt, providerSettings)`.

## Key Behavior To Preserve

- Extraction priority is: selected text -> YouTube -> course -> webpage.
- Results, conversations, and workflow state are stored per tab ID.
- Closing a tab clears that tab's saved result, conversation, and workflow state.
- New summaries clear prior follow-up conversation for the same tab.
- Typical webpage and short YouTube summaries use a single provider request.
- Long YouTube transcripts may use chunking plus synthesis.

## Where To Make Changes

### Add or adjust extraction logic

- Start in `lib/extractors.js`.
- Put source-specific behavior in the matching file under `lib/extractors/`.
- Keep returned objects normalized with `sourceType`, `title`, `url`, and `content`.

### Change prompts or summary format

- Start in `lib/prompts/builders.js`.
- Update shared rules in `lib/prompts/common.js`.
- Update source-specific prompt text in `lib/prompts/templates/`.
- Check `lib/cleaners.js` if you change heading names or section structure.
- Update `docs/PROMPTS.md` so the prompt inventory stays current.

### Change provider behavior

- Update the matching file in `lib/providers/`.
- Keep the provider interface as `generateText(prompt, providerSettings)`.
- If adding a provider, wire it through `lib/provider-registry.js` and document it in `docs/PROVIDERS.md`.

### Change workflow or tab state behavior

- Inspect `lib/background/summary-service.js`, `lib/background/tab-manager.js`, and `lib/background/workflow-store.js`.
- Be careful with per-tab cleanup and follow-up conversation reset behavior.

### Change UI behavior

- Side panel UI lives in `sidepanel.js`, `lib/sidepanel/`, `sidepanel.html`, and `sidepanel.css`.
- Options UI lives in `options.js`, `options.html`, and `options.css`.
- Preserve existing visual patterns unless the task is explicitly a redesign.

## Validation

There is no confirmed build step in this repository. Validate changes by loading the extension unpacked in Chrome:

1. Open `chrome://extensions/`
2. Enable Developer mode
3. Click `Load unpacked`
4. Select the repo root
5. Reload the extension after code changes

Manual checks to prioritize:

- YouTube summary
- Webpage summary
- Selected text summary
- Coursera or Udemy lesson extraction
- Follow-up questions
- Export to Markdown and plain text
- Provider switching
- No console errors in page DevTools or the extension service worker

## Debugging Notes

- Page-level extraction logs appear in the page DevTools console.
- Background/provider logs appear in the extension service worker console from `chrome://extensions`.
- Helpful references:
  - `docs/ARCHITECTURE.md`
  - `docs/WORKFLOW.md`
  - `docs/CONTENT_PIPELINE.md`
  - `docs/DEBUGGING.md`
  - `docs/TESTING.md`

## Change Hygiene

- Do not remove or rename storage keys casually.
- Keep message constants centralized in `lib/messages.js`.
- Prefer updating the smallest relevant module instead of duplicating logic.
- Match the existing plain JavaScript style; do not introduce a framework or build dependency unless explicitly requested.
- If you add a new doc link in `README.md`, make sure the target file actually exists.
