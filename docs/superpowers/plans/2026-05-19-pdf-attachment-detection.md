# PDF Attachment Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display the current Zotero item's existing PDF attachment status in the Research Panel.

**Architecture:** Add a pure core normalization helper for attachment candidates, then mirror its small runtime logic where Zotero APIs are available. The panel remains read-only and only displays the detected attachment summary.

**Tech Stack:** Zotero plugin XHTML/JavaScript, CommonJS core module tests, Node `node:test`, PowerShell XPI packaging.

---

## File Structure

- Modify `src/core/paperSummary.js` to add `selectBestPdfAttachment`.
- Modify `tests/paper-summary.test.js` to cover PDF detection behavior.
- Modify `chrome/content/researchPanel.xhtml` to add `selected-paper-pdf`.
- Modify `chrome/content/paperSummary.js` to detect Zotero child PDF attachments and render status.
- Modify `tests/ui-localization.test.js` to assert PDF status UI and runtime wiring.
- Modify `README.md` to document the read-only PDF attachment status.

### Task 1: Tests First

- [ ] Add `selectBestPdfAttachment` tests for PDF content type, `.pdf` path fallback, and no-PDF result.
- [ ] Add UI localization assertions for `PDF 附件` and `id="selected-paper-pdf"`.
- [ ] Add runtime wiring assertions for `readSelectedPaperPdfAttachment` and `renderPaperPdfAttachment`.
- [ ] Run targeted tests and confirm they fail before implementation.

### Task 2: Core Helper

- [ ] Implement `selectBestPdfAttachment(attachments)`.
- [ ] Export it from `src/core/paperSummary.js`.
- [ ] Keep output shape stable: `{ available, title, path, contentType }`.

### Task 3: Runtime Detection And UI

- [ ] Add `selected-paper-pdf` line to the selected-paper context block.
- [ ] Read child attachments from the selected Zotero item.
- [ ] Normalize attachment title/path/content type.
- [ ] Attach `pdfAttachment` to selected paper context.
- [ ] Render `PDF 附件：<path or title>` or `PDF 附件：未找到 PDF 附件`.

### Task 4: Docs, Verification, Package, Install

- [ ] Update README with PDF attachment status behavior.
- [ ] Run `node tests\paper-summary.test.js`.
- [ ] Run `node tests\ui-localization.test.js`.
- [ ] Run `npm test`.
- [ ] Run `npm run check`.
- [ ] Run `npm run package`.
- [ ] If Zotero is closed, install the XPI and verify hashes.
- [ ] Append a checkpoint under `C:\Users\44199\水银灯的书库\水银灯的ai库\中途路径`.
