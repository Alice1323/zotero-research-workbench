# Provider Status Layered Errors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the LLM provider settings status area onto the same layered error pattern as the rest of the Zotero research workbench.

**Architecture:** Add a provider-specific technical detail drawer in the XHTML panel. The testable provider settings controller reuses the existing core `createLayeredErrorNotice` helper, while the Zotero runtime mirrors the same sanitizer locally because it runs as a browser script.

**Tech Stack:** JavaScript, Node built-in test runner, Zotero XHTML panel.

---

### Task 1: Provider Settings Controller Layered Error Tests

**Files:**
- Modify: `tests/provider-settings.test.js`
- Modify: `src/core/providerSettingsController.js`

- [ ] **Step 1: Write the failing tests**

Add tests that create fake provider error detail elements and verify:

```javascript
assert.equal(document.status.textContent, "设置保存失败，请重启 Zotero 后再试");
assert.equal(document.errorDetails.hidden, false);
assert.match(document.errorDetailText.textContent, /storage unavailable/);
assert.doesNotMatch(document.errorDetailText.textContent, /sk-test-secret/);
```

Also add a connection test failure case:

```javascript
return { ok: false, message: "API 密钥无效" };
```

Expected assertions:

```javascript
assert.equal(document.status.textContent, "API 密钥无效");
assert.equal(document.errorDetails.hidden, false);
assert.match(document.errorDetailText.textContent, /provider connection test failed/);
assert.doesNotMatch(document.errorDetailText.textContent, /sk-test-secret/);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node tests\provider-settings.test.js`

Expected: FAIL because the controller does not populate provider error detail elements.

- [ ] **Step 3: Implement controller helpers**

Import `createLayeredErrorNotice` from `./index` in `src/core/providerSettingsController.js`. Add:

```javascript
function showStatus(message) {
  fields.status.textContent = message;
  clearErrorDetails();
}

function showLayeredError(fallbackMessage, error) {
  const notice = createLayeredErrorNotice(error, fallbackMessage);
  fields.status.textContent = notice.userMessage;
  if (!fields.errorDetails || !fields.errorDetailText) {
    return;
  }
  fields.errorDetailText.textContent = notice.technicalDetail;
  fields.errorDetails.hidden = false;
}
```

Add `clearErrorDetails()` and fields for `provider-error-details` / `provider-error-detail-text`. Replace direct `fields.status.textContent = ...` writes with `showStatus(...)` or `showLayeredError(...)`.

- [ ] **Step 4: Run focused tests**

Run: `node tests\provider-settings.test.js`

Expected: PASS.

### Task 2: Provider Settings Markup and Runtime Tests

**Files:**
- Modify: `tests/ui-localization.test.js`
- Modify: `chrome/content/researchPanel.xhtml`
- Modify: `chrome/content/providerSettings.js`

- [ ] **Step 1: Write the failing markup/runtime tests**

Add assertions:

```javascript
assert.match(panel, /id="provider-error-details"/);
assert.match(panel, /id="provider-error-detail-text"/);
```

Add runtime assertions:

```javascript
assert.match(runtime, /function showLayeredError/);
assert.match(runtime, /function createLayeredErrorNotice/);
assert.match(runtime, /provider-error-details/);
assert.match(runtime, /provider connection test failed/);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node tests\ui-localization.test.js`

Expected: FAIL because provider settings has no technical details drawer and runtime helper yet.

- [ ] **Step 3: Add provider drawer markup**

In `chrome/content/researchPanel.xhtml`, below:

```xml
<p id="provider-status" aria-live="polite"></p>
```

add:

```xml
<details id="provider-error-details" class="error-details" hidden="hidden">
  <summary>技术细节</summary>
  <pre id="provider-error-detail-text"></pre>
</details>
```

Also add `class="status"` to `provider-status` for visual consistency.

- [ ] **Step 4: Add runtime helper and wiring**

In `chrome/content/providerSettings.js`, mirror the existing lightweight sanitizer from `paperSummary.js` and add `showStatus`, `showLayeredError`, and `clearErrorDetails`. Use them in save and test paths:

```javascript
showStatus("正在测试连接...");
const result = await connection.testOpenAICompatibleConnection(...);
if (result.ok) {
  showStatus(result.message);
} else {
  showLayeredError(result.message, createProviderConnectionFailure(result, settings));
}
```

Catch thrown test errors:

```javascript
showLayeredError("测试连接失败", error);
```

- [ ] **Step 5: Run focused tests**

Run: `node tests\ui-localization.test.js`

Expected: PASS.

### Task 3: Full Verification, Package, and Install

**Files:**
- Runtime artifacts under `dist/`
- Active Zotero profile XPI
- Checkpoint file under `C:\Users\44199\水银灯的书库\水银灯的ai库\中途路径`

- [ ] **Step 1: Run focused provider tests**

Run: `node tests\provider-settings.test.js`

Expected: all provider settings tests pass.

- [ ] **Step 2: Run full tests**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 3: Run syntax checks**

Run: `npm run check`

Expected: exit code 0.

- [ ] **Step 4: Build package**

Run: `npm run package`

Expected: exit code 0 and `dist/zotero-research-workbench-0.1.0.xpi` exists.

- [ ] **Step 5: Install active profile XPI**

Confirm Zotero is not running:

```powershell
tasklist /FI "IMAGENAME eq zotero.exe"
```

Then copy:

```powershell
Copy-Item -LiteralPath "dist\zotero-research-workbench-0.1.0.xpi" -Destination "C:\Users\44199\AppData\Roaming\Zotero\Zotero\Profiles\8gsk6fny.default\extensions\zotero-research-workbench@local.xpi" -Force
```

Verify both SHA256 hashes match.

- [ ] **Step 6: Append checkpoint**

Append a concise entry recording changed files, tests, package hash, active profile hash, and remaining Zotero UI manual checks.
