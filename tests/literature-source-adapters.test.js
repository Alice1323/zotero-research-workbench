const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createOpenAlexAdapter,
  createCrossrefAdapter,
  createUnpaywallAdapter,
  createSciHubResolverAdapter,
  createSciPdfEmbeddedAdapter,
  createHttpConnectorAdapter,
  createConnectorRequestPayload
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
