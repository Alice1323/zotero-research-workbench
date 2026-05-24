# PDF Acquisition Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a lawful, user-confirmed PDF acquisition workflow for Zotero Research Workbench and make this document the canonical baseline for all future PDF acquisition work.

**Architecture:** PDF acquisition is an extension of the existing v0.4 Literature Discovery and Zotero Write Queue pipeline. The Workbench may resolve PDF attachment candidates from approved open-access or user-authorized sources, show their provenance before any write, and then attach PDFs through the serial Zotero Write Queue only after explicit user confirmation. Blocked sources, including Sci-Hub and other unauthorized access services, are not supported directly or indirectly.

**Tech Stack:** Zotero 8/9 bootstrap plugin, XHTML Research Panel, CommonJS core modules under `src/core`, Node `node:test`, PowerShell XPI packaging, injected Zotero/fetch runtime adapters.

---

## Canonical Rule

This file is the baseline for future PDF acquisition work in this repository.

Use this plan instead of prior chat history, abandoned project notes, old speculative plans, or informal Sci-Hub download ideas. If another document appears to conflict with this file, treat this file as the controlling baseline and update the conflicting document before implementing code.

## Non-Negotiable Boundaries

- Do not implement Sci-Hub as a source, resolver, fallback downloader, connector template, button, setting, documented workflow, test fixture, or recommended user-supplied connector.
- Do not build or document tools that bypass publisher access controls, login walls, institutional authentication, CAPTCHAs, paywalls, robots restrictions, or DRM.
- Do not silently download PDFs.
- Do not automatically attach PDFs to Zotero items without a visible User Confirmation Gate.
- Do not store full third-party raw responses in Zotero preferences. Store compact provenance in the Workbench Local Store and keep bulky payloads out of preferences.
- Do not treat a generic HTTP connector as permission to integrate blocked sources. Connectors must return provenance and must not be described as a Sci-Hub escape hatch.

## Approved PDF Sources

The Workbench may acquire or attach PDFs only from these source classes:

- Open-access PDF URLs discovered from OpenAlex metadata.
- Open-access PDF URLs discovered from Unpaywall metadata.
- PDF links explicitly present in Crossref metadata when the link is lawful and directly importable.
- HTTP connector file references when the connector is user-configured, provenance-bearing, and not a blocked source integration.
- User-selected local PDF files.
- Existing Zotero attachments selected or reviewed by the user.

## Product Behavior

PDF acquisition must be a reviewable workflow, not background harvesting.

The Research Panel should expose these import modes when enough information exists:

- `仅创建 Zotero 条目`: create a Zotero item without an attachment.
- `创建条目并附加 PDF`: create a Zotero item and attach a reviewed PDF.
- `仅为已有条目补 PDF`: attach a reviewed PDF to an existing Zotero item without creating a duplicate item.

Every candidate PDF must show:

- source adapter id, such as `openalex`, `unpaywall`, `crossref`, or `http-connector`;
- source URL or source record id;
- request URL when available;
- license or open-access status when available;
- attachment kind, such as `open-access-pdf-url`, `local-file`, or `connector-file-reference`;
- importability state and block reason when not importable.

## File Structure

- Modify `src/core/documentCandidateProtocol.js`: keep attachment normalization, importability gates, provenance, and anomaly tags authoritative.
- Modify `src/core/literatureSourceAdapters.js`: extract approved PDF URLs from OpenAlex, Crossref, and Unpaywall without storing bulky raw responses.
- Modify `src/core/documentCandidateReview.js`: expose PDF import modes, attachment choices, existing-item attachment planning, and blocked-source validation.
- Modify `src/core/zoteroItemWriter.js`: keep Zotero item and attachment writes explicit and serial; add existing-item attachment support if missing.
- Modify `src/core/zoteroWriteQueue.js`: keep attachment writes dependent on their parent item or existing target item.
- Modify `src/core/workbenchLocalStoreTransaction.js`: record compact provenance and write queue results without large raw payloads.
- Modify `src/core/researchPanelOrchestrator.js`: expose read models for candidate PDF status and import mode decisions.
- Modify `chrome/content/researchPanel.xhtml`: show PDF status, provenance, and import mode controls.
- Modify `chrome/content/paperSummary.js`: wire PDF acquisition UI actions to orchestrator workflows and Zotero Write Queue execution.
- Modify `README.md`: document approved PDF acquisition behavior and blocked source policy.
- Modify `CONTEXT.md`: keep this baseline linked as the controlling PDF acquisition plan.

