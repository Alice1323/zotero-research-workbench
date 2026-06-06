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
  const toolbarButton = doc.getElementById("zrw-toolbar-open-research-panel");
  assert.ok(toolbarButton);
  assert.equal(toolbarButton.attributes.label, "");
  assert.equal(toolbarButton.attributes["aria-label"], "研究工作台");
  assert.equal(toolbarButton.attributes.tooltiptext, "打开 Zotero 研究工作台");
  assert.match(toolbarButton.attributes.image, /^data:image\/svg\+xml,/);
  assert.ok(toolbarButton.classList.contains("zotero-tb-button"));
  assert.ok(toolbarButton.classList.contains("zrw-toolbar-button"));
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

test("toolbar button is inserted before Zotero search controls", async () => {
  const { WorkbenchPlugin } = await import(
    pathToFileURL(path.join(root, "chrome/content/workbenchPlugin.mjs")).href
  );
  const doc = createFakeDocument();
  const toolbar = doc.getElementById("zotero-items-toolbar");
  toolbar.appendChild(createFakeElementWithId("zotero-tb-new-item", "toolbarbutton", doc.elements));
  toolbar.appendChild(createFakeElementWithId("zotero-tb-note", "toolbarbutton", doc.elements));
  toolbar.appendChild(createFakeElementWithId("zotero-tb-search", "searchbox", doc.elements));
  const win = { document: doc };
  const plugin = new WorkbenchPlugin({
    id: "zotero-research-workbench",
    version: "0.4.0beta2",
    rootURI: "",
    Zotero: { getMainWindow: () => win, getMainWindows: () => [win] }
  });

  plugin.addToolbarButton(win);

  assert.deepEqual(
    toolbar.children.map((child) => child.id),
    ["zotero-tb-new-item", "zotero-tb-note", "zrw-toolbar-open-research-panel", "zotero-tb-search"]
  );
});

test("toolbar button is inserted before nested Zotero search containers", async () => {
  const { WorkbenchPlugin } = await import(
    pathToFileURL(path.join(root, "chrome/content/workbenchPlugin.mjs")).href
  );
  const doc = createFakeDocument();
  const toolbar = doc.getElementById("zotero-items-toolbar");
  const searchContainer = createFakeElementWithId("zotero-tb-search-container", "hbox", doc.elements);
  searchContainer.appendChild(createFakeElementWithId("zotero-tb-search-input", "searchbox", doc.elements));
  toolbar.appendChild(createFakeElementWithId("zotero-tb-new-item", "toolbarbutton", doc.elements));
  toolbar.appendChild(createFakeElementWithId("zotero-tb-note", "toolbarbutton", doc.elements));
  toolbar.appendChild(searchContainer);
  const win = { document: doc };
  const plugin = new WorkbenchPlugin({
    id: "zotero-research-workbench",
    version: "0.4.0beta2",
    rootURI: "",
    Zotero: { getMainWindow: () => win, getMainWindows: () => [win] }
  });

  plugin.addToolbarButton(win);

  assert.deepEqual(
    toolbar.children.map((child) => child.id),
    ["zotero-tb-new-item", "zotero-tb-note", "zrw-toolbar-open-research-panel", "zotero-tb-search-container"]
  );
});

test("toolbar button is inserted inside the Zotero item action group before the flex spacer", async () => {
  const { WorkbenchPlugin } = await import(
    pathToFileURL(path.join(root, "chrome/content/workbenchPlugin.mjs")).href
  );
  const doc = createFakeDocument();
  const toolbar = doc.getElementById("zotero-items-toolbar");
  const spacer = createFakeElementWithId("zotero-items-toolbar-flex-spacer", "spacer", doc.elements);
  spacer.setAttribute("flex", "1");
  toolbar.appendChild(createFakeElementWithId("zotero-tb-add", "toolbarbutton", doc.elements));
  toolbar.appendChild(createFakeElementWithId("zotero-tb-lookup", "toolbarbutton", doc.elements));
  toolbar.appendChild(createFakeElementWithId("zotero-tb-attachment-add", "toolbarbutton", doc.elements));
  toolbar.appendChild(createFakeElementWithId("zotero-tb-note-add", "toolbarbutton", doc.elements));
  toolbar.appendChild(spacer);
  toolbar.appendChild(createFakeElementWithId("zotero-tb-search", "quick-search-textbox", doc.elements));
  const win = { document: doc };
  const plugin = new WorkbenchPlugin({
    id: "zotero-research-workbench",
    version: "0.4.0beta2",
    rootURI: "",
    Zotero: { getMainWindow: () => win, getMainWindows: () => [win] }
  });

  plugin.addToolbarButton(win);

  assert.deepEqual(
    toolbar.children.map((child) => child.id),
    [
      "zotero-tb-add",
      "zotero-tb-lookup",
      "zotero-tb-attachment-add",
      "zotero-tb-note-add",
      "zrw-toolbar-open-research-panel",
      "zotero-items-toolbar-flex-spacer",
      "zotero-tb-search"
    ]
  );
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
    elements,
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
    classList: createFakeClassList(),
    getAttribute(name) {
      return this.attributes[name] || "";
    },
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
    insertBefore(child, anchor) {
      child.parentNode = this;
      const anchorIndex = this.children.indexOf(anchor);
      if (anchorIndex < 0) {
        this.children.push(child);
      } else {
        this.children.splice(anchorIndex, 0, child);
      }
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

function createFakeClassList() {
  const classes = new Set();
  return {
    add(...names) {
      for (const name of names) {
        classes.add(name);
      }
    },
    contains(name) {
      return classes.has(name);
    }
  };
}

function createFakeElementWithId(id, tagName, elements) {
  const element = createFakeElement(tagName, elements);
  element.id = id;
  elements.set(id, element);
  return element;
}

function registerElement(elements, id, element) {
  element.id = id;
  elements.set(id, element);
}
