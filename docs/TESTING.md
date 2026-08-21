# Testing Guide

There is no automated build or test suite. Validate behavior by loading the extension unpacked.

## Load and Reload

1. Open `chrome://extensions/`
2. Enable Developer mode
3. Click **Load unpacked** and choose the repository root
4. Reload the extension after code changes

## Summary Coverage

Run each source through a summary:
- selected text excerpt
- YouTube video with transcript and chapters
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
- summarize: clear overview with Summary and Key Takeaways
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

- Ask a follow-up and verify source-grounded output
- Generate a new summary and verify old conversation clears
- Open multiple tabs and verify saved results remain isolated
- Close a summarized tab and verify its state clears

## Streaming and Cancellation Coverage

- Verify SUMMARY_CHUNK messages arrive and the side panel renders incremental sections
- Verify Cancel button appears during generation
- Cancel mid-generation and confirm no partial result is saved
- Verify the workflow state shows cancelled

## Tab Switch Coverage

- Open the side panel on Tab A, start a summary
- Switch to Tab B: verify Tab A's content is not visible
- Switch back to Tab A: verify the panel refreshes correctly
- Verify extension icon opens the panel for the currently active tab

## Settings Coverage

- Verify output language setting persists and affects generated output
- Verify theme/density/fontScale dropdowns persist and render correctly
- Verify follow-up toggle on/off affects auto-generated suggestions
- Verify API key, endpoint, and model fields persist after reload
- Verify custom prompt hints save and load correctly
- Create, save, delete, and select a custom prompt preset; verify its instructions affect output
- Verify preset selection persists after reopening the side panel
- Verify result metadata shows duration and token count only when usage is available

## UI and Accessibility Coverage

- Keyboard-only: Tab through mode, Generate, Cancel, Settings, theme/density/font, language, section toggles, follow-ups, chat. Verify Options tab navigation supports arrow keys and Space/Enter.
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
