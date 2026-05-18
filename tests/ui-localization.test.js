const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

test("manifest presents Chinese product name and description", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));

  assert.equal(manifest.name, "Zotero 研究工作台");
  assert.equal(manifest.description, "面向 Zotero 8/9 的单篇论文阅读与研究工作流插件。");
});

test("Zotero tools menu uses Chinese label", () => {
  const plugin = fs.readFileSync(path.join(root, "chrome/content/workbenchPlugin.mjs"), "utf8");

  assert.match(plugin, /打开研究工作台/);
  assert.doesNotMatch(plugin, /Open Research Workbench/);
});

test("research panel exposes Chinese LLM provider settings", () => {
  const panel = fs.readFileSync(path.join(root, "chrome/content/researchPanel.xhtml"), "utf8");

  for (const text of [
    "Zotero 研究工作台",
    "研究面板",
    "选中文献",
    "刷新当前上下文",
    "总结选中文献",
    "生成结果",
    "复制结果",
    "全局入口",
    "LLM 服务商设置",
    "接口地址",
    "API 密钥",
    "模型名称",
    "保存设置",
    "测试连接"
  ]) {
    assert.match(panel, new RegExp(text));
  }

  assert.match(panel, /type="password"/);
  assert.match(panel, /class="result-header"/);
  assert.match(panel, /align-items:\s*center/);
  assert.doesNotMatch(panel, /Current item actions will appear here/);
  assert.doesNotMatch(panel, /Global Entry Point/);
});
