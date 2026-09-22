# Testing Guide

Run the focused runtime checks first:

```bash
node --test tests/runtime-performance.test.js
node scripts/print-prompt-snapshots.js
```

There is no full browser automation suite, so also validate behavior by loading the extension unpacked.

## Load and Reload

1. Open `chrome://extensions/`
2. Enable Developer mode
3. Click **Load unpacked** and choose the repository root
4. Reload the extension after code changes

For Firefox, run `node scripts/prepare-firefox.mjs`. Load `firefox-output/firefox/manifest.json`
from `about:debugging#/runtime/this-firefox` for unpacked testing, or load the generated
`firefox-output/deepdigest-firefox-<version>.xpi` as a temporary add-on. The script regenerates both
artifacts from the current source tree.

## Summary Coverage

Run each source through a summary:
- selected text excerpt
- YouTube video with transcript and chapters
- YouTube transcript Copy and Download SRT actions
- Deep/Long result table of contents jumps and active state
- ordinary webpage
- long webpage that triggers chunking
- Coursera or Udemy lesson, where supported

For each, verify the correct source type, title, URL, and summary sections are shown.

## Launch Entry Points

- Click the extension icon and generate from the side panel.
- Right-click a page or selection and choose **Summarize with DeepDigest**.
- Press `Ctrl+Shift+S` or `Cmd+Shift+S` on the active tab.
- Confirm context-menu and keyboard launches open the panel before generation starts and do not
  produce a `sidePanel.open()` user-gesture error.

## Prompt Mode Coverage

Verify all modes:
- summarize: clear overview with Main Summary and Executive Takeaways
- analyze: claims/evidence separation and Missing Context & Limitations
- explain: progressive explanation
- debate: `[Pro]`, `[Con]`, `[Balanced]` prefixes
- study: Core Definitions and recall-oriented takeaways
- outline: hierarchical numbering
- timeline: timestamps or Step N sequence markers
- concepts: Concept Map with definitions, relationships, and prerequisites

## Size and Parser Coverage

- Brief: concise summary and three takeaways
- Medium: standard structured result
- Deep: all five Deep sections parse and render
- Disable follow-up questions and verify its heading is absent

## Provider Coverage

- Gemini valid/invalid key
- OpenAI valid/invalid key and base URL
- Local Ollama endpoint
- Local OpenAI-compatible endpoint such as LM Studio

## Follow-Up and Lifecycle Coverage

- Ask a follow-up in **Source** mode and verify source-grounded output with `Source` badge
- Switch toggle to **General** mode, ask an out-of-domain question, and verify output does not cite the source and displays `General` badge
- Switch back to **Source** mode and verify subsequent questions remain strictly source-grounded
- Switch to **General**, click a suggested question chip, and verify it executes in **General** mode; switch back to **Source** and verify the same chip uses source grounding
- Use highlight tooltip "Ask about this" and verify it executes in **Source** mode
- Generate a new summary and verify old conversation clears
- Switch tabs and verify the current panel result and conversation clear
- Reload the panel or extension and verify no prior result or conversation is restored

## Streaming and Cancellation Coverage

- Verify SUMMARY_CHUNK messages arrive and the side panel renders incremental sections
- Verify chunk messages arrive no more than four times per second and contain no source, transcript, or raw model-output fields
- Verify transcript rows do not exist until the transcript is expanded; then verify filtering and line copy
- Verify Cancel button appears during generation
- Cancel mid-generation and confirm no partial result is shown as complete
- Cancel during the retry delay and Gemini direct-video generation; confirm no fallback request continues

## Loading and Payload Coverage

- On a newly loaded ordinary page, verify extractor globals are absent before the first summary request
- Generate once and verify extractors are injected and extraction retries successfully
- Generate again and verify the already-loaded extractors are reused
- Verify the floating page UI receives only title/source/mode/summary/takeaway fields
- Verify content-script settings updates contain no provider credentials

## Tab Switch Coverage

- Open the side panel on Tab A, start a summary
- Switch to Tab B: verify Tab A's content is cleared
- Switch back to Tab A: verify no persisted result is restored
- Verify extension icon opens the panel for the currently active tab
- Firefox temporary add-on: toolbar action opens the native sidebar and recent session results restore on tab switching without surviving an extension restart

## Settings Coverage

- Verify output language setting persists and affects generated output
- Verify Summary Tone, Coverage, and Detail have identical choices in the side panel and Settings page
- With both views open, change each summary control in the side panel and verify the Settings-page field updates immediately; save from Settings and verify the side panel updates
- Verify all nine tones persist after reopening and that Concise, Critical, Witty, and Roast do not normalize to Simple
- Verify theme and fontScale dropdowns persist and render correctly
- Verify follow-up toggle on/off affects auto-generated suggestions
- Verify API key, endpoint, and model fields persist after reload
- Verify custom prompt hints save and load correctly
- Create, save, delete, and select a custom prompt preset; verify its instructions affect output
- Verify preset selection persists after reopening the side panel
- Verify result metadata shows duration and token count only when usage is available

## UI and Accessibility Coverage

- Keyboard-only: Tab through mode, Generate, Cancel, Settings, tone/size/length, language, theme/font, section toggles, follow-ups, chat. Verify Options tab navigation supports arrow keys and Space/Enter.
- Focus rings visible on all interactive controls
- Screen reader: section toggles announce Expand/Collapse + section name; live status announces workflow changes
- `prefers-reduced-motion`: skeleton/progress animations collapse to near-instant
- Expand all / Collapse all controls have accessible names

## Semantic Chunking Coverage

- Long YouTube video with timestamps: chunks should split near topic/timestamp boundaries
- Long webpage with headings/paragraphs: chunks should not cut mid-sentence when avoidable
- Short content: remains a single request (no chunking)

## Quality Gate Coverage

- Deep + Long on a rich source: quality badge shows solid coverage
- Force a thin model response (if possible): weak sections are flagged and repair runs once
- Brief mode: quality checks are permissive; no repair pass

## Diagnostics

- Page DevTools: extraction logs from content scripts
- Extension service worker console: background and provider errors
- Run `node --check` on changed plain-JavaScript modules
- Run `node scripts/print-prompt-snapshots.js` when validating prompt changes
