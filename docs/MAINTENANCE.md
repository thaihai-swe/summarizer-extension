# Maintenance Guide

## Prompt Changes

1. Update shared behavior in `lib/prompts/common.js` or source behavior in `lib/prompts/templates/`.
2. Check `lib/cleaners.js` before changing output headings.
3. Update `docs/PROMPTS.md` in the same change.
4. Run prompt snapshots with `node scripts/print-prompt-snapshots.js` and manually verify a summary and follow-up.

## Provider Changes

1. Keep the provider interface as `generateText(prompt, providerSettings, onChunk?)`. Streaming is optional and must remain backward-compatible when `onChunk` is omitted.
2. Reuse `lib/providers/shared.js` for timeout, fetch, error, response, and stream handling; keep endpoint payloads and provider fallback logic in the provider module.
3. Register the provider descriptor in `lib/provider-registry.js`.
4. Add defaults in `lib/settings-schema.js` and fallback values in `lib/storage.js`.
5. Update `docs/PROVIDERS.md` and `docs/SETUP.md`.

## Settings Schema Changes

1. Edit `lib/settings-schema.js`: update defaults, valid sets, or normalization logic.
2. Update fallback defaults in `lib/storage.js` if needed.
3. Verify the options page loads and saves the new field correctly.
4. Verify the side-panel controls row reflects the new field (if user-facing).

## Quality Gate Changes

1. Update section contracts in `lib/summary-quality.js` if output headings or Deep sections change.
2. Update the repair prompt logic if scoring or merge behavior needs adjustment.
3. Test Deep/Long coverage: generate a summary and inspect the quality badge.

## Semantic Chunker Changes

1. Update `lib/semantic-chunker.js` boundary logic (timestamp, paragraph, sentence rules).
2. Test edge cases: short single-paragraph content, content without timestamps, oversized transcript segments.
3. Verify fallback when the chunker is absent.

## Extraction Changes

1. Preserve normalized `sourceType`, `title`, `url`, and `content`.
2. Preserve extraction priority: selected text → YouTube → course → webpage.
3. Update `docs/CONTENT_PIPELINE.md` and test affected sources.

## Accessibility Changes

1. Verify live region (`aria-live="polite" role="status"`) announces workflow phase changes.
2. Verify focus rings on all interactive controls.
3. Verify reduced-motion CSS for progress and skeleton animations.
4. Verify screen-reader labels on collapsible section toggles and trim buttons.

## State Changes

Keep results, conversations, and workflow state scoped to tab ID. Preserve cleanup when tabs close and conversation reset when summaries regenerate.


## Custom Prompt Presets

When changing preset storage or selection:

- Keep `customPromptPresets` shape stable: `{ id, name, systemPrompt, userPrompt, createdAt, updatedAt }`.
- Preserve side-panel mode values as `preset-<id>`.
- Ensure presets are applied inside the shared envelope in `lib/prompts/builders.js`, not as a full prompt replacement.
- Update Options UI, side-panel mode loading, storage schema, and `docs/PROMPTS.md` together.
