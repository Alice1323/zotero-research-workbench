const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const snapshotPrefKey = "extensions.zotero-research-workbench.store.snapshot";

test("research panel classic scripts load together and bind literature discovery click", () => {
  const harness = createResearchPanelHarness();

  loadResearchPanelScripts(harness);
  harness.document.fireDOMContentLoaded();

  harness.document.getElementById("literature-discovery-request").value = "graph retrieval";
  harness.document.getElementById("literature-discovery-create-plan").click();

  assert.equal(
    harness.document.getElementById("document-candidate-review-status").textContent,
    "发现计划已生成，请确认后搜索"
  );
  assert.match(harness.document.getElementById("literature-discovery-plan-preview").textContent, /计划预览：来源/);
  assert.equal(harness.document.getElementById("literature-discovery-confirm-search").disabled, false);
  assert.equal(JSON.parse(harness.prefs.get(snapshotPrefKey)).literatureDiscoveryJobs.length, 1);
});

function loadResearchPanelScripts(harness) {
  const panelSource = fs.readFileSync(path.join(root, "chrome/content/researchPanel.xhtml"), "utf8");
  const scriptNames = [...panelSource.matchAll(/<script src="([^"]+)"><\/script>/g)].map((match) => match[1]);
  for (const scriptName of scriptNames) {
    const sourcePath = resolvePanelScriptPath(scriptName);
    const source = fs.readFileSync(sourcePath, "utf8");
    vm.runInNewContext(source, harness.context, { filename: scriptName });
  }
}

function resolvePanelScriptPath(scriptName) {
  const chromePath = path.join(root, "chrome/content", scriptName);
  if (fs.existsSync(chromePath)) {
    return chromePath;
  }
  if (scriptName === "aiTaskWorkspaceCore.js") {
    return path.join(root, "src/core/aiTaskWorkspace.js");
  }
  const corePath = path.join(root, "src/core", scriptName);
  if (fs.existsSync(corePath)) {
    return corePath;
  }
  throw new Error(`Panel script not found: ${scriptName}`);
}

function createResearchPanelHarness() {
  const panelSource = fs.readFileSync(path.join(root, "chrome/content/researchPanel.xhtml"), "utf8");
  const ids = new Set([...panelSource.matchAll(/id="([^"]+)"/g)].map((match) => match[1]));
  const elements = new Map([...ids].map((id) => [id, createFakeElement("div", id)]));
  for (const [id, checked] of [
    ["literature-source-openalex", true],
    ["literature-source-crossref", true],
    ["literature-source-unpaywall", true]
  ]) {
    elements.get(id).checked = checked;
  }
  const document = createFakeDocument(elements);
  const prefs = new Map([[snapshotPrefKey, JSON.stringify(createEmptySnapshot())]]);
  const Zotero = {
    Prefs: {
      get: (key) => prefs.get(key) || "",
      set: (key, value) => prefs.set(key, value)
    },
    debug: () => {},
    getMainWindow: () => ({ ZoteroPane: { getSelectedItems: () => [] } })
  };
  const window = {
    arguments: [{ Zotero }],
    console,
    document,
    fetch: async () => ({ ok: true, status: 200, json: async () => ({ results: [], message: { items: [] } }) }),
    navigator: {},
    addEventListener: (eventName, listener) => document.addEventListener(eventName, listener)
  };
  const context = {
    Array,
    Boolean,
    Date,
    Error,
    JSON,
    Map,
    Math,
    Number,
    Object,
    Promise,
    RegExp,
    Set,
    String,
    URL,
    console,
    decodeURIComponent,
    document,
    encodeURIComponent,
    navigator: window.navigator,
    setTimeout,
    clearTimeout,
    window
  };
  context.globalThis = context;
  return { context, document, elements, prefs, window };
}

function createFakeDocument(elements) {
  const domContentLoadedListeners = [];
  return {
    readyState: "loading",
    getElementById(id) {
      return elements.get(id) || null;
    },
    createElement(tagName) {
      return createFakeElement(tagName);
    },
    createElementNS(_namespace, tagName) {
      return createFakeElement(tagName);
    },
    querySelector() {
      return null;
    },
    querySelectorAll(selector) {
      if (selector === ".segmented-filter[data-filter-target]") {
        return [];
      }
      return [];
    },
    addEventListener(eventName, listener) {
      if (eventName === "DOMContentLoaded") {
        domContentLoadedListeners.push(listener);
      }
    },
    fireDOMContentLoaded() {
      this.readyState = "complete";
      for (const listener of domContentLoadedListeners) {
        listener();
      }
    }
  };
}

function createFakeElement(tagName, id = "") {
  const attributes = new Map();
  const listeners = new Map();
  const element = {
    tagName,
    id,
    children: [],
    className: "",
    dataset: {},
    disabled: false,
    hidden: false,
    open: false,
    placeholder: "",
    style: {},
    type: "",
    value: "",
    checked: false,
    classList: {
      add() {},
      remove() {},
      contains() {
        return false;
      }
    },
    get textContent() {
      return `${this._textContent || ""}${this.children.map((child) => child.textContent || "").join("")}`;
    },
    set textContent(value) {
      this._textContent = String(value || "");
      this.children = [];
    },
    append(child) {
      this.appendChild(child);
    },
    appendChild(child) {
      this.children.push(child);
      child.parentNode = this;
      return child;
    },
    replaceChildren(...children) {
      this.children = [];
      this._textContent = "";
      for (const child of children) {
        this.appendChild(child);
      }
    },
    remove() {},
    addEventListener(eventName, listener) {
      listeners.set(eventName, listener);
    },
    click() {
      listeners.get("click")?.({ type: "click", target: this, currentTarget: this });
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
      if (name === "hidden") {
        this.hidden = true;
      }
      if (name === "disabled") {
        this.disabled = true;
      }
    },
    removeAttribute(name) {
      attributes.delete(name);
      if (name === "hidden") {
        this.hidden = false;
      }
      if (name === "disabled") {
        this.disabled = false;
      }
    },
    hasAttribute(name) {
      return attributes.has(name);
    },
    getAttribute(name) {
      return attributes.get(name) || "";
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    }
  };
  return element;
}

function createEmptySnapshot() {
  return {
    schemaVersion: 1,
    exportedAt: "2026-05-24T00:00:00.000Z",
    providers: [],
    promptTemplates: [],
    promptOverrides: [],
    providerProvenance: [],
    researchNoteDrafts: [],
    graphSeeds: [],
    citationRelations: [],
    taskLedger: [],
    researchTopics: [],
    documentCandidates: [],
    literatureDiscoveryJobs: [],
    literatureDiscoveryFailures: [],
    zoteroImportPlans: [],
    zoteroWriteQueues: [],
    zoteroWriteResults: [],
    aiJobs: [],
    aiTasks: [],
    aiTaskResults: [],
    aiTaskFailures: [],
    aiTaskSkips: [],
    aiJobDiagnoses: []
  };
}
