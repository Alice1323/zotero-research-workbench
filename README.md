# Zotero 研究工作台

Zotero Research Workbench is a Zotero 8/9-only plugin for multi-paper synthesis and research-note workflows.

The first release is deliberately narrow:

- show a context-driven Research Panel from Zotero;
- configure an OpenAI-compatible LLM Provider;
- create Research Note Drafts before saving Confirmed Research Notes;
- record Task Ledger entries for traceability;
- capture Graph Seeds with evidence and provenance;
- export and import Workbench Local Store snapshots without Secret Material.

The user-visible interface defaults to Chinese because the first target users are in China.

This repository starts with a small, testable core and a Zotero plugin shell. The core is plain CommonJS so it can be exercised with Node tests before being wired deeper into Zotero APIs.

## Current Slice

The first implementation slice contains:

- a topic-centered v0.4 literature discovery and import pipeline;
- OpenAlex, Crossref, Unpaywall, and HTTP connector source adapters normalized through one Document Candidate protocol;
- candidate review with batch selection and anomaly blocking;
- explicit Zotero item plus attachment import through a serial Zotero Write Queue;
- top toolbar and item context-menu launch surfaces that open the same Research Panel pipeline;
- Ethereal Reference data and UI reservation for a later relation-network analysis release;
- an AI Task Workspace for current-selection jobs;
- natural-language task request entry in the Research Panel;
- AI Job Plan preview with explicit confirmation before provider calls;
- visible AI Task Queue with provider concurrency limit;
- task-type recognition that decides whether a multi-paper request should become per-paper summary tasks or one commonality synthesis note;
- multi-paper commonality jobs that turn the current Zotero selection into one standalone `共同点笔记` draft when the request is recognized as synthesis rather than per-paper handling;
- retry twice, visible Task Skip, Job Failure Diagnosis, and pause/resume/cancel controls that keep paused work resumable;
- manual resume display for interrupted jobs without automatic background continuation;
- Zotero plugin metadata and startup hooks;
- a Chinese Research Panel that reads the currently selected Zotero item;
- a Chinese LLM Provider settings section that saves to Zotero preferences;
- a `刷新阅读上下文` action that displays selected text from the active Zotero Reader when available;
- a `总结选中文献` action that sends selected item metadata to an OpenAI-compatible chat endpoint and displays a Chinese reading summary;
- a `确认并写入 Zotero 笔记` action that explicitly saves the current draft as a Zotero note; single-paper drafts are child notes, while multi-paper commonality drafts are standalone notes;
- provider configuration redaction;
- in-memory Workbench Local Store;
- prompt task template rendering with a safe variable whitelist;
- task ledger and graph seed records;
- `导出工作台状态` / `导入工作台状态` local JSON export/import with secret redaction;
- `导出 ZIP` / `导入 ZIP` local ZIP export/import wrapping the same redacted JSON snapshot;
- `WebDAV 导出目标` manual redacted JSON upload, including Nutstore-compatible configuration;
- read-only recent graph seed and task ledger lists in the Research Panel;
- a Chinese graph seed review queue for filtering evidence and explicitly confirming or rejecting captured seeds;
- a read-only Chinese work identity clue view for local work identity clues;
- a read-only Chinese duplicate work candidate view for possible local work duplicates;
- a read-only Chinese citation relation graph view for local citation relations around the current work;
- Node test coverage for the core behavior.

## Commands

```powershell
npm test
npm run check
npm run package
```

The package command writes `dist/zotero-research-workbench-0.4.0.xpi`.

## First Release QA

- First-run and manual QA steps: `docs/first-run-manual-qa.md`
- v0.1 release checklist: `docs/release-checklist-v0.1.md`
- Project domain glossary for agents: `CONTEXT.md`
- Local architecture debt issues: `.scratch/architecture-debt/issues/`

## Zotero Smoke Test

The XPI has been verified against Zotero `9.0.3` in an isolated temporary profile.

