export class WorkbenchPlugin {
  constructor({ id, version, rootURI, Zotero }) {
    this.id = id;
    this.version = version;
    this.rootURI = rootURI;
    this.Zotero = Zotero;
    this.menuItem = null;
  }

  async startup() {
    this.setDebugPref("lastStartup", new Date().toISOString());
    this.log("Starting Zotero Research Workbench");
    for (const win of this.getMainWindows()) {
      this.addToWindow(win);
    }
  }

  async shutdown() {
    for (const win of this.getMainWindows()) {
      this.removeFromWindow(win);
    }
    this.setDebugPref("lastShutdown", new Date().toISOString());
    this.log("Stopped Zotero Research Workbench");
  }

  addToWindow(win) {
    const doc = win?.document;
    if (!doc) {
      return;
    }

    this.addToolsMenuItem(win);
    this.addToolbarButton(win);
    this.addItemContextMenu(win);
  }

  addToolsMenuItem(win) {
    const doc = win?.document;
    if (!doc) {
      return;
    }

    const toolsMenu = doc.getElementById("menu_ToolsPopup");
    if (!toolsMenu || doc.getElementById("zrw-open-research-panel")) {
      return;
    }

    const item = this.createChromeElement(doc, "menuitem", "menuitem");
    item.id = "zrw-open-research-panel";
    item.setAttribute("label", "打开研究工作台");
    item.addEventListener("command", () => this.openResearchPanel({ launchSurface: "tools-menu" }));
    toolsMenu.appendChild(item);
  }

  addToolbarButton(win) {
    const doc = win?.document;
    if (!doc || doc.getElementById("zrw-toolbar-open-research-panel")) {
      return;
    }

    const toolbar =
      doc.getElementById("zotero-items-toolbar") ||
      doc.getElementById("zotero-toolbar") ||
      doc.querySelector?.("toolbar");
    if (!toolbar) {
      this.log("Toolbar insertion point unavailable; Tools menu remains available");
      return;
    }

    const button = this.createChromeElement(doc, "toolbarbutton", "button");
    button.id = "zrw-toolbar-open-research-panel";
    button.classList?.add("zotero-tb-button");
    button.classList?.add("zrw-toolbar-button");
    button.setAttribute("label", "");
    button.setAttribute("aria-label", "研究工作台");
    button.setAttribute("tooltiptext", "打开 Zotero 研究工作台");
    button.setAttribute("image", this.getToolbarIconDataUri());
    button.addEventListener("command", () => this.openResearchPanel({ launchSurface: "toolbar" }));
    const anchor = this.findToolbarActionGroupAnchor(toolbar);
    if (anchor && toolbar.insertBefore) {
      toolbar.insertBefore(button, anchor);
      return;
    }
    toolbar.appendChild(button);
  }

  findToolbarActionGroupAnchor(toolbar) {
    const children = Array.from(toolbar?.children || []);
    const noteButton = children.find((child) => child?.id === "zotero-tb-note-add");
    if (noteButton) {
      return this.findNextToolbarSibling(noteButton);
    }
    const spacer = children.find((child) => this.isToolbarFlexSpacer(child));
    if (spacer) {
      return spacer;
    }
    return this.findToolbarSearchAnchor(toolbar);
  }

  findNextToolbarSibling(element) {
    const siblings = Array.from(element?.parentNode?.children || []);
    const index = siblings.indexOf(element);
    if (index < 0) {
      return null;
    }
    return siblings[index + 1] || null;
  }

  isToolbarFlexSpacer(element) {
    const tagName = String(element?.tagName || "").toLowerCase();
    const id = String(element?.id || "").toLowerCase();
    const flex = String(element?.getAttribute?.("flex") || "");
    return tagName === "spacer" || id.includes("spacer") || flex === "1";
  }

  findToolbarSearchAnchor(toolbar) {
    const children = Array.from(toolbar?.children || []);
    return children.find((child) => this.isToolbarSearchControl(child)) || null;
  }

  isToolbarSearchControl(element) {
    const id = String(element?.id || "").toLowerCase();
    const tagName = String(element?.tagName || "").toLowerCase();
    const ariaLabel = String(element?.getAttribute?.("aria-label") || "").toLowerCase();
    const placeholder = String(element?.getAttribute?.("placeholder") || "").toLowerCase();
    return (
      tagName.includes("search") ||
      id.includes("search") ||
      id.includes("quicksearch") ||
      ariaLabel.includes("search") ||
      ariaLabel.includes("搜索") ||
      placeholder.includes("search") ||
      placeholder.includes("搜索")
    );
  }

  getToolbarIconDataUri() {
    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="context-fill" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">',
      '<path d="M2.5 11.5V4.5l5.5-2 5.5 2v7l-5.5 2-5.5-2Z"/>',
      '<path d="M8 2.5v11"/>',
      '<path d="M2.5 4.5l5.5 2 5.5-2"/>',
      '<path d="M5.25 8.25h5.5"/>',
      '<path d="M5.25 10.25h5.5"/>',
      "</svg>"
    ].join("");
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }

  addItemContextMenu(win) {
    const doc = win?.document;
    if (!doc || doc.getElementById("zrw-context-create-discovery-plan")) {
      return;
    }

    const popup =
      doc.getElementById("zotero-itemmenu") ||
      doc.getElementById("zotero-item-context-menu") ||
      doc.querySelector?.("menupopup");
    if (!popup) {
      this.log("Item context menu insertion point unavailable");
      return;
    }

    const item = this.createChromeElement(doc, "menuitem", "menuitem");
    item.id = "zrw-context-create-discovery-plan";
    item.setAttribute("label", "从选中文献发现相关文献");
    item.addEventListener("command", () =>
      this.openResearchPanel({ launchSurface: "item-context-menu", intent: "related-literature" })
    );
    popup.appendChild(item);
  }

  removeFromWindow(win) {
    for (const id of [
      "zrw-open-research-panel",
      "zrw-toolbar-open-research-panel",
      "zrw-context-create-discovery-plan"
    ]) {
      win?.document?.getElementById(id)?.remove();
    }
  }

  openResearchPanel(options = {}) {
    const win = this.getMainWindow();
    if (!win) {
      this.log("Cannot open Research Panel without a main window");
      return;
    }

    win.openDialog(
      "chrome://zotero-research-workbench/content/researchPanel.xhtml",
      "zotero-research-workbench-panel",
      "chrome,centerscreen,resizable,width=520,height=640",
      { Zotero: this.Zotero, launchOptions: options }
    );
  }

  createChromeElement(doc, xulTagName, htmlTagName) {
    if (doc.createXULElement) {
      return doc.createXULElement(xulTagName);
    }
    return doc.createElement(htmlTagName);
  }

  getMainWindow() {
    if (!this.Zotero || !this.Zotero.getMainWindow) {
      return null;
    }
    return this.Zotero.getMainWindow();
  }

  getMainWindows() {
    if (!this.Zotero || !this.Zotero.getMainWindows) {
      const win = this.getMainWindow();
      return win ? [win] : [];
    }
    return this.Zotero.getMainWindows();
  }

  log(message) {
    if (this.Zotero && this.Zotero.debug) {
      this.Zotero.debug(`[Research Workbench] ${message}`);
    }
  }

  setDebugPref(name, value) {
    if (this.Zotero && this.Zotero.Prefs && this.Zotero.Prefs.set) {
      this.Zotero.Prefs.set(`extensions.zotero-research-workbench.${name}`, value);
    }
  }
}
