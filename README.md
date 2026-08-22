# DeepDigest

Browser extension for summarizing YouTube videos, webpages, selected text, PDFs, academic papers, and course lesson content with Gemini, OpenAI, or a local LLM endpoint.

## User Overview

- Summarizes YouTube watch/live pages from transcript data
- Summarizes webpages from semantic-first extraction with accessibility-tree fallback
- Summarizes highlighted text when the user has a selection
- Summarizes PDFs and academic paper pages (arXiv, PubMed, OpenReview, IEEE, Chrome PDF viewer)
- Custom Prompt Presets: Create named prompts for instant access
- Side Panel shortcuts: Trigger summaries via `Ctrl+Shift+S` or Right-Click Context Menu
- Total Execution Token and Latency reporting directly in the panel
- Summarizes course lessons:
  - Udemy lesson pages
  - Coursera lesson and supplement pages
- Supports follow-up Q&A using the saved summary plus prior conversation history
- Exports summaries as Markdown or plain text
- Creates reusable Custom Prompt Presets from the Options page
- Starts summaries from the page context menu or `Ctrl+Shift+S` (`Cmd+Shift+S` on macOS)
- Shows available token usage and generation duration after completion
- Logs extraction, provider requests, and provider responses to the console for debugging

## Example Output

![example-output](example-output.png)

## Supported Providers

- `gemini`
- `openai`
- `local`

The `local` provider supports a configurable OpenAI-compatible or Ollama-style endpoint through settings in [lib/storage.js](/lib/storage.js).

## Current Summary Behavior

- Side panel is the primary UI
- Results, conversations, and workflow state are stored per tab
- Closing a tab clears that tab's saved result, conversation, and workflow state
- Switching tabs refreshes the side panel from the newly active tab
- Normal YouTube and webpage summaries usually use 1 provider request
- Long sources can use semantic chunking (up to 4 chunk requests plus synthesis)
- Final responses stream into the side panel when the selected provider supports streaming
- Deep/Long summaries run a quality gate and may trigger one targeted repair pass
- Context-menu and keyboard launches open the side panel synchronously before summary work begins

## Docs

Start with the full index: [docs/README.md](docs/README.md)

**User docs**
- [User Guide](docs/USER_GUIDE.md)
- [Setup](docs/SETUP.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)

**Developer docs**
- [Architecture](docs/ARCHITECTURE.md)
- [Workflow](docs/WORKFLOW.md)
- [Content Pipeline](docs/CONTENT_PIPELINE.md)
- [API](docs/API.md)
- [Prompts](docs/PROMPTS.md)
- [Providers](docs/PROVIDERS.md)
- [Storage](docs/STORAGE.md)
- [Testing](docs/TESTING.md)
- [Maintenance](docs/MAINTENANCE.md)
- [Debugging](docs/DEBUGGING.md)

## Current Architecture

The codebase is split into small modules instead of monolithic extractor or prompt files.

- Content extraction:
  - [lib/extractors.js](/lib/extractors.js)
  - [lib/extractors/core.js](/lib/extractors/core.js)
  - [lib/extractors/accessibility-tree.js](/lib/extractors/accessibility-tree.js)
  - [lib/extractors/selected-text.js](/lib/extractors/selected-text.js)
  - [lib/extractors/pdf.js](/lib/extractors/pdf.js)
  - [lib/extractors/youtube.js](/lib/extractors/youtube.js)
  - [lib/extractors/course.js](/lib/extractors/course.js)
  - [lib/extractors/webpage.js](/lib/extractors/webpage.js)
- Prompt building:
  - [lib/prompts/builders.js](/lib/prompts/builders.js)
  - [lib/prompts/common.js](/lib/prompts/common.js)
  - [lib/prompts/templates/](/lib/prompts/templates)
- Background orchestration:
  - [background.js](/background.js)
  - [lib/background/tab-manager.js](/lib/background/tab-manager.js)
  - [lib/background/summary-service.js](/lib/background/summary-service.js)
  - [lib/background/ui-notifier.js](/lib/background/ui-notifier.js)
- Side panel UI:
  - [sidepanel.js](/sidepanel.js)
  - [lib/sidepanel/state.js](/lib/sidepanel/state.js)
  - [lib/sidepanel/render.js](/lib/sidepanel/render.js)
  - [lib/sidepanel/visual-renderers.js](/lib/sidepanel/visual-renderers.js)

## Load Locally

1. Open `chrome://extensions/`
2. Enable Developer mode
3. Click Load unpacked
4. Select this project folder

## Portfolio site (GitHub Pages)

The case-study page in [porfolio-page/index.html](porfolio-page/index.html) is published for free with GitHub Pages. The workflow in [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml) copies that page, its CSS, and extension icons into `_site/`, then deploys the bundle.

### Preview locally

```bash
./scripts/prepare-pages.sh
python3 -m http.server --directory _site 8080
```

Open [http://127.0.0.1:8080](http://127.0.0.1:8080).

### Publish (free)

1. Create a GitHub repository and push this project to the `main` branch.
2. In the repo open **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**.
3. Push to `main`, or run **Actions → Deploy Portfolio Page to GitHub Pages → Run workflow**.
4. The live URL is `https://<user>.github.io/<repo>/` (for example `https://thaihai-swe.github.io/summarizer-extension/`).

Parent-relative `../docs/` links on the page are rewritten at build time to GitHub blob URLs so they keep working on Pages.

## Developer Quick Start

New to the codebase? Follow this path:

1. **Understand the project:** Read [Architecture](docs/ARCHITECTURE.md)
2. **Set up locally:** Read [Setup](docs/SETUP.md) and [Architecture](docs/ARCHITECTURE.md)
3. **Learn the data flow:** Review [Workflow](docs/WORKFLOW.md)
4. **Explore the modules:** Start with [lib/extractors.js](/lib/extractors.js)
5. **Make a change:** Review [Maintenance](docs/MAINTENANCE.md), [Testing](docs/TESTING.md), and [Debugging](docs/DEBUGGING.md)
6. **Debug your changes:** Use [Debugging Guide](docs/DEBUGGING.md)

## Notes

- Coursera lesson pages use the dedicated course extraction route instead of generic webpage extraction.
- The side panel is the primary UI. The floating UI is optional and controlled by settings.
- The side panel closes when you switch away from the tab where it was opened.
- Summary generation streams final response text when the selected provider supports it. Intermediate chunk and synthesis requests remain buffered.
- Debug payloads are logged to the console instead of being rendered in the side panel.
