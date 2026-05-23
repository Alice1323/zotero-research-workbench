const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeDocumentCandidate,
  normalizeAttachmentReference,
  deriveCandidateIdentityKeys,
  mergeDocumentCandidates
} = require("../src/core/documentCandidateProtocol");
const { createWorkbenchExportPackage, normalizeSnapshotForImport } = require("../src/core/workbenchSnapshot");

test("normalizeDocumentCandidate creates stable provenance and anomaly tags", () => {
  const candidate = normalizeDocumentCandidate({
    sourceAdapterId: "openalex",
    sourceRecordId: "https://openalex.org/W1",
    title: " Acute gastroenteritis nursing ",
    authors: [{ name: "Chen" }],
    year: "2023",
    doi: "10.123/example",
    attachments: [{ kind: "open-access-pdf-url", url: "https://example.org/paper.pdf", license: "cc-by" }],
    provenance: { source: "openalex", requestId: "req-a" },
    observedAt: "2026-05-23T12:00:00.000Z"
  });

  assert.equal(candidate.id, "candidate-openalex-https-openalex-org-w1");
  assert.equal(candidate.title, "Acute gastroenteritis nursing");
  assert.deepEqual(candidate.identityKeys, ["doi:10.123/example"]);
  assert.equal(candidate.attachments[0].importable, true);
  assert.deepEqual(candidate.anomalyTags, []);
});

test("normalizeAttachmentReference applies importability gates by attachment kind", () => {
  assert.equal(
    normalizeAttachmentReference({ kind: "local-file", path: "C:\\papers\\article.pdf" }).importable,
    true
  );
  assert.equal(
    normalizeAttachmentReference({ kind: "open-access-pdf-url", url: "https://example.org/article", contentType: "application/pdf" })
      .importable,
    true
  );
  assert.equal(
    normalizeAttachmentReference({
      kind: "connector-file-reference",
      referenceId: "file-a",
      provenance: { connectorId: "connector-a" }
    }).importable,
    true
  );
  assert.equal(normalizeAttachmentReference({ kind: "landing-page-url", url: "https://example.org/article" }).importable, false);
});

test("normalizeDocumentCandidate marks missing identity and unclear attachments", () => {
  const candidate = normalizeDocumentCandidate({
    sourceAdapterId: "connector-a",
    sourceRecordId: "record-a",
    title: "Untitled source",
    authors: [],
    year: "3025",
    attachments: [{ kind: "landing-page-url", url: "https://example.org/article" }],
    provenance: {},
    observedAt: "2026-05-23T12:00:00.000Z"
  });

  assert.ok(candidate.anomalyTags.includes("缺少身份线索"));
  assert.ok(candidate.anomalyTags.includes("作者为空"));
  assert.ok(candidate.anomalyTags.includes("年份异常"));
  assert.ok(candidate.anomalyTags.includes("来源证明不足"));
  assert.equal(candidate.attachments[0].importable, false);
});

test("deriveCandidateIdentityKeys prefers durable identifiers before normalized title", () => {
  assert.deepEqual(
    deriveCandidateIdentityKeys({
      doi: "HTTPS://DOI.ORG/10.123/Example",
      isbn: "978-1-2345-6789-0",
      pmid: "123456",
      arxivId: " 2301.00001 ",
      stableUrl: "https://example.org/work",
      title: " Acute gastroenteritis nursing "
    }),
    [
      "doi:10.123/example",
      "isbn:978-1-2345-6789-0",
      "pmid:123456",
      "arxiv:2301.00001",
      "url:https://example.org/work"
    ]
  );
  assert.deepEqual(deriveCandidateIdentityKeys({ title: " Acute gastroenteritis nursing " }), [
    "title:acute gastroenteritis nursing"
  ]);
});

test("mergeDocumentCandidates dedupes by DOI and preserves source provenance", () => {
  const merged = mergeDocumentCandidates([
    normalizeDocumentCandidate({ sourceAdapterId: "crossref", sourceRecordId: "doi-a", title: "A", doi: "10.1/a" }),
    normalizeDocumentCandidate({ sourceAdapterId: "openalex", sourceRecordId: "work-a", title: "A expanded", doi: "10.1/A" })
  ]);

  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0].sourceAdapterIds.sort(), ["crossref", "openalex"]);
  assert.equal(merged[0].title, "A expanded");
});

test("mergeDocumentCandidates preserves right-side raw payload and extension fields", () => {
  const merged = mergeDocumentCandidates([
    normalizeDocumentCandidate({
      sourceAdapterId: "crossref",
      sourceRecordId: "doi-a",
      title: "A",
      doi: "10.1/a",
      rawSourcePayload: { crossrefId: "doi-a" },
      crossrefMetadata: { score: "left" }
    }),
    normalizeDocumentCandidate({
      sourceAdapterId: "openalex",
      sourceRecordId: "work-a",
      title: "A expanded",
      doi: "10.1/A",
      rawSourcePayload: { openalexId: "work-a" },
      openAlexMetadata: { citedByCount: 42 }
    })
  ]);

  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0].rawSourcePayload, { crossrefId: "doi-a", openalexId: "work-a" });
  assert.deepEqual(merged[0].crossrefMetadata, { score: "left" });
  assert.deepEqual(merged[0].openAlexMetadata, { citedByCount: 42 });
});

test("mergeDocumentCandidates only dedupes title-only candidates when normalized title and year match", () => {
  const merged = mergeDocumentCandidates([
    normalizeDocumentCandidate({ sourceAdapterId: "connector-a", sourceRecordId: "a", title: "Shared Title", year: "2024" }),
    normalizeDocumentCandidate({ sourceAdapterId: "connector-b", sourceRecordId: "b", title: " shared title ", year: "2024" }),
    normalizeDocumentCandidate({ sourceAdapterId: "connector-c", sourceRecordId: "c", title: "Shared Title", year: "2025" })
  ]);

  assert.equal(merged.length, 2);
  assert.deepEqual(merged[0].sourceAdapterIds.sort(), ["connector-a", "connector-b"]);
});

test("snapshot preserves candidates and redacts raw payload secrets", () => {
  const restored = normalizeSnapshotForImport({
    schemaVersion: 1,
    documentCandidates: [{ id: "candidate-a", rawSourcePayload: { token: "secret-token" } }]
  });
  const exported = createWorkbenchExportPackage({ snapshot: restored, exportedAt: "2026-05-23T12:00:00.000Z" });
  assert.equal(exported.snapshot.documentCandidates[0].rawSourcePayload.token, "<redacted>");
});

test("core index exports document candidate protocol module", () => {
  const core = require("../src/core");

  assert.equal(typeof core.WorkbenchDocumentCandidateProtocol.normalizeDocumentCandidate, "function");
});
