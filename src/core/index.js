const {
  SECRET_PLACEHOLDER,
  createWorkbenchExportPackage,
  createWorkbenchZipExportPayload,
  importWorkbenchExportPackage,
  importWorkbenchZipExportPayload,
  redactSecretMaterial
} = require("./workbenchSnapshot");
const WorkbenchLocalStoreTransaction = require("./workbenchLocalStoreTransaction");
const WorkbenchGraphReviewWorkflow = require("./graphReviewWorkflow");
const WorkbenchResearchPanelOrchestrator = require("./researchPanelOrchestrator");
const WorkbenchResearchTopic = require("./researchTopic");
const WorkbenchDocumentCandidateProtocol = require("./documentCandidateProtocol");
const WorkbenchDocumentCandidateReview = require("./documentCandidateReview");
const WorkbenchLiteratureDiscovery = require("./literatureDiscovery");
const WorkbenchLiteratureSourceAdapters = require("./literatureSourceAdapters");
const WorkbenchProviderRequestPolicy = require("./providerRequestPolicy");
const WorkbenchAiTaskWorkspace = require("./aiTaskWorkspace");

const SAFE_TEMPLATE_VARIABLES = new Set([
  "selectedText",
  "itemTitle",
  "itemAuthors",
  "abstract",
  "year",
  "publicationTitle",
  "doi",
  "source",
  "pageLabel",
  "noteContent",
  "pdfPageText",
  "graphSeedsSummary",
  "paperCandidatesSummary",
  "userQuery"
]);

const PROVIDER_NUMERIC_DEFAULTS = {
  timeoutMs: { defaultValue: 15000, min: 1000, max: 120000 },
  requestsPerMinute: { defaultValue: 20, min: 1, max: 600 },
  maxInputTokensPerTask: { defaultValue: 12000, min: 1000, max: 200000 }
};

const BUILT_IN_PROMPT_TEMPLATES = {
  "single-paper-chinese-summary": {
    id: "single-paper-chinese-summary",
    title: "单篇文献中文总结",
    purpose: "Create a structured Chinese research note draft for one Zotero item",
    requiredContext: ["itemTitle", "abstract"],
    template: [
      "请用中文为下面这篇 Zotero 文献生成研究阅读摘要。",
      "",
      "输出格式必须包含以下小标题：",
      "1. 研究问题",
      "2. 研究方法",
      "3. 主要发现",
      "4. 局限性",
      "5. 对后续阅读的建议",
      "",
      "文献信息：",
      "标题：{{itemTitle}}",
      "作者：{{itemAuthors}}",
      "年份：{{year}}",
      "期刊/来源：{{publicationTitle}}",
      "DOI：{{doi}}",
      "摘要：{{abstract}}",
      "",
      "要求：不要编造摘要中没有的信息；如果信息不足，请明确写出“原始记录未提供”。"
    ].join("\n"),
    outputExpectation: "structured Chinese research reading summary",
    defaultProviderCapability: "llm",
    version: "1.0.0",
    outputLanguageStrategy: "zh-CN"
  },
  "reading-context-chinese-translation": {
    id: "reading-context-chinese-translation",
    title: "阅读上下文中文翻译",
    purpose: "Translate selected Zotero Reader text into Chinese",
    requiredContext: ["selectedText"],
    template: [
      "请将下面的 Zotero 阅读器选中文本翻译成中文。",
      "",
      "要求：",
      "1. 忠实保留原意，不扩写、不总结。",
      "2. 专业术语使用中文学术表达；没有通用中文译法的术语保留英文。",
      "3. 保留段落结构。",
      "4. 只输出译文，不要添加解释。",
      "",
      "上下文信息：",
      "来源：{{source}}",
      "页码：{{pageLabel}}",
      "",
      "选中文本：",
      "{{selectedText}}"
    ].join("\n"),
    outputExpectation: "faithful Chinese translation",
    defaultProviderCapability: "llm",
    version: "1.0.0",
    outputLanguageStrategy: "zh-CN"
  }
};

