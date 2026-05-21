function createWorkbenchFileRuntime({ getZotero, getComponents, window, console } = {}) {
  const zoteroProvider = typeof getZotero === "function" ? getZotero : () => null;
  const componentsProvider = typeof getComponents === "function" ? getComponents : () => null;
  const windowAdapter = window || {};
  const consoleAdapter = console || null;

  async function pickWorkbenchExportFile({ mode, defaultString, filterName = "JSON", filterPattern = "*.json" } = {}) {
    const Zotero = zoteroProvider();
    const zoteroFile = await tryZoteroFilePicker(Zotero, { mode, defaultString, filterName, filterPattern });
    if (zoteroFile !== undefined) {
      return zoteroFile;
    }

    return pickComponentsFile({ mode, defaultString, filterName, filterPattern });
  }

  async function tryZoteroFilePicker(Zotero, { mode, defaultString, filterName = "JSON", filterPattern = "*.json" } = {}) {
    if (!Zotero?.FilePicker) {
      return undefined;
    }

    try {
      const FilePicker = Zotero.FilePicker;
      const picker = createZoteroFilePicker(FilePicker);
      if (!picker?.init || !picker?.appendFilter) {
        return undefined;
      }
      initFilePicker(picker, filePickerTitle(mode), filePickerMode(picker, FilePicker, mode), {
        useBrowsingContext: false
      });
      picker.appendFilter(filterName, filterPattern);
      if (defaultString) {
        picker.defaultString = defaultString;
      }
      const result = await showFilePicker(picker);
      if (result === filePickerCancelValue(picker, FilePicker)) {
        return null;
      }
      return picker.file || null;
    } catch (error) {
      consoleAdapter?.warn?.("[zotero-research-workbench] Zotero.FilePicker unavailable", error);
      return undefined;
    }
  }

  async function pickComponentsFile({ mode, defaultString, filterName = "JSON", filterPattern = "*.json" } = {}) {
    const Components = componentsProvider();
    if (!Components?.classes || !Components?.interfaces) {
      throw new Error("当前 Zotero 环境不支持打开文件选择器");
    }

    const Ci = Components.interfaces;
    const picker = Components.classes["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
    initFilePicker(picker, filePickerTitle(mode), mode === "save" ? Ci.nsIFilePicker.modeSave : Ci.nsIFilePicker.modeOpen, {
      useBrowsingContext: true
    });
    picker.appendFilter(filterName, filterPattern);
    if (defaultString) {
      picker.defaultString = defaultString;
    }
    const result = await showFilePicker(picker);
    if (result === Ci.nsIFilePicker.returnCancel) {
      return null;
    }
    return picker.file;
  }

  function pickDefaultWorkbenchExportFile(defaultString) {
    const desktop = getDesktopDirectory();
    desktop.append(defaultString || `zotero-research-workbench-${createStableTimestamp(new Date().toISOString())}.json`);
    return desktop;
  }

  function getDesktopDirectory() {
    const Components = componentsProvider();
    if (!Components?.classes || !Components?.interfaces) {
      throw new Error("保存对话框不可用，且无法定位桌面目录");
    }
    const directoryService = Components.classes["@mozilla.org/file/directory_service;1"].getService(
      Components.interfaces.nsIProperties
    );
    return directoryService.get("Desk", Components.interfaces.nsIFile);
  }

  function createZoteroFilePicker(FilePicker) {
    if (typeof FilePicker !== "function") {
      return FilePicker;
    }
    try {
      return new FilePicker();
    } catch (_error) {
      return FilePicker();
    }
  }

  function initFilePicker(picker, title, mode, { useBrowsingContext } = {}) {
    let lastError = null;
    for (const parentWindow of filePickerParentCandidates()) {
      try {
        picker.init(filePickerParentArgument(parentWindow, { useBrowsingContext }), title, mode);
        return;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("当前 Zotero 环境不支持初始化文件选择器");
  }

  function filePickerParentCandidates() {
    const Zotero = zoteroProvider();
    return [
      Zotero?.getMainWindow?.(),
      windowAdapter.opener,
      windowAdapter,
      null
    ].filter((candidate) => candidate !== undefined);
  }

  function filePickerParentArgument(parentWindow, { useBrowsingContext } = {}) {
    if (!useBrowsingContext || parentWindow === null) {
      return parentWindow;
    }
    return parentWindow?.browsingContext;
  }

  return {
    pickWorkbenchExportFile,
    pickDefaultWorkbenchExportFile
  };
}

function filePickerTitle(mode) {
  return mode === "save" ? "导出工作台状态" : "导入工作台状态";
}

function filePickerMode(picker, FilePicker, mode) {
  if (mode === "save") {
    return picker.modeSave ?? FilePicker.modeSave;
  }
  return picker.modeOpen ?? FilePicker.modeOpen;
}

function filePickerCancelValue(picker, FilePicker) {
  return picker.returnCancel ?? FilePicker.returnCancel;
}

function showFilePicker(picker) {
  if (typeof picker.show === "function") {
    return Promise.resolve(picker.show());
  }
  if (typeof picker.open === "function") {
    return new Promise((resolve) => picker.open(resolve));
  }
  throw new Error("当前 Zotero 环境不支持打开文件选择器");
}

function createStableTimestamp(value) {
  return String(value || "")
    .replace(/\.\d{3}Z$/, "Z")
    .replace(/[^0-9A-Za-z]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function createBrowserWorkbenchFileRuntime({ window, getZotero, getComponents, console } = {}) {
  const windowAdapter = window || {};
  return createWorkbenchFileRuntime({
    window: windowAdapter,
    console,
    getZotero:
      getZotero ||
      (() => windowAdapter.arguments?.[0]?.Zotero || windowAdapter.opener?.Zotero || windowAdapter.Zotero),
    getComponents:
      getComponents ||
      (() => {
        if (typeof Components === "undefined") {
          return null;
        }
        return Components;
      })
  });
}

const WorkbenchFileRuntime = {
  createBrowserWorkbenchFileRuntime,
  createWorkbenchFileRuntime
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = WorkbenchFileRuntime;
}

if (typeof window !== "undefined") {
  window.WorkbenchFileRuntime = WorkbenchFileRuntime;
}
