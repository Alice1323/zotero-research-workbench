# v0.3 AI Task Workspace Design

## Goal

v0.3 turns Zotero Research Workbench from a single-paper assistant into an AI Task Workspace for user-confirmed literature understanding work. A user can describe a research need in natural language, review an AI Job Plan, run many small AI Tasks with visible progress and control, and keep all external access, import, and Zotero write side effects behind explicit confirmation.

## Product Direction

The version theme is AI Task Workspace.

UI humanization means three concrete requirements:

- Task Transparency: show plan, queue, progress, success count, skip/failure count, source scope, provider/model, and request or cost estimate when available.
- Task Control: let the user pause, resume, cancel, retry failed work, skip recoverable failures, and retry only safe failed tasks.
- Task Explainability: let every result and failure trace back to source work, input scope, prompt template, provider, time, and error reason.

Low-distraction behavior matters, but it is secondary to transparency, control, and explainability. The UI should stay a workbench, not a landing page: dense enough for repeated literature work, clear enough that batch AI behavior never feels hidden.

## Core Concepts

An AI Job is the user-level request. It starts from natural language and may cover one paper, tens of papers, or hundreds of papers.

An AI Task is the smallest executable unit. For v0.3, one paper summary or one translation segment is the minimum task shape.

An AI Job Plan is produced before execution. The plan lists intended tasks, scope, source set, provider use, expected side effects, and any document import or Zotero write actions.

An AI Task Queue is visible. "Multithreading" for v0.3 means queued provider work controlled by a Provider Concurrency Limit, not OS-level threads and not hidden automation.

The Zotero Write Queue is serial. Zotero item, attachment, note, metadata, and relation writes must run one at a time even if provider calls are concurrent.

## Launch Surfaces

The first v0.3 launch surface is the Research Panel natural-language input. This is the primary place where a user says what they want the AI to do.

The Zotero context menu is reserved as a future AI Job Launch Surface. v0.3 code should leave an explicit extension point for right-click menu wiring, but the first implementation slice does not need to expose the context-menu UI.

No hidden launch surfaces are allowed. A job starts because the user intentionally launched it.

## Job And Task States

AI Job states:

- draft
- confirmed
- running
- paused
- completed
- completed-with-skips
- failed
- cancelled

AI Task states:

- queued
- running
- retrying
- succeeded
- skipped
- failed
- cancelled

Completed-with-skips is not the same as completed. A skipped paper must remain visible in the job result.

## Confirmation Gates

AI may understand the user's request and prepare a plan automatically, but these actions require a User Confirmation Gate before execution:

- external literature discovery
- bulk provider calls
- document import
- Zotero-native writes

The confirmation screen must show scope, provenance, document count, provider/model, expected writes, and import mode when relevant. The user chooses side effects explicitly; the system must not treat natural-language intent alone as consent for import or Zotero mutation.

## Literature Discovery Scope

v0.3 may expand beyond the current selection. Discovery Scope can include:

- current Zotero selection
- current Zotero collection or selected collections
- local Zotero library search
- approved external literature sources through External Literature Connectors
- user-supplied connectors

Discovery Scope is explicit and reviewable. No implicit library-wide search, external source use, or background web search is allowed.

## External Connector Boundary

The Workbench may provide a generic External Literature Connector boundary. The boundary exists so a configured connector can return Document Candidates with provenance, metadata, and optional document payload or local file reference.

For v0.3, the Workbench did not ship, recommend, test, document, or special-case connectors for Blocked Literature Sources. PDF acquisition policy is superseded by `docs/superpowers/plans/2026-05-25-pdf-acquisition-baseline.md`, which supports user-configured Sci-Hub and analogous third-party PDF resolvers when provenance is visible and every attachment write passes the User Confirmation Gate.

User-supplied connectors are advanced configuration. The user's connector decision remains outside the Workbench's shipped behavior, but any candidate they return still goes through the same provenance display and User Confirmation Gate before import or write side effects.

## Document Candidates And Import Modes

A Document Candidate is reviewable before import. It must carry provenance and metadata, and may carry a document payload or local file reference.

The user may choose among three import modes:

- Workbench-Only Import: store the candidate only in Workbench Local Store.
- Attachment Import: attach an approved document to an existing Zotero item.
- Item And Attachment Import: create a new Zotero item and attach the approved document.

All three modes are v0.3 product scope. Attachment Import and Item And Attachment Import use the Zotero Write Queue and require explicit confirmation.

## Provider Concurrency

Provider calls can run concurrently up to a Provider Concurrency Limit. The limit is per LLM provider, user-configurable, and visible near the queue settings.

The queue must respect provider failures. If a provider returns authentication, quota, model, or systemic service errors, the job should pause affected work and show Job Failure Diagnosis instead of wasting retries.

## Retry, Skip, And Diagnosis

Partial failure is allowed. A large job should preserve successful work even when individual papers fail.

Transient errors retry twice. After retry exhaustion, recoverable per-paper failures such as unreadable PDFs, missing readable text, or connector failure become visible Task Skips.

Job Failure Diagnosis triggers when failures suggest a systemic problem:

- three failures for jobs under ten tasks
- thirty percent failures for jobs with ten or more tasks
- five consecutive failures
- any immediate systemic provider, connector, or authentication failure

Diagnosis should summarize likely cause, affected tasks, provider or connector involved, and recommended user actions. It should not be a raw log dump.

## Resumability

AI Jobs are persisted in Workbench Local Store with job, task, result, failure, skip, and progress records.

After Zotero or the Research Panel restarts, resumable jobs return to a manual continuation state. They must not continue automatically in the background. The user reviews state and chooses whether to resume, retry failed tasks, skip failures, export results, or cancel.

## Result And Audit Records

Each task result should retain:

- job id and task id
- source work identity or document candidate
- input scope
- prompt template and prompt override id when available
- provider and model provenance
- status, timestamps, retry count, and error reason when present
- generated summary, translation, or local review record

Task Ledger records should be created only after local Workbench state changes. Zotero-native writes also need visible success or failure records tied to the Zotero Write Queue.

## User Workflows

Single-paper summary or translation:

1. User opens Research Panel with a selected item.
2. User describes the desired summary or translation.
3. Workbench creates a draft AI Job Plan with one or more tasks.
4. User confirms provider use.
5. Queue runs tasks, persists result, and shows provenance.

Large multi-paper understanding job:

1. User describes a topic and scope.
2. Workbench resolves candidate works from the approved Discovery Scope.
3. User reviews the AI Job Plan and confirms bulk provider calls.
4. Queue runs with Provider Concurrency Limit.
5. Partial failures are retried, skipped, or diagnosed according to thresholds.
6. User reviews completed and skipped work separately.

Literature discovery and import:

1. User describes the research need and allowed sources.
2. Connectors return Document Candidates with provenance.
3. User reviews candidates and chooses import mode.
4. Workbench executes Workbench-only writes directly to local store or Zotero writes through the Zotero Write Queue.

Restart recovery:

1. User reopens Zotero or the Research Panel.
2. Workbench shows paused or resumable jobs.
3. User manually chooses resume, retry, skip, cancel, or export.

## First Implementation Slices

Slice 1 should prove the architecture with the smallest useful vertical path:

- AI Job and AI Task core model
- Workbench Local Store persistence for jobs, tasks, failures, skips, and results
- Research Panel natural-language job composer
- plan preview and User Confirmation Gate
- provider-backed queue over the current selection
- Provider Concurrency Limit
- retry twice, Task Skip, and Job Failure Diagnosis
- manual resume after restart

Slice 2 should add richer scope and task types:

- selected collection or local Zotero library search scope
- translation segment tasks
- clearer task result inspector
- retry failed tasks only

Slice 3 should add connector and import boundaries:

- generic External Literature Connector interface
- Document Candidate list and provenance display
- Workbench-Only Import
- Attachment Import through Zotero Write Queue
- Item And Attachment Import through Zotero Write Queue

Slice 4 should reserve additional launch surfaces:

- explicit right-click menu registration seam
- context-menu payload adapter from selected Zotero items into AI Job Launch Surface input
- tests that prove context-menu code can create a draft job plan without starting execution

## Testing Strategy

Core tests should cover:

- AI Job Plan creation from scoped input
- job and task state transitions
- queue concurrency limiting
- retry exhaustion and Task Skip
- diagnosis threshold calculations
- serial Zotero Write Queue behavior through adapter fakes
- Workbench Local Store persistence and resume loading
- connector boundary accepting neutral Document Candidates without source-specific blocked-source code

Runtime/UI tests should cover:

- Research Panel job composer renders without an active job
- plan preview blocks execution until confirmation
- pause, resume, cancel, retry, and skip controls update visible state
- completed-with-skips remains distinguishable from completed
- restart shows resumable jobs without automatic background continuation

Manual verification should include:

- install the built XPI into the active Zotero profile with backup
- start a one-paper summary job
- start a multi-paper job with at least one forced PDF unreadable failure
- force provider 502/503 and confirm diagnosis messaging
- restart Zotero and verify manual resume behavior
- confirm no Zotero item, attachment, metadata, relation, or note write happens without a User Confirmation Gate

## Non-Goals

v0.3 does not implement hidden background automation.

v0.3 does not treat natural-language user intent as permission for external discovery, bulk provider calls, imports, or Zotero writes.

v0.3 does not use OS-level threads as the user-facing model for AI work.

v0.3 does not run Zotero-native writes concurrently.

v0.3 does not automatically resume jobs after restart.

v0.3 did not ship, recommend, test, document, or provide source-specific code for Blocked Literature Sources. Later PDF acquisition work follows `docs/superpowers/plans/2026-05-25-pdf-acquisition-baseline.md`.

v0.3 first slice does not need to expose a right-click menu entry, but it must leave a concrete code extension point for it.

## Open Implementation Question

The remaining planning question is implementation slicing, not product intent. Recommended answer: build Slice 1 first as the non-negotiable MVP because it proves the job model, queue, confirmation gate, concurrency limit, retries, skips, diagnosis, persistence, and Research Panel UI before connector and import complexity are added.
