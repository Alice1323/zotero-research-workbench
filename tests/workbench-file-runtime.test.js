const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const { createWorkbenchFileRuntime } = require("../src/core/workbenchFileRuntime");

const root = path.resolve(__dirname, "..");

test("workbench file runtime picks a save target through Zotero.FilePicker", async () => {
  const calls = [];
  const selectedFile = { path: "C:\\Users\\44199\\Downloads\\workbench.json" };
  class FilePicker {
    constructor() {
      this.returnCancel = 2;
      this.file = selectedFile;
    }

    init(parentWindow, title, mode) {
      calls.push(["init", parentWindow.name, title, mode]);
    }

    appendFilter(name, pattern) {
      calls.push(["appendFilter", name, pattern]);
    }

    show() {
      calls.push(["show", this.defaultString]);
      return 0;
    }
  }
  FilePicker.modeSave = 10;
  FilePicker.modeOpen = 11;
  FilePicker.returnCancel = 2;

  const runtime = createWorkbenchFileRuntime({
    getZotero: () => ({
      FilePicker,
      getMainWindow: () => ({ name: "main-window" })
    }),
    window: { name: "panel-window" }
  });

  const file = await runtime.pickWorkbenchExportFile({
    mode: "save",
    defaultString: "workbench.json",
    filterName: "JSON",
    filterPattern: "*.json"
  });

  assert.equal(file, selectedFile);
  assert.deepEqual(calls, [
    ["init", "main-window", "导出工作台状态", 10],
    ["appendFilter", "JSON", "*.json"],
    ["show", "workbench.json"]
  ]);
});

test("workbench file runtime returns null when the Zotero picker is cancelled", async () => {
  class FilePicker {
    constructor() {
      this.returnCancel = 2;
      this.file = { path: "unused.json" };
    }

    init() {}
    appendFilter() {}
    show() {
      return 2;
    }
  }
  FilePicker.modeSave = 10;
  FilePicker.modeOpen = 11;
  FilePicker.returnCancel = 2;

  const runtime = createWorkbenchFileRuntime({
    getZotero: () => ({ FilePicker }),
    window: {}
  });

  const file = await runtime.pickWorkbenchExportFile({ mode: "open" });

  assert.equal(file, null);
});

test("workbench file runtime falls back to the XUL file picker", async () => {
  const calls = [];
  const selectedFile = { path: "C:\\Users\\44199\\Downloads\\workbench.zip" };
  const nsIFilePicker = {
    modeSave: 20,
    modeOpen: 21,
    returnCancel: 22
  };
  const picker = {
    init(parentContext, title, mode) {
      calls.push(["init", parentContext, title, mode]);
    },
    appendFilter(name, pattern) {
      calls.push(["appendFilter", name, pattern]);
    },
    open(resolve) {
      calls.push(["open", this.defaultString]);
      resolve(0);
    },
    file: selectedFile
  };
  const runtime = createWorkbenchFileRuntime({
    getZotero: () => null,
    getComponents: () => ({
      interfaces: { nsIFilePicker },
      classes: {
        "@mozilla.org/filepicker;1": {
          createInstance(interfaceType) {
            calls.push(["createInstance", interfaceType]);
            return picker;
          }
        }
      }
    }),
    window: {
      browsingContext: "panel-context"
    }
  });

  const file = await runtime.pickWorkbenchExportFile({
    mode: "open",
    defaultString: "workbench.zip",
    filterName: "ZIP",
    filterPattern: "*.zip"
  });

  assert.equal(file, selectedFile);
  assert.deepEqual(calls, [
    ["createInstance", nsIFilePicker],
    ["init", "panel-context", "导入工作台状态", 21],
    ["appendFilter", "ZIP", "*.zip"],
    ["open", "workbench.zip"]
  ]);
});

test("workbench file runtime creates a default desktop export file", () => {
  const appended = [];
  const desktop = {
    append(name) {
      appended.push(name);
    }
  };
  const runtime = createWorkbenchFileRuntime({
    getComponents: () => ({
      interfaces: {
        nsIProperties: "nsIProperties",
        nsIFile: "nsIFile"
      },
      classes: {
        "@mozilla.org/file/directory_service;1": {
          getService(interfaceType) {
            assert.equal(interfaceType, "nsIProperties");
            return {
              get(key, interfaceTypeForFile) {
                assert.equal(key, "Desk");
                assert.equal(interfaceTypeForFile, "nsIFile");
                return desktop;
              }
            };
          }
        }
      }
    })
  });

  const file = runtime.pickDefaultWorkbenchExportFile("workbench.json");

  assert.equal(file, desktop);
  assert.deepEqual(appended, ["workbench.json"]);
});

test("workbench file runtime exposes the same interface to browser runtime scripts", () => {
  const source = fs.readFileSync(path.join(root, "src/core/workbenchFileRuntime.js"), "utf8");
  const context = {
    window: {}
  };

  vm.runInNewContext(source, context, { filename: "workbenchFileRuntime.js" });

  assert.equal(typeof context.window.WorkbenchFileRuntime.createWorkbenchFileRuntime, "function");
  assert.equal(typeof context.window.WorkbenchFileRuntime.createBrowserWorkbenchFileRuntime, "function");
});