function createOpenAICompatibleProvider(config) {
  const required = ["id", "baseUrl", "model"];
  for (const field of required) {
    if (!config || typeof config[field] !== "string" || config[field].trim() === "") {
      throw new Error(`Provider ${field} is required`);
    }
  }

  const timeoutMs = normalizeProviderNumber(config.timeoutMs, PROVIDER_NUMERIC_DEFAULTS.timeoutMs);
  const requestsPerMinute = normalizeProviderNumber(
    config.rateLimitPolicy?.requestsPerMinute ?? config.requestsPerMinute,
    PROVIDER_NUMERIC_DEFAULTS.requestsPerMinute
  );
  const maxInputTokensPerTask = normalizeProviderNumber(
    config.usageLimit?.maxInputTokensPerTask ?? config.maxInputTokensPerTask,
    PROVIDER_NUMERIC_DEFAULTS.maxInputTokensPerTask
  );

  return {
    id: config.id,
    capability: "llm",
    baseUrl: config.baseUrl,
    model: config.model,
    apiKey: config.apiKey || "",
    headers: config.headers || {},
    timeoutMs,
    rateLimitPolicy: { ...(config.rateLimitPolicy || {}), requestsPerMinute },
    usageLimit: { ...(config.usageLimit || {}), maxInputTokensPerTask },
    networkPermissions: [new URL(config.baseUrl).origin],
    authRequirements: ["apiKey"],
    failureModes: ["network-error", "auth-error", "rate-limited", "invalid-response"],
    provenance: {
      providerKind: "openai-compatible",
      configuredAt: config.configuredAt || new Date().toISOString()
    }
  };
}

function normalizeProviderNumber(value, rule) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return rule.defaultValue;
  }
  return Math.min(rule.max, Math.max(rule.min, Math.round(numeric)));
}

function createLayeredErrorNotice(error, fallbackMessage = "操作失败") {
  const rawUserMessage = cleanString(error?.userMessage) || cleanString(error?.message) || cleanString(fallbackMessage) || "操作失败";
  const userMessage = sanitizeSecretText(rawUserMessage) || cleanString(fallbackMessage) || "操作失败";
  const technicalDetail = sanitizeSecretText(formatTechnicalErrorDetail(error) || rawUserMessage).slice(0, 4000);
  return {
    userMessage,
    technicalDetail
  };
}

function formatTechnicalErrorDetail(error) {
  if (error === undefined || error === null) {
    return "";
  }
  if (typeof error !== "object") {
    return String(error);
  }

  const parts = [];
  if (cleanString(error.technicalDetail)) {
    parts.push(error.technicalDetail);
  }
  if (error.name) {
    parts.push(`name: ${error.name}`);
  }
  if (error.message) {
    parts.push(`message: ${error.message}`);
  }
  if (error.stack) {
    parts.push(`stack:\n${error.stack}`);
  }

  const metadata = {};
  for (const key of Object.keys(error)) {
    if (key === "technicalDetail") {
      continue;
    }
    metadata[key] = error[key];
  }
  if (Object.keys(metadata).length) {
    parts.push(`metadata:\n${safeStringify(redactSecretMaterial(metadata))}`);
  }

  return parts.join("\n\n");
}

function sanitizeSecretText(value) {
  return String(value)
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, `$1${SECRET_PLACEHOLDER}`)
    .replace(/\b(Basic\s+)[A-Za-z0-9+/=]+/gi, `$1${SECRET_PLACEHOLDER}`)
    .replace(/\bsk-[A-Za-z0-9._-]+/g, SECRET_PLACEHOLDER)
    .replace(/\b(apiKey|password|token|secret)\b\s*([:=])\s*("[^"]*"|'[^']*'|[^\s,;]+)/gi, (_match, key, separator) => {
      return `${key}${separator}${SECRET_PLACEHOLDER}`;
    });
}

function safeStringify(value) {
  const seen = new WeakSet();
  return JSON.stringify(
    value,
    (_key, entry) => {
      if (!entry || typeof entry !== "object") {
        return entry;
      }
      if (seen.has(entry)) {
        return "[Circular]";
      }
      seen.add(entry);
      return entry;
    },
    2
  );
}

function createPromptTaskTemplate(template) {
  const required = [
    "id",
    "purpose",
    "requiredContext",
    "template",
    "outputExpectation",
    "defaultProviderCapability",
    "version"
  ];

  for (const field of required) {
    if (!template || template[field] === undefined || template[field] === "") {
      throw new Error(`Prompt task template ${field} is required`);
    }
  }

  const variables = extractTemplateVariables(template.template);
  for (const variable of variables) {
    if (!SAFE_TEMPLATE_VARIABLES.has(variable)) {
      throw new Error(`Template variable ${variable} is not allowed`);
    }
  }

  return {
    ...template,
    requiredContext: [...template.requiredContext],
    outputLanguageStrategy: template.outputLanguageStrategy || "follow-ui-language",
    variables
  };
}

function renderPrompt(template, context) {
  const promptTaskTemplate = createPromptTaskTemplate(template);
  for (const field of promptTaskTemplate.requiredContext) {
    if (context[field] === undefined || context[field] === null || context[field] === "") {
      throw new Error(`Missing required context: ${field}`);
    }
  }

  return promptTaskTemplate.template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, name) => {
    if (!SAFE_TEMPLATE_VARIABLES.has(name)) {
      throw new Error(`Template variable ${name} is not allowed`);
    }
    return String(context[name] || "");
  });
}

