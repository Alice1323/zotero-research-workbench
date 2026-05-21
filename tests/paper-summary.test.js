const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const {
  buildChineseReadingContextTranslationPrompt,
  buildChinesePaperSummaryPrompt,
  buildSummaryCopyText,
  buildZoteroNoteHtml,
  createLlmRuntimeGuard,
  createReadingTranslationDraftInput,
  createSummaryDraftInput,
  listRecentGraphSeeds,
  listRecentSummaryDrafts,
  listRecentTaskLedger,
  markSummaryDraftSavedToZotero,
  normalizePaperContext,
  parseChatCompletionText,
  requestReadingContextTranslation,
  requestPaperSummary,
  selectBestPdfAttachment
} = require("../src/core/paperSummary");

const {
  assertLlmRuntimeRequestAllowed: assertGuardRequestAllowed,
  createLlmRuntimeGuard: createSharedLlmRuntimeGuard,
  estimatePromptTokens: estimateSharedPromptTokens
} = require("../src/core/llmRuntimeGuard");

const root = path.resolve(__dirname, "..");

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

test("selectBestPdfAttachment selects the first PDF attachment with a local path", () => {
  const attachment = selectBestPdfAttachment([
    {
      title: "supplement.txt",
      path: "C:\\papers\\supplement.txt",
      contentType: "text/plain"
    },
    {
      title: "main paper",
      path: "C:\\papers\\main-paper.pdf",
      contentType: "application/pdf"
    },
    {
      title: "second.pdf",
      path: "C:\\papers\\second.pdf",
      contentType: "application/pdf"
    }
  ]);

  assert.deepEqual(attachment, {
    available: true,
    title: "main paper",
    path: "C:\\papers\\main-paper.pdf",
    contentType: "application/pdf"
  });
});

test("selectBestPdfAttachment treats pdf file paths as PDF attachments", () => {
  const attachment = selectBestPdfAttachment([
    {
      title: "publisher attachment",
      path: "C:\\papers\\publisher-copy.PDF",
      contentType: ""
    }
  ]);

  assert.equal(attachment.available, true);
  assert.equal(attachment.path, "C:\\papers\\publisher-copy.PDF");
});

test("selectBestPdfAttachment does not stringify async PDF path promises", () => {
  const attachment = selectBestPdfAttachment([
    {
      title: "publisher-copy.pdf",
      path: Promise.resolve("C:\\papers\\publisher-copy.pdf"),
      contentType: "application/pdf"
    }
  ]);

  assert.deepEqual(attachment, {
    available: true,
    title: "publisher-copy.pdf",
    path: "",
    contentType: "application/pdf"
  });
});

test("selectBestPdfAttachment returns unavailable when no PDF attachment exists", () => {
  assert.deepEqual(
    selectBestPdfAttachment([
      {
        title: "dataset.csv",
        path: "C:\\papers\\dataset.csv",
        contentType: "text/csv"
      }
    ]),
    {
      available: false,
      title: "",
      path: "",
      contentType: ""
    }
  );
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

test("requestPaperSummary uses a saved prompt override when present", async () => {
  let requestedBody = null;

  await requestPaperSummary({
    paper: {
      title: "Metformin and gut microbiota in PCOS",
      authors: "Li Wang",
      abstractNote: "This study evaluates microbiome changes after metformin treatment."
    },
    settings: {
      baseUrl: "https://api.example.test/v1",
      apiKey: "sk-secret",
      model: "model-a"
    },
    promptOverrides: [
      {
        templateId: "single-paper-chinese-summary",
        template: "只输出自定义总结：{{itemTitle}}\n{{abstract}}"
      }
    ],
    fetchImpl: async (_url, options) => {
      requestedBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ choices: [{ message: { content: "自定义总结结果" } }] })
      };
    }
  });

  assert.equal(
    requestedBody.messages[0].content,
    [
      "只输出自定义总结：Metformin and gut microbiota in PCOS",
      "This study evaluates microbiome changes after metformin treatment."
    ].join("\n")
  );
  assert.doesNotMatch(requestedBody.messages[0].content, /研究问题/);
});

