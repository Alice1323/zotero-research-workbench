const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createOpenAlexAdapter,
  createCrossrefAdapter,
  createUnpaywallAdapter,
  createPublisherPdfAdapter,
  createSciHubResolverAdapter,
  createSciPdfEmbeddedAdapter,
  createHttpConnectorAdapter,
  createConnectorRequestPayload,
  cleanText
} = require("../src/core/literatureSourceAdapters");
const core = require("../src/core");

test("OpenAlex adapter normalizes works into document candidates", async () => {
  const adapter = createOpenAlexAdapter({
    fetchImpl: async (url) => {
      assert.equal(url, "https://api.openalex.org/works?search=gastroenteritis%20nursing&per-page=5");
      return {
        ok: true,
        status: 200,
        json: async () => ({
          results: [
            {
              id: "https://openalex.org/W123",
              title: "Nursing care in acute gastroenteritis",
              publication_year: 2024,
              doi: "https://doi.org/10.1000/openalex",
              authorships: [{ author: { display_name: "Chen A" } }],
              host_venue: { display_name: "Journal A" },
              open_access: { is_oa: true, oa_url: "https://example.org/openalex.pdf" }
            }
          ]
        })
      };
    }
  });

  const result = await adapter.query({
    requestText: "gastroenteritis nursing",
    maxCandidates: 5,
    observedAt: "2026-05-23T12:00:00.000Z"
  });
  assert.equal(result.candidates[0].sourceAdapterId, "openalex");
  assert.equal(result.candidates[0].doi, "10.1000/openalex");
  assert.equal(result.candidates[0].year, "2024");
  assert.equal(result.candidates[0].attachments[0].kind, "open-access-pdf-url");
});

test("Crossref adapter normalizes message items into document candidates", async () => {
  const adapter = createCrossrefAdapter({
    fetchImpl: async (url) => {
      assert.equal(url, "https://api.crossref.org/works?query=title&rows=5");
      return {
        ok: true,
        status: 200,
        json: async () => ({
          message: {
            items: [
              {
                DOI: "10.1000/crossref",
                title: ["Crossref Title"],
                author: [{ given: "A", family: "Chen" }],
                issued: { "date-parts": [[2023]] },
                "container-title": ["Journal B"],
                URL: "https://doi.org/10.1000/crossref"
              }
            ]
          }
        })
      };
    }
  });

  const result = await adapter.query({ requestText: "title", maxCandidates: 5 });
  assert.equal(result.candidates[0].sourceAdapterId, "crossref");
  assert.equal(result.candidates[0].title, "Crossref Title");
  assert.equal(result.candidates[0].year, "2023");
});

test("Unpaywall adapter requires DOI and returns OA attachment candidates", async () => {
  const adapter = createUnpaywallAdapter({
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        doi: "10.1000/oa",
        title: "OA Title",
        year: 2022,
        is_oa: true,
        best_oa_location: { url_for_pdf: "https://example.org/oa.pdf", license: "cc-by" }
      })
    }),
    email: "user@example.com"
  });

  const result = await adapter.query({ dois: ["10.1000/oa"] });
  assert.equal(result.candidates[0].year, "2022");
  assert.equal(result.candidates[0].attachments[0].importable, true);
});

test("Publisher PDF adapter follows Crossref landing pages to article download PDFs", async () => {
  const calls = [];
  const adapter = createPublisherPdfAdapter({
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, timeoutMs: options.timeoutMs });
      if (url.startsWith("https://api.crossref.org/works/")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            message: {
              DOI: "10.17816/pavlovj70596-52746",
              title: ["图 1乳腺癌表型（n）与年龄（岁）的关系"],
              publisher: "ECO-Vector LLC (Publications)",
              URL: "https://journals.eco-vector.com/pavlovj/article/view/70596",
              resource: {
                primary: {
                  URL: "https://journals.eco-vector.com/pavlovj/article/downloadSuppFile/70596/52746"
                }
              }
            }
          })
        };
      }
      if (url === "https://journals.eco-vector.com/pavlovj/article/view/70596") {
        return {
          ok: true,
          status: 200,
          headers: { get: () => "text/html" },
          text: async () => [
            '<html><body>',
            '<a href="/pavlovj/article/downloadSuppFile/70596/52746">supplement</a>',
            '<a href="/pavlovj/article/download/70596/70737">PDF</a>',
            '</body></html>'
          ].join("")
        };
      }
      throw new Error(`unexpected url ${url}`);
    }
  });

  const result = await adapter.query({
    dois: ["10.17816/pavlovj70596-52746"],
    observedAt: "2026-05-25T10:00:00.000Z",
    topicId: "topic-a"
  });

  assert.deepEqual(calls, [
    { url: "https://api.crossref.org/works/10.17816%2Fpavlovj70596-52746", timeoutMs: 10000 },
    { url: "https://journals.eco-vector.com/pavlovj/article/view/70596", timeoutMs: 10000 }
  ]);
  assert.equal(result.sourceAdapterId, "publisher-pdf");
  assert.equal(result.failures.length, 0);
  assert.equal(result.candidates[0].doi, "10.17816/pavlovj70596-52746");
  assert.equal(result.candidates[0].attachments[0].kind, "open-access-pdf-url");
  assert.equal(
    result.candidates[0].attachments[0].url,
    "https://journals.eco-vector.com/pavlovj/article/download/70596/70737"
  );
  assert.equal(result.candidates[0].attachments[0].importable, true);
});

