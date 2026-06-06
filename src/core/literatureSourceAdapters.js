(function () {
const DocumentCandidateProtocol =
  typeof require === "function"
    ? require("./documentCandidateProtocol")
    : typeof window !== "undefined"
      ? window.WorkbenchDocumentCandidateProtocol
      : null;
const SciPdfEmbeddedResolver =
  typeof require === "function"
    ? require("./scipdfEmbeddedResolver")
    : typeof window !== "undefined"
      ? window.WorkbenchSciPdfEmbeddedResolver
      : null;

const SOURCE_ADAPTER_FETCH_RUNTIME_UNAVAILABLE = "Source adapter fetch runtime unavailable";
const HTTP_CONNECTOR_PROTOCOL = "zotero-research-workbench.document-candidates.v1";
const SECRET_PLACEHOLDER = "<redacted>";
const PUBLISHER_PDF_FETCH_TIMEOUT_MS = 10000;
const PUBLISHER_PDF_CONCURRENCY_LIMIT = 3;
const SCI_PDF_CONCURRENCY_LIMIT = 3;

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

function createPublisherPdfAdapter({ fetchImpl, crossrefBaseUrl = "https://api.crossref.org" } = {}) {
  return {
    sourceAdapterId: "publisher-pdf",
    async query({ dois, observedAt, topicId } = {}) {
      assertFetchRuntime(fetchImpl);
      const normalizedDois = uniqueClean(dois).map((doi) => normalizeDoi(doi)).filter(Boolean);
      if (!normalizedDois.length) {
        return adapterResult("publisher-pdf", [], [
          createSourceAdapterFailure({
            sourceAdapterId: "publisher-pdf",
            userMessage: "Publisher PDF requires at least one DOI",
            error: { reason: "missing-doi" }
          })
        ]);
      }

      const results = await mapWithConcurrency(normalizedDois, PUBLISHER_PDF_CONCURRENCY_LIMIT, (doi) =>
        queryPublisherPdfDoi({
          doi,
          crossrefBaseUrl,
          fetchImpl,
          observedAt,
          topicId
        })
      );
      const candidates = results.flatMap((result) => result.candidates);
      const failures = results.flatMap((result) => result.failures);

      return adapterResult("publisher-pdf", candidates, failures);
    }
  };
}

async function mapWithConcurrency(items, concurrencyLimit, mapper) {
  const values = Array.isArray(items) ? items : [];
  const limit = Math.max(1, Math.min(values.length || 1, Math.trunc(Number(concurrencyLimit)) || 1));
  const results = new Array(values.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: limit }, () => worker()));
  return results;
}

async function queryPublisherPdfDoi({ doi, crossrefBaseUrl, fetchImpl, observedAt, topicId } = {}) {
  const crossrefUrl = `${trimTrailingSlash(crossrefBaseUrl)}/works/${encodeURIComponent(doi)}`;
  try {
    const response = await fetchImpl(crossrefUrl, { timeoutMs: PUBLISHER_PDF_FETCH_TIMEOUT_MS });
    const failure = createHttpFailureIfNeeded("publisher-pdf", response, { doi, crossrefUrl });
    if (failure) {
      return { candidates: [], failures: [failure] };
    }
    const payload = await response.json();
    const item = payload?.message || {};
    const record = await normalizePublisherPdfRecord({
      item,
      doi,
      crossrefUrl,
      fetchImpl,
      observedAt,
      topicId
    });
    const candidate = record.candidate;
    if (candidate.attachments.length) {
      return { candidates: [candidate], failures: [] };
    }
    return {
      candidates: [],
      failures: [createSourceAdapterFailure({
        sourceAdapterId: "publisher-pdf",
        userMessage: "Publisher PDF did not find a PDF URL",
        error: {
          doi,
          crossrefUrl,
          landingUrl: record.landingUrl,
          publisher: cleanText(item?.publisher),
          reason: "publisher-pdf-url-missing",
          ...clonePlain(record.pdfProbe || {})
        }
      })]
    };
  } catch (error) {
    return {
      candidates: [],
      failures: [createSourceAdapterFailure({ sourceAdapterId: "publisher-pdf", error })]
    };
  }
}

