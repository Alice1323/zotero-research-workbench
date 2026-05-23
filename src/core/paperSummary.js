const { resolvePromptTemplate, renderPrompt } = require("./index");
const {
  assertLlmRuntimeRequestAllowed,
  createLlmRuntimeGuard,
  estimatePromptTokens
} = require("./llmRuntimeGuard");
const { parseChatCompletionText, requestOpenAICompatibleChatCompletion } = require("./providerChatCompletion");

function normalizePaperContext(input) {
  const title = cleanText(input.title) || "未命名条目";
  return {
    key: cleanText(input.key),
    itemType: cleanText(input.itemType),
    title,
    authors: cleanText(input.authors) || formatCreators(input.creators),
    year: cleanText(input.year) || extractYear(input.date),
    publicationTitle: cleanText(input.publicationTitle) || "未记录",
    abstractNote: cleanText(input.abstractNote) || "未记录摘要",
    doi: cleanText(input.doi) || "未记录"
  };
}

function selectBestPdfAttachment(attachments) {
  const candidates = Array.isArray(attachments) ? attachments : [];
  for (const attachment of candidates) {
    const normalized = normalizePdfAttachment(attachment);
    if (isPdfAttachment(normalized)) {
      return {
        available: true,
        title: normalized.title,
        path: normalized.path,
        contentType: normalized.contentType
      };
    }
  }
  return {
    available: false,
    title: "",
    path: "",
    contentType: ""
  };
}

function buildChinesePaperSummaryPrompt(context) {
  return renderPrompt(resolvePromptTemplate("single-paper-chinese-summary"), createPaperPromptContext(context));
}

function buildChineseReadingContextTranslationPrompt(context) {
  return renderPrompt(resolvePromptTemplate("reading-context-chinese-translation"), createReadingPromptContext(context));
}

function buildSummaryCopyText({ paper, summary, draft }) {
  const normalized = normalizePaperContext(paper || {});
  const lines = [
    draft?.promptTaskTemplateId === "reading-context-chinese-translation"
      ? "Zotero 研究工作台 - 阅读上下文翻译"
      : "Zotero 研究工作台 - 文献总结",
    "",
    `标题：${normalized.title}`,
    `作者：${normalized.authors}`,
    `年份：${normalized.year}`,
    `期刊/来源：${normalized.publicationTitle}`,
    `DOI：${normalized.doi}`
  ];
  if (draft?.promptTaskTemplateId === "reading-context-chinese-translation") {
    lines.push(`页码：${cleanText(draft?.inputContext?.pageLabel) || "未记录"}`, "", "原文：");
    lines.push(cleanSelectedText(draft?.inputContext?.selectedText) || "未记录");
  }
  lines.push("", "生成结果：", cleanText(summary));
  return lines.join("\n");
}

function buildZoteroNoteHtml({ draft, savedAt }) {
  const context = draft?.inputContext || {};
  const timestamp = cleanText(savedAt) || new Date().toISOString();
  const noteKind =
    draft?.promptTaskTemplateId === "multi-paper-commonality-note"
      ? "Zotero 研究工作台 - 共同点笔记"
      : draft?.promptTaskTemplateId === "reading-context-chinese-translation"
      ? "Zotero 研究工作台 - 阅读上下文翻译"
      : "Zotero 研究工作台 - 文献总结";
  const metadata = buildZoteroNoteMetadata({ context, draft });
  const lines = [
    `<h1>${escapeHtml(draft?.title || noteKind)}</h1>`,
    `<p><strong>${escapeHtml(noteKind)}</strong></p>`,
    "<ul>",
    ...metadata.map(([label, value]) => `<li>${escapeHtml(label)}：${escapeHtml(value || "未记录")}</li>`),
    `<li>模型：${escapeHtml(draft?.llmProviderId || "未记录")}</li>`,
    `<li>草稿时间：${escapeHtml(draft?.createdAt || "未记录")}</li>`,
    `<li>写入时间：${escapeHtml(timestamp)}</li>`,
    "</ul>",
    "<h2>生成结果</h2>",
    `<p>${formatNoteBody(draft?.content || "")}</p>`
  ];
  return lines.join("");
}

