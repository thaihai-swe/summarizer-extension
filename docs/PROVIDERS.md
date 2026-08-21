# Provider Implementation Guide

The extension communicates with LLM APIs through the `lib/provider-registry.js` layer.

## Provider Architecture

`lib/providers/shared.js` owns reusable transport concerns: output budgets, timeout controllers, fetch/network errors, HTTP error mapping, empty-response validation, and streaming readers. Provider modules own only their endpoint URLs, request payloads, response shape, and provider-specific fallback behavior.

All active providers implement exactly this interface:

```js
async generateText(prompt, providerSettings, onChunk?)
```

### Interface

- **prompt**: full prompt string from prompt builders
- **providerSettings**: provider-specific configuration from storage
- **onChunk(accumulatedText)**: optional streaming callback
- **Returns**: Promise resolving to full generated text string

### Request Context (Cancellation)

Provider calls can optionally receive a `requestContext` via `SummarizerProviders.generateText(providerId, prompt, settings, onChunk, requestContext)`, where `requestContext` is `{ signal: AbortSignal }`. When a signal is provided:
1. The registry injects it into `providerSettings.signal` before passing to the provider.
2. Each provider's `shared.createAbortController(timeoutMs, signal)` merges the external signal with the timeout.
3. If an external abort fires before the timeout, the request is aborted immediately.

### Capability Metadata

Each registered provider includes a `capabilities` object:

| Provider | Streaming | Direct YouTube | API Key Required | Endpoint Configurable |
|----------|-----------|----------------|-------------------|----------------------|
| gemini   | Yes       | Yes            | Yes               | No                   |
| openai   | Yes       | No             | Yes               | Yes (baseUrl)        |
| local    | Yes       | No             | No                | Yes (baseUrl + type) |

Access via `SummarizerProviders.getProviderCapabilities(providerId)`.

## Implementations

- `lib/providers/gemini.js`: Google Gemini endpoints (stream + non-stream, model fallback chain, retry logic)
- `lib/providers/openai.js`: OpenAI chat-completions endpoints (stream + non-stream)
- `lib/providers/local.js`: generic OpenAI-compatible and Ollama-style local endpoints (stream + non-stream, auto-detection)
- `lib/providers/shared.js`: shared transport, timeout, error, response, and stream utilities
- `lib/providers/local.js`: unified implementation covering Ollama and OpenAI-compatible/LM Studio-style endpoints

## Provider Registry

`lib/provider-registry.js` maps a provider ID (`gemini`, `openai`, `local`) to a provider descriptor. Descriptors normalize settings and delegate generation without embedding transport logic. The `local` provider ID wraps support for generic local hosts, Ollama, and LM Studio by checking `settings.local.endpointType` or the LM Studio port convention.

## Error Handling

Shared utilities attach provider and model metadata and classify network timeouts, network failures, authentication errors, and rate limits. The registry applies the final user-facing message normalization and transient retry classification.

### Error Codes

| Code | Meaning | User Message |
|------|---------|--------------|
| AUTH_ERROR | Invalid/missing API key | "Invalid or missing API key. Update it in Settings, then try again." |
| RATE_LIMIT | Provider rate limit hit | "Provider rate limit reached. Wait a moment or switch providers in Settings." |
| NETWORK_TIMEOUT | Request timed out | "Provider request timed out. Check your connection or try again." |
| NETWORK_ERROR | Network/fetch failure | "Network error while contacting the provider. Check your connection or endpoint URL." |
| CANCELLED | User cancelled | "Generation cancelled." |
| PROVIDER_ERROR | General provider failure | Original error message |
| TRANSIENT_ERROR | Temporary provider failure | Will be retried automatically once then surfaced. |

## Streaming

Streaming is supported but optional. When `onChunk` is provided:
- **Gemini**: Uses `streamGenerateContent?alt=sse` endpoint, parsed via `shared.parseGeminiSseLine`.
- **OpenAI**: Uses `stream: true` chat completions, parsed via `shared.parseOpenAiSseLine`.
- **Local**: Auto-detects endpoint type; uses `shared.parseOpenAiSseLine` for OpenAI-compatible or `shared.parseOllamaJsonlLine` for Ollama.

When `onChunk` is omitted, requests are sent as standard non-stream POST requests.


## Execution metadata

Provider responses may report input, output, and total token usage. DeepDigest aggregates available usage across chunk and synthesis requests, stores it on `result.execution`, and renders a compact badge under the summary title with model/provider label, token count when available, and total generation time. Providers that do not report usage omit the token count.
