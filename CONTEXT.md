# Zotero Research Workbench Context

## Product

Zotero Research Workbench is a Zotero 8/9-only plugin for a single-paper reading workflow. The first version is intentionally narrow: it helps one user inspect the current Zotero selection, call an OpenAI-compatible LLM provider, create local research drafts, explicitly save confirmed notes to Zotero, and review local graph/work identity records.

## Domain Glossary

**Research Panel**
The Zotero window opened from `工具 -> 打开研究工作台`. It is the main user interface for selection inspection, provider settings, summaries, reading-context translation, local records, review queues, and export/import.

**Workbench Local Store**
The plugin-owned JSON snapshot stored in Zotero preferences. It contains research note drafts, graph seeds, citation relations, task ledger records, prompt overrides, provider structure, and export/import state. It is local plugin data, not Zotero-native item metadata.

**Research Note Draft**
A generated local draft created before any Zotero note write. It records the selected paper context, generated content, provider/model provenance, and confirmation state.

**Confirmed Research Note**
A Zotero child note written only after the user explicitly clicks `确认并写入 Zotero 笔记`. This is the main intentional Zotero-native write in the first version.

**Task Ledger**
Local trace records for workbench actions such as draft creation, note save, graph seed capture, seed review, citation relation promotion, and fixture import. Task ledger records support auditability and debugging.

**Graph Seed**
A local relationship hint captured from user input or model-assisted reading context. Graph seeds have evidence, provenance, confidence, relation type, review state, and source work identity.

**Graph Seed Review Queue**
The Chinese review UI for filtering, confirming, rejecting, and promoting local graph seeds. Reviewing a seed writes only to the Workbench Local Store.

**Citation Relation**
A local, promoted relation derived from a confirmed graph seed. It records source work, target hint, relation type, evidence, confidence, source graph seed id, and provenance. It is not a Zotero-native relation.

**Citation Relation Quality Tag**
A read-only review hint shown in `引用关系图谱`, such as `缺少目标`, `缺少证据`, `低置信度`, or `缺少来源种子`.

**Work Identity**
A local aggregate clue about one work, derived from research note drafts, graph seeds, and citation relations. Work identities can show DOI, Zotero item key, record counts, last-seen time, and status tags.

**Work Identity Status Tag**
A read-only review hint shown in `作品身份线索`, such as `无 DOI`, `多来源`, `有引用关系`, or `孤立线索`.

**Duplicate Work Candidate**
A local review hint that two or more work identities may refer to the same work because they share a DOI, share a Zotero item key, or have the same normalized title hint.

**Secret Material**
API keys, WebDAV passwords, Authorization headers, bearer tokens, cookies, SMTP authorization codes, gateway tokens, and similar credentials. Secret Material must not appear in exports, logs, checkpoints, or user-facing reports.

**Manual Fixture**
A Workbench Local Store-only test record inserted for human UI verification. Manual fixtures must not create Zotero-native items, tags, relations, or metadata.

## First Version Boundaries

- Zotero 8/9 only; Zotero 7 is out of scope.
- The plugin must not automatically merge Work Identities.
- The plugin must not query external identity providers in the first version.
- The plugin must not write Zotero item metadata, tags, attachments, or native relations.
- The plugin writes a Zotero child note only through the explicit `确认并写入 Zotero 笔记` action.
- JSON/ZIP/WebDAV exports must redact Secret Material.
- Read-only inspection surfaces may filter and display local Workbench Local Store records, but must not mutate Zotero-native data.

## Architecture Notes

- `src/core/*` contains the preferred testable business Implementation.
- `chrome/content/*` contains Zotero runtime and DOM Adapters.
- Avoid adding new business rules only to `chrome/content/paperSummary.js`; mirror drift between runtime and core is a known risk.
- Prefer deep Modules with small Interfaces that hide snapshot schema, task ledger details, and Zotero runtime quirks.
