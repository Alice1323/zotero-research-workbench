# v0.4 Literature Discovery And Import Pipeline Design

## Goal

v0.4 turns Zotero Research Workbench into a topic-centered literature discovery and import pipeline. A user can start from a research topic, selected Zotero works, a panel query, DOI/title clues, or local PDFs; review a discovery plan; collect Document Candidates from approved public sources and an HTTP connector; review candidates with anomaly blocking; and explicitly create Zotero items and attachments through a serial Zotero Write Queue.

The version theme is linkage. v0.4 should not add another set of isolated panels. It should make existing useful features work together around one path:

**research topic -> launch -> review candidates -> write Zotero items/attachments -> continue reading, summarizing, note generation, and relation capture**.

## Confirmed Product Decisions

- v0.4 uses the complete main-chain approach: discovery, candidate review, and confirmed Zotero item plus attachment import are in scope.
- The primary UI structure is a three-lane pipeline: `启动`, `复核`, and `写入`.
- The organizing model is: research topic as the bus, papers as nodes, and tasks as the execution pipeline.
- Built-in approved public sources are OpenAlex, Crossref, and Unpaywall.
- User-supplied connectors are supported only as HTTP endpoints in v0.4.
- The architecture leaves a future extension point for local-command connectors, but v0.4 does not execute local commands.
- Attachments may come from user-selected local PDFs, explicit open-access PDF URLs, or HTTP connector file references with provenance.
- Candidate review uses batch selection plus anomaly blocking.
- Zotero item and attachment writes are allowed only after a User Confirmation Gate.
- Zotero-native writes are always serialized through a Zotero Write Queue.
- A top toolbar entry, a Zotero item context-menu entry, and the Research Panel all feed the same AI Job Launch Surface / Discovery Job Launch Surface.
- Ethereal Reference relation-network analysis is a v0.5 main feature. v0.4 reserves code and UI positions only.

## Product Structure

v0.4 introduces a Research Topic container. A topic stores the user's active research question, source scopes, discovery jobs, document candidates, import plans, write results, generated drafts, graph seeds, citation relations, and follow-up actions.

The user should be able to continue a topic rather than restart from scattered controls. Existing surfaces become topic-linked:

- AI Task Workspace jobs belong to a topic.
- Literature discovery candidates belong to a topic.
- Imported Zotero items can be traced back to the topic and candidate provenance.
- Generated notes and commonality drafts can be attached to the topic.
- Graph seeds and local citation relations can be created from candidates, imported works, summaries, and reading results.
- Duplicate work hints and work identity clues support review inside the topic rather than appearing as unrelated lists.

The Research Panel should remain work-focused and dense. It should avoid a marketing-like layout. The primary screen should show the current topic, the three-lane pipeline state, and the next useful action.

## Research Topic Records

A Research Topic is Workbench Local Store data, not a Zotero-native collection. It may reference Zotero collections or items, but it does not replace them.

The minimum topic record should include:

- topic id;
- title;
- user research question or description;
- created and updated timestamps;
- active source scopes;
- linked Zotero item keys;
- linked candidate ids;
- linked AI job ids;
- linked import plan ids;
- linked write queue ids;
- linked draft ids;
- linked graph seed ids;
- linked citation relation ids;
- topic status: active, archived, or needs-review.

Topic membership is additive and reviewable. v0.4 should not automatically move Zotero items between Zotero collections because a topic references them.

## Launch Surfaces

v0.4 has three user-facing launch surfaces:

- Top toolbar button in the Zotero main window, near the existing toolbar controls shown by the user. It opens the Research Panel and restores or creates the active topic.
- Zotero item context menu entry for selected items. It creates a draft Discovery Job Plan from the selected works, such as finding related work or follow-up reading.
- Research Panel entry point for a free-form research question, DOI/title clues, or local PDF-assisted import.

All launch surfaces must pass through the same launch adapter. No launch surface may start source queries, provider calls, imports, downloads, or Zotero writes without a reviewable plan and explicit confirmation.

The toolbar insertion point must be discovered and verified in Zotero 8/9 runtime. Preferred behavior is to insert the Workbench button near the main toolbar location identified by the user. If the toolbar DOM id changes or insertion fails, the plugin keeps the Tools menu and context-menu entries functional and logs a concise diagnostic.

## Three-Lane Pipeline UI

The main pipeline is:

1. `启动`
   - Create or select a Research Topic.
   - Choose input: selected Zotero items, panel query, DOI/title batch, local PDF, current collection, or local library search.
   - Choose sources: OpenAlex, Crossref, Unpaywall, and configured HTTP connector.
   - Show a Discovery Job Plan with source list, candidate limits, attachment rules, expected Zotero side effects, and failure behavior.

2. `复核`
   - Show Document Candidates in one candidate table.
   - Show title, authors, year, DOI/ISBN/stable URL, source, source score when available, attachment source, provenance, anomaly tags, and dedupe hints.
   - Allow batch selection for normal candidates.
   - Force detail review for anomalous candidates.
   - Let the user choose per candidate: keep in Workbench only, create Zotero item, or create Zotero item plus attachment.

3. `写入`
   - Show the Zotero Write Queue.
   - Execute item creation and attachment creation serially.
   - Keep each queue entry visible as queued, running, succeeded, failed, skipped, cancelled, or retrying.
   - Allow pause, resume, cancel, and retry failed write entries.
   - Record write results back to the Research Topic and Task Ledger.

Every completed or failed result should offer a next action: summarize, synthesize with current topic, capture graph seed, inspect provenance, retry attachment, open Zotero item, or reserve for Ethereal Reference.

## Document Candidate Protocol

All sources must normalize into one Document Candidate shape before review. A candidate should include:

- stable candidate id;
- source adapter id;
- raw source record id or URL;
- provenance summary and technical provenance;
- title;
- authors;
- year;
- publication title;
- DOI, ISBN, PMID, arXiv id, or stable URL when available;
- abstract or description when available;
- open-access status when known;
- attachment references;
- source confidence or relevance score when available;
- anomaly tags;
- raw source payload snapshot with secrets removed.

Attachment references may include:

- local file path selected by the user;
- explicit open-access PDF URL;
- connector-returned file reference;
- landing-page URL for review only.

The protocol must distinguish "review link" from "importable attachment." A landing page alone is not a PDF attachment.

## Source Adapter Boundary

Each source adapter should expose the same conceptual interface:

- describe capabilities and required configuration;
- build a source-specific request from the Discovery Job Plan;
- execute through the injected fetch runtime;
- normalize response records into Document Candidates;
- classify source errors without leaking secrets;
- expose source provenance for candidate review and task records.

OpenAlex is used for broad work discovery, citation-related metadata, concepts, and related works where available.

Crossref is used for DOI-centered bibliographic metadata and title/author/year confirmation.

Unpaywall is used for open-access status and open-access location candidates. If it requires an email or other configuration in the chosen runtime path, that configuration must be explicit and must not be treated as Secret Material unless it carries credentials.

HTTP connector is the v0.4 user-supplied connector. It accepts a standard JSON request and returns standard JSON candidates. It must have timeout, response-size, content-type, and schema validation. It must not receive stored provider API keys unless the user explicitly configures connector-specific headers, and any connector secrets must be redacted in exports, logs, checkpoints, and UI details.

Local-command connector is reserved for a later version. v0.4 may define a type name and schema position, but it must not expose UI that implies local commands are executable.

## Candidate Review And Anomaly Blocking

Normal candidates can be batch-selected. Anomalous candidates require detail review before import.

Anomaly tags include:

- missing title;
- missing DOI, ISBN, stable URL, or equivalent identity clue;
- empty author list;
- suspicious or missing year;
- unclear source provenance;
- duplicate of an existing Workbench identity or selected Zotero item;
- attachment URL not clearly open access;
- connector file reference without sufficient provenance;
- metadata conflict between adapters;
- unsupported attachment type.

Anomaly blocking does not delete the candidate. It prevents quick batch import until the user opens the detail view and confirms the candidate.

## Zotero Import Modes

v0.4 supports these import modes during candidate review:

- Workbench-only retention;
- Zotero item creation;
- Zotero item creation plus attachment.

Item creation writes bibliographic metadata to Zotero only after confirmation. Attachment creation may attach a user-selected local PDF, an explicit open-access PDF URL, or a connector file reference. If attachment creation fails after item creation succeeds, the item remains and the attachment write is marked failed with a retry action.

The import plan must show exactly what will be written before the user confirms:

- number of items;
- number of attachments;
- target collection when applicable;
- metadata fields;
- attachment source types;
- candidates that require individual confirmation;
- expected failures or unsupported records.

## Function Linkage

v0.4 should turn isolated capabilities into connected actions:

- A candidate can become a Zotero item.
- A newly created Zotero item can immediately enter summary, commonality synthesis, follow-up reading, or relation capture.
- A candidate or import result can create a graph seed with provenance.
- A graph seed can later become a local citation relation.
- Citation relations, imported candidates, and work identity clues reserve data for Ethereal Reference.
- The task ledger should link discovery, review, import, note generation, and graph actions under the active Research Topic.

Existing read-only views should remain available but become supporting views. The main path should show the next action instead of asking the user to manually infer what to do.

## Ethereal Reference Reservation

Ethereal Reference is deferred to v0.5 as a relation-network analysis feature. v0.4 reserves positions:

- core module seam: `src/core/etherealReferenceGraph.js`;
- runtime/UI seam: a Research Panel section or tab labelled `Ethereal Reference / 关系网络`;
- data seam: imported candidates, work identities, graph seeds, citation relations, provenance, and topic membership must carry enough information for future node-edge graph construction.

The reserved graph read model should be layout-free. It may expose node and edge records, but it must not calculate force layout or render a network. Minimum future-facing shapes:

- node: id, kind, label, work identity, Zotero item key, candidate id, topic ids, status tags, provenance;
- edge: id, kind, source node id, target node id, relation type, evidence, confidence, graph seed id, citation relation id, provenance.

v0.4 does not implement force-directed layout, graph visualization, clustering, path analysis, AI relation explanation, or interactive network exploration.

## Error Handling

Source failures are isolated. OpenAlex, Crossref, or Unpaywall failure must not erase candidates from other sources.

HTTP connector failures show connector name, status, timeout, invalid JSON, schema error, or response-size error. Secret headers, tokens, cookies, and credentials must be redacted.

Deduplication uncertainty remains visible as a duplicate hint. The plugin must not merge works automatically.

Zotero item creation failure blocks that candidate's write entry but does not stop unrelated candidates.

Attachment failure after item creation preserves the item and marks the attachment as retryable when safe.

The write queue can pause, resume, cancel, and retry failed entries. It must not run concurrent Zotero-native writes.

All failures should be recorded in the topic and task ledger, not only in a temporary status message.

## Testing Strategy

Core tests should cover:

- Research Topic normalization and topic-linked records;
- Document Candidate protocol normalization;
- OpenAlex, Crossref, Unpaywall, and HTTP connector adapter fixtures;
- candidate dedupe and anomaly tagging;
- candidate review state transitions;
- import plan creation;
- Zotero Write Queue state transitions;
- partial item/attachment failure behavior;
- redaction of connector secrets and raw source payloads;
- Ethereal Reference placeholder data shape.

Runtime/UI tests should cover:

- top toolbar entry registration and cleanup;
- Tools menu fallback remains available;
- Zotero item context-menu entry registration and cleanup;
- Research Panel three-lane UI labels and controls;
- plan confirmation prevents source calls and Zotero writes until confirmed;
- candidate review table shows provenance and anomaly tags;
- write queue UI shows item and attachment states separately;
- package tests include new runtime files in the XPI.

Manual QA should cover:

- OpenAlex/Crossref/Unpaywall discovery with fixture-like real examples;
- HTTP connector fixture endpoint;
- DOI/title batch input;
- local PDF-assisted candidate;
- anomaly-blocked candidate;
- batch import of normal candidates;
- item creation success;
- attachment creation success;
- attachment failure with item preserved;
- toolbar and context-menu launch surfaces;
- no automatic import, no automatic Zotero writes, and no blocked-source behavior.

## Non-Goals

v0.4 does not implement the local-command connector.

v0.4 does not implement full Ethereal Reference graph UI.

v0.4 does not automatically import all candidates.

v0.4 does not support blocked, pirate, credential-misuse, or scraping-only sources.

v0.4 does not run Zotero-native writes concurrently.

v0.4 does not automatically merge duplicate works.

v0.4 does not let natural-language requests bypass confirmation gates.

v0.4 does not make the existing read-only graph and identity views authoritative Zotero-native relationships.

## Implementation Slices

Slice 1 should add the Research Topic container, Document Candidate protocol, and three-lane UI skeleton.

Slice 2 should add OpenAlex, Crossref, Unpaywall, and HTTP connector source adapters with fixture-backed tests.

Slice 3 should add candidate review, anomaly blocking, dedupe hints, and import plan generation.

Slice 4 should add the Zotero Write Queue, Zotero item/attachment writer adapters, top toolbar entry, context-menu entry, and Ethereal Reference reservation points.

These slices are sequential because source candidates, review state, import planning, and Zotero writes depend on the same protocol and topic records.