function extractTemplateVariables(template) {
  return [...template.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].map((match) => match[1]);
}

function resolvePromptTemplate(templateId, promptOverrides = []) {
  const builtIn = BUILT_IN_PROMPT_TEMPLATES[templateId];
  if (!builtIn) {
    throw new Error(`Unknown prompt template: ${templateId}`);
  }
  const override = Array.isArray(promptOverrides)
    ? promptOverrides.find((entry) => entry?.templateId === templateId)
    : null;
  if (!override?.template) {
    return createPromptTaskTemplate(builtIn);
  }
  return createPromptTaskTemplate({
    ...builtIn,
    template: override.template
  });
}

function upsertPromptOverride(snapshot, override) {
  const templateId = cleanString(override?.templateId);
  const template = cleanString(override?.template);
  const resolved = resolvePromptTemplate(templateId, [{ templateId, template }]);
  const next = clonePlainObject(snapshot);
  const overrides = Array.isArray(next.promptOverrides) ? next.promptOverrides.filter((entry) => entry?.templateId !== templateId) : [];
  overrides.push({ templateId: resolved.id, template: resolved.template });
  next.promptOverrides = overrides;
  return next;
}

function removePromptOverride(snapshot, templateId) {
  const next = clonePlainObject(snapshot);
  next.promptOverrides = (Array.isArray(next.promptOverrides) ? next.promptOverrides : []).filter(
    (entry) => entry?.templateId !== templateId
  );
  return next;
}

function clonePlainObject(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

class WorkbenchLocalStore {
  constructor(snapshot) {
    this.providers = [];
    this.promptTemplates = [];
    this.promptOverrides = [];
    this.providerProvenance = [];
    this.researchNoteDrafts = [];
    this.graphSeeds = [];
    this.citationRelations = [];
    this.taskLedger = [];

    if (snapshot) {
      this.importSnapshot(snapshot);
    }
  }

  upsertProvider(provider) {
    const index = this.providers.findIndex((entry) => entry.id === provider.id);
    if (index === -1) {
      this.providers.push(provider);
    } else {
      this.providers[index] = provider;
    }
    return provider;
  }

  upsertPromptTemplate(template) {
    const promptTaskTemplate = createPromptTaskTemplate(template);
    const index = this.promptTemplates.findIndex((entry) => entry.id === promptTaskTemplate.id);
    if (index === -1) {
      this.promptTemplates.push(promptTaskTemplate);
    } else {
      this.promptTemplates[index] = promptTaskTemplate;
    }
    return promptTaskTemplate;
  }

  createResearchNoteDraft(input) {
    const draft = {
      id: input.id || createId("draft"),
      zoteroItemKey: input.zoteroItemKey,
      workId: input.workId,
      title: input.title,
      content: input.content,
      promptTaskTemplateId: input.promptTaskTemplateId,
      llmProviderId: input.llmProviderId,
      inputContext: input.inputContext || {},
      createdAt: input.createdAt || new Date().toISOString(),
      confirmationState: "draft",
      provenance: input.provenance || {}
    };
    this.researchNoteDrafts.push(draft);
    return draft;
  }

  confirmResearchNoteDraft(draftId, zoteroNoteKey) {
    const draft = this.researchNoteDrafts.find((entry) => entry.id === draftId);
    if (!draft) {
      throw new Error(`Draft not found: ${draftId}`);
    }
    draft.confirmationState = "confirmed";
    draft.confirmedZoteroNoteKey = zoteroNoteKey;
    draft.confirmedAt = new Date().toISOString();
    return draft;
  }

  recordTask(input) {
    const task = {
      id: input.id || createId("task"),
      workflowStep: input.workflowStep,
      state: input.state,
      providerId: input.providerId || null,
      promptTaskTemplateId: input.promptTaskTemplateId || null,
      outputLocation: input.outputLocation || null,
      errorNotice: input.errorNotice ? redactSecretMaterial(input.errorNotice) : null,
      startedAt: input.startedAt || new Date().toISOString(),
      completedAt: input.completedAt || null,
      provenance: input.provenance || {}
    };
    this.taskLedger.push(task);
    return task;
  }

  captureGraphSeed(input) {
    const seed = {
      id: input.id || createId("seed"),
      workId: input.workId,
      relationType: input.relationType || "related",
      target: input.target,
      evidence: input.evidence,
      providerId: input.providerId || null,
      confidence: input.confidence || "low",
      seedKind: input.seedKind || "ai-inferred",
      createdAt: input.createdAt || new Date().toISOString()
    };
    this.graphSeeds.push(seed);
    return seed;
  }

  exportSnapshot() {
    return {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      providers: redactSecretMaterial(this.providers),
      promptTemplates: this.promptTemplates,
      promptOverrides: this.promptOverrides,
      providerProvenance: redactSecretMaterial(this.providerProvenance),
      researchNoteDrafts: this.researchNoteDrafts,
      graphSeeds: this.graphSeeds,
      citationRelations: this.citationRelations,
      taskLedger: redactSecretMaterial(this.taskLedger)
    };
  }

  importSnapshot(snapshot) {
    if (!snapshot || snapshot.schemaVersion !== 1) {
      throw new Error("Unsupported workbench snapshot schema");
    }
    this.providers = snapshot.providers || [];
    this.promptTemplates = snapshot.promptTemplates || [];
    this.promptOverrides = snapshot.promptOverrides || [];
    this.providerProvenance = snapshot.providerProvenance || [];
    this.researchNoteDrafts = snapshot.researchNoteDrafts || [];
    this.graphSeeds = snapshot.graphSeeds || [];
    this.citationRelations = snapshot.citationRelations || [];
    this.taskLedger = snapshot.taskLedger || [];
    return this;
  }
}

function normalizeWebDavExportTarget(input = {}) {
  const serverUrl = cleanString(input.serverUrl);
  const username = cleanString(input.username);
  const password = cleanString(input.password);
  const remoteDirectory = normalizeRemoteDirectory(input.remoteDirectory);

  if (!serverUrl) {
    throw new Error("请填写 WebDAV 服务器地址");
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(serverUrl);
  } catch (_error) {
    throw new Error("WebDAV 服务器地址必须是 http(s) URL");
  }
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("WebDAV 服务器地址必须是 http(s) URL");
  }
  if (!username) {
    throw new Error("请填写 WebDAV 用户名");
  }
  if (!password) {
    throw new Error("请填写 WebDAV 密码");
  }

  const normalizedServerUrl = serverUrl.replace(/\/+$/, "");
  const uploadBaseUrl = `${normalizedServerUrl}/${remoteDirectory ? `${remoteDirectory}/` : ""}`;
  return {
    serverUrl: normalizedServerUrl,
    username,
    password,
    remoteDirectory,
    uploadBaseUrl
  };
}