function buildZoteroNoteMetadata({ context, draft }) {
  if (draft?.promptTaskTemplateId === "multi-paper-commonality-note") {
    const papers = Array.isArray(context.selectedPapers) ? context.selectedPapers : [];
    return [
      ["任务", context.requestText || "共同点综合"],
      ["文献数量", papers.length ? String(papers.length) : "未记录"],
      ["来源文献", papers.map((paper) => cleanText(paper?.title)).filter(Boolean).join("；") || "未记录"]
    ];
  }
  if (draft?.promptTaskTemplateId === "reading-context-chinese-translation") {
    return [
      ["标题", context.title || draft?.title || "未命名条目"],
      ["来源", context.source || "未记录"],
      ["页码", context.pageLabel || "未记录"],
      ["原文", context.selectedText || "未记录"]
    ];
  }
  return [
    ["标题", context.title || draft?.title || "未命名条目"],
    ["作者", context.authors || "未记录"],
    ["年份", context.year || "未记录"],
    ["期刊/来源", context.publicationTitle || "未记录"],
    ["DOI", context.doi || "未记录"]
  ];
}

function markSummaryDraftSavedToZotero({ snapshot, draftId, zoteroNoteKey, savedAt }) {
  const timestamp = cleanText(savedAt) || new Date().toISOString();
  const next = cloneSnapshot(snapshot);
  const drafts = Array.isArray(next.researchNoteDrafts) ? next.researchNoteDrafts : [];
  const draft = drafts.find((entry) => entry?.id === draftId);
  if (!draft) {
    throw new Error(`草稿不存在：${draftId}`);
  }

  draft.confirmationState = "confirmed";
  draft.confirmedZoteroNoteKey = cleanText(zoteroNoteKey);
  draft.confirmedAt = timestamp;
  draft.provenance = {
    ...(draft.provenance || {}),
    writeTarget: "zotero-note"
  };

  next.taskLedger = Array.isArray(next.taskLedger) ? next.taskLedger : [];
  next.taskLedger.push({
    id: `task-${draft.id}-save-to-zotero-note`,
    workflowStep: "save-to-zotero-note",
    state: "completed",
    providerId: draft.llmProviderId || null,
    promptTaskTemplateId: draft.promptTaskTemplateId || null,
    outputLocation: { draftId: draft.id, zoteroNoteKey: cleanText(zoteroNoteKey) },
    errorNotice: null,
    startedAt: timestamp,
    completedAt: timestamp,
    provenance: {
      source: "explicit-user-action",
      writeTarget: "zotero-note"
    }
  });
  next.exportedAt = timestamp;
  return next;
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

function createReadingTranslationDraftInput({ context, translation, model, createdAt, paper }) {
  const timestamp = cleanText(createdAt) || new Date().toISOString();
  const selectedText = cleanSelectedText(context?.text);
  const itemKey = cleanText(context?.itemKey) || cleanText(paper?.key);
  const normalizedPaper = normalizePaperContext({
    ...(paper || {}),
    key: itemKey || paper?.key
  });
  return {
    id: `draft-${itemKey || "unknown"}-translation-${createStableTimestamp(timestamp)}`,
    zoteroItemKey: itemKey,
    workId: createWorkId(normalizedPaper),
    title: `${normalizedPaper.title} - 阅读上下文翻译`,
    content: cleanText(translation),
    promptTaskTemplateId: "reading-context-chinese-translation",
    llmProviderId: cleanText(model),
    inputContext: {
      title: normalizedPaper.title,
      selectedText,
      source: cleanText(context?.source),
      pageLabel: cleanText(context?.pageLabel)
    },
    createdAt: timestamp,
    provenance: {
      source: "zotero-reader-selection",
      model: cleanText(model),
      writeTarget: "local-draft-only"
    }
  };
}

function listRecentSummaryDrafts(snapshot, limit = 5) {
  const maxItems = Number.isInteger(limit) && limit > 0 ? limit : 5;
  return (Array.isArray(snapshot?.researchNoteDrafts) ? snapshot.researchNoteDrafts : [])
    .filter(
      (draft) =>
        draft?.confirmationState === "draft" &&
        ["single-paper-chinese-summary", "reading-context-chinese-translation", "multi-paper-commonality-note"].includes(
          draft?.promptTaskTemplateId
        )
    )
    .slice()
    .sort((left, right) => Date.parse(right.createdAt || "") - Date.parse(left.createdAt || ""))
    .slice(0, maxItems)
    .map((draft) => ({
      id: cleanText(draft.id),
      title: cleanText(draft.title),
      content: cleanText(draft.content),
      createdAt: cleanText(draft.createdAt),
      model: cleanText(draft.llmProviderId),
      promptTaskTemplateId: cleanText(draft.promptTaskTemplateId),
      inputContext: cloneSnapshot(draft.inputContext || {}),
      confirmationState: cleanText(draft.confirmationState)
    }));
}

function listRecentGraphSeeds(snapshot, limit = 5) {
  const maxItems = Number.isInteger(limit) && limit > 0 ? limit : 5;
  return (Array.isArray(snapshot?.graphSeeds) ? snapshot.graphSeeds : [])
    .slice()
    .sort((left, right) => parseTimestamp(right.createdAt) - parseTimestamp(left.createdAt))
    .slice(0, maxItems)
    .map((seed) => ({
      id: cleanDisplayText(seed?.id),
      sourceTitle: cleanDisplayText(seed?.source?.title || seed?.workId) || "未记录",
      relationType: cleanDisplayText(seed?.relationType) || "related",
      target: describeTarget(seed?.target),
      evidence: describeEvidence(seed?.evidence),
      provider: cleanDisplayText(seed?.providerId) || "未记录",
      confidence: cleanDisplayText(seed?.confidence) || "low",
      seedKind: cleanDisplayText(seed?.seedKind) || "ai-inferred",
      createdAt: cleanDisplayText(seed?.createdAt)
    }));
}

function listRecentTaskLedger(snapshot, limit = 5) {
  const maxItems = Number.isInteger(limit) && limit > 0 ? limit : 5;
  return (Array.isArray(snapshot?.taskLedger) ? snapshot.taskLedger : [])
    .slice()
    .sort((left, right) => parseTimestamp(taskTimestamp(right)) - parseTimestamp(taskTimestamp(left)))
    .slice(0, maxItems)
    .map((task) => ({
      id: cleanDisplayText(task?.id),
      workflowStep: cleanDisplayText(task?.workflowStep) || "未记录",
      state: cleanDisplayText(task?.state) || "unknown",
      provider: cleanDisplayText(task?.providerId) || "未记录",
      promptTaskTemplateId: cleanDisplayText(task?.promptTaskTemplateId) || "未记录",
      outputLocation: describeOutputLocation(task?.outputLocation),
      errorMessage: describeTaskError(task?.errorNotice),
      occurredAt: cleanDisplayText(taskTimestamp(task))
    }));
}

async function requestReadingContextTranslation({ context, settings, fetchImpl, promptOverrides, runtimeGuard }) {
  const prompt = renderPrompt(
    resolvePromptTemplate("reading-context-chinese-translation", promptOverrides),
    createReadingPromptContext(context)
  );
  assertLlmRuntimeRequestAllowed({
    prompt,
    settings,
    taskType: "reading-context-chinese-translation",
    runtimeGuard
  });
  return requestOpenAICompatibleChatCompletion({
    settings,
    prompt,
    temperature: 0.1,
    fetchImpl,
    failureMessage: "翻译生成失败"
  });
}

async function requestPaperSummary({ paper, settings, fetchImpl, promptOverrides, runtimeGuard }) {
  const prompt = renderPrompt(
    resolvePromptTemplate("single-paper-chinese-summary", promptOverrides),
    createPaperPromptContext(paper)
  );
  assertLlmRuntimeRequestAllowed({
    prompt,
    settings,
    taskType: "single-paper-chinese-summary",
    runtimeGuard
  });
  return requestOpenAICompatibleChatCompletion({
    settings,
    prompt,
    temperature: 0.2,
    fetchImpl,
    failureMessage: "总结生成失败"
  });
}

function createPaperPromptContext(input) {
  const paper = normalizePaperContext(input || {});
  return {
    itemTitle: paper.title,
    itemAuthors: paper.authors,
    abstract: paper.abstractNote,
    year: paper.year,
    publicationTitle: paper.publicationTitle,
    doi: paper.doi
  };
}

function createReadingPromptContext(context) {
  return {
    selectedText: cleanSelectedText(context?.text),
    pageLabel: cleanText(context?.pageLabel) || "未记录",
    source: cleanText(context?.source) || "reader-selection"
  };
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

function normalizePdfAttachment(attachment) {
  return {
    title: cleanDisplayText(attachment?.title || attachment?.filename || attachment?.name),
    path: cleanDisplayText(attachment?.path || attachment?.filePath),
    contentType: cleanDisplayText(attachment?.contentType || attachment?.mimeType)
  };
}

function isPdfAttachment(attachment) {
  const contentType = attachment.contentType.toLowerCase();
  const path = attachment.path.toLowerCase();
  const title = attachment.title.toLowerCase();
  return contentType === "application/pdf" || path.endsWith(".pdf") || title.endsWith(".pdf");
}

function cleanDisplayText(value) {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "object" || typeof value === "function") {
    return "";
  }
  return String(value).trim();
}

function describeTarget(target) {
  if (!target || typeof target !== "object") {
    return cleanDisplayText(target) || "未记录";
  }
  return (
    cleanDisplayText(target.text) ||
    cleanDisplayText(target.title) ||
    cleanDisplayText(target.doi) ||
    cleanDisplayText(target.key) ||
    describeKeyValueObject(target)
  );
}

function describeEvidence(evidence) {
  if (!evidence || typeof evidence !== "object") {
    return cleanDisplayText(evidence) || "未记录";
  }
  return cleanDisplayText(evidence.text) || describeKeyValueObject(evidence);
}

function describeOutputLocation(outputLocation) {
  if (!outputLocation || typeof outputLocation !== "object") {
    return cleanDisplayText(outputLocation) || "未记录";
  }
  return describeKeyValueObject(outputLocation);
}

function describeTaskError(errorNotice) {
  if (!errorNotice) {
    return "无";
  }
  if (typeof errorNotice !== "object") {
    return cleanDisplayText(errorNotice) || "无";
  }
  return cleanDisplayText(errorNotice.message) || describeKeyValueObject(errorNotice);
}

function describeKeyValueObject(value) {
  const entries = Object.entries(value || {})
    .map(([key, entry]) => [cleanDisplayText(key), cleanDisplayText(entry)])
    .filter(([key, entry]) => key && entry);
  return entries.length ? entries.map(([key, entry]) => `${key}: ${entry}`).join("；") : "未记录";
}

function taskTimestamp(task) {
  return task?.completedAt || task?.startedAt || "";
}

function parseTimestamp(value) {
  const timestamp = Date.parse(cleanDisplayText(value));
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function cleanSelectedText(value) {
  return cleanText(value).replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
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

function cloneSnapshot(snapshot) {
  return JSON.parse(JSON.stringify(snapshot || {}));
}

function formatNoteBody(value) {
  return escapeHtml(cleanText(value)).replace(/\r?\n/g, "<br/>");
}

function escapeHtml(value) {
  return cleanText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

module.exports = {
  buildChineseReadingContextTranslationPrompt,
  buildChinesePaperSummaryPrompt,
  buildSummaryCopyText,
  buildZoteroNoteHtml,
  assertLlmRuntimeRequestAllowed,
  createLlmRuntimeGuard,
  createReadingTranslationDraftInput,
  createSummaryDraftInput,
  estimatePromptTokens,
  listRecentGraphSeeds,
  listRecentSummaryDrafts,
  listRecentTaskLedger,
  markSummaryDraftSavedToZotero,
  normalizePaperContext,
  parseChatCompletionText,
  requestReadingContextTranslation,
  requestPaperSummary,
  selectBestPdfAttachment
};