test("requestPaperSummary blocks prompts over the max input token limit before fetch", async () => {
  let fetchCalled = false;

  await assert.rejects(
    () =>
      requestPaperSummary({
        paper: {
          title: "Oversized input",
          abstractNote: "长".repeat(1300),
          creators: []
        },
        settings: {
          baseUrl: "https://api.example.test/v1",
          apiKey: "sk-secret",
          model: "model-a",
          maxInputTokensPerTask: 1000
        },
        promptOverrides: [
          {
            templateId: "single-paper-chinese-summary",
            template: "{{abstract}}"
          }
        ],
        fetchImpl: async () => {
          fetchCalled = true;
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ choices: [{ message: { content: "不应发送" } }] })
          };
        }
      }),
    (error) => {
      assert.equal(error.message, "输入内容超过单任务 Token 上限");
      assert.equal(error.taskType, "single-paper-chinese-summary");
      assert.ok(error.estimatedTokens > error.maxInputTokensPerTask);
      return true;
    }
  );

  assert.equal(fetchCalled, false);
});

test("LLM runtime guard module blocks oversized prompts before provider access", () => {
  assert.throws(
    () =>
      assertGuardRequestAllowed({
        prompt: "长".repeat(1300),
        settings: { maxInputTokensPerTask: 1000 },
        taskType: "single-paper-chinese-summary"
      }),
    (error) => {
      assert.equal(error.name, "LlmRuntimeGuardError");
      assert.equal(error.message, "输入内容超过单任务 Token 上限");
      assert.equal(error.taskType, "single-paper-chinese-summary");
      assert.ok(error.estimatedTokens > error.maxInputTokensPerTask);
      return true;
    }
  );
});

test("LLM runtime guard module exposes shared limiter and token estimator", () => {
  let now = 1_000_000;
  const runtimeGuard = createSharedLlmRuntimeGuard({ now: () => now });

  assert.equal(estimateSharedPromptTokens("测试 text"), 3);
  assert.deepEqual(
    runtimeGuard.assertRequestAllowed({
      taskType: "single-paper-chinese-summary",
      requestsPerMinute: 1
    }),
    {
      requestsInWindow: 1,
      requestsPerMinute: 1,
      windowMs: 60_000
    }
  );

  assert.throws(
    () =>
      runtimeGuard.assertRequestAllowed({
        taskType: "reading-context-chinese-translation",
        requestsPerMinute: 1
      }),
    /请求过于频繁，请稍后再试/
  );

  now += 60_001;
  assert.equal(
    runtimeGuard.assertRequestAllowed({
      taskType: "reading-context-chinese-translation",
      requestsPerMinute: 1
    }).requestsInWindow,
    1
  );
});

test("LLM runtime guard module exposes the same interface to browser runtime scripts", () => {
  const source = fs.readFileSync(path.join(root, "src/core/llmRuntimeGuard.js"), "utf8");
  const context = {
    Date,
    Error,
    Math,
    Number,
    Object,
    RegExp,
    String,
    window: {}
  };

  vm.runInNewContext(source, context, { filename: "llmRuntimeGuard.js" });

  assert.equal(typeof context.window.WorkbenchLlmRuntimeGuard.createLlmRuntimeGuard, "function");
  assert.equal(typeof context.window.WorkbenchLlmRuntimeGuard.assertLlmRuntimeRequestAllowed, "function");
  assert.equal(context.window.WorkbenchLlmRuntimeGuard.estimatePromptTokens("测试 text"), 3);
});

test("buildChineseReadingContextTranslationPrompt requests faithful Chinese translation of selected text", () => {
  const prompt = buildChineseReadingContextTranslationPrompt({
    text: "The gut microbiome may alter insulin resistance in women with PCOS.",
    source: "reader-selection-popup",
    pageLabel: "12"
  });

  assert.match(prompt, /翻译成中文/);
  assert.match(prompt, /忠实/);
  assert.match(prompt, /专业术语/);
  assert.match(prompt, /页码：12/);
  assert.match(prompt, /The gut microbiome may alter insulin resistance/);
  assert.doesNotMatch(prompt, /undefined|null/);
});

test("requestReadingContextTranslation posts selected Reader text to OpenAI-compatible chat completion", async () => {
  let requestedUrl = "";
  let requestedBody = null;

  const translation = await requestReadingContextTranslation({
    context: {
      text: "Metformin reduced bacterial diversity in this cohort.",
      pageLabel: "3"
    },
    settings: {
      baseUrl: "https://api.example.test/v1/",
      apiKey: "sk-secret",
      model: "model-a"
    },
    fetchImpl: async (url, options) => {
      requestedUrl = url;
      requestedBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            choices: [{ message: { content: "二甲双胍降低了该队列中的细菌多样性。" } }]
          })
      };
    }
  });

  assert.equal(requestedUrl, "https://api.example.test/v1/chat/completions");
  assert.equal(requestedBody.model, "model-a");
  assert.match(requestedBody.messages[0].content, /Metformin reduced bacterial diversity/);
  assert.equal(translation, "二甲双胍降低了该队列中的细菌多样性。");
});

