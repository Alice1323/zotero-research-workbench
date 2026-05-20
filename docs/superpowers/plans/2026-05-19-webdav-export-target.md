# WebDAV Export Target Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a manual WebDAV JSON export target for the existing redacted Workbench Local Store package.

**Architecture:** Keep URL normalization and upload request construction in Node-testable core helpers. The Zotero runtime stores WebDAV preferences, validates settings, tests the target with `PROPFIND`, and uploads the existing redacted JSON export package with `PUT`. This is not sync, import, remote directory creation, ZIP upload, or encrypted backup.

**Tech Stack:** Zotero chrome JavaScript, CommonJS core helpers, Node `node:test`, existing PowerShell XPI packaging.

---

### Task 1: Core WebDAV Helpers

**Files:**
- Modify: `src/core/index.js`
- Test: `tests/core.test.js`

- [ ] **Step 1: Write failing tests**

Add imports:

```js
buildWebDavExportRequest,
normalizeWebDavExportTarget
```

Add tests:

```js
test("WebDAV export target normalizes URL and remote directory", () => {
  const target = normalizeWebDavExportTarget({
    serverUrl: "https://dav.jianguoyun.com/dav/",
    username: "user@example.com",
    password: "app-password",
    remoteDirectory: "/zotero/workbench/"
  });

  assert.equal(target.serverUrl, "https://dav.jianguoyun.com/dav");
  assert.equal(target.remoteDirectory, "zotero/workbench");
  assert.equal(target.uploadBaseUrl, "https://dav.jianguoyun.com/dav/zotero/workbench/");
});

test("WebDAV export target requires http URL, username, and password", () => {
  assert.throws(
    () => normalizeWebDavExportTarget({ serverUrl: "ftp://example.test", username: "u", password: "p" }),
    /WebDAV 服务器地址必须是 http\(s\) URL/
  );
  assert.throws(
    () => normalizeWebDavExportTarget({ serverUrl: "https://example.test", username: "", password: "p" }),
    /请填写 WebDAV 用户名/
  );
  assert.throws(
    () => normalizeWebDavExportTarget({ serverUrl: "https://example.test", username: "u", password: "" }),
    /请填写 WebDAV 密码/
  );
});

test("WebDAV export request uploads redacted JSON package without leaking password", () => {
  const request = buildWebDavExportRequest({
    target: {
      serverUrl: "https://dav.jianguoyun.com/dav",
      username: "user@example.com",
      password: "webdav-password",
      remoteDirectory: "zotero/workbench"
    },
    snapshot: {
      schemaVersion: 1,
      providers: [{ id: "moonshot", apiKey: "sk-live-secret" }],
      promptTemplates: [],
      promptOverrides: [],
      providerProvenance: [{ password: "webdav-password" }],
      researchNoteDrafts: [],
      graphSeeds: [],
      taskLedger: []
    },
    exportedAt: "2026-05-19T10:00:00.000Z"
  });

  assert.equal(request.method, "PUT");
  assert.equal(request.url, "https://dav.jianguoyun.com/dav/zotero/workbench/zotero-research-workbench-2026-05-19T10-00-00-000Z.json");
  assert.equal(request.headers["Content-Type"], "application/json; charset=utf-8");
  assert.match(request.headers.Authorization, /^Basic /);
  assert.doesNotMatch(request.body, /webdav-password/);
  assert.match(request.body, /<redacted>/);
});
```

- [ ] **Step 2: Verify RED**

Run:

```powershell
node --test tests/core.test.js
```

Expected: failure because WebDAV helpers are not exported.

- [ ] **Step 3: Implement helpers**

Add:

```js
function normalizeWebDavExportTarget(input) { ... }
function buildWebDavExportRequest({ target, snapshot, exportedAt } = {}) { ... }
```

`buildWebDavExportRequest` must call `createWorkbenchExportPackage()` and create a Basic Authorization header. Export both helpers.

- [ ] **Step 4: Verify GREEN**

Run:

```powershell
node --test tests/core.test.js
```

Expected: all core tests pass.

### Task 2: Panel WebDAV Settings And Runtime

**Files:**
- Modify: `chrome/content/researchPanel.xhtml`
- Modify: `chrome/content/paperSummary.js`
- Test: `tests/ui-localization.test.js`

- [ ] **Step 1: Write failing UI/runtime tests**

Assert panel contains:

```text
WebDAV 导出目标
服务器地址
用户名
密码
远端目录
保存 WebDAV 设置
测试 WebDAV
上传 JSON 到 WebDAV
Nutstore/坚果云
webdav-server-url
webdav-username
webdav-password
webdav-remote-directory
webdav-save
webdav-test
webdav-upload-json
webdav-status
```

Assert runtime contains:

```text
function loadWebDavSettings
function saveWebDavSettings
function testWebDavConnection
function uploadWorkbenchJsonToWebDav
function requestWebDav
normalizeWebDavExportTarget
buildWebDavExportRequest
webdav-save").addEventListener("click", saveWebDavSettings)
webdav-test").addEventListener("click", testWebDavConnection)
webdav-upload-json").addEventListener("click", uploadWorkbenchJsonToWebDav)
```

- [ ] **Step 2: Verify RED**

Run:

```powershell
node --test tests/ui-localization.test.js
```

Expected: failure because WebDAV UI/runtime are absent.

- [ ] **Step 3: Add panel controls**

Add a compact `WebDAV 导出目标` section in the global entry area after local export/import buttons and status.

- [ ] **Step 4: Add runtime functions**

Add WebDAV prefs:

```js
webdavServerUrl
webdavUsername
webdavPassword
webdavRemoteDirectory
```

Implement runtime helpers mirroring core normalization/request construction. Use `window.fetch` for `PROPFIND` and `PUT`.

- [ ] **Step 5: Verify GREEN**

Run:

```powershell
node --test tests/ui-localization.test.js
```

Expected: UI tests pass.

### Task 3: Documentation, Verification, Package, Checkpoint

**Files:**
- Modify: `README.md`
- Append checkpoint: `C:\Users\44199\水银灯的书库\水银灯的ai库\中途路径\2026-05-18_2005_zotero-research-workbench_checkpoint.md`

- [ ] **Step 1: Update README**

Document WebDAV export target behavior and boundaries: manual JSON upload only, Nutstore-compatible, no sync/import/conflict handling, no password in exports.

- [ ] **Step 2: Run full verification**

Run:

```powershell
npm test
npm run check
npm run package
```

Expected: all pass and XPI is generated.

- [ ] **Step 3: Install and inspect active XPI**

If Zotero is not running, copy dist XPI to the active Zotero profile. Verify hashes match and XPI contains WebDAV runtime strings.

- [ ] **Step 4: Append checkpoint**

Record changed files, verification output, XPI hash, and manual Zotero UI checks still needed.
