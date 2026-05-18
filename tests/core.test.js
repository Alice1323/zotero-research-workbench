const test = require("node:test");
const assert = require("node:assert/strict");

const {
  SECRET_PLACEHOLDER,
  WorkbenchLocalStore,
  createOpenAICompatibleProvider,
  createPromptTaskTemplate,
  redactSecretMaterial,
  renderPrompt
} = require("../src/core");

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
  assert.equal(snapshot.taskLedger[0].workflowStep, "create-research-note-draft");

  const restored = new WorkbenchLocalStore(snapshot);
  assert.equal(restored.researchNoteDrafts.length, 1);
  assert.equal(restored.graphSeeds.length, 1);
  assert.equal(restored.taskLedger.length, 1);
});