test("summary and translation requests share the runtime request limiter", async () => {
  let now = 1_000_000;
  const runtimeGuard = createLlmRuntimeGuard({ now: () => now });
  let summaryFetchCount = 0;
  let translationFetchCount = 0;

  await requestPaperSummary({
    paper: { title: "Example", abstractNote: "Short abstract.", creators: [] },
    settings: {
      baseUrl: "https://api.example.test/v1",
      apiKey: "sk-secret",
      model: "model-a",
      requestsPerMinute: 1
    },
    runtimeGuard,
    promptOverrides: [
      {
        templateId: "single-paper-chinese-summary",
        template: "{{itemTitle}}"
      }
    ],
    fetchImpl: async () => {
      summaryFetchCount += 1;
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ choices: [{ message: { content: "总结" } }] })
      };
    }
  });

  await assert.rejects(
    () =>
      requestReadingContextTranslation({
        context: {
          text: "Short reader selection.",
          pageLabel: "3"
        },
        settings: {
          baseUrl: "https://api.example.test/v1",
          apiKey: "sk-secret",
          model: "model-a",
          requestsPerMinute: 1
        },
        runtimeGuard,
        promptOverrides: [
          {
            templateId: "reading-context-chinese-translation",
            template: "{{selectedText}}"
          }
        ],
        fetchImpl: async () => {
          translationFetchCount += 1;
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ choices: [{ message: { content: "翻译" } }] })
          };
        }
      }),
    (error) => {
      assert.equal(error.message, "请求过于频繁，请稍后再试");
      assert.equal(error.taskType, "reading-context-chinese-translation");
      assert.equal(error.requestsInWindow, 1);
      assert.equal(error.requestsPerMinute, 1);
      return true;
    }
  );

  assert.equal(summaryFetchCount, 1);
  assert.equal(translationFetchCount, 0);

  now += 60_001;
  await requestReadingContextTranslation({
    context: {
      text: "Short reader selection.",
      pageLabel: "3"
    },
    settings: {
      baseUrl: "https://api.example.test/v1",
      apiKey: "sk-secret",
      model: "model-a",
      requestsPerMinute: 1
    },
    runtimeGuard,
    promptOverrides: [
      {
        templateId: "reading-context-chinese-translation",
        template: "{{selectedText}}"
      }
    ],
    fetchImpl: async () => {
      translationFetchCount += 1;
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ choices: [{ message: { content: "翻译" } }] })
      };
    }
  });

  assert.equal(translationFetchCount, 1);
});

test("requestReadingContextTranslation uses a saved prompt override when present", async () => {
  let requestedBody = null;

  await requestReadingContextTranslation({
    context: {
      text: "The gut microbiome may alter insulin resistance.",
      pageLabel: "12",
      source: "reader-selection-popup"
    },
    settings: {
      baseUrl: "https://api.example.test/v1/",
      apiKey: "sk-secret",
      model: "model-a"
    },
    promptOverrides: [
      {
        templateId: "reading-context-chinese-translation",
        template: "仅翻译：{{selectedText}}\n页码：{{pageLabel}}"
      }
    ],
    fetchImpl: async (_url, options) => {
      requestedBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ choices: [{ message: { content: "肠道微生物组可能改变胰岛素抵抗。" } }] })
      };
    }
  });

  assert.equal(
    requestedBody.messages[0].content,
    "仅翻译：The gut microbiome may alter insulin resistance.\n页码：12"
  );
  assert.doesNotMatch(requestedBody.messages[0].content, /忠实保留原意/);
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

test("buildSummaryCopyText labels reading context translation draft copies", () => {
  const text = buildSummaryCopyText({
    paper: {
      title: "Metformin and gut microbiota in PCOS",
      authors: "Li Wang",
      year: "2026",
      publicationTitle: "Journal of Endocrine Research",
      doi: "10.1000/pcos.2026"
    },
    summary: "肠道微生物组可能改变胰岛素抵抗。",
    draft: {
      promptTaskTemplateId: "reading-context-chinese-translation",
      inputContext: {
        selectedText: "The gut microbiome may alter insulin resistance.",
        pageLabel: "12"
      }
    }
  });

  assert.equal(
    text,
    [
      "Zotero 研究工作台 - 阅读上下文翻译",
      "",
      "标题：Metformin and gut microbiota in PCOS",
      "作者：Li Wang",
      "年份：2026",
      "期刊/来源：Journal of Endocrine Research",
      "DOI：10.1000/pcos.2026",
      "页码：12",
      "",
      "原文：",
      "The gut microbiome may alter insulin resistance.",
      "",
      "生成结果：",
      "肠道微生物组可能改变胰岛素抵抗。"
    ].join("\n")
  );
});

