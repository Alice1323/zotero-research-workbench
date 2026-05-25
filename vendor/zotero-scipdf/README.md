# Vendored Sci-PDF Snapshot

This directory contains a source snapshot from `syt2/zotero-scipdf`, inspected at commit `af4a838`.

Sci-PDF is licensed `AGPL-3.0-or-later`. The upstream license is preserved in `LICENSE`, and the Workbench redistribution notice is preserved in `NOTICE.md`.

The Workbench does not execute Sci-PDF's Zotero plugin startup lifecycle from this directory. The files are retained as an embedded dependency source snapshot and as the behavior reference for the Workbench-owned runtime boundary in `src/core/scipdfEmbeddedResolver.js`.

Runtime behavior imported into the Workbench:

- Sci-Hub resolver schema with `method`, `url`, `mode`, `selector`, `attribute`, and `automatic`.
- Preset Sci-Hub base URLs.
- DOI extraction patterns.
- HTML resolver behavior that reads `#pdf[src]`.
- Explicit resolver preference shape for Zotero Find Full Text sync.

Runtime behavior not imported automatically:

- Sci-PDF right-click menu registration.
- Startup writes to `extensions.zotero.findPDFs.resolvers`.
- Direct attachment import outside the Workbench review and write queue.
