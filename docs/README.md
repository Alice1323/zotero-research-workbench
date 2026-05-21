# Zotero Research Workbench Documentation Index

This index is the entry point for project documentation. Use it to find the current product direction, domain language, accepted decisions, implementation specs, execution plans, and manual verification notes.

## Start Here

- [Project README](../README.md): current shipped behavior, commands, runtime notes, and user-visible boundaries.
- [Domain Glossary](../CONTEXT.md): canonical product language for AI jobs, tasks, queues, import modes, connectors, local store records, graph records, and safety boundaries.
- [Agent Instructions](../AGENTS.md): repository-specific operating rules for agentic work.

## Current Version Direction

- [v0.3 AI Task Workspace Design](./superpowers/specs/2026-05-21-v03-ai-task-workspace-design.md): main v0.3 design covering AI Job/Task model, humanized UI requirements, queue concurrency, confirmation gates, literature discovery scope, external connector boundary, import modes, retries/skips/diagnosis, resumability, and the right-click menu extension point.

Recommended v0.3 implementation order:

1. Slice 1: AI Job/Task model, local persistence, Research Panel natural-language launch, plan confirmation, current-selection provider queue, provider concurrency, retry/skip/diagnosis, manual resume.
2. Slice 2: selected collection or local library scope, translation segments, richer result inspector, retry failed tasks only.
3. Slice 3: generic connector boundary, Document Candidates, provenance display, Workbench-only import, Zotero attachment/item import through the Zotero Write Queue.
4. Slice 4: reserved Zotero context-menu launch surface and tests that prove it creates draft job plans without starting execution.

## Architecture Decisions

ADRs record decisions that are hard to reverse or easy to misunderstand later.

- [ADR 0001: User-confirmed document import modes](./adr/0001-user-confirmed-document-import-modes.md)
- [ADR 0002: AI job plans require confirmation before side effects](./adr/0002-ai-job-plans-require-confirmation-before-side-effects.md)
- [ADR 0003: AI jobs allow partial failure with diagnosis thresholds](./adr/0003-ai-jobs-allow-partial-failure-with-diagnosis-thresholds.md)
- [ADR 0004: External connectors stay lawful and generic](./adr/0004-external-connectors-stay-lawful-and-generic.md)

## Design Specs

Design specs describe intended behavior and boundaries before implementation.

### v0.3

- [v0.3 AI Task Workspace Design](./superpowers/specs/2026-05-21-v03-ai-task-workspace-design.md)

### Core And Architecture

- [First Slice Design](./superpowers/specs/2026-05-18-first-slice-design.md)
- [Workbench Snapshot Module Design](./superpowers/specs/2026-05-20-workbench-snapshot-module-design.md)

### Provider And Prompting

- [Provider Connection Test Design](./superpowers/specs/2026-05-19-provider-status-layered-errors-design.md)
- [Provider Runtime Guards Design](./superpowers/specs/2026-05-19-provider-runtime-guards-design.md)
- [Provider Advanced Settings Design](./superpowers/specs/2026-05-19-provider-advanced-settings-design.md)
- [Prompt Template Overrides Design](./superpowers/specs/2026-05-19-prompt-template-overrides-design.md)
- [Layered Errors Design](./superpowers/specs/2026-05-19-layered-errors-design.md)

### Reading And Paper Context

- [PDF Attachment Detection Design](./superpowers/specs/2026-05-19-pdf-attachment-detection-design.md)

### Local Graph And Work Identity

- [Graph Seed Review Queue Design](./superpowers/specs/2026-05-18-graph-seed-review-queue-design.md)
- [Citation Relation Promotion Design](./superpowers/specs/2026-05-19-citation-relation-promotion-design.md)

### Export And Backup

- [ZIP Export Import Design](./superpowers/specs/2026-05-19-zip-export-import-design.md)
- [WebDAV Export Target Design](./superpowers/specs/2026-05-19-webdav-export-target-design.md)
- [WebDAV Auto Create Directory Design](./superpowers/specs/2026-05-19-webdav-auto-create-directory-design.md)

## Implementation Plans

Implementation plans are step-by-step execution documents for agentic workers.

### v0.3

- [v0.3 AI Task Workspace Slice 1 Plan](./superpowers/plans/2026-05-22-v03-ai-task-workspace-slice1.md)

### First Release And Core Workflow