test("createSummaryDraftInput maps generated summary into research note draft input", () => {
  const draftInput = createSummaryDraftInput({
    paper: {
      key: "ABCD1234",
      title: "Metformin and gut microbiota in PCOS",
      authors: "Li Wang",
      year: "2026",
      publicationTitle: "Journal of Endocrine Research",
      doi: "10.1000/pcos.2026"
    },
    summary: "研究问题：示例问题\n主要发现：示例发现",
    model: "moonshot-v1",
    createdAt: "2026-05-18T12:00:00.000Z"
  });

  assert.deepEqual(draftInput, {
    id: "draft-ABCD1234-2026-05-18T12-00-00-000Z",
    zoteroItemKey: "ABCD1234",
    workId: "work:doi:10.1000/pcos.2026",
    title: "Metformin and gut microbiota in PCOS - 中文总结",
    content: "研究问题：示例问题\n主要发现：示例发现",
    promptTaskTemplateId: "single-paper-chinese-summary",
    llmProviderId: "moonshot-v1",
    inputContext: {
      title: "Metformin and gut microbiota in PCOS",
      authors: "Li Wang",
      year: "2026",
      publicationTitle: "Journal of Endocrine Research",
      doi: "10.1000/pcos.2026"
    },
    createdAt: "2026-05-18T12:00:00.000Z",
    provenance: {
      source: "zotero-selection",
      model: "moonshot-v1",
      writeTarget: "local-draft-only"
    }
  });
});

test("createReadingTranslationDraftInput maps translated Reader selection into research note draft input", () => {
  const draftInput = createReadingTranslationDraftInput({
    context: {
      source: "reader-selection-popup",
      text: "The gut microbiome may alter insulin resistance.",
      itemKey: "ITEM123",
      pageLabel: "12",
      createdAt: "2026-05-18T11:59:00.000Z"
    },
    paper: {
      key: "ITEM123",
      title: "Metformin and gut microbiota in PCOS",
      doi: "10.1000/pcos.2026"
    },
    translation: "肠道微生物组可能改变胰岛素抵抗。",
    model: "moonshot-v1",
    createdAt: "2026-05-18T12:00:00.000Z"
  });

  assert.deepEqual(draftInput, {
    id: "draft-ITEM123-translation-2026-05-18T12-00-00-000Z",
    zoteroItemKey: "ITEM123",
    workId: "work:doi:10.1000/pcos.2026",
    title: "Metformin and gut microbiota in PCOS - 阅读上下文翻译",
    content: "肠道微生物组可能改变胰岛素抵抗。",
    promptTaskTemplateId: "reading-context-chinese-translation",
    llmProviderId: "moonshot-v1",
    inputContext: {
      title: "Metformin and gut microbiota in PCOS",
      selectedText: "The gut microbiome may alter insulin resistance.",
      source: "reader-selection-popup",
      pageLabel: "12"
    },
    createdAt: "2026-05-18T12:00:00.000Z",
    provenance: {
      source: "zotero-reader-selection",
      model: "moonshot-v1",
      writeTarget: "local-draft-only"
    }
  });
});

test("listRecentSummaryDrafts returns summary drafts newest first", () => {
  const drafts = listRecentSummaryDrafts({
    researchNoteDrafts: [
      {
        id: "old-summary",
        title: "旧草稿",
        content: "旧内容",
        createdAt: "2026-05-18T08:00:00.000Z",
        llmProviderId: "model-a",
        confirmationState: "draft",
        promptTaskTemplateId: "single-paper-chinese-summary"
      },
      {
        id: "confirmed-summary",
        title: "已确认",
        content: "不应显示",
        createdAt: "2026-05-18T10:00:00.000Z",
        llmProviderId: "model-a",
        confirmationState: "confirmed",
        promptTaskTemplateId: "single-paper-chinese-summary"
      },
      {
        id: "other-template",
        title: "其他模板",
        content: "不应显示",
        createdAt: "2026-05-18T11:00:00.000Z",
        llmProviderId: "model-a",
        confirmationState: "draft",
        promptTaskTemplateId: "other-template"
      },
      {
        id: "new-summary",
        title: "新草稿",
        content: "新内容",
        createdAt: "2026-05-18T12:00:00.000Z",
        llmProviderId: "model-b",
        confirmationState: "draft",
        promptTaskTemplateId: "single-paper-chinese-summary"
      }
    ]
  });

  assert.deepEqual(drafts, [
    {
      id: "new-summary",
      title: "新草稿",
      content: "新内容",
      createdAt: "2026-05-18T12:00:00.000Z",
      model: "model-b"
    },
    {
      id: "old-summary",
      title: "旧草稿",
      content: "旧内容",
      createdAt: "2026-05-18T08:00:00.000Z",
      model: "model-a"
    }
  ]);
});

