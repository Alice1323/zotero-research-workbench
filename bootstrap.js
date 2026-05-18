var chromeHandle;
var plugin;

function install() {}

function uninstall() {}

async function startup({ id, version, rootURI }) {
  registerChrome(rootURI);
  var { WorkbenchPlugin } = ChromeUtils.importESModule(
    "chrome://zotero-research-workbench/content/workbenchPlugin.mjs"
  );
  plugin = new WorkbenchPlugin({ id, version, rootURI, Zotero });
  await plugin.startup();
}

function onMainWindowLoad({ window }) {
  if (plugin) {
    plugin.addToWindow(window);
  }
}

function onMainWindowUnload({ window }) {
  if (plugin) {
    plugin.removeFromWindow(window);
  }
}

async function shutdown() {
  if (plugin) {
    await plugin.shutdown();
    plugin = null;
  }
  if (chromeHandle) {
    chromeHandle.destruct();
    chromeHandle = null;
  }
}

function registerChrome(rootURI) {
  var aomStartup = Cc["@mozilla.org/addons/addon-manager-startup;1"].getService(
    Ci.amIAddonManagerStartup
  );
  var manifestURI = Services.io.newURI(rootURI + "manifest.json");
  chromeHandle = aomStartup.registerChrome(manifestURI, [
    ["content", "zotero-research-workbench", "chrome/content/"]
  ]);
}