test("Publisher PDF adapter follows Hans Publishers landing pages to PDF links", async () => {
  const calls = [];
  const adapter = createPublisherPdfAdapter({
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, timeoutMs: options.timeoutMs });
      if (url.startsWith("https://api.crossref.org/works/")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            message: {
              DOI: "10.12677/acm.2023.1381824",
              title: ["Advances in Endocrine Therapy for Breast Cancer"],
              publisher: "Hans Publishers",
              URL: "https://doi.org/10.12677/acm.2023.1381824",
              resource: {
                primary: {
                  URL: "https://www.hanspub.org/journal/paperinformation?paperid=70788"
                }
              }
            }
          })
        };
      }
      if (url === "https://doi.org/10.12677/acm.2023.1381824") {
        return {
          ok: true,
          status: 200,
          headers: { get: () => "text/html; charset=utf-8" },
          text: async () => "<html><body>DOI resolver page without PDF links</body></html>"
        };
      }
      if (url === "https://www.hanspub.org/journal/paperinformation?paperid=70788") {
        if (!cleanText(options.headers?.Cookie).startsWith("acw_sc__v2=6a16014cd5b4b5ea7f8147211b9675e14c64b0f4")) {
          return {
            ok: true,
            status: 200,
            headers: { get: () => "text/html; charset=utf-8" },
            text: async () => [
              "<html><script>",
              "var arg1='21E1B9E25D4892566637BEC675541C191BA13C4D';",
              "(function(a,c){}(a0i,0x760bf));",
              "var m=[0xf,0x23,0x1d,0x18,0x21,0x10,0x1,0x26,0xa,0x9,0x13,0x1f,0x28,0x1b,0x16,0x17,0x19,0xd,0x6,0xb,0x27,0x12,0x14,0x8,0xe,0x15,0x20,0x1a,0x2,0x1e,0x7,0x4,0x11,0x5,0x3,0x1c,0x22,0x25,0xc,0x24],p='3000176000856006061501533003690027800375';",
              "p=L(0x115);",
              "function a0i(){var N=['mJKZmgTStNvVyq','C3rYAw5N','y2fSBa','o2v4CgLYzxm9','y29VA2LL','mteZmZy3mNLbu2PszW','C2vHCMnO','D2HPBguGkhrYDwuPihT9','mJq1ndi0rKHuthnj','AM9PBG','nNH1rKHOuq','Bg9JyxrPB24','Dg9tDhjPBMC','Aw5PDa','mJi2odi1nwnMre1IyG','n0HxChPJva','CMvSB2fK','DgvZDa','y2HHAw4','xcTCkYaQkd86w2eTEKeTwL8KxvSWltLHlxPblvPFjf0Qkq','y29UC3rYDwn0B3i','y291BNrLCG','o21HEc1Hz2u9mZyWmdTWyxrOps87','zgvIDq','ywn0Aw9U','Dg9htvrtDhjPBMC','yxbWBhK','mJbiru1MChi','kcGOlISPkYKRksSK','z2DLCG','nKHJq01Aqq','nJe5nZu5ogH1twPUDa','C3rHDgvpyMPLy3q','mZu5mdu5mNbcB2Pxyq','mZaWmde3nJaWmdG1nJaWnJa2mtuWmtuZmZaWmZy5mdaYnZGWmdm3nq','BgvUz3rO','mtqWnti2shvUBNDv','zNvUy3rPB24GkLWOicPCkq','BM93','C2XPy2u','Aw5WDxq','ntm5BwrLuMXi'];a0i=function(){return N;};return a0i();}",
              "</script></html>"
            ].join("")
          };
        }
        return {
          ok: true,
          status: 200,
          headers: { get: () => "text/html; charset=utf-8" },
          text: async () => [
            '<html><body>',
            '<a target="_blank" href="https://pdf.hanspub.org/acm20230800000_95491336.pdf">PDF</a>',
            '<a href="/journal/paperinformation?paperid=70789">HTML</a>',
            '</body></html>'
          ].join("")
        };
      }
      throw new Error(`unexpected url ${url}`);
    }
  });

  const result = await adapter.query({
    dois: ["10.12677/acm.2023.1381824"],
    observedAt: "2026-05-27T01:45:00.000Z",
    topicId: "topic-a"
  });

  assert.deepEqual(calls, [
    { url: "https://api.crossref.org/works/10.12677%2Facm.2023.1381824", timeoutMs: 10000 },
    { url: "https://www.hanspub.org/journal/paperinformation?paperid=70788", timeoutMs: 10000 },
    { url: "https://www.hanspub.org/journal/paperinformation?paperid=70788", timeoutMs: 10000 }
  ]);
  assert.equal(result.sourceAdapterId, "publisher-pdf");
  assert.equal(result.failures.length, 0);
  assert.equal(result.candidates[0].doi, "10.12677/acm.2023.1381824");
  assert.equal(
    result.candidates[0].attachments[0].url,
    "https://pdf.hanspub.org/acm20230800000_95491336.pdf"
  );
  assert.equal(result.candidates[0].attachments[0].importable, true);
});