test("listRecentSummaryDrafts limits visible drafts", () => {
  const drafts = listRecentSummaryDrafts(
    {
      researchNoteDrafts: [
        {
          id: "draft-1",
          title: "草稿 1",
          content: "内容 1",
          createdAt: "2026-05-18T08:00:00.000Z",
          llmProviderId: "model-a",
          confirmationState: "draft",
          promptTaskTemplateId: "single-paper-chinese-summary"
        },
        {
          id: "draft-2",
          title: "草稿 2",
          content: "内容 2",
          createdAt: "2026-05-18T09:00:00.000Z",
          llmProviderId: "model-b",
          confirmationState: "draft",
          promptTaskTemplateId: "single-paper-chinese-summary"
        }
      ]
    },
    1
  );

  assert.deepEqual(drafts.map((draft) => draft.id), ["draft-2"]);
});

test("listRecentGraphSeeds returns display records newest first", () => {
  const seeds = listRecentGraphSeeds({
    graphSeeds: [
      {
        id: "old-seed",
        source: { title: "Old Source" },
        relationType: "supports",
        target: { text: "Old Target" },
        evidence: { text: "Old evidence" },
        providerId: "model-a",
        confidence: "low",
        seedKind: "user-confirmed",
        createdAt: "2026-05-18T08:00:00.000Z"
      },
      {
        id: "new-seed",
        source: { title: "New Source" },
        relationType: "contrasts",
        target: { text: "New Target" },
        evidence: { text: "New evidence" },
        providerId: "model-b",
        confidence: "high",
        seedKind: "ai-inferred",
        createdAt: "2026-05-18T12:00:00.000Z"
      }
    ]
  });

  assert.deepEqual(seeds, [
    {
      id: "new-seed",
      sourceTitle: "New Source",
      relationType: "contrasts",
      target: "New Target",
      evidence: "New evidence",
      provider: "model-b",
      confidence: "high",
      seedKind: "ai-inferred",
      createdAt: "2026-05-18T12:00:00.000Z"
    },
    {
      id: "old-seed",
      sourceTitle: "Old Source",
      relationType: "supports",
      target: "Old Target",
      evidence: "Old evidence",
      provider: "model-a",
      confidence: "low",
      seedKind: "user-confirmed",
      createdAt: "2026-05-18T08:00:00.000Z"
    }
  ]);
});

test("listRecentTaskLedger returns display records newest first", () => {
  const tasks = listRecentTaskLedger(
    {
      taskLedger: [
        {
          id: "old-task",
          workflowStep: "create-research-note-draft",
          state: "completed",
          providerId: "model-a",
          promptTaskTemplateId: "single-paper-chinese-summary",
          outputLocation: { draftId: "draft-a" },
          startedAt: "2026-05-18T08:00:00.000Z",
          completedAt: "2026-05-18T08:01:00.000Z"
        },
        {
          id: "new-task",
          workflowStep: "capture-graph-seed",
          state: "failed",
          providerId: "model-b",
          promptTaskTemplateId: null,
          outputLocation: { graphSeedId: "seed-a" },
          errorNotice: { message: "Provider failed" },
          startedAt: "2026-05-18T12:00:00.000Z",
          completedAt: ""
        }
      ]
    },
    1
  );

  assert.deepEqual(tasks, [
    {
      id: "new-task",
      workflowStep: "capture-graph-seed",
      state: "failed",
      provider: "model-b",
      promptTaskTemplateId: "未记录",
      outputLocation: "graphSeedId: seed-a",
      errorMessage: "Provider failed",
      occurredAt: "2026-05-18T12:00:00.000Z"
    }
  ]);
});