Manual or UI installation is still required for the active Zotero profile because Zotero marks dropped-in sideloaded XPI files as `foreignInstall` and `userDisabled` by default. In an isolated smoke profile, enabling the add-on produced:

```text
id: zotero-research-workbench@local
version: 0.2.0
active: True
userDisabled: False
appDisabled: False
```

The plugin startup hook writes a debug preference:

```text
extensions.zotero.extensions.zotero-research-workbench.lastStartup
```

Seeing that preference in the profile confirms that `bootstrap.js` loaded and `WorkbenchPlugin.startup()` ran.

## Provider Settings Behavior

The panel saves these values to Zotero preferences:

- `extensions.zotero-research-workbench.provider.baseUrl`
- `extensions.zotero-research-workbench.provider.apiKey`
- `extensions.zotero-research-workbench.provider.model`
- `extensions.zotero-research-workbench.provider.timeoutMs`
- `extensions.zotero-research-workbench.provider.requestsPerMinute`
- `extensions.zotero-research-workbench.provider.maxInputTokensPerTask`

After saving, the panel shows `设置已保存`. When reopened, it reloads `接口地址`, `模型名称`, request timeout, requests-per-minute, and max input token settings; the API key field stays blank and shows `已保存，留空则保持不变`.

`测试连接` sends a minimal OpenAI-compatible `/chat/completions` request using the saved provider settings and the configured timeout. It reports Chinese status messages such as `连接成功`, `API 密钥无效`, `模型不可用`, `接口地址不可用`, `请求超时`, and `连接可用，但接口未校验模型名称，请确认模型名称已填写正确`.

`总结选中文献` and `翻译阅读上下文` also use the saved requests-per-minute and max input token settings. The two actions share an in-memory 60-second request window; when the window is exhausted, the panel shows `请求过于频繁，请稍后再试` and keeps technical details available. Before sending a provider request, the panel estimates prompt tokens locally and blocks oversized inputs with `输入内容超过单任务 Token 上限`. Token counting is an approximation, not a provider-specific tokenizer.

## Prompt Template Behavior

The Research Panel includes `提示词模板` controls for the first two built-in tasks:

- `单篇文献中文总结`
- `阅读上下文中文翻译`

The editor shows the allowed variables for the selected task and saves overrides into the Workbench Local Store `promptOverrides` array. Saving validates the template against the safe variable whitelist before it can affect model requests. Unsafe variables such as `{{apiKey}}` are rejected and shown through the same layered error detail UI.

`总结选中文献` and `翻译阅读上下文` use a saved override when one exists. `重置为默认模板` removes the override and returns the task to the built-in prompt. Prompt overrides are included in local JSON/ZIP export/import and remain non-secret user configuration.

## Paper Summary Behavior

The Research Panel reads only the current Zotero selection. It displays title, creators, year, source, and abstract. `总结选中文献` sends those fields to the configured OpenAI-compatible provider and renders the generated Chinese summary in the panel.

When the selected Zotero item has an existing PDF child attachment, the panel shows `PDF 附件` with the detected local path or attachment title. This is read-only detection for the current item. It does not download PDFs, create attachments, open files, or extract PDF text.

`刷新阅读上下文` reads the active Zotero Reader or window selection and displays the selected text in the panel. If no reader text is selected, the panel shows `暂无阅读器选中文本`. This is a read-only path and does not write Zotero notes, tags, attachments, or item fields.

Generated summaries, translations, and AI Task Workspace commonality notes are saved first as local Research Note Drafts with provenance. Per-paper AI Task Workspace summary results are listed in the task result view. They do not write notes, tags, attachments, or item fields back to Zotero automatically.

`确认并写入 Zotero 笔记` is the explicit save-to-Zotero-note action. It creates a new child note under the currently selected Zotero item for single-paper drafts. For `共同点笔记` drafts generated from multiple selected papers, it creates a standalone Zotero note so the synthesis is not incorrectly attached to one source paper. The action records the Zotero note key in the local draft snapshot and marks the draft as confirmed.

