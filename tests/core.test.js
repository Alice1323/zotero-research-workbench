const test = require("node:test");
const assert = require("node:assert/strict");

const core = require("../src/core");
const {
  SECRET_PLACEHOLDER,
  WorkbenchLocalStoreTransaction,
  WorkbenchLocalStore,
  buildWebDavDirectoryRequests,
  buildWebDavExportRequest,
  createLayeredErrorNotice,
  createOpenAICompatibleProvider,
  createPromptTaskTemplate,
  createWorkbenchExportPackage,
  createWorkbenchZipExportPayload,
  importWorkbenchExportPackage,
  importWorkbenchZipExportPayload,
  normalizeWebDavExportTarget,
  redactSecretMaterial,
  resolvePromptTemplate,
  renderPrompt
} = core;

test("OpenAI-compatible provider exposes contract fields and keeps secret material local", () => {
  const provider = createOpenAICompatibleProvider({
    id: "local-openai",
    baseUrl: "https://api.example.test/v1",
    model: "model-a",
    apiKey: "sk-live-secret",
    headers: {
      Authorization: "Bearer token-secret"
    }
  });

  assert.equal(provider.capability, "llm");
  assert.equal(provider.networkPermissions[0], "https://api.example.test");
  assert.deepEqual(provider.authRequirements, ["apiKey"]);

  const exported = redactSecretMaterial(provider);
  assert.equal(exported.apiKey, SECRET_PLACEHOLDER);
  assert.equal(exported.headers.Authorization, SECRET_PLACEHOLDER);
});

test("OpenAI-compatible provider preserves custom timeout, rate, and usage limits", () => {
  const provider = createOpenAICompatibleProvider({
    id: "local-openai",
    baseUrl: "https://api.example.test/v1",
    model: "model-a",
    apiKey: "sk-live-secret",
    timeoutMs: 45000,
    requestsPerMinute: 60,
    maxInputTokensPerTask: 32000
  });

  assert.equal(provider.timeoutMs, 45000);
  assert.deepEqual(provider.rateLimitPolicy, { requestsPerMinute: 60 });
  assert.deepEqual(provider.usageLimit, { maxInputTokensPerTask: 32000 });
});

test("prompt task templates reject variables outside the safe whitelist", () => {
  assert.throws(
    () =>
      createPromptTaskTemplate({
        id: "unsafe",
        purpose: "Unsafe template",
        requiredContext: ["selectedText"],
        template: "Summarize {{selectedText}} and {{apiKey}}",
        outputExpectation: "short note",
        defaultProviderCapability: "llm",
        version: "1.0.0"
      }),
    /apiKey is not allowed/
  );
});

test("renderPrompt substitutes only declared reading context", () => {
  const prompt = renderPrompt(
    {
      id: "single-paper-summary",
      purpose: "Create a research note draft",
      requiredContext: ["selectedText", "itemTitle"],
      template: "Title: {{itemTitle}}\nSelection: {{selectedText}}",
      outputExpectation: "research note draft",
      defaultProviderCapability: "llm",
      version: "1.0.0"
    },
    {
      itemTitle: "Example Paper",
      selectedText: "A relevant passage."
    }
  );

  assert.equal(prompt, "Title: Example Paper\nSelection: A relevant passage.");
});

test("prompt overrides replace built-in templates and reject unsafe variables", () => {
  const snapshot = { promptOverrides: [] };
  assert.equal(core.upsertPromptOverride, undefined);
  assert.equal(core.removePromptOverride, undefined);
  const next = WorkbenchLocalStoreTransaction.upsertPromptOverrideTransaction({
    snapshot,
    overrideInput: {
      templateId: "single-paper-chinese-summary",
      template: "请只输出标题：{{itemTitle}}\n摘要：{{abstract}}"
    },
    updatedAt: "2026-05-21T00:04:30.000Z"
  }).snapshot;

  assert.deepEqual(snapshot.promptOverrides, []);
  assert.equal(next.promptOverrides.length, 1);
  assert.equal(next.promptOverrides[0].templateId, "single-paper-chinese-summary");

  const resolved = resolvePromptTemplate("single-paper-chinese-summary", next.promptOverrides);
  assert.equal(resolved.template, "请只输出标题：{{itemTitle}}\n摘要：{{abstract}}");
  assert.equal(
    renderPrompt(resolved, {
      itemTitle: "Example Paper",
      abstract: "A relevant abstract."
    }),
    "请只输出标题：Example Paper\n摘要：A relevant abstract."
  );

  assert.throws(
    () =>
      WorkbenchLocalStoreTransaction.upsertPromptOverrideTransaction({
        snapshot,
        overrideInput: {
          templateId: "single-paper-chinese-summary",
          template: "泄露 {{apiKey}}"
        },
        updatedAt: "2026-05-21T00:04:35.000Z"
      }),
    /apiKey is not allowed/
  );

  const reset = WorkbenchLocalStoreTransaction.removePromptOverrideTransaction({
    snapshot: next,
    templateId: "single-paper-chinese-summary",
    updatedAt: "2026-05-21T00:04:45.000Z"
  }).snapshot;
  assert.deepEqual(reset.promptOverrides, []);
  assert.notEqual(
    resolvePromptTemplate("single-paper-chinese-summary", reset.promptOverrides).template,
    "请只输出标题：{{itemTitle}}\n摘要：{{abstract}}"
  );
});