## Task 1: Lock Blocked-Source Policy In Tests

**Files:**
- Modify: `tests/document-candidate-protocol.test.js`
- Modify: `src/core/documentCandidateProtocol.js`

- [ ] **Step 1: Add a failing blocked-source attachment test**

Add this test to `tests/document-candidate-protocol.test.js`:

```js
test("normalizeAttachmentReference blocks unauthorized PDF sources", () => {
  const attachment = normalizeAttachmentReference({
    kind: "open-access-pdf-url",
    url: "https://sci-hub.example/10.1000/example.pdf",
    provenance: { source: "sci-hub" }
  });

  assert.equal(attachment.importable, false);
  assert.equal(attachment.importBlockReason, "来源不被允许");
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```powershell
node --test tests\document-candidate-protocol.test.js
```

Expected: FAIL because `normalizeAttachmentReference` does not yet block by source name.

- [ ] **Step 3: Implement blocked-source detection**

In `src/core/documentCandidateProtocol.js`, add:

```js
const BLOCKED_SOURCE_TAG = "来源不被允许";

function isBlockedAttachmentSource(input = {}) {
  const values = [
    input.provenance?.source,
    input.provenance?.connectorId,
    input.provenance?.connectorEndpoint,
    input.url,
    input.fileUrl,
    input.sourceUrl
  ].map((value) => cleanText(value).toLowerCase());
  return values.some((value) => /sci[\s.-]*hub|libgen|library genesis/.test(value));
}
```

Then, inside `normalizeAttachmentReference`, before kind-specific importability logic:

```js
if (isBlockedAttachmentSource(input)) {
  return {
    ...clonePlain(input),
    kind,
    path,
    url,
    referenceId,
    license: cleanText(input.license),
    contentType,
    provenance,
    importable: false,
    importBlockReason: BLOCKED_SOURCE_TAG
  };
}
```

- [ ] **Step 4: Run the focused tests**

Run:

```powershell
node --test tests\document-candidate-protocol.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src\core\documentCandidateProtocol.js tests\document-candidate-protocol.test.js
git commit -m "fix: block unauthorized pdf attachment sources"
```

## Task 2: Show Candidate PDF Status In The Review Model

**Files:**
- Modify: `tests/document-candidate-review.test.js`
- Modify: `src/core/documentCandidateReview.js`

- [ ] **Step 1: Add a failing PDF status read-model test**

Add this test:

```js
test("candidate review read model exposes pdf status and provenance", () => {
  const model = createDocumentCandidateReviewReadModel({
    documentCandidates: [
      {
        id: "candidate-a",
        topicId: "topic-a",
        title: "Candidate A",
        anomalyTags: [],
        attachments: [
          {
            id: "att-a",
            kind: "open-access-pdf-url",
            url: "https://example.org/a.pdf",
            importable: true,
            license: "cc-by",
            provenance: { source: "unpaywall", requestUrl: "https://api.unpaywall.org/v2/10.1000/a" }
          }
        ]
      }
    ]
  }, { topicId: "topic-a" });

  assert.equal(model.candidates[0].pdfStatus, "available");
  assert.equal(model.candidates[0].pdfStatusLabel, "可导入 PDF");
  assert.deepEqual(model.candidates[0].pdfSources, ["unpaywall"]);
});
```

- [ ] **Step 2: Run the test and verify it fails**

```powershell
node --test tests\document-candidate-review.test.js
```

Expected: FAIL because `pdfStatus` fields are not yet exposed.

- [ ] **Step 3: Implement PDF status derivation**

In `src/core/documentCandidateReview.js`, add:

```js
function derivePdfStatus(candidate = {}) {
  const attachments = Array.isArray(candidate.attachments) ? candidate.attachments : [];
  const pdfAttachments = attachments.filter((attachment) =>
    ["open-access-pdf-url", "local-file", "connector-file-reference"].includes(cleanText(attachment.kind))
  );
  const importable = pdfAttachments.filter((attachment) => attachment.importable);
  if (importable.length) {
    return {
      pdfStatus: "available",
      pdfStatusLabel: "可导入 PDF",
      pdfSources: uniqueClean(importable.map((attachment) => attachment.provenance?.source || attachment.kind))
    };
  }
  if (pdfAttachments.length) {
    return {
      pdfStatus: "blocked",
      pdfStatusLabel: "PDF 需复核",
      pdfSources: uniqueClean(pdfAttachments.map((attachment) => attachment.provenance?.source || attachment.kind))
    };
  }
  return { pdfStatus: "missing", pdfStatusLabel: "未发现 PDF", pdfSources: [] };
}
```

Merge the result into each candidate record returned by `createDocumentCandidateReviewReadModel`.

- [ ] **Step 4: Run focused tests**

```powershell
node --test tests\document-candidate-review.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src\core\documentCandidateReview.js tests\document-candidate-review.test.js
git commit -m "feat: expose candidate pdf status"
```

## Task 3: Add Explicit PDF Import Modes

**Files:**
- Modify: `tests/document-candidate-review.test.js`
- Modify: `src/core/documentCandidateReview.js`

- [ ] **Step 1: Add failing import-mode tests**

Add:

```js
test("createZoteroImportPlanFromCandidates supports item plus pdf and attachment-only modes", () => {
  const snapshot = {
    documentCandidates: [
      {
        id: "candidate-a",
        topicId: "topic-a",
        title: "Candidate A",
        anomalyTags: [],
        attachments: [{ id: "att-a", kind: "open-access-pdf-url", url: "https://example.org/a.pdf", importable: true }]
      }
    ]
  };

  const itemPlusPdf = createZoteroImportPlanFromCandidates({
    snapshot,
    topicId: "topic-a",
    selections: [{ candidateId: "candidate-a", importMode: "zotero-item-plus-attachment", attachmentId: "att-a" }],
    createdAt: "2026-05-25T02:00:00.000Z"
  });
  assert.deepEqual(itemPlusPdf.expectedWrites, { items: 1, attachments: 1 });

  const attachmentOnly = createZoteroImportPlanFromCandidates({
    snapshot,
    topicId: "topic-a",
    selections: [{
      candidateId: "candidate-a",
      importMode: "attachment-only",
      attachmentId: "att-a",
      targetZoteroItemKey: "ABCD1234",
      targetZoteroItemId: 123
    }],
    createdAt: "2026-05-25T02:01:00.000Z"
  });
  assert.deepEqual(attachmentOnly.expectedWrites, { items: 0, attachments: 1 });
  assert.equal(attachmentOnly.writeIntents[0].kind, "create-attachment");
  assert.equal(attachmentOnly.writeIntents[0].parentItemKey, "ABCD1234");
});
```

- [ ] **Step 2: Run the test and verify it fails**

```powershell
node --test tests\document-candidate-review.test.js
```

Expected: FAIL because `attachment-only` is not yet supported.

- [ ] **Step 3: Implement `attachment-only` plan creation**

In `src/core/documentCandidateReview.js`, define:

```js
const IMPORT_MODES = {
  zoteroItem: "zotero-item",
  zoteroItemPlusAttachment: "zotero-item-plus-attachment",
  attachmentOnly: "attachment-only"
};
```

When processing a selection with `importMode === IMPORT_MODES.attachmentOnly`, require:

```js
if (!cleanText(selection.targetZoteroItemKey) && !selection.targetZoteroItemId) {
  throw new Error("仅补 PDF 需要目标 Zotero 条目");
}
```

Create one `create-attachment` write intent without a `create-item` dependency:

```js
{
  id: `write-intent-${candidate.id}-attachment`,
  kind: "create-attachment",
  candidateId: candidate.id,
  topicId,
  parentItemKey: cleanText(selection.targetZoteroItemKey),
  parentItemId: Number(selection.targetZoteroItemId) || null,
  attachment,
  dependsOn: [],
  provenance: { sourceCandidateId: candidate.id, attachmentSource: attachment.kind }
}
```

- [ ] **Step 4: Run focused tests**

```powershell
node --test tests\document-candidate-review.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src\core\documentCandidateReview.js tests\document-candidate-review.test.js
git commit -m "feat: add attachment-only pdf import mode"
```

## Task 4: Wire Existing-Item Attachment Writes

**Files:**
- Modify: `tests/zotero-item-writer.test.js`
- Modify: `src/core/zoteroItemWriter.js`
- Modify: `chrome/content/paperSummary.js`

- [ ] **Step 1: Add failing writer test**

Add:

```js
test("writeZoteroAttachmentFromIntent attaches a URL PDF to an existing Zotero item", async () => {
  const calls = [];
  const Zotero = {
    Attachments: {
      importFromURL: async (input) => {
        calls.push(input);
        return { key: "ATTACH1", id: 456 };
      }
    }
  };

  const result = await writeZoteroAttachmentFromIntent({
    Zotero,
    intent: {
      parentItemId: 123,
      parentItemKey: "ABCD1234",
      attachment: { kind: "open-access-pdf-url", url: "https://example.org/a.pdf", title: "A PDF" }
    }
  });

  assert.equal(calls[0].parentItemID, 123);
  assert.equal(calls[0].url, "https://example.org/a.pdf");
  assert.equal(result.parentItemKey, "ABCD1234");
});
```

- [ ] **Step 2: Run the test and verify it fails if runtime support is missing**

```powershell
node --test tests\zotero-item-writer.test.js
```

Expected: FAIL only if `parentItemId` or URL attachment support is incomplete.

- [ ] **Step 3: Ensure runtime passes parent item fields**

In `chrome/content/paperSummary.js`, in `runZoteroWriteQueue`, keep this call shape for attachment entries:

```js
result = await writeZoteroAttachmentFromIntent({
  Zotero: getZotero(),
  intent: next.entry.writeIntent,
  parentItemId: next.entry.resolvedZoteroItemId || next.entry.writeIntent.parentItemId,
  parentItemKey: next.entry.resolvedZoteroItemKey || next.entry.writeIntent.parentItemKey
});
```

- [ ] **Step 4: Run focused tests**

```powershell
node --test tests\zotero-item-writer.test.js tests\literature-discovery-ui.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src\core\zoteroItemWriter.js chrome\content\paperSummary.js tests\zotero-item-writer.test.js tests\literature-discovery-ui.test.js
git commit -m "feat: attach pdfs to existing zotero items"
```

## Task 5: Render PDF Status And Import Mode Controls

**Files:**
- Modify: `tests/ui-localization.test.js`
- Modify: `tests/literature-discovery-ui.test.js`
- Modify: `chrome/content/researchPanel.xhtml`
- Modify: `chrome/content/paperSummary.js`

- [ ] **Step 1: Add failing UI text tests**

Add assertions for these Chinese labels:

```js
assert.match(panel, /PDF 状态/);
assert.match(panel, /仅创建 Zotero 条目/);
assert.match(panel, /创建条目并附加 PDF/);
assert.match(panel, /仅为已有条目补 PDF/);
assert.match(runtime, /pdfStatusLabel/);
assert.match(runtime, /attachment-only/);
```

- [ ] **Step 2: Run UI tests and verify failure**

```powershell
node --test tests\ui-localization.test.js tests\literature-discovery-ui.test.js
```

Expected: FAIL because the UI does not yet show explicit PDF mode controls.

- [ ] **Step 3: Update candidate rendering**

In `chrome/content/paperSummary.js`, inside candidate rendering, append compact PDF status text:

```js
appendMeta(item, "PDF 状态", candidate.pdfStatusLabel || "未发现 PDF");
if (Array.isArray(candidate.pdfSources) && candidate.pdfSources.length) {
  appendMeta(item, "PDF 来源", candidate.pdfSources.join("、"));
}
```

For each importable candidate, render explicit import mode controls:

```js
const mode = document.createElement("select");
mode.className = "zotero-import-mode";
mode.dataset.candidateId = candidate.id;
appendOption(mode, "zotero-item", "仅创建 Zotero 条目");
if (candidate.importableAttachmentIds?.length) {
  appendOption(mode, "zotero-item-plus-attachment", "创建条目并附加 PDF");
  appendOption(mode, "attachment-only", "仅为已有条目补 PDF");
}
item.appendChild(mode);
```

Update `readZoteroImportSelections()` so it reads the selected mode per candidate instead of relying only on checkbox dataset defaults.

- [ ] **Step 4: Run UI tests**

```powershell
node --test tests\ui-localization.test.js tests\literature-discovery-ui.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add chrome\content\researchPanel.xhtml chrome\content\paperSummary.js tests\ui-localization.test.js tests\literature-discovery-ui.test.js
git commit -m "feat: show pdf acquisition controls"
```

## Task 6: Document The Baseline

**Files:**
- Modify: `README.md`
- Modify: `CONTEXT.md`
- Modify: `docs/superpowers/plans/2026-05-25-pdf-acquisition-baseline.md`

- [ ] **Step 1: Update README policy**

Add a section:

```markdown
### PDF acquisition baseline

