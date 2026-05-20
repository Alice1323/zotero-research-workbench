# Duplicate Work Candidate Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add read-only confidence and reason filters to Duplicate Work Candidates.

**Architecture:** Keep duplicate detection in `src/core/workIdentity.js` and mirror the helper in `chrome/content/paperSummary.js` for the packaged Zotero runtime. Add XHTML segmented controls that update hidden filter inputs and re-render only the affected panel view.

**Tech Stack:** Zotero XHTML panel, plain JavaScript runtime, Node `node:test`.

---

### Task 1: Core Filtering

**Files:**
- Modify: `tests/work-identity.test.js`
- Modify: `src/core/workIdentity.js`

- [ ] Add tests proving `listDuplicateWorkCandidates(snapshot, { confidence: "high" })` returns only shared DOI/Zotero-key candidates and `{ reason: "similar-title" }` returns only normalized title candidates.
- [ ] Run `node tests\work-identity.test.js` and confirm the new tests fail before implementation.
- [ ] Add candidate-level filtering for `confidence` and `reason`, treating empty or `all` as unfiltered.
- [ ] Re-run `node tests\work-identity.test.js`.

### Task 2: Runtime And Panel Controls

**Files:**
- Modify: `tests/ui-localization.test.js`
- Modify: `chrome/content/researchPanel.xhtml`
- Modify: `chrome/content/paperSummary.js`

- [ ] Add UI tests for `duplicate-work-confidence-filter`, `duplicate-work-reason-filter`, and segmented target dispatch.
- [ ] Run `node tests\ui-localization.test.js` and confirm the new tests fail before implementation.
- [ ] Add segmented XHTML controls for duplicate confidence and reason.
- [ ] Mirror the core filtering helper in `paperSummary.js`.
- [ ] Route segmented filter clicks to the renderer for the matching target instead of always refreshing the graph seed review queue.
- [ ] Re-run `node tests\ui-localization.test.js`.

### Task 3: Verification And Packaging

**Files:**
- Modify: `README.md`
- Update installed XPI in the active Zotero profile.

- [ ] Document the new read-only filters and boundaries.
- [ ] Run `npm test`.
- [ ] Run `npm run check`.
- [ ] Run `npm run package`.
- [ ] Copy the XPI to the active Zotero profile while Zotero is not running.
- [ ] Verify source and installed XPI SHA256 match.
