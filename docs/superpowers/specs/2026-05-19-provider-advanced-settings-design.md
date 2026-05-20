# Provider Advanced Settings Design

## Goal

Bring the first-release LLM provider settings closer to the roadmap contract by exposing timeout, rate-limit, and usage-limit values in the Chinese Research Panel.

## Scope

- Add three non-secret provider preferences:
  - `extensions.zotero-research-workbench.provider.timeoutMs`
  - `extensions.zotero-research-workbench.provider.requestsPerMinute`
  - `extensions.zotero-research-workbench.provider.maxInputTokensPerTask`
- Show the values as numeric fields in `LLM 服务商设置`.
- Save and reload them with the existing provider settings controller and runtime script.
- Pass `timeoutMs` into `测试连接` so connection tests respect the user setting.
- Preserve rate-limit and usage-limit values in provider contract objects.
- Update README to state that WebDAV upload now attempts to create missing remote directories.

## Non-Goals

- Do not add a global runtime rate limiter in this slice.
- Do not block summary or translation prompts by token count in this slice.
- Do not add provider profiles or multiple provider support.
- Do not expose or export secret material.

## Validation Rules

`timeoutMs` is clamped to 1,000-120,000 ms and defaults to 15,000 ms.

`requestsPerMinute` is clamped to 1-600 and defaults to 20.

`maxInputTokensPerTask` is clamped to 1,000-200,000 and defaults to 12,000.

Blank or invalid numeric input falls back to the default rather than preventing base provider settings from being saved.

## Data Flow

On panel load, the provider settings controller reads preferences and fills fields. Missing numeric values render defaults.

On save, the controller validates required base URL and model as before, normalizes numeric values, stores them, and keeps the API key field blank after saving.

On test, the controller builds settings from saved preferences or current fields and passes `timeoutMs` to `testOpenAICompatibleConnection(settings, { timeoutMs })`.

The core provider factory maps `requestsPerMinute` to `rateLimitPolicy.requestsPerMinute` and `maxInputTokensPerTask` to `usageLimit.maxInputTokensPerTask`.

## Error Handling

Existing layered provider errors stay in place. Technical details must continue to redact API keys and bearer tokens.

Invalid numeric values are not treated as user-facing errors because the fields have conservative defaults and bounded ranges.

## Tests

- Provider settings controller saves and reloads the three numeric settings.
- Provider settings controller passes saved timeout into the connection tester.
- Provider connection uses `settings.timeoutMs` when no explicit option override is supplied.
- Provider contract preserves custom timeout, rate-limit, and usage-limit values.
- UI localization test confirms Chinese labels and field IDs exist.
- README text reflects automatic WebDAV directory creation.
