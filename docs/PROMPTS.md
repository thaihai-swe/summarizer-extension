# Prompt Inventory

This document inventories every runtime LLM prompt path used by the extension.

Use it as the source of truth when changing prompt behavior in:

- `lib/prompts/common.js`
- `lib/prompts/builders.js`
- `lib/prompts/templates/youtube.js`
- `lib/prompts/templates/webpage.js`
- `lib/prompts/templates/course.js`
- `lib/prompts/templates/selected-text.js`
- `lib/prompts/templates/prompt-enhance.js`

## Prompt Architecture

All providers receive one final prompt string.

Runtime flow:

1. Extraction produces normalized context (`sourceType`, `title`, `url`, `content`, optional metadata).
2. `lib/prompts/builders.js` routes to the matching template builder.
3. Source templates assemble a shared prompt envelope from `lib/prompts/common.js`.
4. `summaryLanguage` is injected through a critical language directive requiring all response content to use the selected language; parser-required headings remain unchanged.
5. The final prompt string is sent through `generateText(prompt, providerSettings)`.

Users can configure additional output languages in Settings using `customLanguages`, a comma-separated list. English and Vietnamese are always available.
6. The response is parsed by heading in `parseStructuredSummary()`.
7. Failed Deep/Long results may trigger one targeted repair prompt from `lib/summary-quality.js`.

Important constraints:

- Source grounding rules remain active, but prompts no longer instruct the model to produce bracketed claim labels such as `[DIRECTLY STATED]`, `[PARAPHRASE]`, `[INFERENCE]`, or `[OPINION]`.
- Heading names (e.g. `Connections, Causes & Tradeoffs`) are parsed directly; do not change them without updating `lib/cleaners.js` and `lib/sidepanel/render.js`.
- Providers remain prompt-agnostic. They do not interpret settings or split sections.

## Runtime Prompt Entry Points

### 1. Standard summary prompt

Entry:
- `lib/prompts/builders.js` → `buildSummaryPrompt(context, settings)`

Selects:
- YouTube, course, webpage, or selected-text template based on `sourceType`.

Assembly:
- Applies system role instructions, grounding rules, mode guides, customized prompt hints, section contracts, and content envelopes.

### 2. Chunk summary prompt

Entry:
- `lib/prompts/builders.js` → `buildChunkSummaryPrompt(context, chunk, index, total, settings)`

Behavior:
- Summarizes individual source chunks (under 12,000 characters) created by the semantic chunker.
- YouTube chunk prompts instruct the model to use `### Topic [MM:SS]` subsections only when timestamps appear in the chunk.

### 3. Synthesis prompt

Entry:
- `lib/prompts/builders.js` → `buildSynthesisPrompt(context, chunkSummaries, settings)`

Behavior:
- Synthesizes up to four individual chunk summaries into a single cohesive output.
- Instructs the model to preserve timestamps, resolve duplicate topics sequentially, and maintain structural flow without inventing transitions.

### 4. Deep-dive prompt

Entry:
- `lib/prompts/builders.js` → `buildDeepDivePrompt(context, question, settings)`

Behavior:
- Grounds follow-up answers in the saved summary, Deep fields, conversation history, and relevant source context.
- instruct the model to refuse queries unrelated to the source or summary.

### 5. Quality repair prompt

Entry:
- `lib/summary-quality.js` → `buildRepairPrompt(context, parsed, quality, settings)`

Behavior:
- Used only when Deep/Long quality checks fail.
- Instructs the model to rewrite only weak or missing sections (e.g., `Connections, Causes & Tradeoffs`) while preserving healthy sections.
- Repaired sections are merged back using `mergeRepairedSections()`.

### Custom prompt presets

Entry:
- Settings field: `customPromptPresets`
- Side-panel mode values: `preset-<id>`
- Application: `lib/prompts/builders.js`

Behavior:
- Options stores named `{ id, name, systemPrompt, userPrompt }` presets.
- Selecting a preset sets `promptMode` to that preset id.
- The selected preset is applied inside the shared prompt envelope as additional system/user guidance.
- Presets do not replace source grounding, safety rules, language rules, section contracts, or parser-safe headings.

### 6. Prompt enhancement prompt

Entry:
- `lib/prompts/templates/prompt-enhance.js` → `buildEnhancePrompt(promptText, lang)`

