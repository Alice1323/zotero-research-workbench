(function () {
const DocumentCandidateProtocol =
  typeof require === "function"
    ? require("./documentCandidateProtocol")
    : typeof window !== "undefined"
      ? window.WorkbenchDocumentCandidateProtocol
      : null;

const SOURCE_ADAPTER_FETCH_RUNTIME_UNAVAILABLE = "Source adapter fetch runtime unavailable";
const HTTP_CONNECTOR_PROTOCOL = "zotero-research-workbench.document-candidates.v1";
const SECRET_PLACEHOLDER = "<redacted>";

function createOpenAlexAdapter({ fetchImpl, baseUrl = "https://api.openalex.org" } = {}) {
  return {
    sourceAdapterId: "openalex",
    async query({ requestText, maxCandidates, observedAt, topicId } = {}) {
      assertFetchRuntime(fetchImpl);
      const url = `${trimTrailingSlash(baseUrl)}/works?search=${encodeURIComponent(cleanText(requestText))}&per-page=${normalizeMaxCandidates(maxCandidates)}`;

      try {
        const response = await fetchImpl(url);
        const failure = createHttpFailureIfNeeded("openalex", response);
        if (failure) {
          return adapterResult("openalex", [], [failure]);
        }
        const payload = await response.json();
        const candidates = (Array.isArray(payload?.results) ? payload.results : []).map((work) =>
          normalizeOpenAlexWork({ work, url, observedAt, topicId })
        );
        return adapterResult("openalex", candidates, []);
      } catch (error) {
        return adapterResult("openalex", [], [createSourceAdapterFailure({ sourceAdapterId: "openalex", error })]);
      }
    }
  };
}

function createCrossrefAdapter({ fetchImpl, baseUrl = "https://api.crossref.org" } = {}) {
  return {
    sourceAdapterId: "crossref",
    async query({ requestText, maxCandidates, observedAt, topicId } = {}) {
      assertFetchRuntime(fetchImpl);
      const url = `${trimTrailingSlash(baseUrl)}/works?query=${encodeURIComponent(cleanText(requestText))}&rows=${normalizeMaxCandidates(maxCandidates)}`;

      try {
        const response = await fetchImpl(url);
        const failure = createHttpFailureIfNeeded("crossref", response);
        if (failure) {
          return adapterResult("crossref", [], [failure]);
        }
        const payload = await response.json();
        const candidates = (Array.isArray(payload?.message?.items) ? payload.message.items : []).map((item) =>
          normalizeCrossrefItem({ item, url, observedAt, topicId })
        );
        return adapterResult("crossref", candidates, []);
      } catch (error) {
        return adapterResult("crossref", [], [createSourceAdapterFailure({ sourceAdapterId: "crossref", error })]);
      }
    }
  };
}

function createUnpaywallAdapter({ fetchImpl, baseUrl = "https://api.unpaywall.org/v2", email } = {}) {
  return {
    sourceAdapterId: "unpaywall",
    async query({ dois, observedAt, topicId } = {}) {
      assertFetchRuntime(fetchImpl);
      const normalizedDois = uniqueClean(dois).map((doi) => normalizeDoi(doi)).filter(Boolean);
      if (!normalizedDois.length) {
        return adapterResult("unpaywall", [], [
          createSourceAdapterFailure({
            sourceAdapterId: "unpaywall",
            userMessage: "Unpaywall requires at least one DOI",
            error: { reason: "missing-doi" }
          })
        ]);
      }

      const candidates = [];
      const failures = [];
      for (const doi of normalizedDois) {
        const url = `${trimTrailingSlash(baseUrl)}/${encodeURIComponent(doi)}?email=${encodeURIComponent(cleanText(email))}`;
        try {
          const response = await fetchImpl(url);
          const failure = createHttpFailureIfNeeded("unpaywall", response);
          if (failure) {
            failures.push(failure);
            continue;
          }
          const payload = await response.json();
          candidates.push(normalizeUnpaywallRecord({ record: payload, doi, url, observedAt, topicId }));
        } catch (error) {
          failures.push(createSourceAdapterFailure({ sourceAdapterId: "unpaywall", error }));
        }
      }

      return adapterResult("unpaywall", candidates, failures);
    }
  };
}

function createHttpConnectorAdapter({
  fetchImpl,
  endpointUrl,
  headers,
  timeoutMs = 15000,
  maxResponseBytes = 1_000_000
} = {}) {
  return {
    sourceAdapterId: "http-connector",
    async query({ topicId, requestText, sourceScopes, maxCandidates, selectedItems, dois, observedAt } = {}) {
      assertFetchRuntime(fetchImpl);
      const normalizedEndpointUrl = cleanText(endpointUrl);
      if (!normalizedEndpointUrl) {
        return adapterResult("http-connector", [], [
          createSourceAdapterFailure({
            sourceAdapterId: "http-connector",
            userMessage: "HTTP connector endpoint is required",
            error: { reason: "missing-endpoint" }
          })
        ]);
      }

      const payload = createConnectorRequestPayload({ topicId, requestText, sourceScopes, maxCandidates, selectedItems, dois });
      const requestHeaders = {
        ...clonePlain(headers || {}),
        "content-type": "application/json"
      };

      try {
        const response = await fetchImpl(normalizedEndpointUrl, {
          method: "POST",
          headers: requestHeaders,
          body: JSON.stringify(payload),
          timeoutMs: normalizeTimeoutMs(timeoutMs)
        });
        const httpFailure = createHttpFailureIfNeeded("http-connector", response, {
          endpointUrl: normalizedEndpointUrl,
          headers: requestHeaders
        });
        if (httpFailure) {
          return adapterResult("http-connector", [], [httpFailure]);
        }

        const contentType = getHeader(response?.headers, "content-type");
        const body = await response.text();
        if (body.length > normalizeMaxResponseBytes(maxResponseBytes)) {
          return adapterResult("http-connector", [], [
            createSourceAdapterFailure({
              sourceAdapterId: "http-connector",
              status: response?.status,
              userMessage: "HTTP connector response is too large",
              error: { endpointUrl: normalizedEndpointUrl, headers: requestHeaders, maxResponseBytes }
            })
          ]);
        }
        if (contentType && !contentType.toLowerCase().includes("application/json")) {
          return adapterResult("http-connector", [], [
            createSourceAdapterFailure({
              sourceAdapterId: "http-connector",
              status: response?.status,
              userMessage: "HTTP connector returned non-JSON content",
              error: { endpointUrl: normalizedEndpointUrl, contentType, headers: requestHeaders }
            })
          ]);
        }

        const parsed = JSON.parse(body || "{}");
        if (!Array.isArray(parsed.candidates)) {
          return adapterResult("http-connector", [], [
            createSourceAdapterFailure({
              sourceAdapterId: "http-connector",
              status: response?.status,
              userMessage: "HTTP connector response must include candidates array",
              error: { endpointUrl: normalizedEndpointUrl, headers: requestHeaders, responseKeys: Object.keys(parsed || {}) }
            })
          ]);
        }

        const candidates = parsed.candidates.map((candidate) =>
          normalizeHttpConnectorCandidate({
            candidate,
            endpointUrl: normalizedEndpointUrl,
            observedAt,
            topicId: cleanText(candidate?.topicId) || cleanText(topicId)
          })
        );
        return adapterResult("http-connector", candidates, []);
      } catch (error) {
        return adapterResult("http-connector", [], [
          createSourceAdapterFailure({
            sourceAdapterId: "http-connector",
            error: {
              endpointUrl: normalizedEndpointUrl,
              headers: requestHeaders,
              message: error?.message || String(error)
            }
          })
        ]);
      }
    }
  };
}

function createConnectorRequestPayload({ topicId, requestText, sourceScopes, maxCandidates, selectedItems, dois } = {}) {
  return {
    protocol: HTTP_CONNECTOR_PROTOCOL,
    topicId: cleanText(topicId),
    requestText: cleanText(requestText),
    sourceScopes: Array.isArray(sourceScopes) ? clonePlain(sourceScopes) : [],
    maxCandidates: normalizeMaxCandidates(maxCandidates),
    selectedItems: Array.isArray(selectedItems) ? clonePlain(selectedItems) : [],
    dois: uniqueClean(dois).map((doi) => normalizeDoi(doi)).filter(Boolean)
  };
}

function createSourceAdapterFailure({ sourceAdapterId, error, status, userMessage } = {}) {
  return {
    sourceAdapterId: cleanText(sourceAdapterId) || "unknown-source",
    status: normalizeFailureStatus(status),
    message: cleanText(userMessage) || cleanText(error?.message) || "Source adapter query failed",
    userMessage: cleanText(userMessage) || cleanText(error?.message) || "Source adapter query failed",
    technicalDetail: formatTechnicalDetail(error),
    createdAt: new Date().toISOString()
  };
}

function normalizeFailureStatus(status) {
  if (typeof status === "number" && Number.isFinite(status)) {
    return status;
  }
  return cleanText(status);
}

function normalizeOpenAlexWork({ work, url, observedAt, topicId } = {}) {
  const openAccess = work?.open_access || {};
  const pdfUrl = cleanText(openAccess.oa_url || work?.primary_location?.pdf_url);
  return normalizeDocumentCandidate({
    sourceAdapterId: "openalex",
    sourceRecordId: cleanText(work?.id),
    title: cleanText(work?.title || work?.display_name),
    authors: (Array.isArray(work?.authorships) ? work.authorships : []).map((authorship) => ({
      name: cleanText(authorship?.author?.display_name)
    })),
    year: cleanNumberishText(work?.publication_year),
    doi: cleanText(work?.doi),
    publicationTitle: cleanText(work?.host_venue?.display_name || work?.primary_location?.source?.display_name),
    stableUrl: cleanText(work?.id || work?.doi),
    openAccessStatus: openAccess.is_oa ? "open" : "closed",
    attachments: pdfUrl
      ? [
          {
            kind: "open-access-pdf-url",
            url: pdfUrl,
            license: cleanText(openAccess.license || work?.primary_location?.license),
            provenance: { source: "openalex", sourceUrl: cleanText(work?.id), requestUrl: url }
          }
        ]
      : [],
    provenance: { source: "openalex", sourceUrl: cleanText(work?.id), requestUrl: url },
    rawSourcePayload: { openalex: clonePlain(work || {}) },
    topicId: cleanText(topicId),
    observedAt
  });
}

function normalizeCrossrefItem({ item, url, observedAt, topicId } = {}) {
  const doi = cleanText(item?.DOI || item?.doi);
  const sourceRecordId = doi || cleanText(item?.URL || item?.URL);
  return normalizeDocumentCandidate({
    sourceAdapterId: "crossref",
    sourceRecordId,
    title: firstClean(item?.title),
    authors: (Array.isArray(item?.author) ? item.author : []).map((author) => ({
      name: cleanText(author?.name || [author?.given, author?.family].filter(Boolean).join(" "))
    })),
    year: cleanNumberishText(firstIssuedYear(item?.issued || item?.published || item?.["published-print"] || item?.["published-online"])),
    doi,
    publicationTitle: firstClean(item?.["container-title"]),
    stableUrl: cleanText(item?.URL || (doi ? `https://doi.org/${doi}` : "")),
    attachments: extractCrossrefAttachments(item, url),
    provenance: { source: "crossref", sourceUrl: cleanText(item?.URL), requestUrl: url },
    rawSourcePayload: { crossref: clonePlain(item || {}) },
    topicId: cleanText(topicId),
    observedAt
  });
}

function normalizeUnpaywallRecord({ record, doi, url, observedAt, topicId } = {}) {
  const location = record?.best_oa_location || {};
  const pdfUrl = cleanText(location.url_for_pdf);
  const normalizedDoi = normalizeDoi(record?.doi || doi);
  return normalizeDocumentCandidate({
    sourceAdapterId: "unpaywall",
    sourceRecordId: normalizedDoi,
    title: cleanText(record?.title),
    authors: normalizeUnpaywallAuthors(record?.z_authors),
    year: cleanNumberishText(record?.year),
    doi: normalizedDoi,
    publicationTitle: cleanText(record?.journal_name),
    stableUrl: normalizedDoi ? `https://doi.org/${normalizedDoi}` : "",
    openAccessStatus: record?.is_oa ? "open" : "closed",
    attachments: pdfUrl
      ? [
          {
            kind: "open-access-pdf-url",
            url: pdfUrl,
            license: cleanText(location.license),
            provenance: { source: "unpaywall", sourceUrl: cleanText(location.url || location.url_for_landing_page), requestUrl: url }
          }
        ]
      : [],
    provenance: { source: "unpaywall", sourceUrl: cleanText(location.url || location.url_for_landing_page), requestUrl: url },
    rawSourcePayload: { unpaywall: clonePlain(record || {}) },
    topicId: cleanText(topicId),
    observedAt
  });
}

function normalizeHttpConnectorCandidate({ candidate, endpointUrl, observedAt, topicId } = {}) {
  return normalizeDocumentCandidate({
    ...clonePlain(candidate || {}),
    sourceAdapterId: "http-connector",
    sourceRecordId: cleanText(candidate?.sourceRecordId || candidate?.id || candidate?.url || candidate?.doi || candidate?.title),
    provenance: {
      ...clonePlain(candidate?.provenance || {}),
      source: "http-connector",
      connectorEndpoint: endpointUrl
    },
    rawSourcePayload: {
      ...clonePlain(candidate?.rawSourcePayload || {}),
      httpConnector: clonePlain(candidate || {})
    },
    topicId: cleanText(topicId),
    observedAt: cleanText(candidate?.observedAt || observedAt)
  });
}

function normalizeDocumentCandidate(candidate) {
  if (!DocumentCandidateProtocol?.normalizeDocumentCandidate) {
    throw new Error("Document candidate protocol runtime unavailable");
  }
  return DocumentCandidateProtocol.normalizeDocumentCandidate(candidate);
}

function adapterResult(sourceAdapterId, candidates, failures) {
  return {
    sourceAdapterId,
    candidates: Array.isArray(candidates) ? candidates : [],
    failures: Array.isArray(failures) ? failures : []
  };
}

function createHttpFailureIfNeeded(sourceAdapterId, response, context = {}) {
  if (response?.ok !== false) {
    return null;
  }
  return createSourceAdapterFailure({
    sourceAdapterId,
    status: response?.status,
    userMessage: `${sourceAdapterId} returned HTTP ${response?.status || "error"}`,
    error: { ...context, status: response?.status, statusText: response?.statusText }
  });
}

function assertFetchRuntime(fetchImpl) {
  if (typeof fetchImpl !== "function") {
    throw new Error(SOURCE_ADAPTER_FETCH_RUNTIME_UNAVAILABLE);
  }
}

function extractCrossrefAttachments(item, requestUrl) {
  return (Array.isArray(item?.link) ? item.link : [])
    .filter((link) => cleanText(link?.URL))
    .map((link) => ({
      kind: "open-access-pdf-url",
      url: cleanText(link.URL),
      contentType: cleanText(link["content-type"]),
      provenance: { source: "crossref", requestUrl }
    }));
}

function normalizeUnpaywallAuthors(authors) {
  return (Array.isArray(authors) ? authors : []).map((author) => ({
    name: cleanText(author?.given && author?.family ? `${author.given} ${author.family}` : author?.name || author?.family || author?.given)
  }));
}

function firstIssuedYear(value) {
  const firstPart = Array.isArray(value?.["date-parts"]) ? value["date-parts"][0] : null;
  return Array.isArray(firstPart) ? firstPart[0] : "";
}

function firstClean(value) {
  if (Array.isArray(value)) {
    return cleanText(value[0]);
  }
  return cleanText(value);
}

function getHeader(headers, key) {
  if (!headers) {
    return "";
  }
  if (typeof headers.get === "function") {
    return cleanText(headers.get(key));
  }
  const match = Object.keys(headers).find((entry) => entry.toLowerCase() === key.toLowerCase());
  return match ? cleanText(headers[match]) : "";
}

function formatTechnicalDetail(error) {
  if (!error) {
    return "";
  }
  const material =
    error instanceof Error
      ? { message: error.message, name: error.name }
      : typeof error === "string"
        ? { message: error }
        : clonePlain(error);
  return JSON.stringify(redactSecretMaterial(material));
}

function redactSecretMaterial(value) {
  if (Array.isArray(value)) {
    return value.map((item) => redactSecretMaterial(item));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const result = {};
  for (const [key, entry] of Object.entries(value)) {
    result[key] = isSecretKey(key) && entry ? SECRET_PLACEHOLDER : redactSecretMaterial(entry);
  }
  return result;
}

function isSecretKey(key) {
  const value = String(key || "");
  return (
    /^(authorization|apiKey|api_key|api-key|token|secret|password)$/i.test(value) ||
    /(^|[_-])(api[_-]?key|token|secret|password)([_-]|$)/i.test(value)
  );
}

function normalizeMaxCandidates(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 50;
  }
  return Math.max(1, Math.min(200, Math.round(numeric)));
}

function normalizeTimeoutMs(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 15000;
  }
  return Math.max(1000, Math.min(120000, Math.round(numeric)));
}

function normalizeMaxResponseBytes(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 1_000_000;
  }
  return Math.max(1, Math.min(10_000_000, Math.round(numeric)));
}

