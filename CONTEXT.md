# Zotero Research Workbench Context

## Product

Zotero Research Workbench is a Zotero 8/9-only plugin for multi-paper synthesis and research-note workflows. The first version is intentionally narrow: it helps one user inspect the current Zotero selection, call an OpenAI-compatible LLM provider, create local research drafts, explicitly save confirmed notes to Zotero, and review local graph/work identity records.

## Domain Glossary

**Research Panel**
The Zotero window opened from `工具 -> 打开研究工作台`. It is the main user interface for selection inspection, provider settings, summaries, reading-context translation, local records, review queues, and export/import.

**AI Task Workspace**
The user-facing work area for explicitly launched AI tasks such as summaries, translations, and future reading workflows.
_Avoid_: generic UI polish, hidden background automation

**AI Job Launch Surface**
A user-facing place where an AI Job can be started, such as the Research Panel natural-language input or a future Zotero context menu entry.
_Avoid_: hidden trigger, implicit automation

**Task Transparency**
The user experience requirement that an AI Job shows its plan, queue, progress, success count, failure count, and request or cost estimate when available.
_Avoid_: black-box generation, vague spinner

**Task Control**
The user experience requirement that queued or running work can be paused, resumed, cancelled, retried, skipped, or retried only for failed tasks where safe.
_Avoid_: unstoppable batch

**Task Explainability**
The user experience requirement that AI results and failures can be traced to source works, input scope, prompt template, provider, time, and error reason.
_Avoid_: contextless output

**AI Job**
A natural-language user request that may decompose into one or more AI tasks over a scoped set of papers or reading contexts.
_Avoid_: prompt, batch, workflow script

**AI Job Plan**
A user-reviewable plan produced from an AI Job before costly, external, or write-side-effect work starts.
_Avoid_: hidden execution, implicit plan

**AI Job State**
The lifecycle state of an AI Job: draft, confirmed, running, paused, completed, completed-with-skips, failed, or cancelled.
_Avoid_: ad hoc job status text

**Literature Discovery**
The AI-assisted process of finding candidate works from the Zotero library and approved external literature sources for a user-stated research need.
_Avoid_: scraping, uncontrolled web search, hidden library-wide automation

**Discovery Scope**
The user-approved boundary that determines where a Literature Discovery job may search, such as the current Zotero library, selected collections, or approved external literature sources.
_Avoid_: implicit full access, ambiguous "these papers"

**External Literature Source**
A non-Zotero source used to discover candidate works for a Literature Discovery job.
_Avoid_: arbitrary websites, undocumented search providers

**External Literature Connector**
A generic integration boundary for querying or resolving candidate works from configured literature sources.
_Avoid_: Sci-Hub port, piracy adapter, scraper slot

**User-Supplied Connector**
An advanced connector supplied by the user rather than shipped by the Workbench.
_Avoid_: built-in shadow provider, recommended bypass

**Document Candidate**
A user-reviewable document result from a connector, with provenance, metadata, and optionally a document payload or local file reference.
_Avoid_: silent download, unreviewed PDF import

**Document Import Request**
An explicit user-approved request to bring a Document Candidate into the Workbench or Zotero.
_Avoid_: automatic PDF attachment, background harvesting

**Workbench-Only Import**
A Document Import Request that stores the candidate only in the Workbench Local Store.
_Avoid_: hidden Zotero write

**Attachment Import**
A Document Import Request that attaches a user-approved document to an existing Zotero item.
_Avoid_: automatic attachment

**Item And Attachment Import**
A Document Import Request that creates a new Zotero item and attaches a user-approved document.
_Avoid_: silent item creation, unreviewed metadata write

**User Confirmation Gate**
A UI checkpoint where the user reviews scope, provenance, document count, and side effects before a job imports or writes anything.
_Avoid_: implied consent, hidden batch action

**Approved Literature Source**
An External Literature Source whose access method is documented, lawful, and suitable for repeatable integration.
_Avoid_: scraping-only sources, pirate libraries

**Blocked Literature Source**
An external site that must not be integrated because it is based on unauthorized access, copyright infringement, credential misuse, or unstable scraping.
_Avoid_: "shadow provider", "fallback downloader"

**AI Task**
The smallest executable AI unit, such as one literature summary or one translation of a reading context segment.
_Avoid_: thread, sub-agent

**AI Task State**
The lifecycle state of an AI Task: queued, running, retrying, succeeded, skipped, failed, or cancelled.
_Avoid_: ad hoc task status text

**AI Task Queue**
A visible queue of user-launched AI tasks with clear waiting, running, completed, failed, cancelled, and retry states.
_Avoid_: multithreading, automatic batch processing

**Resumable AI Job**
A persisted AI Job that can be reviewed and manually resumed after the Research Panel or Zotero restarts.
_Avoid_: automatic background resume

**Provider Concurrency Limit**
The user-configured maximum number of AI Tasks that may call the same LLM Provider at the same time.
_Avoid_: global thread count, unlimited parallelism

**Zotero Write Queue**
A serial queue for Zotero item, attachment, note, metadata, or relation writes.
_Avoid_: parallel Zotero mutation

**Task Skip**
A terminal AI Task outcome used after allowed retries are exhausted for recoverable per-paper failures such as unreadable PDFs or connector failures.
_Avoid_: silent failure, hidden omission

**Job Failure Diagnosis**
A user-visible diagnostic summary created when an AI Job has enough failures to suggest a systemic problem.
_Avoid_: raw log dump, unexplained stop