## AI Task Classification Behavior

The AI Task Workspace does not treat every multi-selection as the same task. `生成任务计划` first classifies the natural-language request. Explicit wording such as `分别`, `逐篇`, `每篇`, or `一篇一篇` creates one `single-paper-summary` task per selected paper. Explicit wording such as `共同点`, `共通点`, `比较`, `对比`, `综合`, `关系`, or `归纳` creates one `multi-paper-commonality-note` task for the whole selection.

When a multi-paper request is ambiguous, such as `总结这些文献`, the runtime asks the configured OpenAI-compatible provider to classify the task type and requires a JSON-only answer. The plan preview shows the recognized type, whether it came from local keywords or AI classification, the confidence, and the reason before the user confirms execution.

For `multi-paper-commonality-note`, the prompt includes all selected paper metadata and abstracts in the same prompt. It asks the model to compare the papers and extract shared research themes, shared concepts or mechanisms, method/object/data intersections, converging findings, tensions, grouping rationale, and follow-up reading questions.

The result is recorded as a standalone local Research Note Draft with `promptTaskTemplateId: multi-paper-commonality-note`. It appears in `最近草稿`, is automatically loaded into the main `生成结果` reading area after the task completes, and can then be explicitly saved to Zotero as a standalone note through `确认并写入 Zotero 笔记`. This path is not a per-paper translation or per-paper summary batch.

AI Task Workspace job and task states are shown with Chinese user-facing labels such as `待确认`, `待执行`, `运行中`, and `已完成` instead of raw internal state names.

## Literature Discovery Import Behavior

The v0.4 pipeline starts from a `研究主题`, builds a draft discovery plan, and requires explicit confirmation before source queries. The supported source adapter set is OpenAlex, Crossref, Unpaywall, and an HTTP connector endpoint. HTTP connector settings are runtime inputs; local command connectors are reserved for a future release and are not executed in v0.4.

Source results are normalized as Document Candidates with source provenance, identity keys, attachment references, and anomaly tags. The panel shows candidates in the three-lane pipeline: `启动`, `复核`, and `写入`. Normal candidates can be batch-selected into an import plan. Anomalous candidates are blocked from quick import until explicitly reviewed.

Zotero item and attachment writes are never automatic. Selecting candidates creates a local Zotero Import Plan and a serial Zotero Write Queue. The queue writes one item or attachment at a time only after the user starts it. Supported attachment references are user-selected local PDFs, explicit open-access PDF URLs, and HTTP connector file references with provenance.

The toolbar `研究工作台`, Tools menu fallback, and item context-menu `从选中文献发现相关文献` all open the same Research Panel flow. Ethereal Reference is visible as a reserved v0.5 area, but v0.4 does not render a force-directed graph or relation-network UI.

## Local Export Import Behavior

`导出工作台状态` writes a local JSON package containing the Workbench Local Store snapshot: research note drafts, graph seeds, task ledger records, prompt templates, prompt overrides, provider settings structure, and provider provenance.

Exports redact Secret Material before writing the file. API 密钥, WebDAV 密码, bearer tokens, authorization headers, and fields named like `secret` are written as `<redacted>` rather than plaintext.

`导入工作台状态` reads the exported JSON package, validates the package kind and version, restores the snapshot into Zotero preferences, and refreshes the recent draft list.

`导出 ZIP` writes a local `.zip` wrapper around the same redacted JSON export. The ZIP contains only:

- `manifest.json`
- `snapshot.json`

`snapshot.json` is the existing `zotero-research-workbench-export` package, so import validation and secret redaction are shared with the JSON path. `导入 ZIP` reads the ZIP manifest, loads `snapshot.json`, validates it through the existing JSON importer, restores the snapshot, and refreshes the panel lists.

ZIP exports do not include attachments, PDFs, Zotero item metadata dumps, logs, credentials, encrypted secrets, or live cloud/WebDAV sync material.