test("local store preserves drafts, task ledger, graph seeds, and redacts exports", () => {
  const store = new WorkbenchLocalStore();
  const provider = createOpenAICompatibleProvider({
    id: "local-openai",
    baseUrl: "https://api.example.test/v1",
    model: "model-a",
    apiKey: "sk-live-secret"
  });

  store.upsertProvider(provider);
  store.upsertPromptTemplate({
    id: "single-paper-summary",
    purpose: "Create a research note draft",
    requiredContext: ["selectedText"],
    template: "Summarize {{selectedText}}",
    outputExpectation: "research note draft",
    defaultProviderCapability: "llm",
    version: "1.0.0"
  });

  const draft = store.createResearchNoteDraft({
    zoteroItemKey: "ABCD1234",
    workId: "work:doi:10.1000/example",
    title: "Example Paper summary",
    content: "Draft content",
    promptTaskTemplateId: "single-paper-summary",
    llmProviderId: "local-openai",
    inputContext: { selectedText: "A relevant passage." },
    provenance: { providerId: "local-openai" }
  });

  store.confirmResearchNoteDraft(draft.id, "NOTE1234");

  store.recordTask({
    workflowStep: "create-research-note-draft",
    state: "completed",
    providerId: "local-openai",
    promptTaskTemplateId: "single-paper-summary",
    outputLocation: { draftId: draft.id }
  });

  store.captureGraphSeed({
    workId: "work:doi:10.1000/example",
    relationType: "cites",
    target: { doi: "10.1000/target" },
    evidence: { source: "selected-text", text: "Prior work..." },
    providerId: "local-openai",
    confidence: "medium",
    seedKind: "ai-inferred"
  });

  const snapshot = store.exportSnapshot();
  assert.equal(snapshot.providers[0].apiKey, SECRET_PLACEHOLDER);
  assert.equal(snapshot.researchNoteDrafts[0].confirmationState, "confirmed");
  assert.equal(snapshot.graphSeeds[0].relationType, "cites");
  assert.deepEqual(snapshot.citationRelations, []);
  assert.equal(snapshot.taskLedger[0].workflowStep, "create-research-note-draft");

  const restored = new WorkbenchLocalStore(snapshot);
  assert.equal(restored.researchNoteDrafts.length, 1);
  assert.equal(restored.graphSeeds.length, 1);
  assert.deepEqual(restored.citationRelations, []);
  assert.equal(restored.taskLedger.length, 1);
});

