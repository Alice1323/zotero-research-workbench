const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createOpenAlexAdapter,
  createCrossrefAdapter,
  createUnpaywallAdapter,
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
});
