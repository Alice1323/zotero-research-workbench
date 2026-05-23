const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const root = path.resolve(__dirname, "..");

test("workbench plugin defines toolbar and context menu launch surface ids", () => {
  const plugin = fs.readFileSync(path.join(root, "chrome/content/workbenchPlugin.mjs"), "utf8");

  assert.match(plugin, /zrw-toolbar-open-research-panel/);
  assert.match(plugin, /zrw-context-create-discovery-plan/);
  assert.match(plugin, /addToolbarButton/);
  assert.match(plugin, /addItemContextMenu/);
  assert.match(plugin, /removeFromWindow/);
});

test("toolbar and context labels are Chinese", () => {
  const plugin = fs.readFileSync(path.join(root, "chrome/content/workbenchPlugin.mjs"), "utf8");

  assert.match(plugin, /研究工作台/);
  assert.match(plugin, /从选中文献发现相关文献/);
});

test("toolbar and context menu launch options are passed to the research panel", async () => {
  const { WorkbenchPlugin } = await import(
    pathToFileURL(path.join(root, "chrome/content/workbenchPlugin.mjs")).href
  );
  const doc = createFakeDocument();
  const openedDialogs = [];
  const win = {
    document: doc,
    openDialog(...args) {
      openedDialogs.push(args);
    }
  };
  const plugin = new WorkbenchPlugin({
    id: "zotero-research-workbench",
    version: "0.3.0",
    rootURI: "",
    Zotero: { getMainWindow: () => win, getMainWindows: () => [win] }
  });

  plugin.addToWindow(win);

  assert.ok(doc.getElementById("zrw-open-research-panel"));
  assert.ok(doc.getElementById("zrw-toolbar-open-research-panel"));
  assert.ok(doc.getElementById("zrw-context-create-discovery-plan"));

  doc.getElementById("zrw-toolbar-open-research-panel").dispatch("command");
  assert.equal(openedDialogs.at(-1)[3].launchOptions.launchSurface, "toolbar");

  doc.getElementById("zrw-context-create-discovery-plan").dispatch("command");
  assert.deepEqual(openedDialogs.at(-1)[3].launchOptions, {
    launchSurface: "item-context-menu",
    intent: "related-literature"
  });

  plugin.removeFromWindow(win);

  assert.equal(doc.getElementById("zrw-open-research-panel"), null);
  assert.equal(doc.getElementById("zrw-toolbar-open-research-panel"), null);
  assert.equal(doc.getElementById("zrw-context-create-discovery-plan"), null);
});

function createFakeDocument() {
  const elements = new Map();
  const toolsMenu = createFakeElement("menupopup", elements);
  const toolbar = createFakeElement("toolbar", elements);
  const contextMenu = createFakeElement("menupopup", elements);
  registerElement(elements, "menu_ToolsPopup", toolsMenu);
  registerElement(elements, "zotero-items-toolbar", toolbar);
  registerElement(elements, "zotero-itemmenu", contextMenu);

  return {
    createXULElement(tagName) {
      return createFakeElement(tagName, elements);
    },
    createElement(tagName) {
      return createFakeElement(tagName, elements);
    },
    getElementById(id) {
      return elements.get(id) || null;
    },
    querySelector() {
      return null;
    }
  };
}

function createFakeElement(tagName, elements) {
  return {
    tagName,
    attributes: {},
    children: [],
    listeners: {},
    parentNode: null,
    id: "",
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    addEventListener(eventName, listener) {
      this.listeners[eventName] = listener;
    },
    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      if (child.id) {
        elements.set(child.id, child);
      }
    },
    dispatch(eventName) {
      this.listeners[eventName]?.();
    },
    remove() {
      if (this.parentNode) {
        this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
      }
      if (this.id) {
        elements.delete(this.id);
      }
    }
  };
}

function registerElement(elements, id, element) {
  element.id = id;
  elements.set(id, element);
}
