# Workbench Snapshot Module Design

## Goal

Extract Workbench Local Store snapshot export/import behavior into a dedicated deep Module without changing the v0.1.0 user-visible behavior, package formats, or Zotero runtime wiring.

## Current Problem

Snapshot lifecycle rules currently live inside `src/core/index.js` beside provider, prompt, WebDAV, and local store logic. The same file owns export package construction, ZIP payload construction, import validation, snapshot normalization, and redaction orchestration. This lowers Locality: future changes to snapshot format or recovery behavior require reading unrelated core logic.

The first v0.2 slice should create a clearer Seam around the Workbench Local Store snapshot while preserving the old `require("../src/core")` Interface for callers.

## Selected Approach

Use a conservative core-only extraction.

Create `src/core/workbenchSnapshot.js` and move the snapshot package Interface there:

- `normalizeSnapshotForImport(snapshot)`
- `normalizeSnapshotForExport(snapshot, exportedAt)`
- `createWorkbenchExportPackage({ snapshot, exportedAt })`
- `importWorkbenchExportPackage(input)`
- `createWorkbenchZipExportPayload({ snapshot, exportedAt })`
- `importWorkbenchZipExportPayload(payload)`

`src/core/index.js` will import these functions and re-export them, so existing tests and runtime-facing code can keep using `require("../src/core")`.

## Module Interface

The Module Interface is intentionally narrow:

- Import-side callers pass an exported JSON package or ZIP payload and receive a normalized snapshot object.
- Export-side callers pass a snapshot and optional timestamp and receive a redacted package object.
- The Module owns package kind/version validation, snapshot schema validation, default array normalization, exported timestamp placement, and ZIP `manifest.json` / `snapshot.json` payload shape.

The Module depends on redaction through an injected or imported redaction helper from `src/core/index.js` only for this first slice. It must not introduce a new storage Adapter or Zotero runtime dependency.

## Data Flow

Current public call path remains stable:

```text
tests / future core callers
  -> require("../src/core")
  -> src/core/index.js re-export
  -> src/core/workbenchSnapshot.js
```

The Zotero runtime copy in `chrome/content/paperSummary.js` is deliberately left unchanged in this slice. It contains duplicated snapshot functions, but moving runtime code belongs to a later v0.2 slice after the core Module Interface is stable.

## Behavior To Preserve

- JSON export package kind: `zotero-research-workbench-export`.
- JSON export package version: `1`.
- ZIP package kind: `zotero-research-workbench-zip-export`.
- ZIP package version: `1`.
- ZIP payload contains exactly the existing `manifest.json` and `snapshot.json` object model.
- Import rejects malformed JSON, unsupported package kind/version, unsupported snapshot schema, and missing ZIP snapshot entries with the current error messages.
- Export redacts Secret Material recursively.
- Missing snapshot arrays normalize to empty arrays.
- Existing `src/core/index.js` exports remain available.

## Testing

Add `tests/workbench-snapshot.test.js` with Interface-level tests for the new Module. The first red test should import from `../src/core/workbenchSnapshot` before the file exists.

Test coverage:

- JSON export redacts providers, provider provenance, and task ledger secret material.
- JSON import accepts a package string and returns normalized snapshot arrays.
- ZIP export wraps the redacted JSON package at `snapshot.json` and manifest at `manifest.json`.
- ZIP import routes through JSON package validation and restores citation relations.
- Missing `snapshot.json` throws `ZIP 导出包缺少 snapshot.json`.

Keep existing `tests/core.test.js` compatibility tests green. If duplicate coverage becomes excessive, leave it in place for this slice; reducing old tests can happen after the new Module proves stable.

## Out Of Scope

- No snapshot schema migration.
- No runtime extraction from `chrome/content/paperSummary.js`.
- No active Zotero profile edits.
- No XPI coverage or packaging changes beyond syntax/test commands.
- No README, localization, or UI text changes.
- No WebDAV behavior changes, except it continues to call the re-exported package builder.

## Risks

- Circular dependency risk if `workbenchSnapshot.js` imports from `index.js`. Avoid this by moving or passing the redaction helper in a way that does not require `index.js` from inside the new Module.
- Runtime/core drift remains after this slice because `chrome/content/paperSummary.js` still has duplicated functions. This is accepted temporarily and should be addressed in a later runtime Seam slice.
- `src/core/index.js` must continue to export the old names, or WebDAV and existing tests will break.
