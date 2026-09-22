# Debugging Guide

## Console Locations

- **Page DevTools console**: content-script extraction logs
- **Extension service worker console**: background workflow, prompts, providers, storage, quality gate
- **Side-panel DevTools**: rendering, streaming updates, and panel interaction issues

Open the service worker console from `chrome://extensions/` (Chrome), or from `about:debugging` → **This Firefox** (Firefox).

## Common Failures

### No content extracted
- Confirm the page is supported.
- Check whether selected text has priority over the source you expected.
- Inspect page console extraction logs.

### Provider failure
- Check API key, provider selection, model, and base URL.
- Gemini/OpenAI failures appear in the service-worker console.
- Local endpoints must be reachable from the extension host permissions.

### Long content failure
- Check whether chunking was selected: YouTube > 24k, webpage > 60k, course > 50k characters.
- Inspect provider request errors for individual chunks or final synthesis.
- Confirm `lib/semantic-chunker.js` is loaded before `summary-service.js`.

### Missing sections
- Inspect the raw response and `lib/cleaners.js` heading mapping.
- Ensure the provider followed the section contract from `docs/PROMPTS.md`.
- For Deep/Long results, check whether quality repair ran and failed.

### Streaming or cancellation issues
- Confirm the provider supports streaming and that `SUMMARY_CHUNK` is emitted only for the final pass.
- Cancel should abort the per-tab `AbortController` and leave no partial session result.
- Stale chunks from another tab must be ignored by `tabId`.

### Settings not applying
- Inspect `lib/settings-schema.js` normalization and the settings returned by `SummarizerStorage.getSettings()`.
- Blank output language falls back to English.
- Reload the extension after Options changes if the service worker is stale.

## Useful Files

- `lib/background/summary-service.js`
- `lib/background/tab-manager.js`
- `lib/extractors.js`
- `lib/prompts/common.js`
- `lib/prompts/builders.js`
- `lib/provider-registry.js`
- `lib/cleaners.js`
- `lib/semantic-chunker.js`
- `lib/summary-quality.js`
- `lib/settings-schema.js`
- `lib/storage.js`
- `lib/sidepanel/render.js`


## Context menu / shortcut open failures

If the sidebar open call fails with a user-gesture error:

1. Confirm the generated service worker reloaded after the latest WXT build.
2. Verify `openSidePanelForTab()` runs before any `await`.
3. Reproduce from context menu and keyboard command separately.
4. Check the service worker console for the rejected open promise or follow-on summary error.
