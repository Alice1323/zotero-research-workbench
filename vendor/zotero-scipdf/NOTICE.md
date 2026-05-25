# Sci-PDF Notice

Zotero Research Workbench embeds a source snapshot from Sci-PDF.

- Upstream repository: https://github.com/syt2/zotero-scipdf
- Inspected commit: `af4a838`
- License: `AGPL-3.0-or-later`
- Vendored files: resolver schema, resolver manager reference, Sci-Hub fetcher reference, utility DOI extraction, and DOI identifier patterns.

The vendored Sci-PDF plugin lifecycle is not executed automatically. Zotero Research Workbench uses a separate Workbench-owned resolver boundary and keeps PDF attachment writes behind explicit candidate review and the Zotero Write Queue.

The optional `同步到 Zotero Find Full Text` action writes Sci-PDF-style resolver entries only after explicit user action from the `PDF 获取` tab.
