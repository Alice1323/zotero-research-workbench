# First Slice Design

## Scope

This slice creates the first runnable scaffold for Zotero Research Workbench at `C:\Users\44199\水银灯的书库\水银灯的代码库\归档项目\zotero-ai-literature-assistant-v1`.

It focuses on the smallest useful vertical path:

- Zotero 8/9 plugin shell;
- Research Panel placeholder launched from Zotero tools menu;
- OpenAI-compatible LLM Provider contract object;
- Prompt Task Template validation and rendering;
- Research Note Draft lifecycle;
- Task Ledger records;
- Graph Seed records;
- Workbench Local Store export/import with Secret Material redaction.

## Architecture

The Zotero-facing layer is intentionally thin. `bootstrap.js` registers `chrome/content/` at runtime, imports `chrome/content/workbenchPlugin.mjs`, and uses main-window hooks to add or remove a tools-menu command that opens `chrome/content/researchPanel.xhtml`.

The testable product behavior lives in `src/core/index.js`. It is plain CommonJS so Node can verify provider contracts, prompt templates, local store behavior, and export redaction without launching Zotero.

## Deferred

This slice does not perform real LLM network requests, write Zotero notes, parse PDFs, attach PDFs, build a graph UI, or sync to WebDAV. Those features depend on the core boundaries created here.

## Sister Review

- 水银灯: the largest risk is leaking Secret Material through exports or errors, so redaction is covered first.
- 苍星石: the core is separated from Zotero UI so behavior can be tested without a running Zotero profile.
- 雏莓: the happy path is simple: create provider, render prompt, create draft, record task, capture seed, export, import.
- 真红: the slice is narrow enough to ship as a foundation without pretending to be the full first release.