- [First Slice Plan](./superpowers/plans/2026-05-18-first-slice.md)
- [Chinese Provider UI Plan](./superpowers/plans/2026-05-18-chinese-provider-ui.md)
- [Provider Settings Persistence Plan](./superpowers/plans/2026-05-18-provider-settings-persistence.md)
- [Provider Connection Test Plan](./superpowers/plans/2026-05-18-provider-connection-test.md)
- [Reading Context Extraction Plan](./superpowers/plans/2026-05-18-reading-context-extraction.md)
- [Reading Context Translation Plan](./superpowers/plans/2026-05-18-reading-context-translation.md)
- [Save Draft To Zotero Note Plan](./superpowers/plans/2026-05-18-save-draft-to-zotero-note.md)
- [Read-only Workbench Records Plan](./superpowers/plans/2026-05-18-readonly-workbench-records.md)

### Provider, Prompting, And Errors

- [Layered Errors Plan](./superpowers/plans/2026-05-19-layered-errors.md)
- [Provider Runtime Guards Plan](./superpowers/plans/2026-05-19-provider-runtime-guards.md)
- [Provider Status Layered Errors Plan](./superpowers/plans/2026-05-19-provider-status-layered-errors.md)
- [Provider Advanced Settings Plan](./superpowers/plans/2026-05-19-provider-advanced-settings.md)
- [Prompt Template Overrides Plan](./superpowers/plans/2026-05-19-prompt-template-overrides.md)
- [PDF Attachment Detection Plan](./superpowers/plans/2026-05-19-pdf-attachment-detection.md)

### Export, Import, And Snapshot

- [Local Export Import Plan](./superpowers/plans/2026-05-18-local-export-import.md)
- [ZIP Export Import Plan](./superpowers/plans/2026-05-19-zip-export-import.md)
- [WebDAV Export Target Plan](./superpowers/plans/2026-05-19-webdav-export-target.md)
- [WebDAV Auto Create Directory Plan](./superpowers/plans/2026-05-19-webdav-auto-create-directory.md)
- [Workbench Snapshot Module Plan](./superpowers/plans/2026-05-20-workbench-snapshot-module.md)
- [V0.21 Workbench Local Store Transaction Historical Plan](./superpowers/plans/2026-05-21-v021-workbench-local-store-transaction.md)

### Graph, Citation, And Work Identity

- [Graph Seed Capture Plan](./superpowers/plans/2026-05-18-graph-seed-capture.md)
- [Graph Seed Review Queue Plan](./superpowers/plans/2026-05-18-graph-seed-review-queue.md)
- [Citation Relation Promotion Plan](./superpowers/plans/2026-05-19-citation-relation-promotion.md)
- [Citation Graph Inspector Plan](./superpowers/plans/2026-05-20-citation-graph-inspector.md)
- [Citation Relation Quality Tags Plan](./superpowers/plans/2026-05-20-citation-relation-quality-tags.md)
- [Citation Relation Quality Filter Plan](./superpowers/plans/2026-05-20-citation-relation-quality-filter.md)
- [Work Identity Inspector Plan](./superpowers/plans/2026-05-20-work-identity-inspector.md)
- [Work Identity Status Tags Plan](./superpowers/plans/2026-05-20-work-identity-status-tags.md)
- [Work Identity Status Filter Plan](./superpowers/plans/2026-05-20-work-identity-status-filter.md)
- [Duplicate Work Candidates Plan](./superpowers/plans/2026-05-20-duplicate-work-candidates.md)
- [Duplicate Work Candidate Filters Plan](./superpowers/plans/2026-05-20-duplicate-work-candidate-filters.md)

## QA And Release

- [First Run Manual QA](./first-run-manual-qa.md): manual verification checklist for the plugin in Zotero.
- [v0.1 Release Checklist](./release-checklist-v0.1.md): historical release checklist for the first release.

## Agent Support Docs

- [Agent Domain Notes](./agents/domain.md)
- [Issue Tracker Notes](./agents/issue-tracker.md)
- [Triage Labels](./agents/triage-labels.md)

## How To Use This Index

- For product language, update [Domain Glossary](../CONTEXT.md), not a spec.
- For hard decisions, add an ADR under [adr](./adr/).
- For a new feature design, add a spec under [superpowers/specs](./superpowers/specs/).
- For executable work, add a plan under [superpowers/plans](./superpowers/plans/).
- For manual Zotero verification, update [First Run Manual QA](./first-run-manual-qa.md) or add a version-specific checklist.