function normalizeDoi(value) {
  return cleanText(value)
    .replace(/^doi:\s*/i, "")
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .toLowerCase();
}

function uniqueClean(values) {
  const result = [];
  for (const value of Array.isArray(values) ? values : []) {
    const text = cleanText(value);
    if (text && !result.includes(text)) {
      result.push(text);
    }
  }
  return result;
}

function trimTrailingSlash(value) {
  return cleanText(value).replace(/\/+$/, "");
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanNumberishText(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return cleanText(value);
}

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

const WorkbenchLiteratureSourceAdapters = {
  HTTP_CONNECTOR_PROTOCOL,
  SOURCE_ADAPTER_FETCH_RUNTIME_UNAVAILABLE,
  cleanText,
  cleanNumberishText,
  clonePlain,
  createConnectorRequestPayload,
  createCrossrefAdapter,
  createHttpConnectorAdapter,
  createOpenAlexAdapter,
  createSourceAdapterFailure,
  createUnpaywallAdapter,
  normalizeDoi,
  normalizeMaxCandidates,
  redactSecretMaterial,
  uniqueClean
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = WorkbenchLiteratureSourceAdapters;
}

if (typeof window !== "undefined") {
  window.WorkbenchLiteratureSourceAdapters = WorkbenchLiteratureSourceAdapters;
}
})();
