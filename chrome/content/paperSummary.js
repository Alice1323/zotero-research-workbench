(function () {
  const PREFS = {
    baseUrl: "extensions.zotero-research-workbench.provider.baseUrl",
    apiKey: "extensions.zotero-research-workbench.provider.apiKey",
    model: "extensions.zotero-research-workbench.provider.model",
    snapshot: "extensions.zotero-research-workbench.store.snapshot"
  };

  function getField(id) {
    return document.getElementById(id);
  }

  function getZotero() {
    return window.arguments?.[0]?.Zotero || window.opener?.Zotero || window.Zotero;
  }

  function getPref(key) {
    return getZotero()?.Prefs?.get(key) || "";
  }

  function setPref(key, value) {
    const zotero = getZotero();
    if (!zotero?.Prefs?.set) {
      throw new Error("Zotero preferences are unavailable");
    }
    zotero.Prefs.set(key, value);
  }

  async function refreshSelectedPaper() {
    const status = getField("paper-summary-status");
    const paper = readSelectedPaperContext();
    window.WorkbenchSelectedPaper = paper;

    if (!paper) {
      status.textContent = "请先在 Zotero 中选中一篇文献";
      renderPaperContext(null);
      return null;
    }

    renderPaperContext(paper);
    status.textContent = "已读取选中文献";
    return paper;
  }

  async function summarizeSelectedPaper() {
    const status = getField("paper-summary-status");
    const output = getField("paper-summary-output");
    const paper = window.WorkbenchSelectedPaper || (await refreshSelectedPaper());
    if (!paper) {
      return;
    }

    const settings = {
      baseUrl: getPref(PREFS.baseUrl),
      apiKey: getPref(PREFS.apiKey),
      model: getPref(PREFS.model)
    };
    if (!settings.baseUrl || !settings.model) {
      status.textContent = "请先保存接口地址和模型名称";
      return;
    }
    if (!settings.apiKey) {
      status.textContent = "请先填写并保存 API 密钥";
      return;
    }

    status.textContent = "正在生成中文总结...";
    output.textContent = "";

    try {
      const summary = await requestPaperSummary({ paper, settings, fetchImpl: window.fetch.bind(window) });
      output.textContent = summary;
      window.WorkbenchLastSummary = summary;
      const draft = saveSummaryDraft({ paper, summary, model: settings.model });
      status.textContent = "总结已生成";
      renderDraftStatus(draft);
    } catch (error) {
      status.textContent = error?.message || "总结生成失败";
    }
  }

  async function copyGeneratedResult() {
    const status = getField("paper-summary-status");
    const summary = cleanText(getField("paper-summary-output").textContent);
    if (!summary) {
      status.textContent = "暂无可复制的生成结果";
      return;
    }

    const text = buildSummaryCopyText({
      paper: window.WorkbenchSelectedPaper || {},
      summary
    });

    try {
      await writeClipboardText(text);
      status.textContent = "生成结果已复制";
    } catch (_error) {
      status.textContent = "复制失败，请手动选择生成结果";
    }
  }

  function readSelectedPaperContext() {
    const Zotero = getZotero();
    const win = Zotero?.getMainWindow?.();
    const selectedItems = win?.ZoteroPane?.getSelectedItems?.() || Zotero?.Pane?.getSelectedItems?.() || [];
    const item = selectedItems.find((entry) => entry && !entry.isNote?.() && !entry.isAttachment?.());
    if (!item) {
      return null;
    }

    return normalizePaperContext({
      key: item.key,
      itemType: item.itemType || item.getField?.("itemType"),
      title: item.getField?.("title"),
      abstractNote: item.getField?.("abstractNote"),
      doi: item.getField?.("DOI"),
      publicationTitle: item.getField?.("publicationTitle") || item.getField?.("bookTitle"),
      date: item.getField?.("date"),
      creators: item.getCreators?.() || []
    });
  }

  function renderPaperContext(paper) {
    getField("selected-paper-title").textContent = paper?.title || "未选择文献";
    getField("selected-paper-meta").textContent = paper
      ? `${paper.authors}｜${paper.year}｜${paper.publicationTitle}`
      : "请在 Zotero 主窗口中选中一篇文献";
    getField("selected-paper-abstract").textContent = paper?.abstractNote || "";
  }

  function saveSummaryDraft({ paper, summary, model }) {
    const snapshot = loadWorkbenchSnapshot();
    const draftInput = createSummaryDraftInput({
      paper,
      summary,
      model,
      createdAt: new Date().toISOString()
    });
    const draft = {
      ...draftInput,
      confirmationState: "draft"
    };

    snapshot.researchNoteDrafts = snapshot.researchNoteDrafts || [];
    snapshot.taskLedger = snapshot.taskLedger || [];
    snapshot.researchNoteDrafts.push(draft);
    snapshot.taskLedger.push({
      id: `task-${draft.id}`,
      workflowStep: "create-research-note-draft",
      state: "completed",
      providerId: model,
      promptTaskTemplateId: draft.promptTaskTemplateId,
      outputLocation: { draftId: draft.id },
      errorNotice: null,
      startedAt: draft.createdAt,
      completedAt: draft.createdAt,
      provenance: {
        source: "zotero-selection",
        writeTarget: "local-draft-only"
      }
    });
    snapshot.exportedAt = new Date().toISOString();
    setPref(PREFS.snapshot, JSON.stringify(snapshot));
    window.WorkbenchLastDraft = draft;
    return draft;
  }

  function loadWorkbenchSnapshot() {
    const raw = getPref(PREFS.snapshot);
    if (!raw) {
      return createEmptySnapshot();
    }
    try {
      const snapshot = JSON.parse(raw);
      return snapshot?.schemaVersion === 1 ? snapshot : createEmptySnapshot();
    } catch (_error) {
      return createEmptySnapshot();
    }
  }

  function createEmptySnapshot() {
    return {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      providers: [],
      promptTemplates: [],
      researchNoteDrafts: [],
      graphSeeds: [],
      taskLedger: []
    };
  }

  function renderDraftStatus(draft) {
    getField("paper-draft-status").textContent = draft
      ? `已自动保存为草稿（${formatLocalTime(draft.createdAt)}）`
      : "当前结果尚未保存";
  }

  async function requestPaperSummary({ paper, settings, fetchImpl }) {
    const response = await fetchImpl(`${settings.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [{ role: "user", content: buildChinesePaperSummaryPrompt(paper) }],
        temperature: 0.2
      })
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("API 密钥无效");
      }
      if (response.status === 408 || response.status === 504) {
        throw new Error("请求超时");
      }
      throw new Error(`总结生成失败（HTTP ${response.status}）`);
    }

    return parseChatCompletionText(parseJsonResponseText(await readResponseText(response)));
  }

  function normalizePaperContext(input) {
    return {
      key: cleanText(input.key),
      itemType: cleanText(input.itemType),
      title: cleanText(input.title) || "未命名条目",
      authors: cleanText(input.authors) || formatCreators(input.creators),
      year: cleanText(input.year) || extractYear(input.date),
      publicationTitle: cleanText(input.publicationTitle) || "未记录",
      abstractNote: cleanText(input.abstractNote) || "未记录摘要",
      doi: cleanText(input.doi) || "未记录"
    };
  }

  function buildChinesePaperSummaryPrompt(context) {
    const paper = normalizePaperContext(context);
    return [
      "请用中文为下面这篇 Zotero 文献生成研究阅读摘要。",
      "",
      "输出格式必须包含以下小标题：",
      "1. 研究问题",
      "2. 研究方法",
      "3. 主要发现",
      "4. 局限性",
      "5. 对后续阅读的建议",
      "",
      "文献信息：",
      `标题：${paper.title}`,
      `作者：${paper.authors}`,
      `年份：${paper.year}`,
      `期刊/来源：${paper.publicationTitle}`,
      `DOI：${paper.doi}`,
      `摘要：${paper.abstractNote}`,
      "",
      "要求：不要编造摘要中没有的信息；如果信息不足，请明确写出“原始记录未提供”。"
    ].join("\n");
  }

  function parseChatCompletionText(body) {
    const text = body?.choices?.[0]?.message?.content;
    if (!cleanText(text)) {
      throw new Error("LLM 响应为空");
    }
    return text.trim();
  }

  function buildSummaryCopyText({ paper, summary }) {
    const normalized = normalizePaperContext(paper || {});
    return [
      "Zotero 研究工作台 - 文献总结",
      "",
      `标题：${normalized.title}`,
      `作者：${normalized.authors}`,
      `年份：${normalized.year}`,
      `期刊/来源：${normalized.publicationTitle}`,
      `DOI：${normalized.doi}`,
      "",
      "生成结果：",
      cleanText(summary)
    ].join("\n");
  }

  function createSummaryDraftInput({ paper, summary, model, createdAt }) {
    const normalized = normalizePaperContext(paper || {});
    const timestamp = cleanText(createdAt) || new Date().toISOString();
    return {
      id: `draft-${normalized.key || "unknown"}-${createStableTimestamp(timestamp)}`,
      zoteroItemKey: normalized.key,
      workId: createWorkId(normalized),
      title: `${normalized.title} - 中文总结`,
      content: cleanText(summary),
      promptTaskTemplateId: "single-paper-chinese-summary",
      llmProviderId: cleanText(model),
      inputContext: {
        title: normalized.title,
        authors: normalized.authors,
        year: normalized.year,
        publicationTitle: normalized.publicationTitle,
        doi: normalized.doi
      },
      createdAt: timestamp,
      provenance: {
        source: "zotero-selection",
        model: cleanText(model),
        writeTarget: "local-draft-only"
      }
    };
  }

  async function writeClipboardText(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "readonly");
    textarea.style.position = "fixed";
    textarea.style.inset = "-1000px auto auto -1000px";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand?.("copy");
    textarea.remove();
    if (!copied) {
      throw new Error("copy failed");
    }
  }

  async function readResponseText(response) {
    if (typeof response.text === "function") {
      return response.text();
    }
    if (typeof response.json === "function") {
      try {
        return JSON.stringify(await response.json());
      } catch (_error) {
        return "";
      }
    }
    return "";
  }

  function parseJsonResponseText(text) {
    try {
      return JSON.parse(text);
    } catch (_error) {
      throw new Error("LLM 服务返回了无法解析的响应，请检查接口地址是否为 OpenAI 兼容地址");
    }
  }

  function formatCreators(creators) {
    if (!Array.isArray(creators) || creators.length === 0) {
      return "未记录";
    }

    const names = creators
      .map((creator) => {
        if (cleanText(creator.name)) {
          return cleanText(creator.name);
        }
        return [creator.firstName, creator.lastName].map(cleanText).filter(Boolean).join(" ");
      })
      .filter(Boolean);
    return names.length ? names.join("；") : "未记录";
  }

  function extractYear(date) {
    const value = cleanText(date);
    if (!value) {
      return "未记录";
    }
    const match = value.match(/\b(1[5-9]\d{2}|20\d{2}|21\d{2})\b/);
    return match ? match[1] : "未记录";
  }

  function cleanText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function createWorkId(paper) {
    if (paper.doi && paper.doi !== "未记录") {
      return `work:doi:${paper.doi}`;
    }
    return `work:zotero:${paper.key || "unknown"}`;
  }

  function createStableTimestamp(value) {
    return value.replace(/[^0-9A-Za-z]+/g, "-").replace(/-$/, "");
  }

  function formatLocalTime(value) {
    try {
      return new Date(value).toLocaleString("zh-CN", { hour12: false });
    } catch (_error) {
      return value;
    }
  }

  function init() {
    getField("refresh-paper-context").addEventListener("click", refreshSelectedPaper);
    getField("summarize-selected-paper").addEventListener("click", summarizeSelectedPaper);
    getField("copy-paper-summary").addEventListener("click", copyGeneratedResult);
    refreshSelectedPaper();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  window.WorkbenchPaperSummary = {
    buildChinesePaperSummaryPrompt,
    buildSummaryCopyText,
    createSummaryDraftInput,
    copyGeneratedResult,
    loadWorkbenchSnapshot,
    normalizePaperContext,
    parseChatCompletionText,
    readSelectedPaperContext,
    requestPaperSummary,
    saveSummaryDraft
  };
})();
