const SECRET_PLACEHOLDER = "<redacted>";

const SAFE_TEMPLATE_VARIABLES = new Set([
  "selectedText",
  "itemTitle",
  "itemAuthors",
  "abstract",
  "noteContent",
  "pdfPageText",
  "graphSeedsSummary",
  "paperCandidatesSummary",
  "userQuery"
]);

function createOpenAICompatibleProvider(config) {
  const required = ["id", "baseUrl", "model"];
  for (const field of required) {
    if (!config || typeof config[field] !== "string" || config[field].trim() === "") {
      throw new Error(`Provider ${field} is required`);
    }
  }

  return {
    id: config.id,
    capability: "llm",
    baseUrl: config.baseUrl,
    model: config.model,
    apiKey: config.apiKey || "",
    headers: config.headers || {},
    timeoutMs: config.timeoutMs || 30000,
    rateLimitPolicy: config.rateLimitPolicy || { requestsPerMinute: 20 },
    usageLimit: config.usageLimit || { maxInputTokensPerTask: 12000 },
    networkPermissions: [new URL(config.baseUrl).origin],
    authRequirements: ["apiKey"],
    failureModes: ["network-error", "auth-error", "rate-limited", "invalid-response"],
    provenance: {
      providerKind: "openai-compatible",
      configuredAt: config.configuredAt || new Date().toISOString()
    }
  };
}

function redactSecretMaterial(value) {
  if (Array.isArray(value)) {
    return value.map((item) => redactSecretMaterial(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const redacted = {};
  for (const [key, entry] of Object.entries(value)) {
    if (isSecretKey(key) && entry) {
      redacted[key] = SECRET_PLACEHOLDER;
    } else {
      redacted[key] = redactSecretMaterial(entry);
    }
  }
  return redacted;
}

function isSecretKey(key) {
  return /apiKey|password|token|authorization|secret/i.test(key);
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

class WorkbenchLocalStore {
  constructor(snapshot) {
    this.providers = [];
    this.promptTemplates = [];
    this.researchNoteDrafts = [];
    this.graphSeeds = [];
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
      researchNoteDrafts: this.researchNoteDrafts,
      graphSeeds: this.graphSeeds,
      taskLedger: redactSecretMaterial(this.taskLedger)
    };
  }

  importSnapshot(snapshot) {
    if (!snapshot || snapshot.schemaVersion !== 1) {
      throw new Error("Unsupported workbench snapshot schema");
    }
    this.providers = snapshot.providers || [];
    this.promptTemplates = snapshot.promptTemplates || [];
    this.researchNoteDrafts = snapshot.researchNoteDrafts || [];
    this.graphSeeds = snapshot.graphSeeds || [];
    this.taskLedger = snapshot.taskLedger || [];
    return this;
  }
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

module.exports = {
  SAFE_TEMPLATE_VARIABLES,
  SECRET_PLACEHOLDER,
  WorkbenchLocalStore,
  createOpenAICompatibleProvider,
  createPromptTaskTemplate,
  redactSecretMaterial,
  renderPrompt
};
