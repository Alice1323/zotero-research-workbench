# Prompt Template Overrides Design

## Goal

Expose first-release prompt override controls in the Chinese Research Panel so users can edit the prompts used by single-paper summaries and reading-context translation.

## Scope

- Add a `提示词模板` section to the Research Panel global entry area.
- Support two built-in template IDs:
  - `single-paper-chinese-summary`
  - `reading-context-chinese-translation`
- Show each template's allowed variables and editable prompt body.
- Save overrides into `Workbench Local Store` `promptOverrides`.
- Reset a template override back to its built-in default.
- Use saved overrides when running `总结选中文献` and `翻译阅读上下文`.
- Keep prompt validation restricted to the existing safe variable whitelist.
- Route validation/storage failures through a layered error drawer with technical details.

## Non-Goals

- No arbitrary scripting.
- No multi-template marketplace.
- No version history UI.
- No provider-specific prompt variants.
- No automatic migration of user prompt wording beyond preserving saved override records.

## Template Model

Each built-in template has:

- `id`
- Chinese display title
- editable `template` string
- required context keys
- allowed variable list
- output expectation
- default provider capability
- version

The override record stored in `promptOverrides` is:

```json
{
  "templateId": "single-paper-chinese-summary",
  "template": "..."
}
```

## Data Flow

The panel loads the local snapshot from Zotero preferences. The prompt section selects a built-in template, then displays the saved override if one exists, otherwise the default template.

On save, the panel validates the template through `createPromptTaskTemplate`. Invalid variables such as `{{apiKey}}` are rejected. A valid override updates `promptOverrides` in the snapshot and writes the snapshot back to Zotero preferences.

On reset, the panel removes the matching override from `promptOverrides`, writes the snapshot, and displays the built-in template again.

When summary or translation runs, the request builder resolves the template by ID, applies a saved override when present, and renders it with the existing context.

## Error Handling

Validation and storage errors use `showLayeredError("prompt-template-status", ...)`.

Technical details must be visible and still use existing secret redaction. User prompt text is not secret material by default, but error details must not leak API keys if they appear in exception metadata.

## Tests

- Core prompt override resolution uses saved overrides and safe variable validation.
- Summary and translation request functions use overrides when supplied.
- Runtime UI wires prompt template controls and layered error details.
- UI localization test confirms Chinese labels and element IDs.
- Export/import behavior remains covered by existing `promptOverrides` snapshot tests.
