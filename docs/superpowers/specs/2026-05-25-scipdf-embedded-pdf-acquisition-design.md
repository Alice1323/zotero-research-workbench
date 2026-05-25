# Sci-PDF Embedded PDF Acquisition Design

## Goal

Embed Sci-PDF into Zotero Research Workbench as a first-class PDF acquisition source, presented through a prominent `PDF 获取` tab that matches the approved visual mockup and keeps all Zotero writes behind the existing review and write-queue gates.

## Context

The current Workbench already has a PDF acquisition baseline and a JSON Sci-Hub resolver path. The user has selected the dedicated `PDF 获取` layout from the visual companion and wants the implemented UI to preserve that effect: Sci-PDF must be easy to find, visually distinct, and comfortable to use.

Sci-PDF refers to `syt2/zotero-scipdf`, inspected at commit `af4a838` in `C:\Users\44199\.codex\tmp\zotero-scipdf-inspect`. Its useful capabilities are:

- Zotero custom PDF resolver schema with `method`, `url`, `mode`, `selector`, `attribute`, and `automatic`.
- Preset Sci-Hub base URLs.
- DOI extraction from item fields and attachment fields.
- HTML resolver behavior that requests a Sci-Hub DOI page and extracts `#pdf[src]`.
- Optional writing into Zotero's `extensions.zotero.findPDFs.resolvers`.

Sci-PDF is licensed `AGPL-3.0-or-later`. If its source is vendored or redistributed in the XPI, the Workbench package must preserve Sci-PDF license and attribution materials and document the embedded dependency.

## Product Design

Add a dedicated `PDF 获取` section to the Research Panel navigation. It should be visually prominent and operational, not a small checkbox hidden in the existing literature source list.

The first screen of the tab should have this hierarchy:

- Header: `PDF 获取`
- Supporting line: `从选中文献、发现候选或 DOI 列表生成可复核 PDF 候选`
- Primary action button: `查找 PDF 候选`
- Main source card: `Sci-PDF Embedded`
- Secondary source card: `Open Access Sources`
- Input/status strip for selected items, DOI count, and write strategy.
- Candidate list with source, attachment kind, importability, request URL/source URL, and license/provenance details.
- Bottom actions for review/write planning, with write actions visibly separate from search.

The Sci-PDF card should show:

- Enabled/disabled state.
- Editable Sci-Hub site list.
- `测试站点` action.
- Advanced `同步到 Zotero Find Full Text` option.
- A warning that Zotero resolver sync is advanced and defaults off.

The UI must keep the approved feel from `.superpowers/brainstorm/20260525-143712-scipdf-ui/content/pdf-tab-detail.html`: visible tab, green-accented Sci-PDF card, compact operational cards, and clear PDF candidate rows. It should not become a dense wall of checkboxes.

## Behavior

Sci-PDF is embedded as a vendored dependency, but its original startup hooks must not run automatically. In particular:

- Do not auto-register Sci-PDF's right-click menu.
- Do not auto-write Zotero global `extensions.zotero.findPDFs.resolvers` on plugin startup.
- Do not auto-download or auto-attach PDFs outside the Workbench flow.

The default Workbench flow is:

1. User opens `PDF 获取`.
2. User enables Sci-PDF or keeps it enabled.
3. User supplies/accepts Sci-Hub base URLs.
4. User clicks `查找 PDF 候选`.
5. Workbench extracts DOI values from selected Zotero items and current discovery candidates.
6. Workbench queries the embedded Sci-PDF HTML resolver logic.
7. The resolver returns `DocumentCandidate` records with `sci-hub-resolved-url` attachments.
8. The UI displays provenance before any Zotero write.
9. User chooses import mode.
10. Existing Zotero Write Queue performs item/attachment writes serially after explicit confirmation.

The advanced Zotero sync option may write Sci-PDF-style resolver entries into `extensions.zotero.findPDFs.resolvers`, but only after explicit user action from the `PDF 获取` tab. It must show that this affects Zotero's native Find Full Text behavior outside the Workbench queue.

## Architecture

Add a small embedded Sci-PDF boundary rather than importing Sci-PDF's whole plugin runtime.

Planned modules:

- `vendor/zotero-scipdf/`: vendored source snapshot and license/notice files.
- `src/core/scipdfEmbeddedResolver.js`: Workbench-owned adapter boundary around Sci-PDF resolver concepts. It should expose stable CommonJS/browser globals and avoid direct ztoolkit dependency.
- `src/core/literatureSourceAdapters.js`: create an adapter that calls the embedded Sci-PDF resolver and normalizes results into Workbench document candidates.
- `src/core/documentCandidateProtocol.js`: continue to keep `sci-hub-resolved-url` importability rules authoritative.
- `chrome/content/researchPanel.xhtml`: add the dedicated `PDF 获取` tab/section controls.
- `chrome/content/paperSummary.js`: render the tab, read settings, call the adapter, render PDF candidate details, and keep write planning on the existing queue path.
- `scripts/build-xpi.ps1`: package vendored dependency metadata and new runtime modules into the XPI.
- `README.md` and dependency notice docs: document the embedded Sci-PDF dependency, AGPL attribution, and the default no-auto-write behavior.

The embedded boundary should favor behavior-compatible wrapping over hard coupling to Sci-PDF's plugin lifecycle. The Workbench should be able to test resolver behavior without starting Zotero or ztoolkit.

## Data Model

Add Workbench settings/read-model fields:

- `pdfAcquisitionSources`: selected sources for the `PDF 获取` tab.
- `sciPdfEnabled`: boolean.
- `sciPdfBaseUrls`: list of base URLs or templates.
- `sciPdfSyncToZoteroFindFullText`: boolean, default false.
- `sciPdfLastSiteTest`: compact test status per URL.

Candidate attachments remain:

```js
{
  kind: "sci-hub-resolved-url",
  url: "https://...",
  importable: true,
  license: "unknown",
  provenance: {
    source: "sci-pdf",
    sourceAdapterId: "sci-hub",
    sourceUrl: "https://sci-hub.example/10.xxxx",
    requestUrl: "https://sci-hub.example/10.xxxx",
    resolverMode: "html",
    selector: "#pdf"
  }
}
```

The source label shown to the user should be `Sci-PDF / Sci-Hub` or `Sci-PDF` depending on available space. Internal source ids should remain stable and lower-case, such as `sci-pdf`.

## Error Handling

Visible errors should distinguish:

- missing DOI;
- invalid Sci-Hub URL/template;
- HTML page fetched but `#pdf` missing;
- page indicates PDF not found;
- network failure;
- unsupported response type;
- Zotero resolver sync failure.

Resolver failures should contribute to the source failure count and should not block other PDF sources. The candidate list should remain useful when Sci-PDF fails but OpenAlex/Unpaywall succeeds.

Do not store full Sci-Hub HTML or full raw third-party responses in Zotero preferences. Store compact provenance and status only.

## Licensing And Attribution

Because Sci-PDF is AGPL-3.0-or-later:

- Vendor its `LICENSE` with the source snapshot.
- Include a Workbench notice naming Sci-PDF, repository URL, inspected commit/version, and license.
- Add packaging tests that verify the license/notice files are present in the XPI.
- Do not strip copyright notices from vendored files.

This design is not legal advice. It records the engineering requirement that redistribution must preserve dependency license materials.

## Testing

Use TDD for implementation.

Focused tests should cover:

- Sci-PDF preset URL normalization into `{doi}` templates.
- DOI extraction from item-like fixtures.
- HTML `#pdf[src]` extraction for absolute, protocol-relative, root-relative, and relative URLs.
- PDF-not-found HTML detection.
- Adapter returns `sci-hub-resolved-url` candidates with provenance.
- Empty/missing Sci-PDF URL shows a visible source failure.
- `PDF 获取` labels and controls exist in XHTML/runtime.
- Candidate rows show `Sci-PDF`, `sci-hub-resolved-url`, source URL, request URL, and importability.
- Zotero resolver sync is explicit and not triggered by startup/default rendering.
- XPI includes Sci-PDF license/notice and new runtime files.

Full verification should include:

- `npm run check`
- focused node tests for new modules
- `npm test`
- `git diff --check`
- `npm run package`
- `node --test tests\package.test.js`

## Manual QA

Manual QA should stop before real Zotero writes unless explicitly approved:

1. Open `工具 -> 打开研究工作台`.
2. Confirm the `PDF 获取` tab is visible and visually prominent.
3. Confirm Sci-PDF appears as the main card.
4. Confirm default Zotero Find Full Text sync is off.
5. Enter one test Sci-Hub base URL/template.
6. Select a Zotero item with DOI.
7. Click `查找 PDF 候选`.
8. Confirm candidates show source/provenance and no write happened.
9. Confirm write actions only create or run the existing Zotero Write Queue after user confirmation.

## Out Of Scope

- CAPTCHA or Cloudflare bypass.
- Credential/cookie storage for Sci-Hub.
- Silent PDF download.
- Automatic Zotero writes.
- Replacing OpenAlex/Unpaywall/Crossref PDF discovery.
- Shipping Sci-PDF's original right-click menu as the default interaction.