function createSciHubResolverAdapter({ fetchImpl, resolverUrlTemplate } = {}) {
  return {
    sourceAdapterId: "sci-hub",
    async query({ dois, observedAt, topicId } = {}) {
      assertFetchRuntime(fetchImpl);
      const template = cleanText(resolverUrlTemplate);
      if (!template) {
        return adapterResult("sci-hub", [], [
          createSourceAdapterFailure({
            sourceAdapterId: "sci-hub",
            userMessage: "Sci-Hub resolver URL template is required",
            error: { reason: "missing-resolver-template" }
          })
        ]);
      }
      const normalizedDois = uniqueClean(dois).map((doi) => normalizeDoi(doi)).filter(Boolean);
      if (!normalizedDois.length) {
        return adapterResult("sci-hub", [], [
          createSourceAdapterFailure({
            sourceAdapterId: "sci-hub",
            userMessage: "Sci-Hub resolver requires at least one DOI",
            error: { reason: "missing-doi" }
          })
        ]);
      }

      const candidates = [];
      const failures = [];
      for (const doi of normalizedDois) {
        const url = buildResolverUrl(template, doi);
        try {
          const response = await fetchImpl(url);
          const failure = createHttpFailureIfNeeded("sci-hub", response);
          if (failure) {
            failures.push(failure);
            continue;
          }
          const payload = await response.json();
          const candidate = normalizeSciHubResolverRecord({ record: payload, doi, url, observedAt, topicId });
          if (candidate.attachments.length) {
            candidates.push(candidate);
          } else {
            failures.push(createSourceAdapterFailure({
              sourceAdapterId: "sci-hub",
              userMessage: "Sci-Hub resolver did not return a PDF URL",
              error: { requestUrl: url, responseKeys: Object.keys(payload || {}) }
            }));
          }
        } catch (error) {
          failures.push(createSourceAdapterFailure({ sourceAdapterId: "sci-hub", error }));
        }
      }
      return adapterResult("sci-hub", candidates, failures);
    }
  };
}