test("workbench export package redacts secrets and imports restorable snapshot state", () => {
  const snapshot = {
    schemaVersion: 1,
    exportedAt: "2026-05-18T12:00:00.000Z",
    providers: [
      {
        id: "moonshot",
        capability: "llm",
        baseUrl: "https://api.example.test/v1",
        model: "moonshot-v1",
        apiKey: "sk-live-secret",
        headers: {
          Authorization: "Bearer token-secret"
        },
        provenance: {
          providerKind: "openai-compatible",
          configuredAt: "2026-05-18T10:00:00.000Z"
        }
      }
    ],
    promptTemplates: [
      {
        id: "single-paper-summary",
        purpose: "Create a research note draft",
        requiredContext: ["selectedText"],
        template: "Summarize {{selectedText}}",
        outputExpectation: "research note draft",
        defaultProviderCapability: "llm",
        version: "1.0.0"
      }
    ],
    promptOverrides: [
      {
        templateId: "single-paper-summary",
        template: "请总结 {{selectedText}}"
      }
    ],
    providerProvenance: [
      {
        providerId: "moonshot",
        source: "user-configured",
        password: "webdav-secret"
      }
    ],
    researchNoteDrafts: [
      {
        id: "draft-a",
        title: "Example - 中文总结",
        content: "内容",
        promptTaskTemplateId: "single-paper-summary",
        llmProviderId: "moonshot",
        confirmationState: "draft"
      }
    ],
    graphSeeds: [
      {
        id: "seed-a",
        workId: "work:doi:10.1000/example",
        relationType: "related",
        target: { text: "Target work" }
      }
    ],
    citationRelations: [
      {
        id: "citation-relation-seed-a",
        graphSeedId: "seed-a",
        relationType: "related"
      }
    ],
    taskLedger: [
      {
        id: "task-a",
        workflowStep: "create-research-note-draft",
        state: "failed",
        errorNotice: {
          message: "Provider failed",
          token: "runtime-token"
        }
      }
    ]
  };

  const exported = createWorkbenchExportPackage({
    snapshot,
    exportedAt: "2026-05-18T13:00:00.000Z"
  });

  assert.equal(exported.packageKind, "zotero-research-workbench-export");
  assert.equal(exported.packageVersion, 1);
  assert.equal(exported.exportedAt, "2026-05-18T13:00:00.000Z");
  assert.equal(exported.snapshot.exportedAt, "2026-05-18T13:00:00.000Z");
  assert.equal(exported.snapshot.providers[0].apiKey, SECRET_PLACEHOLDER);
  assert.equal(exported.snapshot.providers[0].headers.Authorization, SECRET_PLACEHOLDER);
  assert.equal(exported.snapshot.providerProvenance[0].password, SECRET_PLACEHOLDER);
  assert.equal(exported.snapshot.taskLedger[0].errorNotice.token, SECRET_PLACEHOLDER);
  assert.equal(exported.snapshot.promptOverrides[0].template, "请总结 {{selectedText}}");

  const restored = importWorkbenchExportPackage(JSON.stringify(exported));
  assert.equal(restored.schemaVersion, 1);
  assert.equal(restored.researchNoteDrafts[0].id, "draft-a");
  assert.equal(restored.graphSeeds[0].id, "seed-a");
  assert.deepEqual(restored.citationRelations, [
    {
      id: "citation-relation-seed-a",
      graphSeedId: "seed-a",
      relationType: "related"
    }
  ]);
  assert.equal(restored.taskLedger[0].workflowStep, "create-research-note-draft");
  assert.equal(restored.providers[0].apiKey, SECRET_PLACEHOLDER);
});

test("workbench ZIP payload wraps redacted JSON export files", () => {
  const snapshot = {
    schemaVersion: 1,
    exportedAt: "2026-05-19T09:00:00.000Z",
    providers: [
      {
        id: "moonshot",
        capability: "llm",
        baseUrl: "https://api.example.test/v1",
        model: "moonshot-v1",
        apiKey: "sk-live-secret"
      }
    ],
    promptTemplates: [],
    promptOverrides: [],
    providerProvenance: [{ providerId: "moonshot", password: "webdav-secret" }],
    researchNoteDrafts: [{ id: "draft-a", title: "Draft A" }],
    graphSeeds: [{ id: "seed-a", target: { text: "Target" } }],
    citationRelations: [{ id: "citation-relation-seed-a", graphSeedId: "seed-a" }],
    taskLedger: [{ id: "task-a", errorNotice: { token: "runtime-token" } }]
  };

  const payload = createWorkbenchZipExportPayload({
    snapshot,
    exportedAt: "2026-05-19T10:00:00.000Z"
  });

  assert.equal(payload.packageKind, "zotero-research-workbench-zip-export");
  assert.equal(payload.packageVersion, 1);
  assert.deepEqual(Object.keys(payload.files).sort(), ["manifest.json", "snapshot.json"]);
  assert.equal(payload.files["manifest.json"].packageKind, "zotero-research-workbench-zip-export");
  assert.equal(payload.files["manifest.json"].snapshotPath, "snapshot.json");
  assert.equal(payload.files["snapshot.json"].packageKind, "zotero-research-workbench-export");
  assert.equal(payload.files["snapshot.json"].snapshot.providers[0].apiKey, SECRET_PLACEHOLDER);
  assert.equal(payload.files["snapshot.json"].snapshot.providerProvenance[0].password, SECRET_PLACEHOLDER);
  assert.equal(payload.files["snapshot.json"].snapshot.citationRelations[0].id, "citation-relation-seed-a");
  assert.equal(payload.files["snapshot.json"].snapshot.taskLedger[0].errorNotice.token, SECRET_PLACEHOLDER);
});

test("workbench ZIP payload imports through the existing JSON package validator", () => {
  const payload = createWorkbenchZipExportPayload({
    snapshot: {
      schemaVersion: 1,
      exportedAt: "2026-05-19T09:00:00.000Z",
      providers: [],
      promptTemplates: [],
      promptOverrides: [],
      providerProvenance: [],
      researchNoteDrafts: [{ id: "draft-a", title: "Draft A" }],
      graphSeeds: [{ id: "seed-a", target: { text: "Target" } }],
      citationRelations: [{ id: "citation-relation-seed-a", graphSeedId: "seed-a" }],
      taskLedger: [{ id: "task-a", workflowStep: "review-graph-seed" }]
    },
    exportedAt: "2026-05-19T10:00:00.000Z"
  });

  const restored = importWorkbenchZipExportPayload(payload);

  assert.equal(restored.researchNoteDrafts[0].id, "draft-a");
  assert.equal(restored.graphSeeds[0].id, "seed-a");
  assert.equal(restored.citationRelations[0].id, "citation-relation-seed-a");
  assert.equal(restored.taskLedger[0].workflowStep, "review-graph-seed");
});

