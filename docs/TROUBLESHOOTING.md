# Troubleshooting Guide

## Context menu or shortcut does not open the side panel

- Reload the extension from `chrome://extensions/` after changing the manifest or `background.js`.
- Confirm the shortcut is assigned at `chrome://extensions/shortcuts`.
- Use the context menu on a normal page or selected text; restricted browser pages cannot be summarized.
- If the console reports `sidePanel.open() may only be called in response to a user gesture`, verify the extension is using the current `background.js` and that no stale service worker is running. The open call must happen before asynchronous extraction or provider work.

## Extension Does Not Load

1. Open `chrome://extensions/`.
2. Enable Developer mode.
3. Confirm the repository root contains a valid `manifest.json`.
4. Click Reload after changes.
5. Inspect manifest or service-worker errors displayed on the extensions page.

## Summary Does Not Start

- Open the side panel on a normal browser tab.
- Confirm a provider is configured in Options.
- Check the page console for extraction errors.
- Check the service worker console for background errors.

## Provider Errors

### Gemini or OpenAI
- Verify API key and model.
- Verify billing/quota and internet access.
- For custom OpenAI endpoints, verify the Base URL is correct.

### Ollama or LM Studio
- Start the local server before generating.
- Ollama commonly uses `http://127.0.0.1:11434`.
- LM Studio OpenAI-compatible mode commonly uses `http://127.0.0.1:1234/v1`.
- Select the matching Local endpoint type and model name.

## Poor or Incomplete Results

- Try Deep size for detailed source material.
- Use Analyze, Study, Outline, or Timeline mode when that structure matches the content.
- Long content is processed in semantic chunks; provider context limits can still reduce detail.
- Check output language: if the language field is empty or incorrectly set, output may revert to defaults.
- Inspect `docs/PROMPTS.md` if custom instructions conflict with the required section contract.
- If the quality badge shows "needs work", the Deep/Long repair pass may have failed; check the service-worker console.

## Built-in Prompt Not Showing

- The options page Prompt Reference tab shows the assembled prompt.
- The side panel shows the prompt for the current source in the "Built-in prompt" textarea.
- If the textarea is empty, verify the extension was reloaded after source changes.

## Output Language Not Taking Effect

- Select `English` or `Vietnamese` in the language dropdown.
- Blank or misspelled language values fall back to `English`.
- Language instructions are part of the prompt envelope and apply only to new summaries, not existing results.

## Transcript Display Issues

- Transcript is collapsed by default; click the transcript toggle to expand.
- Timestamps show `[mm:ss]` or `[hh:mm:ss]` only; duration labels like "20 giây" should be suppressed.
- If "Transcript" label missing, verify the toggle button text includes a visible button/label (not just an icon).

## Quality Gate Repair Fails

- Check the service-worker console for repair prompt errors.
- The repair runs once per summary; if it fails, the original output is saved without quality improvements.
- Brief mode does not trigger repair.

## Semantic Chunking Skipped

- The `SummarizerSemanticChunker` global is loaded from `lib/semantic-chunker.js`.
- If the chunker is missing, the summary service falls back to the balanced text splitter.
- Check script loading order: `semantic-chunker.js` must load before `summary-service.js`.

## Side Panel Shows Wrong Tab Content

- The side panel updates on tab switch.
- Stale messages from previous tabs are ignored by `tabId` match.
- If content does not refresh, reload the extension from `chrome://extensions/`.

## Saved Result or Follow-Up Problems

- Results and conversation are tab-specific.
- A new summary clears old follow-up history.
- Closing a tab clears stored data for that tab.
- Switch tabs and switch back to retrigger a fresh panel state.