test("Publisher PDF adapter reports landing page diagnostics when no PDF is found", async () => {
  const adapter = createPublisherPdfAdapter({
    fetchImpl: async (url, options = {}) => {
      if (url.startsWith("https://api.crossref.org/works/")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            message: {
              DOI: "10.12677/acm.2023.1381824",
              title: ["Advances in Endocrine Therapy for Breast Cancer"],
              publisher: "Hans Publishers",
              URL: "https://doi.org/10.12677/acm.2023.1381824",
              resource: {
                primary: {
                  URL: "https://www.hanspub.org/journal/paperinformation?paperid=70788"
                }
              }
            }
          })
        };
      }
      if (url === "https://www.hanspub.org/journal/paperinformation?paperid=70788") {
        return {
          ok: true,
          status: 200,
          headers: { get: () => "text/html; charset=utf-8" },
          text: async () => options.headers?.Cookie
            ? "<html><script>var arg1='still-challenge-after-retry';</script></html>"
            : "<html><script>var arg1='21E1B9E25D4892566637BEC675541C191BA13C4D';</script></html>"
        };
      }
      throw new Error(`unexpected url ${url}`);
    }
  });

  const result = await adapter.query({ dois: ["10.12677/acm.2023.1381824"] });

  assert.equal(result.candidates.length, 0);
  assert.equal(result.failures.length, 1);
  assert.match(result.failures[0].technicalDetail, /"landingUrl":"https:\/\/www\.hanspub\.org\/journal\/paperinformation\?paperid=70788"/);
  assert.match(result.failures[0].technicalDetail, /"publisher":"Hans Publishers"/);
  assert.match(result.failures[0].technicalDetail, /"reason":"no-pdf-url-in-landing-html"/);
  assert.match(result.failures[0].technicalDetail, /"hansChallengeDetected":true/);
  assert.match(result.failures[0].technicalDetail, /"hansChallengeCookieCreated":false/);
});