`WebDAV 导出目标` stores an optional manual export profile: server URL, username, password, and remote directory. Nutstore/坚果云 can be configured with its WebDAV URL, account, and application password. The password field is blank when the panel opens; leaving it blank while saving preserves the stored password.

`测试 WebDAV` checks the configured remote directory with a lightweight WebDAV request. `上传 JSON 到 WebDAV` uploads the same redacted JSON package produced by `导出工作台状态` using a timestamped filename. Before upload, it attempts to create missing remote directory parents with WebDAV `MKCOL`, which supports Nutstore/坚果云 directory setup when the account permits it. This does not upload ZIP files, import from WebDAV, sync automatically, or resolve conflicts.

## Read-Only Workbench Records

The Research Panel can refresh recent `graphSeeds` and `taskLedger` records from the Workbench Local Store snapshot. These lists are inspection-only: they help confirm that graph seed capture, draft creation, note save, export, and import steps are being recorded, but they do not edit records or promote graph seeds into citation relations.

## 图谱种子复核队列

The Research Panel includes `图谱种子复核队列` for captured graph seeds. The queue can filter by review state, provider, confidence, relation type, seed kind, and the current work. It also includes a collapsible `选项说明` block explaining each filter in Chinese. Legacy seeds without a review state are treated as `pending`.

Users can explicitly confirm or reject a pending seed. This updates the local snapshot and records a `review-graph-seed` task ledger entry. Confirmation means the user has reviewed the seed evidence; it does not create formal citation relations or modify Zotero item metadata.

Confirmed graph seeds can be promoted into local `citationRelations` records with `生成关系`. Promotion stores the source work, target hint, relation type, evidence, confidence, source graph seed id, and provenance in the Workbench Local Store, then records a `promote-graph-seed-to-citation-relation` task ledger entry. This is still local snapshot data only: it does not write Zotero item fields, tags, notes, or relations.

## 引用关系图谱

The Research Panel includes a read-only `引用关系图谱` view for local `citationRelations`. It can show relations for the current work or all local relations, newest first, and can filter by quality tags. Each row displays source work, target hint, relation type, confidence, evidence, source graph seed id, and read-only quality tags such as `缺少目标`, `缺少证据`, `低置信度`, and `缺少来源种子`.

The inspector only reads the Workbench Local Store snapshot. Quality tags and the `质量筛选` segmented control are review aids for incomplete local relation records. They do not write Zotero item metadata, create Zotero relations, merge work identities, or run graph layout.

## 作品身份线索

The Research Panel includes a read-only `作品身份线索` view for local work clues already present in the Workbench snapshot. It aggregates works from research note drafts, graph seeds, and citation relations, then shows work id, title, DOI, Zotero item key, record counts, last-seen time, and read-only status tags such as `无 DOI`, `多来源`, `有引用关系`, and `孤立线索`.

The inspector can show the current work or all local work identities, and it can filter the visible list by status tag. The status tags and `身份筛选` segmented control are review hints only. They change only the local Workbench display range: they do not merge duplicate works, query external providers, create Zotero items, or write Zotero metadata.

## 重复作品候选

The Research Panel includes a read-only `重复作品候选` view. It flags possible duplicate local works when two or more work identities share a DOI, share a Zotero item key, or have the same normalized title hint.

Candidates can be filtered by current/all work scope, confidence, and matching reason. The panel includes a collapsible `选项说明` block for Chinese users. Rows show the reason, confidence, involved work ids, titles, and last-seen time. Each row can expand `查看证据` to show the local draft, graph seed, or citation relation records that produced the duplicate signal. This is only a review aid: it does not merge works, edit Zotero items, rewrite work ids, delete records, or call external identity providers.

## Boundaries

The project does not support Zotero 7. It does not ship a full Citation Graph UI, Visual Workflow Builder, batch processing UI, Sci-Hub provider, Google Scholar scraping, arbitrary user scripts, Zotero-native relation writing, or live cloud sync.
