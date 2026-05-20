# PDF Attachment Detection Design

## Goal

Show whether the currently selected Zotero item has an existing PDF attachment, and expose the best available local path/title in the Research Panel.

## Scope

- Detect existing child attachments from the selected Zotero item.
- Treat an attachment as PDF when its content type is `application/pdf` or its path/title ends in `.pdf`.
- Prefer the first PDF attachment with a local path.
- Display PDF status near the selected-paper metadata:
  - no selected item
  - no PDF attachment
  - PDF attachment found
- Keep this read-only. Do not download PDFs, attach files, or extract PDF text in this slice.

## Non-Goals

- No user-selected PDF picker.
- No allowed download flow.
- No PDF text extraction.
- No note/attachment writes to Zotero.
- No persistence into Workbench Local Store yet.

## Data Flow

When the selected-paper context is refreshed, the runtime reads the selected regular Zotero item. It normalizes the paper metadata as before, then inspects child attachments through Zotero APIs and attaches a `pdfAttachment` summary to the paper object.

`renderPaperContext` displays the PDF status line. If a path exists, it displays the path. If only a title exists, it displays the title. If no PDF is detected, it displays `未找到 PDF 附件`.

## Attachment Shape

Core helper output:

```json
{
  "available": true,
  "title": "paper.pdf",
  "path": "C:\\path\\paper.pdf",
  "contentType": "application/pdf"
}
```

If unavailable:

```json
{
  "available": false,
  "title": "",
  "path": "",
  "contentType": ""
}
```

## Error Handling

PDF detection failures should not block reading selected-paper metadata. Runtime catches detection errors, sets `pdfAttachment.available = false`, and sends details to `paper-summary-status` layered errors only when the refresh action itself fails unexpectedly.

## Tests

- Core helper selects the first PDF attachment with a path.
- Core helper treats `.pdf` paths as PDF even when content type is missing.
- Core helper returns unavailable when no PDF exists.
- UI localization confirms the PDF status line and element ID.
- Runtime wiring confirms selected-paper rendering updates `selected-paper-pdf`.