test("workbench ZIP payload requires snapshot.json", () => {
  assert.throws(
    () =>
      importWorkbenchZipExportPayload({
        packageKind: "zotero-research-workbench-zip-export",
        packageVersion: 1,
        files: {
          "manifest.json": {
            packageKind: "zotero-research-workbench-zip-export",
            packageVersion: 1,
            snapshotPath: "snapshot.json"
          }
        }
      }),
    /ZIP 导出包缺少 snapshot\.json/
  );
});

test("WebDAV export target normalizes URL and remote directory", () => {
  const target = normalizeWebDavExportTarget({
    serverUrl: "https://dav.jianguoyun.com/dav/",
    username: "user@example.com",
    password: "app-password",
    remoteDirectory: "/zotero/workbench/"
  });

  assert.equal(target.serverUrl, "https://dav.jianguoyun.com/dav");
  assert.equal(target.username, "user@example.com");
  assert.equal(target.password, "app-password");
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
      exportedAt: "2026-05-19T09:00:00.000Z",
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
  assert.equal(
    request.url,
    "https://dav.jianguoyun.com/dav/zotero/workbench/zotero-research-workbench-2026-05-19T10-00-00-000Z.json"
  );
  assert.equal(request.filename, "zotero-research-workbench-2026-05-19T10-00-00-000Z.json");
  assert.equal(request.headers["Content-Type"], "application/json; charset=utf-8");
  assert.match(request.headers.Authorization, /^Basic /);
  assert.doesNotMatch(request.headers.Authorization, /webdav-password/);
  assert.doesNotMatch(request.body, /webdav-password/);
  assert.doesNotMatch(request.body, /sk-live-secret/);
  assert.match(request.body, /<redacted>/);
  assert.match(request.body, /zotero-research-workbench-export/);
});

test("WebDAV directory requests create remote directory parents before upload", () => {
  const requests = buildWebDavDirectoryRequests({
    serverUrl: "https://dav.jianguoyun.com/dav/",
    username: "user@example.com",
    password: "webdav-password",
    remoteDirectory: "/zotero/workbench/"
  });

  assert.equal(requests.length, 2);
  assert.deepEqual(
    requests.map((request) => [request.method, request.url]),
    [
      ["MKCOL", "https://dav.jianguoyun.com/dav/zotero/"],
      ["MKCOL", "https://dav.jianguoyun.com/dav/zotero/workbench/"]
    ]
  );
  assert.match(requests[0].headers.Authorization, /^Basic /);
  assert.doesNotMatch(requests[0].headers.Authorization, /webdav-password/);
});

test("layered error notice keeps user message concise and redacts technical detail", () => {
  const error = new Error("请求失败 Authorization: Bearer live-token sk-live-secret");
  error.stack = "Error: 请求失败\n    at request (paperSummary.js:10:5)\n    password=webdav-password";
  error.context = {
    apiKey: "sk-live-secret",
    password: "webdav-password",
    token: "runtime-token",
    nested: {
      Authorization: "Bearer live-token",
      harmless: "HTTP 500"
    }
  };

  const notice = createLayeredErrorNotice(error, "总结生成失败");

  assert.equal(notice.userMessage, "请求失败 Authorization: Bearer <redacted> <redacted>");
  assert.match(notice.technicalDetail, /HTTP 500/);
  assert.match(notice.technicalDetail, /<redacted>/);
  assert.doesNotMatch(notice.technicalDetail, /live-token/);
  assert.doesNotMatch(notice.technicalDetail, /sk-live-secret/);
  assert.doesNotMatch(notice.technicalDetail, /webdav-password/);
  assert.doesNotMatch(notice.technicalDetail, /runtime-token/);
});

test("layered error notice keeps non-secret token budget metadata visible", () => {
  const error = new Error("输入内容超过单任务 Token 上限");
  error.name = "LlmRuntimeGuardError";
  error.taskType = "reading-context-chinese-translation";
  error.estimatedTokens = 1297;
  error.maxInputTokensPerTask = 1000;
  error.apiKey = "sk-live-secret";

  const notice = createLayeredErrorNotice(error, "总结生成失败");

  assert.match(notice.technicalDetail, /"estimatedTokens": 1297/);
  assert.match(notice.technicalDetail, /"maxInputTokensPerTask": 1000/);
  assert.match(notice.technicalDetail, /"apiKey": "<redacted>"/);
  assert.doesNotMatch(notice.technicalDetail, /sk-live-secret/);
});