**Failure Diagnosis Threshold**
The point at which an AI Job pauses related work and presents a Job Failure Diagnosis.
_Avoid_: vague "too many failures"

**Workbench Local Store**
The plugin-owned JSON snapshot stored in Zotero preferences. It contains research note drafts, graph seeds, citation relations, task ledger records, prompt overrides, provider structure, and export/import state. It is local plugin data, not Zotero-native item metadata.

**Research Note Draft**
A generated local draft created before any Zotero note write. It records the selected paper context, generated content, provider/model provenance, and confirmation state.

**Commonality Note Draft**
A Research Note Draft generated from multiple selected papers as one synthesis task. It records the source paper set and extracts shared research themes, concepts, mechanisms, methods, converging findings, tensions, and grouping rationale. It is not a per-paper translation or per-paper summary batch.

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

## Relationships

- An **AI Task Workspace** displays one or more **AI Task Queue** entries.
- An **AI Task Workspace** must support **Task Transparency**, **Task Control**, and **Task Explainability**.
- An **AI Job Launch Surface** starts an **AI Job** and passes the initial user request and scope.
- An **AI Job** decomposes into one or more **AI Tasks**.
- An **AI Job** first produces an **AI Job Plan**.
- An **AI Job** has exactly one **AI Job State** at a time.
- An **AI Job Plan** must pass a **User Confirmation Gate** before external discovery, bulk provider requests, document import, or Zotero writes.
- An **AI Job** may be a **Resumable AI Job** stored in the Workbench Local Store.
- A **Literature Discovery** job uses a **Discovery Scope** to produce candidate works before creating **AI Tasks**.
- A **Discovery Scope** may include the local Zotero library and **Approved Literature Sources** through **External Literature Connectors**.
- A **User-Supplied Connector** may exist as an extension boundary, but the Workbench does not ship, recommend, test, or document connectors for **Blocked Literature Sources**.
- A **User-Supplied Connector** may produce **Document Candidates**.
- A **Document Candidate** becomes a **Document Import Request** only after a **User Confirmation Gate**.
- A **Document Import Request** may be a **Workbench-Only Import**, **Attachment Import**, or **Item And Attachment Import**, selected by the user.
- A **Blocked Literature Source** is never part of a **Discovery Scope**.
- An **AI Task Queue** entry represents exactly one **AI Task**.
- An **AI Task** has exactly one **AI Task State** at a time.
- A **Provider Concurrency Limit** controls how many **AI Tasks** may run against one LLM Provider concurrently.
- An **AI Task** may produce a **Research Note Draft** or a local review record.
- A current-selection multi-paper synthesis **AI Job** should create one **Commonality Note Draft** task over the selected set, not one summary task per paper.
- An **AI Task** may end as a **Task Skip** after bounded retries for recoverable per-paper failures.
- An **AI Job** may finish with partial success and include **Job Failure Diagnosis** when failures indicate a systemic issue.
- A **Failure Diagnosis Threshold** is reached at three failures for small jobs, thirty percent failure rate for larger jobs, five consecutive failures, or any systemic provider, connector, or authentication failure.
- A **Zotero Write Queue** executes Zotero-native writes one at a time.
- A **Task Ledger** records completed or failed workbench actions after they affect local workbench state.

## Flagged ambiguities

- "多线程化" was used for AI work; resolved as **AI Task Queue**, not OS-level threads or hidden automatic batch processing.
- "任务" was used for both one summary/translation and a large multi-paper request; resolved as **AI Task** for the smallest executable unit and **AI Job** for the user-level request.
- "寻找文献" was expanded beyond the current Zotero selection; resolved as **Literature Discovery** over an explicit **Discovery Scope**, including local Zotero library search and approved external sources.
- "Sci-Hub 等网站" was proposed as an external source; resolved as **Blocked Literature Source** for integration work, not an approved discovery or download provider.
- "留出接入端口" was resolved as a generic **External Literature Connector** boundary, not a named or assisted Sci-Hub integration.
- "一切决定由用户来做" was resolved as a **User Confirmation Gate** before document import or Zotero write side effects.
- "导入文献" was resolved as three explicit user-selected modes: **Workbench-Only Import**, **Attachment Import**, and **Item And Attachment Import**.
- "AI 自动了解需要干嘛" was resolved as automatic **AI Job Plan** generation, not automatic execution of external, costly, import, or Zotero-write side effects.
- "多线程化" for provider calls was resolved as **Provider Concurrency Limit**; Zotero-native writes remain serialized through a **Zotero Write Queue**.
- "失败后跳过" was resolved as **Task Skip**, visible to the user and distinct from success.
- "失败过多自动检查原因" was resolved as **Job Failure Diagnosis**.
- "失败过多" was resolved as a **Failure Diagnosis Threshold**: three failures for jobs under ten tasks, thirty percent for jobs with ten or more tasks, five consecutive failures, or immediate systemic provider/connector/authentication failure.
- "UI 人性化" was resolved as **Task Transparency**, **Task Control**, and **Task Explainability**, with low-distraction behavior as a secondary concern.
- AI Job state was resolved as draft, confirmed, running, paused, completed, completed-with-skips, failed, or cancelled.
- AI Task state was resolved as queued, running, retrying, succeeded, skipped, failed, or cancelled.
- Long-running AI Jobs were resolved as **Resumable AI Jobs**: persisted for manual resume after restart, never automatically resumed in the background.
- v0.3 launch was resolved as Research Panel natural-language input first, with a future Zotero context-menu **AI Job Launch Surface** reserved but not required for the first v0.3 slice.

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
