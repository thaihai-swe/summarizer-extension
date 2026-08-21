# Setup Guide

## 1. Load the Extension

1. Open `chrome://extensions/`
2. Turn on **Developer mode**
3. Click **Load unpacked** and select the repository root directory

After loading, Chrome registers the **Summarize with DeepDigest** page/selection context-menu
item and the `Ctrl+Shift+S` command (`Cmd+Shift+S` on macOS). If a shortcut conflicts with
another extension, open `chrome://extensions/shortcuts` and assign a different key.

## 2. Configure a Provider
Click the extension icon to open the side panel, then open Options from the side-panel settings button. Configure one of the supported providers.

### Gemini (Default)
1. Get a key at Google AI Studio (https://aistudio.google.com).
2. Paste the API Key in the Options page.
3. Model defaults to `gemini-3.5-flash-lite`.

### OpenAI
1. Get a key at OpenAI Platform (https://platform.openai.com).
2. Paste the API Key.
3. Model defaults to `gpt-4o-mini`.
4. Base URL defaults to `https://api.openai.com/v1`.

### Local (Ollama, LM Studio, or OpenAI-compatible)
1. Run your local server.
2. Select the `Local` provider.
3. Configure the Base URL:
   - Ollama: `http://127.0.0.1:11434`
   - LM Studio: `http://127.0.0.1:1234/v1`
4. Configure Endpoint Type: choose `ollama` or `openai`.
5. Define the model string (e.g. `llama3.1`, `qwen2.5`).

Note: Local setups require a fast, high-context model to summarize long text well.

## 3. Configure Other Settings

- **Output Language**: Select `English` or `Vietnamese` in the side-panel language dropdown or Options page. Default is `English`.
- **Theme**: Choose `System Default`, `Light`, or `Dark` in the side-panel dropdown.
- **Density**: Choose `Comfortable` or `Compact` in the side-panel dropdown.
- **Font Scale**: Choose between `Small`, `Medium`, `Large`, or `Extra Large` in the side-panel dropdown.
- **Follow-up Questions**: Toggle auto-generated question suggestions on or off in Options.
- **Floating UI**: Toggle the floating mini-panel button on pages on or off in Options.

## 4. Access Prompt Reference

From the Options page, navigate to the "Prompt Reference" tab to see the assembled prompt string for your current settings and source type. Edit built-in prompts per source type in the "Global Overrides" section.