function createSciPdfEmbeddedAdapter({ fetchImpl, baseUrls } = {}) {
  return {
    sourceAdapterId: "sci-pdf",
    async query({ dois, selectedItems, documentCandidates, observedAt, topicId } = {}) {
      assertFetchRuntime(fetchImpl);
      assertSciPdfRuntime();
      const normalizedBaseUrls = SciPdfEmbeddedResolver.normalizeSciPdfBaseUrls(baseUrls);
      if (!normalizedBaseUrls.length) {
        return adapterResult("sci-pdf", [], [
          createSourceAdapterFailure({
            sourceAdapterId: "sci-pdf",
            userMessage: "Sci-PDF requires at least one valid Sci-PDF site",
            error: { reason: "missing-base-url" }
          })
        ]);
      }

      const normalizedDois = SciPdfEmbeddedResolver.extractSciPdfDoiValues(
        dois,
        selectedItems,
        documentCandidates
      );
      if (!normalizedDois.length) {
        return adapterResult("sci-pdf", [], [
          createSourceAdapterFailure({
            sourceAdapterId: "sci-pdf",
            userMessage: "Sci-PDF requires at least one DOI",
            error: { reason: "missing-doi" }
          })
        ]);
      }

      const results = await mapWithConcurrency(normalizedDois, SCI_PDF_CONCURRENCY_LIMIT, async (doi) => {
        const resolved = await SciPdfEmbeddedResolver.resolveSciPdfDoi({
          doi,
          baseUrls: normalizedBaseUrls,
          fetchImpl
        });
        if (resolved.pdfUrl) {
          return {
            candidates: [normalizeSciPdfEmbeddedRecord({ resolved, observedAt, topicId })],
            failures: []
          };
        }
        return {
          candidates: [],
          failures: [createSourceAdapterFailure({
            sourceAdapterId: "sci-pdf",
            userMessage: "Sci-PDF did not find a PDF for DOI",
            error: {
              doi,
              failures: resolved.failures
            }
          })]
        };
      });
      const candidates = results.flatMap((result) => result.candidates);
      const failures = results.flatMap((result) => result.failures);

      return adapterResult("sci-pdf", candidates, failures);
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

async function normalizePublisherPdfRecord({ item, doi, crossrefUrl, fetchImpl, observedAt, topicId } = {}) {
  const normalizedDoi = normalizeDoi(item?.DOI || doi);
  const resourceUrl = cleanText(item?.resource?.primary?.URL);
  const landingUrl = derivePublisherLandingUrlFromResource(resourceUrl) || resourceUrl || cleanText(item?.URL);
  const pdfProbe = await findPublisherPdfUrl({ item, landingUrl, fetchImpl });
  const pdfUrl = cleanText(pdfProbe?.url || pdfProbe);
  const candidate = normalizeDocumentCandidate({
    sourceAdapterId: "publisher-pdf",
    sourceRecordId: normalizedDoi,
    title: firstClean(item?.title) || `Publisher PDF ${normalizedDoi}`,
    authors: (Array.isArray(item?.author) ? item.author : []).map((author) => ({
      name: cleanText(author?.name || [author?.given, author?.family].filter(Boolean).join(" "))
    })),
    year: firstIssuedYear(item?.issued || item?.published || item?.["published-print"] || item?.["published-online"]),
    doi: normalizedDoi,
    publicationTitle: firstClean(item?.["container-title"]),
    stableUrl: landingUrl || (normalizedDoi ? `https://doi.org/${normalizedDoi}` : ""),
    openAccessStatus: pdfUrl ? "open" : "",
    attachments: pdfUrl
      ? [
          {
            kind: "open-access-pdf-url",
            url: pdfUrl,
            contentType: "application/pdf",
            provenance: { source: "publisher-pdf", sourceUrl: landingUrl, requestUrl: crossrefUrl }
          }
        ]
      : [],
    provenance: { source: "publisher-pdf", sourceUrl: landingUrl, requestUrl: crossrefUrl },
    rawSourcePayload: {
      crossref: {
        doi: normalizedDoi,
        publisher: cleanText(item?.publisher),
        hasPublisherPdfUrl: Boolean(pdfUrl)
      }
    },
    topicId: cleanText(topicId),
    observedAt
  });
  return { candidate, landingUrl, pdfProbe };
}

function normalizeSciHubResolverRecord({ record, doi, url, observedAt, topicId } = {}) {
  const pdfUrl = cleanText(record?.pdfUrl || record?.url || record?.fileUrl);
  const sourceUrl = cleanText(record?.sourceUrl || record?.landingPageUrl || record?.requestUrl);
  return normalizeDocumentCandidate({
    sourceAdapterId: "sci-hub",
    sourceRecordId: normalizeDoi(record?.doi || doi),
    title: cleanText(record?.title) || `Sci-Hub PDF ${normalizeDoi(doi)}`,
    authors: Array.isArray(record?.authors) ? record.authors : [],
    year: cleanNumberishText(record?.year),
    doi: normalizeDoi(record?.doi || doi),
    publicationTitle: cleanText(record?.publicationTitle || record?.journalTitle),
    stableUrl: normalizeDoi(record?.doi || doi) ? `https://doi.org/${normalizeDoi(record?.doi || doi)}` : "",
    openAccessStatus: cleanText(record?.openAccessStatus || record?.oaStatus),
    attachments: pdfUrl
      ? [
          {
            kind: "sci-hub-resolved-url",
            url: pdfUrl,
            license: cleanText(record?.license),
            provenance: { source: "sci-hub", sourceUrl, requestUrl: url }
          }
        ]
      : [],
    provenance: { source: "sci-hub", sourceUrl, requestUrl: url },
    rawSourcePayload: {
      sciHub: {
        doi: normalizeDoi(record?.doi || doi),
        sourceUrl,
        hasPdfUrl: Boolean(pdfUrl)
      }
    },
    topicId: cleanText(topicId),
    observedAt
  });
}

function assertSciPdfRuntime() {
  if (!SciPdfEmbeddedResolver) {
    throw new Error("Sci-PDF embedded resolver runtime unavailable");
  }
}

function normalizeSciPdfEmbeddedRecord({ resolved, observedAt, topicId } = {}) {
  const doi = SciPdfEmbeddedResolver.normalizeDoi(resolved?.doi);
  return normalizeDocumentCandidate({
    sourceAdapterId: "sci-pdf",
    sourceRecordId: doi,
    title: `Sci-PDF PDF ${doi}`,
    doi,
    stableUrl: doi ? `https://doi.org/${doi}` : "",
    openAccessStatus: "unknown",
    topicId: cleanText(topicId),
    provenance: {
      source: "sci-pdf",
      sourceAdapterId: "sci-pdf",
      sourceUrl: cleanText(resolved?.requestUrl),
      requestUrl: cleanText(resolved?.requestUrl),
      upstream: "syt2/zotero-scipdf@af4a838"
    },
    attachments: [
      {
        kind: "sci-hub-resolved-url",
        url: cleanText(resolved?.pdfUrl),
        contentType: "application/pdf",
        license: "unknown",
        provenance: {
          source: "sci-pdf",
          sourceAdapterId: "sci-pdf",
          sourceUrl: cleanText(resolved?.requestUrl),
          requestUrl: cleanText(resolved?.requestUrl),
          resolverMode: cleanText(resolved?.resolver?.mode) || "html",
          selector: cleanText(resolved?.resolver?.selector) || "#pdf",
          upstream: "syt2/zotero-scipdf@af4a838"
        }
      }
    ],
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

async function findPublisherPdfUrl({ item, landingUrl, fetchImpl } = {}) {
  const linkedPdf = (Array.isArray(item?.link) ? item.link : [])
    .map((link) => cleanText(link?.URL))
    .find(isLikelyPdfDownloadUrl);
  if (linkedPdf) {
    return { url: linkedPdf, strategy: "crossref-link" };
  }

  const resourceUrl = cleanText(item?.resource?.primary?.URL);
  if (isLikelyPdfDownloadUrl(resourceUrl)) {
    return { url: resourceUrl, strategy: "crossref-resource" };
  }

  const normalizedLandingUrl = derivePublisherLandingUrlFromResource(resourceUrl) || cleanText(landingUrl);
  if (!normalizedLandingUrl || !/^https?:\/\//i.test(normalizedLandingUrl)) {
    return { url: "", landingUrl: normalizedLandingUrl, reason: "missing-landing-url" };
  }
  const probe = {
    url: "",
    landingUrl: normalizedLandingUrl,
    landingStatus: "",
    landingContentType: "",
    hansChallengeDetected: false,
    hansChallengeCookieCreated: false,
    hansChallengeRetried: false,
    hansRetryStatus: "",
    hansRetryContentType: "",
    hansRetryStillChallenge: false,
    reason: ""
  };
  const response = await fetchImpl(normalizedLandingUrl, { timeoutMs: PUBLISHER_PDF_FETCH_TIMEOUT_MS });
  probe.landingStatus = normalizeFailureStatus(response?.status);
  const failure = createHttpFailureIfNeeded("publisher-pdf", response, { landingUrl: normalizedLandingUrl });
  if (failure) {
    probe.reason = "landing-http-error";
    return probe;
  }
  const contentType = getHeader(response?.headers, "content-type").toLowerCase();
  probe.landingContentType = contentType;
  if (contentType.includes("application/pdf")) {
    return { ...probe, url: normalizedLandingUrl, strategy: "landing-pdf" };
  }
  const html = typeof response?.text === "function" ? await response.text() : "";
  const pdfUrl = await extractPublisherPdfUrlFromHtml({ html, landingUrl: normalizedLandingUrl, fetchImpl });
  if (pdfUrl) {
    return { ...probe, url: pdfUrl, strategy: "landing-html" };
  }
  const cookie = createHansPublisherChallengeCookie(html);
  probe.hansChallengeDetected = isHansPublisherChallengeHtml(html);
  probe.hansChallengeCookieCreated = Boolean(cookie);
  if (cookie) {
    probe.hansChallengeRetried = true;
    const retryResponse = await fetchImpl(normalizedLandingUrl, {
      timeoutMs: PUBLISHER_PDF_FETCH_TIMEOUT_MS,
      headers: { Cookie: cookie }
    });
    probe.hansRetryStatus = normalizeFailureStatus(retryResponse?.status);
    const retryFailure = createHttpFailureIfNeeded("publisher-pdf", retryResponse, { landingUrl: normalizedLandingUrl });
    if (retryFailure) {
      probe.reason = "hans-retry-http-error";
      return probe;
    }
    const retryContentType = getHeader(retryResponse?.headers, "content-type").toLowerCase();
    probe.hansRetryContentType = retryContentType;
    if (retryContentType.includes("application/pdf")) {
      return { ...probe, url: normalizedLandingUrl, strategy: "hans-retry-pdf" };
    }
    const retryHtml = typeof retryResponse?.text === "function" ? await retryResponse.text() : "";
    probe.hansRetryStillChallenge = isHansPublisherChallengeHtml(retryHtml);
    const retryPdfUrl = await extractPublisherPdfUrlFromHtml({ html: retryHtml, landingUrl: normalizedLandingUrl, fetchImpl });
    if (retryPdfUrl) {
      return { ...probe, url: retryPdfUrl, strategy: "hans-retry-html" };
    }
  }
  probe.reason = "no-pdf-url-in-landing-html";
  return probe;
}

function derivePublisherLandingUrlFromResource(resourceUrl) {
  const text = cleanText(resourceUrl);
  const ecoVector = text.match(/^(https?:\/\/journals\.eco-vector\.com\/[^/]+\/article\/)downloadSuppFile\/(\d+)\/\d+(?:[/?#]|$)/i);
  if (ecoVector) {
    return `${ecoVector[1]}view/${ecoVector[2]}`;
  }
  return "";
}

async function extractPublisherPdfUrlFromHtml({ html, landingUrl, fetchImpl } = {}) {
  const text = String(html || "");
  const candidates = [];
  const anchorRegexp = /<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchorRegexp.exec(text)) !== null) {
    const anchorContext = `${match[0]} ${stripHtmlTags(match[4])}`;
    const href = decodeHtmlAttribute(match[1] || match[2] || match[3]);
    if (isLikelyPdfDownloadUrl(href)) {
      const resolved = resolveUrl(href, landingUrl);
      if (resolved) {
        candidates.push({
          url: resolved,
          score: scorePublisherFileCandidate(anchorContext, resolved)
        });
      }
    }
  }
  candidates.sort((left, right) => right.score - left.score);
  const directCandidate = candidates.map((candidate) => candidate.url).find(Boolean);
  if (directCandidate) {
    return directCandidate;
  }
  if (typeof fetchImpl === "function") {
    anchorRegexp.lastIndex = 0;
    while ((match = anchorRegexp.exec(text)) !== null) {
      const tag = `${match[0]} ${stripHtmlTags(match[4])}`;
      const href = decodeHtmlAttribute(match[1] || match[2] || match[3]);
      const resolved = resolveUrl(href, landingUrl);
      if (!resolved || !/\bclass\s*=\s*(?:"[^"]*\bfile\b[^"]*"|'[^']*\bfile\b[^']*')/i.test(tag)) {
        continue;
      }
      const directDownloadUrl = derivePublisherDownloadUrlFromFileViewUrl(resolved);
      if (directDownloadUrl) {
        candidates.push({
          url: directDownloadUrl,
          score: scorePublisherFileCandidate(tag, directDownloadUrl)
        });
        continue;
      }
      const pdfCandidate = await resolvePublisherFileCandidate(resolved, fetchImpl);
      if (pdfCandidate.url) {
        candidates.push({
          url: pdfCandidate.url,
          score: scorePublisherFileCandidate(`${tag} ${pdfCandidate.label}`, resolved)
        });
      }
    }
  }
  candidates.sort((left, right) => right.score - left.score);
  return candidates.map((candidate) => candidate.url).find(Boolean) || "";
}

function derivePublisherDownloadUrlFromFileViewUrl(url) {
  const text = cleanText(url);
  if (!text) {
    return "";
  }
  const ecoVector = text.match(/^(https?:\/\/journals\.eco-vector\.com\/[^/]+\/article\/)view\/(\d+)\/(\d+)([/?#].*)?$/i);
  if (ecoVector) {
    return `${ecoVector[1]}download/${ecoVector[2]}/${ecoVector[3]}${ecoVector[4] || ""}`;
  }
  return "";
}

async function resolvePublisherFileCandidate(url, fetchImpl) {
  try {
    const response = await fetchImpl(url, { timeoutMs: PUBLISHER_PDF_FETCH_TIMEOUT_MS });
    if (response?.ok === false) {
      return { url: "", label: "" };
    }
    const contentType = getHeader(response?.headers, "content-type").toLowerCase();
    if (contentType.includes("application/pdf")) {
      return { url, label: "" };
    }
    if (contentType.includes("text/html") && typeof response?.text === "function") {
      const html = await response.text();
      return {
        url: extractDirectPublisherDownloadUrl({ html, landingUrl: url }) || "",
        label: extractHtmlTitle(html)
      };
    }
    return { url: "", label: "" };
  } catch (_error) {
    return { url: "", label: "" };
  }
}

function extractHtmlTitle(html) {
  return cleanText(String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
}

function stripHtmlTags(value) {
  return decodeHtmlAttribute(String(value || "").replace(/<[^>]*>/g, " "));
}

function extractDirectPublisherDownloadUrl({ html, landingUrl } = {}) {
  const text = String(html || "");
  const attrRegexp = /\b(?:href|src|data)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  let match;
  while ((match = attrRegexp.exec(text)) !== null) {
    const value = decodeHtmlAttribute(match[1] || match[2] || match[3]);
    if (/\/article\/(?:download|viewFile)\/\d+\/\d+(?:[/?#]|$)/i.test(value)) {
      return resolveUrl(value, landingUrl);
    }
  }
  return "";
}

function createHansPublisherChallengeCookie(html) {
  const text = String(html || "");
  const arg1 = cleanText(text.match(/\barg1\s*=\s*['"]([0-9a-f]{40})['"]/i)?.[1]);
  const key = extractHansPublisherChallengeKey(text);
  const permutationText = text.match(/\bm\s*=\s*\[([^\]]+)\]/i)?.[1] || "";
  if (!arg1 || !key || !permutationText) {
    return "";
  }
  const permutation = permutationText
    .split(",")
    .map((entry) => Number.parseInt(entry.trim(), 16))
    .filter((entry) => Number.isFinite(entry));
  if (permutation.length !== arg1.length || key.length !== arg1.length) {
    return "";
  }
  const reordered = [];
  for (let index = 0; index < arg1.length; index += 1) {
    const targetIndex = permutation.findIndex((entry) => entry === index + 1);
    if (targetIndex < 0) {
      return "";
    }
    reordered[targetIndex] = arg1[index];
  }
  const source = reordered.join("");
  let value = "";
  for (let index = 0; index < source.length && index < key.length; index += 2) {
    const byte = Number.parseInt(source.slice(index, index + 2), 16) ^ Number.parseInt(key.slice(index, index + 2), 16);
    if (!Number.isFinite(byte)) {
      return "";
    }
    value += byte.toString(16).padStart(2, "0");
  }
  return value ? `acw_sc__v2=${value}` : "";
}

function isHansPublisherChallengeHtml(html) {
  const text = String(html || "");
  return /\barg1\s*=\s*['"][0-9a-f]{40}['"]/i.test(text) || /\bacw_sc__v2\b/i.test(text);
}

function extractHansPublisherChallengeKey(html) {
  const indexMatch = String(html || "").match(/\bp\s*=\s*[A-Za-z_$][\w$]*\((0x[0-9a-f]+|\d+)\)/i);
  if (indexMatch) {
    return decodeHansPublisherChallengeStringAt(html, Number.parseInt(indexMatch[1], 0));
  }
  return cleanText(String(html || "").match(/\bp\s*=\s*['"]([0-9a-f]{40})['"]/i)?.[1]);
}

function decodeHansPublisherChallengeStringAt(html, encodedIndex) {
  const values = extractHansPublisherChallengeStringValues(html);
  const target = extractHansPublisherChallengeTarget(html);
  if (!values.length || !Number.isFinite(target)) {
    return "";
  }
  const cache = {};
  const decodeAt = (index) => {
    const offset = index - 0xfb;
    if (offset < 0 || offset >= values.length) {
      return "";
    }
    const cacheKey = `${offset}:${values[0]}`;
    if (!cache[cacheKey]) {
      cache[cacheKey] = decodeHansPublisherChallengeString(values[offset]);
    }
    return cache[cacheKey];
  };
  for (let guard = 0; guard < 10000; guard += 1) {
    try {
      const result =
        -Number.parseInt(decodeAt(0x117), 10) / 0x1 * (Number.parseInt(decodeAt(0x111), 10) / 0x2) +
        -Number.parseInt(decodeAt(0xfb), 10) / 0x3 * (Number.parseInt(decodeAt(0x10e), 10) / 0x4) +
        -Number.parseInt(decodeAt(0x101), 10) / 0x5 * (-Number.parseInt(decodeAt(0xfd), 10) / 0x6) +
        -Number.parseInt(decodeAt(0x102), 10) / 0x7 * (Number.parseInt(decodeAt(0x122), 10) / 0x8) +
        Number.parseInt(decodeAt(0x112), 10) / 0x9 +
        Number.parseInt(decodeAt(0x11d), 10) / 0xa * (Number.parseInt(decodeAt(0x11c), 10) / 0xb) +
        Number.parseInt(decodeAt(0x114), 10) / 0xc;
      if (result === target) {
        break;
      }
      values.push(values.shift());
    } catch (_error) {
      values.push(values.shift());
    }
  }
  return cleanText(decodeAt(encodedIndex));
}

function extractHansPublisherChallengeStringValues(html) {
  const body = String(html || "").match(/function\s+a0i\s*\(\)\s*\{\s*var\s+\w+\s*=\s*\[([\s\S]*?)\];\s*a0i\s*=\s*function/i)?.[1] || "";
  return Array.from(body.matchAll(/'([^']*)'/g)).map((match) => match[1]);
}

function extractHansPublisherChallengeTarget(html) {
  const value = String(html || "").match(/\}\(a0i,\s*(0x[0-9a-f]+|\d+)\s*\)/i)?.[1];
  return value ? Number.parseInt(value, 0) : NaN;
}

function decodeHansPublisherChallengeString(value) {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/=";
  let bufferText = "";
  let escaped = "";
  const functionText = "function g(l){}";
  for (let q = 0, r = 0, s = 0, t = 0; (s = cleanText(value).charAt(t++));) {
    s = alphabet.indexOf(s);
    if (!(~s)) {
      continue;
    }
    r = q % 4 ? r * 64 + s : s;
    if (q++ % 4) {
      bufferText += functionText.charCodeAt(t + 0xa) - 0xa !== 0
        ? String.fromCharCode(0xff & (r >> ((-0x2 * q) & 0x6)))
        : q;
    }
  }
  for (let index = 0; index < bufferText.length; index += 1) {
    escaped += `%${(`00${bufferText.charCodeAt(index).toString(16)}`).slice(-2)}`;
  }
  try {
    return decodeURIComponent(escaped);
  } catch (_error) {
    return "";
  }
}

function scorePublisherFileCandidate(tag, url) {
  const text = `${tag || ""} ${url || ""}`.toLowerCase();
  let score = 1;
  if (text.includes("chinese") || text.includes("中文")) {
    score += 10;
  }
  if (text.includes("english")) {
    score += 5;
  }
  if (text.includes("russian")) {
    score += 1;
  }
  return score;
}

function isLikelyPdfDownloadUrl(value) {
  const text = cleanText(value);
  if (!text) {
    return false;
  }
  if (/downloadSuppFile/i.test(text)) {
    return false;
  }
  return /\.pdf(?:[?#]|$)/i.test(text) || /\/article\/download\/\d+\/\d+(?:[/?#]|$)/i.test(text);
}

function resolveUrl(value, baseUrl) {
  try {
    return new URL(value, baseUrl).href;
  } catch (_error) {
    return "";
  }
}

function decodeHtmlAttribute(value) {
  return cleanText(value)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
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

function buildResolverUrl(template, doi) {
  const normalizedDoi = normalizeDoi(doi);
  if (template.includes("{doi}")) {
    return template.replace(/\{doi\}/g, encodeURIComponent(normalizedDoi));
  }
  return `${trimTrailingSlash(template)}/${encodeURIComponent(normalizedDoi)}`;
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
  createPublisherPdfAdapter,
  createSciHubResolverAdapter,
  createSciPdfEmbeddedAdapter,
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