test("buildZoteroNoteHtml formats generated summary with escaped metadata", () => {
  const html = buildZoteroNoteHtml({
    draft: {
      title: "Metformin <PCOS> - 中文总结",
      content: "研究问题：A < B\n主要发现：C & D",
      llmProviderId: "moonshot-v1",
      createdAt: "2026-05-18T12:00:00.000Z",
      inputContext: {
        title: "Metformin <PCOS>",
        authors: "Li Wang & Team",
        year: "2026",
        publicationTitle: "Journal <Endocrine>",
        doi: "10.1000/pcos&2026"
      }
    },
    savedAt: "2026-05-18T13:00:00.000Z"
  });

  assert.match(html, /Zotero 研究工作台 - 文献总结/);
  assert.match(html, /标题：Metformin &lt;PCOS&gt;/);
  assert.match(html, /作者：Li Wang &amp; Team/);
  assert.match(html, /模型：moonshot-v1/);
  assert.match(html, /写入时间：2026-05-18T13:00:00.000Z/);
  assert.match(html, /研究问题：A &lt; B<br\/>主要发现：C &amp; D/);
  assert.doesNotMatch(html, /Metformin <PCOS>/);
});

test("buildZoteroNoteHtml labels reading context translation drafts", () => {
  const html = buildZoteroNoteHtml({
    draft: {
      title: "Metformin and gut microbiota in PCOS - 阅读上下文翻译",
      content: "肠道微生物组可能改变胰岛素抵抗。",
      promptTaskTemplateId: "reading-context-chinese-translation",
      llmProviderId: "moonshot-v1",
      createdAt: "2026-05-18T12:00:00.000Z",
      inputContext: {
        title: "Metformin and gut microbiota in PCOS",
        selectedText: "The gut microbiome may alter insulin resistance.",
        source: "reader-selection-popup",
        pageLabel: "12"
      }
    },
    savedAt: "2026-05-18T13:00:00.000Z"
  });

  assert.match(html, /Zotero 研究工作台 - 阅读上下文翻译/);
  assert.match(html, /标题：Metformin and gut microbiota in PCOS/);
  assert.match(html, /页码：12/);
  assert.match(html, /肠道微生物组可能改变胰岛素抵抗。/);
  assert.doesNotMatch(html, /Zotero 研究工作台 - 文献总结/);
});

test("markSummaryDraftSavedToZotero confirms one draft and records save task", () => {
  const snapshot = {
    schemaVersion: 1,
    exportedAt: "2026-05-18T12:00:00.000Z",
    researchNoteDrafts: [
      {
        id: "draft-a",
        zoteroItemKey: "ITEM123",
        title: "Example - 中文总结",
        content: "内容",
        promptTaskTemplateId: "single-paper-chinese-summary",
        llmProviderId: "model-a",
        createdAt: "2026-05-18T12:00:00.000Z",
        confirmationState: "draft"
      },
      {
        id: "draft-b",
        title: "Other - 中文总结",
        content: "其他",
        promptTaskTemplateId: "single-paper-chinese-summary",
        llmProviderId: "model-b",
        createdAt: "2026-05-18T11:00:00.000Z",
        confirmationState: "draft"
      }
    ],
    taskLedger: []
  };

  const updated = markSummaryDraftSavedToZotero({
    snapshot,
    draftId: "draft-a",
    zoteroNoteKey: "NOTE123",
    savedAt: "2026-05-18T13:00:00.000Z"
  });

  assert.notEqual(updated, snapshot);
  assert.equal(snapshot.researchNoteDrafts[0].confirmationState, "draft");
  assert.equal(updated.researchNoteDrafts[0].confirmationState, "confirmed");
  assert.equal(updated.researchNoteDrafts[0].confirmedZoteroNoteKey, "NOTE123");
  assert.equal(updated.researchNoteDrafts[0].confirmedAt, "2026-05-18T13:00:00.000Z");
  assert.equal(updated.researchNoteDrafts[1].confirmationState, "draft");
  assert.deepEqual(updated.taskLedger[0], {
    id: "task-draft-a-save-to-zotero-note",
    workflowStep: "save-to-zotero-note",
    state: "completed",
    providerId: "model-a",
    promptTaskTemplateId: "single-paper-chinese-summary",
    outputLocation: { draftId: "draft-a", zoteroNoteKey: "NOTE123" },
    errorNotice: null,
    startedAt: "2026-05-18T13:00:00.000Z",
    completedAt: "2026-05-18T13:00:00.000Z",
    provenance: {
      source: "explicit-user-action",
      writeTarget: "zotero-note"
    }
  });
});