test("Publisher PDF adapter derives Eco-Vector article pages from component supplement URLs", async () => {
  const calls = [];
  const adapter = createPublisherPdfAdapter({
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, timeoutMs: options.timeoutMs });
      if (url.startsWith("https://api.crossref.org/works/")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            message: {
              DOI: "10.17816/pavlovj70596-52746",
              title: ["图 1乳腺癌表型（n）与年龄（岁）的关系"],
              publisher: "ECO-Vector LLC (Publications)",
              URL: "https://doi.org/10.17816/pavlovj70596-52746",
              type: "component",
              resource: {
                primary: {
                  URL: "https://journals.eco-vector.com/pavlovj/article/downloadSuppFile/70596/52746"
                }
              }
            }
          })
        };
      }
      if (url === "https://journals.eco-vector.com/pavlovj/article/view/70596") {
        return {
          ok: true,
          status: 200,
          headers: { get: () => "text/html" },
          text: async () => [
            '<a href="https://journals.eco-vector.com/pavlovj/article/view/70596/69673" class="file">PDF Russian</a>',
            '<a href="https://journals.eco-vector.com/pavlovj/article/view/70596/70737" class="file">PDF Chinese</a>'
          ].join("")
        };
      }
      if (url === "https://journals.eco-vector.com/pavlovj/article/view/70596/69673") {
        return {
          ok: true,
          status: 200,
          headers: { get: () => "text/html" },
          text: async () => '<title>Article - PDF (Russian)</title><a href="https://journals.eco-vector.com/pavlovj/article/download/70596/69673">Download PDF</a>'
        };
      }
      if (url === "https://journals.eco-vector.com/pavlovj/article/view/70596/70737") {
        return {
          ok: true,
          status: 200,
          headers: { get: () => "text/html" },
          text: async () => '<a href="https://journals.eco-vector.com/pavlovj/article/download/70596/70737">Download PDF</a>'
        };
      }
      throw new Error(`unexpected url ${url}`);
    }
  });

  const result = await adapter.query({ dois: ["10.17816/pavlovj70596-52746"] });

  assert.deepEqual(calls, [
    { url: "https://api.crossref.org/works/10.17816%2Fpavlovj70596-52746", timeoutMs: 10000 },
    { url: "https://journals.eco-vector.com/pavlovj/article/view/70596", timeoutMs: 10000 }
  ]);
  assert.equal(
    result.candidates[0].attachments[0].url,
    "https://journals.eco-vector.com/pavlovj/article/download/70596/70737"
  );
});

test("Publisher PDF adapter returns direct landing PDFs without probing slower file views", async () => {
  const calls = [];
  const adapter = createPublisherPdfAdapter({
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, timeoutMs: options.timeoutMs });
      if (url.startsWith("https://api.crossref.org/works/")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            message: {
              DOI: "10.1000/direct-pdf",
              title: ["Direct PDF Article"],
              URL: "https://publisher.example/article/123"
            }
          })
        };
      }
      if (url === "https://publisher.example/article/123") {
        return {
          ok: true,
          status: 200,
          headers: { get: () => "text/html" },
          text: async () => [
            '<a href="/article/download/123/456">PDF</a>',
            '<a class="file" href="https://slow.publisher.example/file-view">PDF mirror</a>'
          ].join("")
        };
      }
      return {
        ok: true,
        status: 200,
        headers: { get: () => "text/html" },
        text: async () => "<html>slow fallback should not be fetched</html>"
      };
    }
  });

  const result = await adapter.query({ dois: ["10.1000/direct-pdf"] });

  assert.deepEqual(calls, [
    { url: "https://api.crossref.org/works/10.1000%2Fdirect-pdf", timeoutMs: 10000 },
    { url: "https://publisher.example/article/123", timeoutMs: 10000 }
  ]);
  assert.equal(
    result.candidates[0].attachments[0].url,
    "https://publisher.example/article/download/123/456"
  );
});

test("Publisher PDF adapter queries multiple DOI records without serial source delay", async () => {
  const calls = [];
  let firstCrossrefReady = null;
  const secondCrossrefStarted = new Promise((resolve) => {
    firstCrossrefReady = resolve;
  });
  const adapter = createPublisherPdfAdapter({
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, timeoutMs: options.timeoutMs });
      if (url === "https://api.crossref.org/works/10.1000%2Ffirst") {
        await secondCrossrefStarted;
        return createPublisherCrossrefResponse({
          doi: "10.1000/first",
          title: "First PDF",
          url: "https://publisher.example/first.pdf"
        });
      }
      if (url === "https://api.crossref.org/works/10.1000%2Fsecond") {
        firstCrossrefReady();
        return createPublisherCrossrefResponse({
          doi: "10.1000/second",
          title: "Second PDF",
          url: "https://publisher.example/second.pdf"
        });
      }
      throw new Error(`unexpected url ${url}`);
    }
  });

  const result = await Promise.race([
    adapter.query({ dois: ["10.1000/first", "10.1000/second"] }),
    new Promise((resolve) => setTimeout(() => resolve("serial-timeout"), 20))
  ]);

  assert.notEqual(result, "serial-timeout");
  assert.deepEqual(calls, [
    { url: "https://api.crossref.org/works/10.1000%2Ffirst", timeoutMs: 10000 },
    { url: "https://api.crossref.org/works/10.1000%2Fsecond", timeoutMs: 10000 }
  ]);
  assert.deepEqual(
    result.candidates.map((candidate) => candidate.attachments[0].url).sort(),
    ["https://publisher.example/first.pdf", "https://publisher.example/second.pdf"]
  );
});

