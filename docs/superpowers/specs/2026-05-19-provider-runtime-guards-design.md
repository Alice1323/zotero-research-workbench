# Provider Runtime Guards Design

## Goal

Make the already-saved provider settings `requestsPerMinute` and `maxInputTokensPerTask` affect summary and reading-context translation requests before they reach the OpenAI-compatible provider.

## Scope

- Apply runtime guards to:
  - `single-paper-chinese-summary`
  - `reading-context-chinese-translation`
- Estimate prompt token usage before the network request.
- Block requests that exceed `maxInputTokensPerTask`.
- Track LLM request timestamps in memory and block requests that exceed `requestsPerMinute`.
- Surface failures through the existing layered paper-summary error details.

## Non-Goals

- Do not change provider connection tests or WebDAV requests.
- Do not add an exact tokenizer.
- Do not persist rate-limit state across Zotero restarts.
- Do not queue, retry, or delay requests automatically.
- Do not change provider profiles or secret handling.

## Behavior

Token budget uses a conservative local estimate: CJK characters count as one token each, and remaining non-whitespace characters count as one token per four characters. This is intentionally approximate and only prevents obviously oversized prompts.

Rate limiting uses a rolling 60-second in-memory window. Summary and translation share the same limiter instance in the Zotero panel runtime. A blocked request does not call `fetch`.

The guard normalizes missing or invalid limits to the same safe defaults used by provider advanced settings:

- `requestsPerMinute`: default 20, clamp 1-600.
- `maxInputTokensPerTask`: default 12000, clamp 1000-200000.

## Errors

Token budget failures throw `输入内容超过单任务 Token 上限`.

Rate-limit failures throw `请求过于频繁，请稍后再试`.

Both errors include enumerable metadata for the existing technical-details drawer, including task type, estimated tokens or request-window count, and configured limit. Secret material is not included.

## Tests

- Core request tests prove token-budget failure rejects before `fetch`.
- Core request tests prove summary and translation share one rate limiter.
- UI localization/runtime wiring tests prove the runtime script exposes the guard helpers and Chinese messages.
- Full verification covers existing summary, translation, provider settings, export, and WebDAV behavior.
