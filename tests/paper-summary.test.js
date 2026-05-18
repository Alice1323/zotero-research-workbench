const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildChinesePaperSummaryPrompt,
  buildSummaryCopyText,
  normalizePaperContext,
  parseChatCompletionText,
  requestPaperSummary
} = require("../src/core/paperSummary");

test("normalizePaperContext formats Zotero item metadata without mutating source item", () => {
  const item = {
    key: "ABCD1234",
    itemType: "journalArticle",
    fields: {
      title: "Metformin and gut microbiota in PCOS",
      abstractNote: "This study evaluates microbiome changes after metformin treatment.",
      DOI: "10.1000/pcos.2026",
      publicationTitle: "Journal of Endocrine Research",
      date: "2026-03-15"
    },
    creators: [
      { firstName: "Li", lastName: "Wang" },
      { name: "PCOS Microbiome Consortium" }
    ]
  };

  const context = normalizePaperContext({
    key: item.key,
    itemType: item.itemType,
    title: item.fields.title,
    abstractNote: item.fields.abstractNote,
    doi: item.fields.DOI,
    publicationTitle: item.fields.publicationTitle,
    date: item.fields.date,
    creators: item.creators
  });

  assert.deepEqual(context, {
    key: "ABCD1234",
    itemType: "journalArticle",
    title: "Metformin and gut microbiota in PCOS",
    authors: "Li Wang；PCOS Microbiome Consortium",
    year: "2026",
    publicationTitle: "Journal of Endocrine Research",
    abstractNote: "This study evaluates microbiome changes after metformin treatment.",
    doi: "10.1000/pcos.2026"
  });
  assert.equal(item.fields.title, "Metformin and gut microbiota in PCOS");
});

test("normalizePaperContext uses Chinese placeholders for missing optional metadata", () => {
  const context = normalizePaperContext({
    key: "NOABS001",
    title: "Untitled selected record",
    creators: []
  });

  assert.equal(context.authors, "未记录");
  assert.equal(context.year, "未记录");
  assert.equal(context.publicationTitle, "未记录");
  assert.equal(context.abstractNote, "未记录摘要");
  assert.equal(context.doi, "未记录");
});

test("buildChinesePaperSummaryPrompt requests a structured Chinese reading note", () => {
  const prompt = buildChinesePaperSummaryPrompt({
    title: "Metformin and gut microbiota in PCOS",
    authors: "Li Wang",
    year: "2026",
    publicationTitle: "Journal of Endocrine Research",
    abstractNote: "This study evaluates microbiome changes after metformin treatment.",
    doi: "10.1000/pcos.2026"
  });

  assert.match(prompt, /请用中文/);
  assert.match(prompt, /研究问题/);
  assert.match(prompt, /研究方法/);
  assert.match(prompt, /主要发现/);
  assert.match(prompt, /局限性/);
  assert.match(prompt, /Metformin and gut microbiota in PCOS/);
  assert.doesNotMatch(prompt, /undefined|null/);
});

test("parseChatCompletionText extracts assistant text from OpenAI-compatible response", () => {
  assert.equal(
    parseChatCompletionText({
      choices: [{ message: { content: "中文总结内容" } }]
    }),
    "中文总结内容"
  );

  assert.throws(
    () => parseChatCompletionText({ choices: [{ message: { content: "" } }] }),
    /LLM 响应为空/
  );
});

test("requestPaperSummary reports Chinese error when provider returns non-JSON body", async () => {
  await assert.rejects(
    () =>
      requestPaperSummary({
        paper: { title: "Example", creators: [] },
        settings: {
          baseUrl: "https://api.example.test/v1",
          apiKey: "sk-secret",
          model: "model-a"
        },
        fetchImpl: async () => ({
          ok: true,
          status: 200,
          text: async () => "<html>gateway error</html>"
        })
      }),
    /LLM 服务返回了无法解析的响应/
  );
});

test("buildSummaryCopyText formats selected paper metadata and generated result", () => {
  const text = buildSummaryCopyText({
    paper: {
      title: "Metformin and gut microbiota in PCOS",
      authors: "Li Wang",
      year: "2026",
      publicationTitle: "Journal of Endocrine Research",
      doi: "10.1000/pcos.2026"
    },
    summary: "研究问题：示例问题\n主要发现：示例发现"
  });

  assert.equal(
    text,
    [
      "Zotero 研究工作台 - 文献总结",
      "",
      "标题：Metformin and gut microbiota in PCOS",
      "作者：Li Wang",
      "年份：2026",
      "期刊/来源：Journal of Endocrine Research",
      "DOI：10.1000/pcos.2026",
      "",
      "生成结果：",
      "研究问题：示例问题\n主要发现：示例发现"
    ].join("\n")
  );
});