PDF acquisition is limited to approved open-access or user-authorized sources: OpenAlex, Unpaywall, Crossref direct PDF links, user-configured lawful HTTP connectors, user-selected local PDFs, and existing Zotero attachments. The Workbench does not integrate Sci-Hub, pirate libraries, paywall bypass tools, credential-sharing downloaders, or scraping-based fallback resolvers.

PDF import remains user-confirmed. The Workbench may create a Zotero item, create an item plus an approved PDF attachment, or attach an approved PDF to an existing item only through the visible Zotero Write Queue.
```

- [ ] **Step 2: Update CONTEXT policy reference**

Ensure `CONTEXT.md` references this file as the controlling PDF acquisition baseline:

```markdown
- PDF acquisition work must use `docs/superpowers/plans/2026-05-25-pdf-acquisition-baseline.md` as the baseline. Sci-Hub and similar unauthorized access services are Blocked Literature Sources, not future connector work.
```

- [ ] **Step 3: Run docs grep**

```powershell
rg -n "Sci-Hub|scihub|PDF acquisition baseline|Blocked Literature Source" README.md CONTEXT.md docs -S
```

Expected: references describe Sci-Hub only as blocked, never as an implementation target.

- [ ] **Step 4: Commit**

```powershell
git add README.md CONTEXT.md docs\superpowers\plans\2026-05-25-pdf-acquisition-baseline.md
git commit -m "docs: define pdf acquisition baseline"
```

## Final Verification

Run:

```powershell
npm run check
npm test
git diff --check
npm run package
node --test tests\package.test.js
```

Expected:

- `npm run check` exits 0.
- `npm test` exits 0.
- `git diff --check` has no whitespace errors; LF/CRLF warnings may appear on Windows.
- `npm run package` builds `dist\zotero-research-workbench-0.4.0beta1.xpi`.
- `node --test tests\package.test.js` exits 0.

## Manual QA

1. Start Zotero after installing the rebuilt XPI.
2. Open `工具 -> 打开研究工作台`.
3. Create a literature discovery plan with OpenAlex, Crossref, and Unpaywall enabled.
4. Click `确认并搜索`.
5. Confirm each candidate shows PDF status.
6. Select a candidate with an approved PDF.
7. Choose `创建条目并附加 PDF`.
8. Create the write plan and execute the Zotero Write Queue.
9. Confirm Zotero creates the item and attaches the PDF.
10. Repeat with `仅创建 Zotero 条目`.
11. Select an existing Zotero item, choose `仅为已有条目补 PDF`, and confirm only an attachment is added.
12. Confirm no UI, README text, or connector setting suggests Sci-Hub or unauthorized PDF acquisition.
