function normalizePaperContext(input) {
  const title = cleanText(input.title) || "未命名条目";
  return {
    key: cleanText(input.key),
    itemType: cleanText(input.itemType),
    title,
    authors: formatCreators(input.creators),
    year: extractYear(input.date),
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

module.exports = {
  buildChinesePaperSummaryPrompt,
  normalizePaperContext,
  parseChatCompletionText
};
