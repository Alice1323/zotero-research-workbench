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
    button.setAttribute("label", "研究工作台");
    button.setAttribute("tooltiptext", "打开 Zotero 研究工作台");
    button.addEventListener("command", () => this.openResearchPanel({ launchSurface: "toolbar" }));
    toolbar.appendChild(button);
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
