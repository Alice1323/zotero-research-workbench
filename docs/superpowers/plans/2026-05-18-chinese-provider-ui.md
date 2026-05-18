# Chinese Provider UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the current Zotero Research Workbench shell Chinese-first and expose a static LLM Provider settings area.

**Architecture:** Keep the slice UI-only. User-visible strings live in `manifest.json`, `chrome/content/workbenchPlugin.mjs`, and `chrome/content/researchPanel.xhtml`; behavior remains unchanged until the next provider persistence slice.

**Tech Stack:** Zotero manifest v2, Zotero bootstrap plugin shell, XHTML, Node `node:test`.

---

### Task 1: Chinese UI Coverage

**Files:**
- Create: `tests/ui-localization.test.js`

- [x] **Step 1: Write failing tests**

Assert that `manifest.json` uses `Zotero 研究工作台`, the menu label is `打开研究工作台`, and `researchPanel.xhtml` contains Chinese labels for `LLM 服务商设置`, `接口地址`, `API 密钥`, `模型名称`, `保存设置`, and `测试连接`.

- [x] **Step 2: Run test and verify RED**

Run:

```powershell
npm test
```

Expected before implementation: fail because the UI is still English.

### Task 2: Chinese Static UI

**Files:**
- Modify: `manifest.json`
- Modify: `chrome/content/workbenchPlugin.mjs`
- Modify: `chrome/content/researchPanel.xhtml`
- Modify: `README.md`

- [x] **Step 1: Implement Chinese strings**

Change plugin name, description, menu label, window title, panel sections, and Provider settings labels to Chinese.

- [x] **Step 2: Keep API key hidden**

Use `<input type="password" />` for `API 密钥`.

- [x] **Step 3: Run GREEN verification**

Run:

```powershell
npm test
npm run check
npm run package
```

Expected: all pass.

- [x] **Step 4: Replace installed active-profile XPI**

Copy `dist/zotero-research-workbench-0.1.0.xpi` to the active profile extension package path:

```powershell
Copy-Item -LiteralPath dist\zotero-research-workbench-0.1.0.xpi -Destination "$env:APPDATA\Zotero\Zotero\Profiles\8gsk6fny.default\extensions\zotero-research-workbench@local.xpi" -Force
```

- [x] **Step 5: Verify installed package content**

Extract `manifest.json` and `chrome/content/researchPanel.xhtml` from the installed XPI and confirm the Chinese strings are present.
