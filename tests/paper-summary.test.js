const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildChinesePaperSummaryPrompt,
  normalizePaperContext,
  parseChatCompletionText
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