Behavior:
- Used in the options UI to enhance custom prompts.
- Instructs the model to improve instructions, keep placeholders (`__CONTENT__`, `__LANG__`, `__TITLE__`, `__URL__`) intact, and return ONLY the enhanced template text.

## Headings and Contracts

Every prompt includes a section contract matching these exact headers:

### Standard Headings
- `Main Summary` / `Summary` (mapped to `summary`)
- `Key Takeaways` (mapped to `keyTakeaways`)
- `Main Points` (mapped to `mainPoints`)
- `Details of the Video` (YouTube only; mapped to `detailsOfVideo`)
- `Detailed Breakdown` / `Complete Guided Walkthrough` (mapped to `detailedBreakdown`)
- `Expert Commentary` (mapped to `expertCommentary`)
- `Follow-up Questions` (mapped to `followUpQuestions`)

### Deep Headings
- `Evidence and Details` (mapped to `evidenceAndDetails`)
- `Connections, Causes & Tradeoffs` (mapped to `argumentAndInsight`)
- `Concept Map and Prerequisites` / `Concepts, Definitions & Mental Models` (mapped to `conceptMapAndPrerequisites`)
- `Causal and Knowledge Flow` (mapped to `causalAndKnowledgeFlow`)
- `Perspectives and Uncertainty` (mapped to `perspectivesAndUncertainty`)

## Output Language Rules

All prompts receive `__LANG__` instruction:
```text
All headings, subheadings, lists, paragraphs, and timestamps must be written in __LANG__.
```

## Validation

Run `node scripts/print-prompt-snapshots.js` to print prompt builders outputs for manual inspection.

## Coverage and quality behavior

Deep and Long prompts now treat `Complete Guided Walkthrough` as the canonical coverage record. Chunk prompts produce uncompressed coverage records, while synthesis prompts reconcile claims, examples, names, numbers, definitions, procedures, transitions, and caveats before writing the final sections.

The quality gate also checks source coverage signals in addition to section length. Diagnostics may report missing source signals, low coverage, weak sections, missing timestamps, and repair attempts. Deep/Long repair prompts include the beginning and end of long sources plus detected missing signals so repairs are not limited to the first source window.

Prompt instructions do not request bracketed classification labels. Debate and study modes use normal prose, tables, and descriptive subheadings instead.

Follow-up retrieval uses up to five relevant passage matches with two neighboring units around each match and an 8,000-character excerpt budget. The parser accepts additional safe aliases for evidence audits, tradeoffs, practical implications, limitations, and debate sections while preserving canonical internal section keys.

## Dynamic summary sizing

Each summary prompt receives a source-length-aware word target appended to the `Main Summary` instruction. The target is computed from `getSummarySizeInstructionsForSource()` in `lib/prompts/common.js` using:

$$\text{Target Words} = \text{clamp}\left(\text{minTarget},\, \text{maxTarget},\, \text{round}\left(\frac{\text{sourceLength}}{\text{charsPerWord}} \times \text{sizeMultiplier} \times \text{lengthMultiplier}\right)\right)$$

### Canonical Defaults
- **Size Multipliers (`sizeMultiplier`):** `Brief: 0.05`, `Medium: 0.08`, `Deep: 0.12`
- **Length Multipliers (`lengthMultiplier`):** `Short: 0.7`, `Medium: 1.0`, `Long: 1.35`
- **Character-to-word ratio (`charsPerWord`):** `5`
- **Clamps (`minTargetWords` / `maxTargetWords`):** `60` to `1500` words

### User Overrides & Settings Exposure
Users can inspect, simulate, and override every parameter of this formula directly from the **Options page** (`options.html` under General → Dynamic Word Target):
- Toggle custom formula calculations via `customFormulaEnabled`.
- Customize individual Brief / Medium / Deep and Short / Medium / Long multipliers.
- Adjust minimum clamp, maximum clamp, and characters-per-word ratio.
- Supply an optional `customTargetTemplate` string supporting `{targetWords}`, `{sourceChars}`, and `{sourceWords}` placeholders.
- Test formula output live with the interactive slider simulator.
- Reset to built-in defaults with a single click. Mode-specific guidance (e.g. analyze, explain, study) is prepended alongside the size-aware coverage instruction so both the analytical focus and the dynamic word target are conveyed.
