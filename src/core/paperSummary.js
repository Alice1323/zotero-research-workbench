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

module.exports = {
  buildChinesePaperSummaryPrompt,
  buildSummaryCopyText,
  normalizePaperContext,
  parseChatCompletionText,
  requestPaperSummary
};
