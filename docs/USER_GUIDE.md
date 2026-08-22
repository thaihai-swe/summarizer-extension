# User Guide

DeepDigest creates structured summaries from webpages, YouTube videos, course lessons, PDFs, academic papers, and selected text. The side panel is the primary interface. Both the side panel and settings page use a high-density reading studio design with a Warm Book & Library palette, keyboard-navigable tabs, visible focus, and reduced-motion support.

## Custom Prompt Presets

Open Settings to create named prompt presets with optional system emphasis and user instructions. Presets appear in the side-panel mode selector and retain DeepDigest's grounded, structured output contract while adding your instructions. Placeholders such as `__CONTENT__` and `__LANG__` are supported in preset text.

## Launch Options

You can trigger a summary using any of the following methods:
- Click the DeepDigest extension icon to open the side panel and click Generate.
- Press `Ctrl+Shift+S` (or `Cmd+Shift+S` on macOS) to instantly open the side panel and begin summarizing the active tab.
- Select text or right-click anywhere on a page, and choose **Summarize with DeepDigest** from the context menu.

## Quick Start

1. Load the extension from `chrome://extensions/` in Developer mode.
2. Open Options and configure Gemini, OpenAI, or Local.
3. Open a supported page and click the extension icon to open the side panel.
4. Click **Generate** to start the summary. Text appears incrementally as the model generates it.

## Supported Content

- YouTube watch pages with available transcripts
- Webpages and documents
- PDFs and academic paper pages (arXiv, PubMed, OpenReview, IEEE, Chrome PDF viewer text layers)
- Supported course lesson pages (Udemy, Coursera)
- Text selected on a page

Selected text has priority over all other source types. When no selection exists, the extension prioritizes PDFs and academic papers, then YouTube, then course content, then webpage extraction.

## Side Panel Controls

- **Mode dropdown**: choose the summarization mode or a saved custom prompt preset.
- **Generate button**: start a new summary.
- **Cancel button**: abort the current request.
- **Settings button**: open the Options page.
- **Theme / Density / Font Scale / Language**: adjust output formatting in the controls row below the Generate button.
- **Generation stepper**: during a run, a four-step ribbon shows Extract → Analyze → Synthesize → Quality. Chunked sources display live progress such as `2/3`.

## Summary Modes

- **Summarize**: clear structured overview
- **Analyze**: claims, evidence, assumptions, bias, and tradeoffs
- **Explain**: simpler-to-advanced explanation
- **Debate**: supporting, opposing, and balanced interpretations
- **Study**: definitions, retention, and practice focus
- **Outline**: hierarchical topic structure
- **Timeline**: chronological or step-by-step order, rendered as a vertical milestone rail when the source has timestamps, phases, or dates
- **Concepts**: knowledge-concept map with definitions, relationships, and prerequisites, rendered as filterable Core / Important / Supporting cards

## Summary Sizes

- **Brief**: essential conclusion and three takeaways
- **Medium**: standard structured result
- **Deep**: comprehensive summary with Evidence and Details, Connections Causes & Tradeoffs, Concept Map and Prerequisites, Causal and Knowledge Flow, and Perspectives and Uncertainty

## Summary Lengths

- **Short**: concise output
- **Medium**: balanced length
- **Long**: expanded sections covering all content segments

## Dynamic Word Target (Options)

Open **Settings → General → Dynamic Word Target** to inspect the live formula and optionally override it.

- **Use custom formula values**: when enabled, your multipliers and clamps replace the built-in defaults on the next Generate.
- **Size multipliers**: Brief `0.05`, Medium `0.08`, Deep `0.12` by default.
- **Length multipliers**: Short `0.7`, Medium `1.0`, Long `1.35` by default.
- **Chars / word**, **Min words**, and **Max words** control the character-to-word ratio and the 60–1500 clamp.
- **Custom target sentence**: optional prompt sentence. Placeholders `{targetWords}`, `{sourceChars}`, and `{sourceWords}` are replaced at generate time.
- **Simulate source length**: drag the slider to preview the resulting word target before you save.
- **Reset formula defaults**: restore the shipped values without changing Size or Length.

The formula is:

`target = clamp(min, max, round((sourceChars / charsPerWord) × sizeMultiplier × lengthMultiplier))`

## Output Sections

Completed summaries may display:

- **Main Summary** / **Summary** – main conclusion
- **Key Takeaways** – bulleted main insights
- **Main Points** – detailed summary of the key content
- **Details of the Video** (YouTube only) – walkthrough of the video narrative
- **Detailed Breakdown** / **Complete Guided Walkthrough** – topic-by-topic explanation
- **Expert Commentary** – analysis and evaluation
- **Evidence and Details** (Deep) – supporting evidence and claims
- **Connections, Causes & Tradeoffs** (Deep) – dependencies and tradeoffs
- **Concept Map and Prerequisites** (Deep) – structured concept hierarchy
- **Causal and Knowledge Flow** (Deep) – causal links in the material
- **Perspectives and Uncertainty** (Deep) – alternative viewpoints and open questions
- **Follow-up Questions** – suggested questions for deeper exploration

## Section Expansion

Sections are collapsible. Initial expansion depends on size and length:

- Brief/Medium: first substantive section open
- Deep: first three substantive sections open
- Long: all substantive sections open except Details of the Video

Expand All and Collapse All buttons appear when multiple Deep sections are available.

## Transcript

When the source is a YouTube video, the transcript is displayed collapsed by default. Click the transcript toggle button to expand it. Timestamps are shown as `[mm:ss]` or `[hh:mm:ss]`.

## Quality Badge

After a Deep or Long summary completes, a small badge at the top left of the summary area shows the coverage score (e.g. "Coverage solid  92%"). If the score is low, it shows "Coverage needs work" with short descriptions.

## Execution Metadata

After a summary completes, a badge below the title shows total token usage (if reported by the provider) and the time it took to generate.

## Output Language

Select a language (`English` or `Vietnamese`) in the side-panel language dropdown before generating. The summary output will be written in that language. Default is `English`.

## Follow-Up Questions

Ask questions in the side panel after a summary completes. Use the toggle in the Follow-up header to choose between two modes:

- **Source (default)**: Answers are strictly grounded in the saved summary, relevant excerpts, recent conversation, and source content.
- **General**: Answers leverage the model's broader knowledge base without requiring or referencing the tab's source content.

Clicking suggested question chips or using the text selection "Ask about this" tooltip always submits in **Source** mode. A new summary clears prior follow-up history for that tab.

## Providers

- **Gemini**: default cloud provider
- **OpenAI**: OpenAI API compatible cloud provider
- **Local**: Ollama, LM Studio, or compatible local endpoint

## Tab Lifecycle

- Results are per-tab. Switching tabs shows that tab's saved summary.
- The side panel content updates on tab switch.
- Closing a tab clears its saved result and conversation.

## Export

Copy individual sections using the copy button next to each section heading. Use the export buttons (Markdown, Plain Text) to download the full result.

See `docs/SETUP.md` for provider configuration and `docs/TROUBLESHOOTING.md` for common issues.

## Accessibility

- Side panel and Options controls support keyboard focus with visible focus rings.
- Options tabs support Arrow keys, Home/End, and Space/Enter activation.
- Collapsible transcript and deep-dive sections expose `aria-expanded` and accessible names.
- Status updates are announced through a live region during generation and errors.
- Reduced-motion preferences disable non-essential animations and transitions.