function buildWebDavExportRequest({ target, snapshot, exportedAt } = {}) {
  const normalizedTarget = normalizeWebDavExportTarget(target);
  const timestamp = exportedAt || new Date().toISOString();
  const filename = `zotero-research-workbench-${createStableTimestamp(timestamp)}.json`;
  const exportPackage = createWorkbenchExportPackage({ snapshot, exportedAt: timestamp });
  return {
    method: "PUT",
    url: new URL(encodeURIComponent(filename), normalizedTarget.uploadBaseUrl).toString(),
    filename,
    headers: {
      Authorization: `Basic ${encodeBasicAuth(normalizedTarget.username, normalizedTarget.password)}`,
      "Content-Type": "application/json; charset=utf-8"
    },
    body: JSON.stringify(exportPackage, null, 2)
  };
}

function buildWebDavDirectoryRequests(target) {
  const normalizedTarget = normalizeWebDavExportTarget(target);
  if (!normalizedTarget.remoteDirectory) {
    return [];
  }

  const headers = {
    Authorization: `Basic ${encodeBasicAuth(normalizedTarget.username, normalizedTarget.password)}`
  };
  const parts = normalizedTarget.remoteDirectory.split("/").filter(Boolean);
  return parts.map((_part, index) => {
    const directory = parts.slice(0, index + 1).join("/");
    return {
      method: "MKCOL",
      url: `${normalizedTarget.serverUrl}/${directory}/`,
      headers
    };
  });
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRemoteDirectory(value) {
  return cleanString(value)
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .join("/");
}

function createStableTimestamp(value) {
  return String(value).replace(/[^0-9A-Za-z]+/g, "-").replace(/-$/, "");
}

function encodeBasicAuth(username, password) {
  const value = `${username}:${password}`;
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value, "utf8").toString("base64");
  }
  if (typeof btoa === "function") {
    return btoa(unescape(encodeURIComponent(value)));
  }
  throw new Error("当前环境不支持 WebDAV 认证编码");
}

module.exports = {
  BUILT_IN_PROMPT_TEMPLATES,
  SAFE_TEMPLATE_VARIABLES,
  SECRET_PLACEHOLDER,
  WorkbenchAiTaskWorkspace,
  WorkbenchGraphReviewWorkflow,
  WorkbenchLocalStoreTransaction,
  WorkbenchProviderRequestPolicy,
  WorkbenchResearchPanelOrchestrator,
  WorkbenchResearchTopic,
  WorkbenchDocumentCandidateProtocol,
  WorkbenchDocumentCandidateReview,
  WorkbenchLiteratureDiscovery,
  WorkbenchLiteratureSourceAdapters,
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
};
