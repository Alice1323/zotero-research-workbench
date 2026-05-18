# Zotero 研究工作台

Zotero Research Workbench is a Zotero 8/9-only plugin for a single-paper reading workflow.

The first release is deliberately narrow:

- show a context-driven Research Panel from Zotero;
- configure an OpenAI-compatible LLM Provider;
- create Research Note Drafts before saving Confirmed Research Notes;
- record Task Ledger entries for traceability;
- capture Graph Seeds with evidence and provenance;
- export and import Workbench Local Store snapshots without Secret Material.

The user-visible interface defaults to Chinese because the first target users are in China.

This repository starts with a small, testable core and a Zotero plugin shell. The core is plain CommonJS so it can be exercised with Node tests before being wired deeper into Zotero APIs.

## Current Slice

The first implementation slice contains:

- Zotero plugin metadata and startup hooks;
- a Chinese Research Panel placeholder view;
- a static Chinese LLM Provider settings section;
- provider configuration redaction;
- in-memory Workbench Local Store;
- prompt task template rendering with a safe variable whitelist;
- task ledger and graph seed records;
- JSON export/import with secret redaction;
- Node test coverage for the core behavior.

## Commands

```powershell
npm test
npm run check
npm run package
```

The package command writes `dist/zotero-research-workbench-0.1.0.xpi`.

## Zotero Smoke Test

The XPI has been verified against Zotero `9.0.3` in an isolated temporary profile.

Manual or UI installation is still required for the active Zotero profile because Zotero marks dropped-in sideloaded XPI files as `foreignInstall` and `userDisabled` by default. In an isolated smoke profile, enabling the add-on produced:

```text
id: zotero-research-workbench@local
version: 0.1.0
active: True
userDisabled: False
appDisabled: False
```

The plugin startup hook writes a debug preference:

```text
extensions.zotero.extensions.zotero-research-workbench.lastStartup
```

Seeing that preference in the profile confirms that `bootstrap.js` loaded and `WorkbenchPlugin.startup()` ran.

## Boundaries

The project does not support Zotero 7. It does not ship a full Citation Graph UI, Visual Workflow Builder, batch processing UI, Sci-Hub provider, Google Scholar scraping, arbitrary user scripts, or live cloud sync.