test("Sci-Hub resolver adapter returns provenance-bearing PDF attachment candidates", async () => {
  const adapter = createSciHubResolverAdapter({
    resolverUrlTemplate: "https://resolver.example/{doi}",
    fetchImpl: async (url) => {
      assert.equal(url, "https://resolver.example/10.1000%2Fsci");
      return {
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: async () => ({
          title: "Sci-Hub Candidate",
          pdfUrl: "https://resolver.example/download/10.1000/sci.pdf",
          sourceUrl: "https://sci-hub.example/10.1000/sci"
        })
      };
    }
  });

  const result = await adapter.query({
    dois: ["10.1000/sci"],
    topicId: "topic-a",
    observedAt: "2026-05-25T02:00:00.000Z"
  });

  assert.equal(result.sourceAdapterId, "sci-hub");
  assert.equal(result.candidates[0].sourceAdapterId, "sci-hub");
  assert.equal(result.candidates[0].doi, "10.1000/sci");
  assert.equal(result.candidates[0].attachments[0].kind, "sci-hub-resolved-url");
  assert.equal(result.candidates[0].attachments[0].importable, true);
  assert.deepEqual(result.candidates[0].attachments[0].provenance, {
    source: "sci-hub",
    sourceUrl: "https://sci-hub.example/10.1000/sci",
    requestUrl: "https://resolver.example/10.1000%2Fsci"
  });
});

test("Sci-PDF embedded adapter returns provenance-bearing PDF candidates from HTML", async () => {
  const adapter = createSciPdfEmbeddedAdapter({
    baseUrls: ["https://sci-hub.se/"],
    fetchImpl: async (url) => {
      assert.equal(url, "https://sci-hub.se/10.1000%2Fembedded");
      return {
        ok: true,
        status: 200,
        text: async () => '<html><body><iframe id="pdf" src="/downloads/embedded.pdf"></iframe></body></html>'
      };
    }
  });

  const result = await adapter.query({
    dois: ["10.1000/embedded"],
    topicId: "topic-a",
    observedAt: "2026-05-25T06:30:00.000Z"
  });

  assert.equal(result.sourceAdapterId, "sci-pdf");
  assert.equal(result.failures.length, 0);
  assert.equal(result.candidates[0].sourceAdapterId, "sci-pdf");
  assert.equal(result.candidates[0].doi, "10.1000/embedded");
  assert.equal(result.candidates[0].attachments[0].kind, "sci-hub-resolved-url");
  assert.equal(result.candidates[0].attachments[0].importable, true);
  assert.deepEqual(result.candidates[0].attachments[0].provenance, {
    source: "sci-pdf",
    sourceAdapterId: "sci-pdf",
    sourceUrl: "https://sci-hub.se/10.1000%2Fembedded",
    requestUrl: "https://sci-hub.se/10.1000%2Fembedded",
    resolverMode: "html",
    selector: "#pdf",
    upstream: "syt2/zotero-scipdf@af4a838"
  });
});

test("Sci-PDF embedded adapter resolves DOI batches concurrently", async () => {
  const started = [];
  let releaseFirst = null;
  let secondStarted = null;
  const secondStartedPromise = new Promise((resolve) => {
    secondStarted = resolve;
  });
  const firstReleasePromise = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  const adapter = createSciPdfEmbeddedAdapter({
    baseUrls: ["https://sci-hub.red/"],
    fetchImpl: async (url) => {
      started.push(url);
      if (url.includes("10.1000%2Ffirst")) {
        await secondStartedPromise;
        await firstReleasePromise;
      } else if (url.includes("10.1000%2Fsecond")) {
        secondStarted();
      }
      return {
        ok: true,
        status: 200,
        text: async () => '<iframe id="pdf" src="/storage/test.pdf"></iframe>'
      };
    }
  });

  const queryPromise = adapter.query({
    dois: ["10.1000/first", "10.1000/second"],
    observedAt: "2026-05-26T00:00:00.000Z",
    topicId: "topic-a"
  });
  await Promise.race([
    secondStartedPromise,
    new Promise((_resolve, reject) => setTimeout(() => reject(new Error("second DOI did not start concurrently")), 100))
  ]);
  releaseFirst();
  const result = await queryPromise;

  assert.equal(result.candidates.length, 2);
  assert.deepEqual(started, [
    "https://sci-hub.red/10.1000%2Ffirst",
    "https://sci-hub.red/10.1000%2Fsecond"
  ]);
});

