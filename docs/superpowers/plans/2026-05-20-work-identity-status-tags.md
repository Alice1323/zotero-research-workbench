# Work Identity Status Tags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add read-only status tags to the work identity inspector so users can quickly spot missing DOI values, multi-source identities, citation-linked works, and isolated local records.

**Architecture:** Extend the existing `listWorkIdentitiesForInspector()` shape with derived `statusTags` only. Mirror the same derivation in the Zotero runtime copy and render the tags inline in `作品身份线索`; no merge action, Zotero metadata write, or external provider lookup is introduced.

**Tech Stack:** CommonJS core, Zotero XHTML runtime JavaScript, Node `node:test`, PowerShell packaging.

---

### Task 1: Core Status Tags

**Files:**
- Modify: `src/core/workIdentity.js`
- Test: `tests/work-identity.test.js`

- [ ] **Step 1: Write failing core test**

Add a test that expects `statusTags` for four local identity states: `多来源`, `有引用关系`, `无 DOI`, and `孤立线索`.

- [ ] **Step 2: Run target test and verify RED**

Run: `node tests\work-identity.test.js`
Expected: FAIL because returned work identity records do not include `statusTags`.

- [ ] **Step 3: Implement minimal derivation**

Add a helper that derives tags from finalized record fields:
- `无 DOI` when DOI is `未记录`.
- `多来源` when at least two of draft, graph seed, and citation relation counts are non-zero.
- `有引用关系` when citation relation count is non-zero.
- `孤立线索` when total record count is one.

- [ ] **Step 4: Run target test and verify GREEN**

Run: `node tests\work-identity.test.js`
Expected: PASS.

### Task 2: Runtime Rendering

**Files:**
- Modify: `chrome/content/paperSummary.js`
- Test: `tests/ui-localization.test.js`

- [ ] **Step 1: Write failing runtime test**

Assert the runtime contains `statusTags`, `formatWorkIdentityStatusTags`, and the Chinese tag strings.

- [ ] **Step 2: Run target test and verify RED**

Run: `node tests\ui-localization.test.js`
Expected: FAIL because the runtime does not derive or render work identity status tags.

- [ ] **Step 3: Mirror implementation in runtime**

Add the same tag derivation to the runtime `finalizeWorkIdentity()` and append the rendered tag string to each work identity detail line.

- [ ] **Step 4: Run target test and verify GREEN**

Run: `node tests\ui-localization.test.js`
Expected: PASS.

### Task 3: Docs, Package, And Checkpoint

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-05-20-work-identity-status-tags.md`
- Append: `C:\Users\44199\水银灯的书库\水银灯的ai库\中途路径\2026-05-18_2005_zotero-research-workbench_checkpoint.md`

- [ ] **Step 1: Update README**

Document that `作品身份线索` shows status tags and that they remain read-only review hints.

- [ ] **Step 2: Run full verification**

Run:

```powershell
npm test
npm run check
npm run package
```

Expected: all commands exit 0.

- [ ] **Step 3: Cover active XPI if Zotero is closed**

If `tasklist /FI "IMAGENAME eq zotero.exe"` shows no Zotero process, copy `dist\zotero-research-workbench-0.1.0.xpi` to the active profile XPI path and verify source/target SHA256 match. If Zotero is running, leave the active XPI untouched and record that state.

- [ ] **Step 4: Write checkpoint**

Append a concise checkpoint with completed work, current status, verification, risks, and next plan.
