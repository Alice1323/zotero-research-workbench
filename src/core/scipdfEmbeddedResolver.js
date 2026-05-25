(function () {
const SCI_PDF_PRESET_BASE_URLS = [
  "https://sci-hub.se/",
  "https://sci-hub.st/",
  "https://sci-hub.ru/",
  "https://sci-hub.box/",
  "https://sci-hub.red/",
  "https://sci-hub.ren/",
  "https://sci-hub.ee/"
];

const SCI_PDF_USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 11_3_1 like Mac OS X) AppleWebKit/603.1.30 (KHTML, like Gecko) Version/10.0 Mobile/14E304 Safari/602.1";

const DOI_REGEXPS = [
  /doi[\s.:]{0,2}(10\.\d{4}[\d:.\-_/a-z]+)(?:[\s\n"<]|$)/gi,
  /(10\.\d{4}[\d:./a-z]+)(?:[\s\n"<]|$)/gi,
  /(10\.\d{4}[:.\-/a-z]+[:.\-\d]+)(?:[\s\na-z"<]|$)/gi,
  /(?:http[s]?:\/\/)+?[/\w.-]*doi[/\w.-]\/(10\.\d{4,15}\/[-._;()/:a-z0-9]+)(?:[\s\n"<]|$)/gi,
  /^(10\.\d{4,15}\/[-._;()/:A-Z0-9]+)$/gi
];

const NOT_FOUND_REGEXPS = [
  /Please try to search again using DOI/im,
  /статья не найдена в базе/im
];

function createSciPdfCustomResolver(baseUrl, automatic = false) {
  const normalizedBaseUrl = normalizeSciPdfBaseUrl(baseUrl);
  if (!normalizedBaseUrl) {
    return null;
  }
  return {
    name: "Sci-Hub",
    method: "GET",
    url: normalizedBaseUrl.includes("{doi}")
      ? normalizedBaseUrl
      : `${trimTrailingSlash(normalizedBaseUrl)}/{doi}`,
    mode: "html",
    selector: "#pdf",
    attribute: "src",
    automatic: Boolean(automatic)
  };
}

function createSciPdfCustomResolvers(baseUrls = SCI_PDF_PRESET_BASE_URLS, { automatic = false } = {}) {
  const resolvers = [];
  for (const baseUrl of normalizeSciPdfBaseUrls(baseUrls)) {
    const resolver = createSciPdfCustomResolver(baseUrl, automatic);
    if (resolver && !resolvers.some((entry) => isSciPdfResolverEqual(entry, resolver))) {
      resolvers.push(resolver);
    }
  }
  return resolvers;
}

function normalizeSciPdfBaseUrls(baseUrls = SCI_PDF_PRESET_BASE_URLS) {
  const result = [];
  for (const value of Array.isArray(baseUrls) ? baseUrls : [baseUrls]) {
    const normalized = normalizeSciPdfBaseUrl(value);
    if (normalized && !result.includes(normalized)) {
      result.push(normalized);
    }
  }
  return result;
}

function normalizeSciPdfBaseUrl(value) {
  const text = cleanText(value);
  if (!text) {
    return "";
  }
  try {
    const url = new URL(text);
    if (!["http:", "https:"].includes(url.protocol)) {
      return "";
    }
    if (text.includes("{doi}")) {
      return text;
    }
    return `${trimTrailingSlash(url.href)}/`;
  } catch (_error) {
    return "";
  }
}

function buildSciPdfRequestUrl(resolver, doi) {
  const normalizedDoi = normalizeDoi(doi);
  const template = cleanText(resolver?.url);
  if (!template || !normalizedDoi) {
    return "";
  }
  if (template.includes("{doi}")) {
    return template.replace(/\{doi\}/g, encodeURIComponent(normalizedDoi));
  }
  return `${trimTrailingSlash(template)}/${encodeURIComponent(normalizedDoi)}`;
}

function extractSciPdfDoiValues(...sources) {
  const result = [];
  for (const source of sources) {
    collectDoiValues(source, result);
  }
  return result;
}

function collectDoiValues(source, result) {
  if (!source) {
    return;
  }
  if (typeof source === "string") {
    pushDoiMatches(source, result);
    return;
  }
  if (Array.isArray(source)) {
    for (const entry of source) {
      collectDoiValues(entry, result);
    }
    return;
  }
  if (typeof source !== "object") {
    return;
  }

  for (const field of ["DOI", "doi", "url", "stableUrl", "title", "extra", "abstract"]) {
    pushDoiMatches(source[field], result);
  }
  collectDoiValues(source.attachments, result);
  collectDoiValues(source.attachmentReferences, result);
  collectDoiValues(source.documentCandidates, result);
}

function pushDoiMatches(value, result) {
  const text = cleanText(value);
  if (!text) {
    return;
  }
  for (const regexp of DOI_REGEXPS) {
    regexp.lastIndex = 0;
    let match;
    while ((match = regexp.exec(text)) !== null) {
      const doi = normalizeDoi(match[1]);
      if (shouldAppendDoi(result, doi)) {
        result.push(doi);
      }
    }
  }
}

function shouldAppendDoi(result, doi) {
  if (!doi || result.includes(doi)) {
    return false;
  }
  if (result.some((entry) => entry.startsWith(doi))) {
    return false;
  }
  for (let index = result.length - 1; index >= 0; index--) {
    if (doi.startsWith(result[index])) {
      result.splice(index, 1);
    }
  }
  return true;
}

function extractSciPdfPdfUrlFromHtml({ html, requestUrl } = {}) {
  const rawPdfUrl = extractPdfElementAttribute(html, "src");
  if (!rawPdfUrl || !cleanText(requestUrl)) {
    return "";
  }
  try {
    const pdfUrl = new URL(
      /^[a-z][a-z0-9+.-]*:|^\/\//i.test(rawPdfUrl) || rawPdfUrl.startsWith("/")
        ? rawPdfUrl
        : `/${rawPdfUrl}`,
      requestUrl
    );
    if (pdfUrl.protocol === "http:") {
      pdfUrl.protocol = "https:";
    }
    if (!["https:", "http:"].includes(pdfUrl.protocol)) {
      return "";
    }
    return pdfUrl.href;
  } catch (_error) {
    return "";
  }
}

function extractPdfElementAttribute(html, attributeName) {
  const text = String(html || "");
  const tags = text.match(/<[^>]*\bid\s*=\s*["']pdf["'][^>]*>|<[^>]*\bid\s*=\s*pdf\b[^>]*>|<[^>]*\bsrc\s*=\s*["'][^"']+["'][^>]*\bid\s*=\s*["']pdf["'][^>]*>/gi) || [];
  for (const tag of tags) {
    const attr = tag.match(new RegExp(`\\b${attributeName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
    const value = cleanText(attr?.[1] || attr?.[2] || attr?.[3]);
    if (value) {
      return decodeHtmlAttribute(value);
    }
  }
  return "";
}

function isSciPdfNotFoundHtml(html) {
  if (extractPdfElementAttribute(html, "src")) {
    return false;
  }
  const body = extractBodyHtml(html);
  const bodyText = stripTags(body);
  if (!bodyText.trim()) {
    return true;
  }
  return NOT_FOUND_REGEXPS.some((regexp) => regexp.test(body));
}

async function resolveSciPdfDoi({ doi, baseUrls = SCI_PDF_PRESET_BASE_URLS, fetchImpl } = {}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("Sci-PDF resolver fetch runtime unavailable");
  }
  const normalizedDoi = normalizeDoi(doi);
  const failures = [];
  if (!normalizedDoi) {
    return createSciPdfResolutionResult({ doi: "", failures: [createFailure("missing-doi")] });
  }

  const resolvers = createSciPdfCustomResolvers(baseUrls, { automatic: false });
  if (!resolvers.length) {
    return createSciPdfResolutionResult({ doi: normalizedDoi, failures: [createFailure("missing-resolver")] });
  }

  for (const resolver of resolvers) {
    const requestUrl = buildSciPdfRequestUrl(resolver, normalizedDoi);
    try {
      const response = await fetchImpl(requestUrl, {
        method: resolver.method,
        headers: { "User-Agent": SCI_PDF_USER_AGENT }
      });
      if (response?.ok === false) {
        failures.push(createFailure("http-error", { requestUrl, status: response?.status, resolver }));
        continue;
      }
      const html = typeof response?.text === "function" ? await response.text() : "";
      if (isSciPdfNotFoundHtml(html)) {
        failures.push(createFailure("pdf-not-found", { requestUrl, status: response?.status, resolver }));
        continue;
      }
      const pdfUrl = extractSciPdfPdfUrlFromHtml({ html, requestUrl });
      if (!pdfUrl) {
        failures.push(createFailure("pdf-selector-missing", { requestUrl, status: response?.status, resolver }));
        continue;
      }
      return createSciPdfResolutionResult({
        doi: normalizedDoi,
        pdfUrl,
        requestUrl,
        resolver,
        failures
      });
    } catch (error) {
      failures.push(createFailure("fetch-error", { requestUrl, resolver, error }));
    }
  }

  return createSciPdfResolutionResult({ doi: normalizedDoi, failures });
}

function parseSciPdfResolverPref(value) {
  try {
    const parsed = JSON.parse(cleanText(value) || "[]");
    return Array.isArray(parsed) ? parsed.map((entry) => clonePlain(entry)) : [];
  } catch (_error) {
    return [];
  }
}

function serializeSciPdfResolverPref(resolvers) {
  return JSON.stringify(Array.isArray(resolvers) ? resolvers : []);
}

function mergeSciPdfResolvers(existing, incoming) {
  const merged = [];
  for (const resolver of Array.isArray(existing) ? existing : []) {
    if (!resolver || typeof resolver !== "object") {
      continue;
    }
    if (!merged.some((entry) => isSciPdfResolverEqual(entry, resolver))) {
      merged.push(clonePlain(resolver));
    }
  }
  for (const resolver of Array.isArray(incoming) ? incoming : []) {
    if (!resolver || typeof resolver !== "object") {
      continue;
    }
    if (!merged.some((entry) => isSciPdfResolverEqual(entry, resolver))) {
      merged.push(clonePlain(resolver));
    }
  }
  return merged;
}

function createSciPdfResolutionResult({ doi, pdfUrl = "", requestUrl = "", resolver = null, failures = [] } = {}) {
  return {
    doi: normalizeDoi(doi),
    pdfUrl: cleanText(pdfUrl),
    requestUrl: cleanText(requestUrl),
    resolver: resolver ? clonePlain(resolver) : null,
    failures: failures.map((failure) => clonePlain(failure))
  };
}

function createFailure(reason, details = {}) {
  return {
    reason: cleanText(reason),
    requestUrl: cleanText(details.requestUrl),
    status: details.status || "",
    resolver: details.resolver ? clonePlain(details.resolver) : null,
    message: cleanText(details.error?.message) || cleanText(reason)
  };
}

function isSciPdfResolverEqual(a, b) {
  return cleanText(a?.name) === cleanText(b?.name) &&
    cleanText(a?.method) === cleanText(b?.method) &&
    cleanText(a?.url) === cleanText(b?.url) &&
    cleanText(a?.mode) === cleanText(b?.mode) &&
    cleanText(a?.selector) === cleanText(b?.selector) &&
    cleanText(a?.attribute) === cleanText(b?.attribute) &&
    Boolean(a?.automatic) === Boolean(b?.automatic);
}

function extractBodyHtml(html) {
  const text = String(html || "");
  const match = text.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  return match ? match[1] : text;
}

function stripTags(value) {
  return String(value || "").replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ");
}

function decodeHtmlAttribute(value) {
  return cleanText(value)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function normalizeDoi(value) {
  return cleanText(value)
    .replace(/^doi:\s*/i, "")
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .toLowerCase();
}

function trimTrailingSlash(value) {
  return cleanText(value).replace(/\/+$/, "");
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

const WorkbenchSciPdfEmbeddedResolver = {
  SCI_PDF_PRESET_BASE_URLS,
  SCI_PDF_USER_AGENT,
  buildSciPdfRequestUrl,
  createSciPdfCustomResolver,
  createSciPdfCustomResolvers,
  extractSciPdfDoiValues,
  extractSciPdfPdfUrlFromHtml,
  isSciPdfNotFoundHtml,
  mergeSciPdfResolvers,
  normalizeSciPdfBaseUrls,
  normalizeSciPdfBaseUrl,
  parseSciPdfResolverPref,
  resolveSciPdfDoi,
  serializeSciPdfResolverPref
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = WorkbenchSciPdfEmbeddedResolver;
}

if (typeof window !== "undefined") {
  window.WorkbenchSciPdfEmbeddedResolver = WorkbenchSciPdfEmbeddedResolver;
}
})();
