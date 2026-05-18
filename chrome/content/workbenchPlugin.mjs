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

    const toolsMenu = doc.getElementById("menu_ToolsPopup");
    if (!toolsMenu || doc.getElementById("zrw-open-research-panel")) {
      return;
    }

    const item = doc.createXULElement("menuitem");
    item.id = "zrw-open-research-panel";
    item.setAttribute("label", "Open Research Workbench");
    item.addEventListener("command", () => this.openResearchPanel());
    toolsMenu.appendChild(item);
  }

  removeFromWindow(win) {
    win?.document?.getElementById("zrw-open-research-panel")?.remove();
  }

  openResearchPanel() {
    const win = this.getMainWindow();
    if (!win) {
      this.log("Cannot open Research Panel without a main window");
      return;
    }

    win.openDialog(
      "chrome://zotero-research-workbench/content/researchPanel.xhtml",
      "zotero-research-workbench-panel",
      "chrome,centerscreen,resizable,width=520,height=640"
    );
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