test("Sci-PDF embedded adapter reports missing DOI and invalid site failures visibly", async () => {
  const missingDoi = await createSciPdfEmbeddedAdapter({
    baseUrls: ["https://sci-hub.se/"],
    fetchImpl: async () => {
      throw new Error("fetch should not run without DOI");
    }
  }).query({ dois: [] });

  assert.equal(missingDoi.candidates.length, 0);
  assert.equal(missingDoi.failures[0].sourceAdapterId, "sci-pdf");
  assert.match(missingDoi.failures[0].userMessage, /requires at least one DOI/);

  const invalidSite = await createSciPdfEmbeddedAdapter({
    baseUrls: ["not a url"],
    fetchImpl: async () => {
      throw new Error("fetch should not run without valid site");
    }
  }).query({ dois: ["10.1000/no-site"] });

  assert.equal(invalidSite.candidates.length, 0);
  assert.match(invalidSite.failures[0].userMessage, /valid Sci-PDF site/);
});

test("source adapters require an injected fetch runtime", async () => {
  await assert.rejects(
    () => createOpenAlexAdapter().query({ requestText: "query" }),
    /Source adapter fetch runtime unavailable/
  );
});

test("HTTP connector validates JSON candidates and redacts secret headers in errors", async () => {
  const adapter = createHttpConnectorAdapter({
    endpointUrl: "https://connector.example.invalid/search",
    headers: { authorization: "Bearer secret-token" },
    fetchImpl: async (_url, options) => {
      assert.equal(options.method, "POST");
      return {
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        text: async () =>
          JSON.stringify({
            candidates: [{ id: "external-a", title: "Connector Candidate", sourceRecordId: "external-a" }]
          })
      };
    }
  });

  const result = await adapter.query({ requestText: "query", topicId: "topic-a" });
  assert.equal(result.candidates[0].sourceAdapterId, "http-connector");
  assert.equal(result.candidates[0].provenance.connectorEndpoint, "https://connector.example.invalid/search");
});

test("HTTP connector rejects non-JSON responses without leaking secret headers", async () => {
  const adapter = createHttpConnectorAdapter({
    endpointUrl: "https://connector.example.invalid/search",
    headers: { authorization: "Bearer secret-token", "X-Api-Key": "abc123", "x-secret-token": "hidden" },
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      headers: { get: () => "text/html" },
      text: async () => "<html></html>"
    })
  });

  const result = await adapter.query({ requestText: "query" });
  assert.equal(result.candidates.length, 0);
  assert.equal(result.failures[0].sourceAdapterId, "http-connector");
  assert.doesNotMatch(result.failures[0].technicalDetail, /Bearer secret-token|abc123|:"hidden"/);
  assert.match(result.failures[0].technicalDetail, /<redacted>/);
  const detail = JSON.parse(result.failures[0].technicalDetail);
  assert.equal(detail.headers.authorization, "<redacted>");
  assert.equal(detail.headers["X-Api-Key"], "<redacted>");
  assert.equal(detail.headers["x-secret-token"], "<redacted>");
});

test("createConnectorRequestPayload uses standard protocol shape", () => {
  const payload = createConnectorRequestPayload({
    topicId: "topic-a",
    requestText: "query",
    sourceScopes: [{ kind: "selected-items", itemKeys: ["AAA"] }],
    maxCandidates: 10
  });

  assert.equal(payload.protocol, "zotero-research-workbench.document-candidates.v1");
  assert.equal(payload.topicId, "topic-a");
  assert.equal(payload.maxCandidates, 10);
});

test("core index exports literature source adapters", () => {
  assert.equal(typeof core.WorkbenchLiteratureSourceAdapters.createOpenAlexAdapter, "function");
  assert.equal(typeof core.WorkbenchLiteratureSourceAdapters.createSciHubResolverAdapter, "function");
});

test("core index exports Sci-PDF embedded source adapter", () => {
  assert.equal(typeof core.WorkbenchLiteratureSourceAdapters.createSciPdfEmbeddedAdapter, "function");
});

function createPublisherCrossrefResponse({ doi, title, url }) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      message: {
        DOI: doi,
        title: [title],
        link: [{ URL: url }]
      }
    })
  };
}
