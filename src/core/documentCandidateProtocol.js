const CANDIDATE_ANOMALY_TAGS = {
  missingTitle: "缺少标题",
  missingIdentity: "缺少身份线索",
  emptyAuthors: "作者为空",
  suspiciousYear: "年份异常",
  weakProvenance: "来源证明不足",
  unclearAttachment: "附件来源不清",
  unsupportedAttachment: "附件类型不支持"
};

const KNOWN_CANDIDATE_FIELDS = new Set([
  "abstract",
  "anomalyTags",
  "arxivId",
  "attachmentReferences",
  "attachments",
  "authors",
  "containerTitle",
  "description",
  "doi",
  "id",
  "identityKeys",
  "isbn",
  "oaStatus",
  "observedAt",
  "openAccessStatus",
  "pmid",
  "publicationTitle",
  "provenance",
  "rawSourcePayload",
  "score",
  "sourceAdapterId",
  "sourceAdapterIds",
  "sourceConfidence",
  "sourceProvenance",
  "sourceRecordId",
  "stableUrl",
  "title",
  "url",
  "year"
]);

function normalizeDocumentCandidate(input = {}) {
  const sourceAdapterId = cleanText(input.sourceAdapterId) || "unknown-source";
  const sourceRecordId = cleanText(input.sourceRecordId || input.url || input.doi || input.title) || "unknown-record";
  const title = cleanText(input.title);
  const attachments = normalizeAttachmentReferences(input.attachments || input.attachmentReferences);
  const identityKeys = deriveCandidateIdentityKeys(input);
  const provenance = normalizeProvenance(input.provenance, sourceAdapterId);
  const anomalyTags = deriveAnomalyTags({ ...input, title, attachments, identityKeys, provenance });

  return {
    ...clonePlain(input),
    id: cleanText(input.id) || `candidate-${slug(sourceAdapterId)}-${slug(sourceRecordId)}`,
    sourceAdapterId,
    sourceAdapterIds: uniqueClean([sourceAdapterId].concat(input.sourceAdapterIds || [])),
    sourceRecordId,
    title: title || "未命名候选文献",
    authors: normalizeAuthors(input.authors),
    year: cleanYear(input.year),
    publicationTitle: cleanText(input.publicationTitle || input.containerTitle),
    doi: normalizeDoi(input.doi),
    isbn: cleanText(input.isbn),
    pmid: cleanText(input.pmid),
    arxivId: normalizeArxivId(input.arxivId),
    stableUrl: normalizeStableUrl(input.stableUrl || input.url),
    abstract: cleanText(input.abstract || input.description),
    openAccessStatus: cleanText(input.openAccessStatus || input.oaStatus),
    attachments,
    identityKeys,
    sourceConfidence: normalizeScore(input.sourceConfidence ?? input.score),
    anomalyTags: uniqueClean([].concat(Array.isArray(input.anomalyTags) ? input.anomalyTags : [], anomalyTags)),
    provenance,
    rawSourcePayload: clonePlain(input.rawSourcePayload || {}),
    observedAt: cleanText(input.observedAt) || new Date().toISOString()
  };
}

function normalizeAttachmentReferences(attachments) {
  return (Array.isArray(attachments) ? attachments : []).map((attachment) => normalizeAttachmentReference(attachment));
}

function normalizeAttachmentReference(input = {}) {
  const kind = cleanText(input.kind) || "unknown";
  const path = cleanText(input.path || input.filePath);
  const url = normalizeStableUrl(input.url);
  const contentType = cleanText(input.contentType || input.mimeType).toLowerCase();
  const provenance = normalizeAttachmentProvenance(input.provenance);
  const referenceId = cleanText(input.referenceId || input.fileReferenceId || input.id);

  let importable = false;
  let importBlockReason = "";

  if (kind === "local-file") {
    importable = Boolean(path && /\.pdf$/i.test(path));
    if (!importable) importBlockReason = CANDIDATE_ANOMALY_TAGS.unclearAttachment;
  } else if (kind === "open-access-pdf-url") {
    importable = isHttpUrl(url) && (isPdfUrl(url) || contentType === "application/pdf");
    if (!importable) importBlockReason = CANDIDATE_ANOMALY_TAGS.unclearAttachment;
  } else if (kind === "connector-file-reference") {
    importable = Boolean(cleanText(provenance.source) || cleanText(provenance.connectorId));
    if (!importable) importBlockReason = CANDIDATE_ANOMALY_TAGS.unclearAttachment;
  } else if (kind === "landing-page-url") {
    importable = false;
    importBlockReason = CANDIDATE_ANOMALY_TAGS.unclearAttachment;
  } else {
    importable = false;
    importBlockReason = CANDIDATE_ANOMALY_TAGS.unsupportedAttachment;
  }

  return {
    ...clonePlain(input),
    kind,
    path,
    url,
    referenceId,
    license: cleanText(input.license),
    contentType,
    provenance,
    importable,
    importBlockReason
  };
}

function deriveCandidateIdentityKeys(input = {}) {
  const durableKeys = uniqueClean([
    normalizeDoi(input.doi) ? `doi:${normalizeDoi(input.doi)}` : "",
    cleanText(input.isbn) ? `isbn:${cleanText(input.isbn)}` : "",
    cleanText(input.pmid) ? `pmid:${cleanText(input.pmid)}` : "",
    normalizeArxivId(input.arxivId) ? `arxiv:${normalizeArxivId(input.arxivId)}` : "",
    normalizeStableUrl(input.stableUrl || input.url) ? `url:${normalizeStableUrl(input.stableUrl || input.url)}` : ""
  ]);
  if (durableKeys.length) {
    return durableKeys;
  }
  return uniqueClean([normalizeTitleKey(input.title) ? `title:${normalizeTitleKey(input.title)}` : ""]);
}

function mergeDocumentCandidates(candidates) {
  const groups = new Map();
  const orderedKeys = [];

  for (const [index, entry] of (Array.isArray(candidates) ? candidates : []).entries()) {
    const candidate = normalizeDocumentCandidate(entry);
    const key = createCandidateMergeKey(candidate, index);
    if (!groups.has(key)) {
      groups.set(key, candidate);
      orderedKeys.push(key);
    } else {
      groups.set(key, mergeTwoDocumentCandidates(groups.get(key), candidate));
    }
  }

  return orderedKeys.map((key) => groups.get(key));
}

function createCandidateMergeKey(candidate, index) {
  const durableKey = candidate.identityKeys.find((key) => !key.startsWith("title:"));
  if (durableKey) {
    return `identity:${durableKey}`;
  }
  const titleKey = candidate.identityKeys.find((key) => key.startsWith("title:"));
  if (titleKey && cleanText(candidate.year)) {
    return `title-year:${titleKey}|${cleanText(candidate.year)}`;
  }
  return `record:${candidate.id || index}`;
}

function mergeTwoDocumentCandidates(left, right) {
  const sourceAdapterIds = uniqueClean([].concat(left.sourceAdapterIds || [], right.sourceAdapterIds || []));
  const sourceProvenance = [].concat(left.sourceProvenance || createSourceProvenanceEntry(left));
  sourceProvenance.push(createSourceProvenanceEntry(right));

  return {
    ...left,
    ...preserveRightExtensionFields(left, right),
    sourceAdapterIds,
    sourceProvenance,
    title: pickLongerText(left.title, right.title),
    authors: pickLongerArray(left.authors, right.authors),
    year: cleanText(left.year) || cleanText(right.year),
    publicationTitle: pickLongerText(left.publicationTitle, right.publicationTitle),
    doi: cleanText(left.doi) || cleanText(right.doi),
    isbn: cleanText(left.isbn) || cleanText(right.isbn),
    pmid: cleanText(left.pmid) || cleanText(right.pmid),
    arxivId: cleanText(left.arxivId) || cleanText(right.arxivId),
    stableUrl: cleanText(left.stableUrl) || cleanText(right.stableUrl),
    abstract: pickLongerText(left.abstract, right.abstract),
    openAccessStatus: cleanText(left.openAccessStatus) || cleanText(right.openAccessStatus),
    attachments: mergeAttachments(left.attachments, right.attachments),
    identityKeys: uniqueClean([].concat(left.identityKeys || [], right.identityKeys || [])),
    sourceConfidence: Math.max(Number(left.sourceConfidence) || 0, Number(right.sourceConfidence) || 0),
    anomalyTags: uniqueClean([].concat(left.anomalyTags || [], right.anomalyTags || [])),
    rawSourcePayload: {
      ...clonePlain(left.rawSourcePayload || {}),
      ...clonePlain(right.rawSourcePayload || {})
    },
    observedAt: maxText(left.observedAt, right.observedAt)
  };
}

function preserveRightExtensionFields(left, right) {
  const result = {};
  for (const [key, value] of Object.entries(clonePlain(right || {}))) {
    if (KNOWN_CANDIDATE_FIELDS.has(key) || Object.prototype.hasOwnProperty.call(left, key)) {
      continue;
    }
    result[key] = value;
  }
  return result;
}

function createSourceProvenanceEntry(candidate) {
  return {
    sourceAdapterId: cleanText(candidate.sourceAdapterId),
    sourceRecordId: cleanText(candidate.sourceRecordId),
    provenance: clonePlain(candidate.provenance || {})
  };
}

function mergeAttachments(left, right) {
  const result = [];
  for (const attachment of [].concat(left || [], right || [])) {
    const normalized = normalizeAttachmentReference(attachment);
    const key = [normalized.kind, normalized.path, normalized.url, normalized.referenceId].join("|");
    if (!result.some((entry) => [entry.kind, entry.path, entry.url, entry.referenceId].join("|") === key)) {
      result.push(normalized);
    }
  }
  return result;
}

function deriveAnomalyTags(candidate) {
  const tags = [];
  if (!cleanText(candidate.title)) {
    tags.push(CANDIDATE_ANOMALY_TAGS.missingTitle);
  }
  if (!hasDurableIdentity(candidate.identityKeys)) {
    tags.push(CANDIDATE_ANOMALY_TAGS.missingIdentity);
  }
  if (normalizeAuthors(candidate.authors).length === 0) {
    tags.push(CANDIDATE_ANOMALY_TAGS.emptyAuthors);
  }
  if (isSuspiciousYear(candidate.year)) {
    tags.push(CANDIDATE_ANOMALY_TAGS.suspiciousYear);
  }
  if (hasWeakProvenance(candidate.provenance)) {
    tags.push(CANDIDATE_ANOMALY_TAGS.weakProvenance);
  }
  for (const attachment of candidate.attachments || []) {
    if (attachment.importBlockReason) {
      tags.push(attachment.importBlockReason);
    }
  }
  return uniqueClean(tags);
}

function hasDurableIdentity(identityKeys) {
  return (Array.isArray(identityKeys) ? identityKeys : []).some((key) => !cleanText(key).startsWith("title:"));
}

function hasWeakProvenance(provenance) {
  if (!provenance || typeof provenance !== "object") {
    return true;
  }
  return !(
    cleanText(provenance.source) ||
    cleanText(provenance.connectorId) ||
    cleanText(provenance.requestId) ||
    cleanText(provenance.sourceUrl)
  );
}

function normalizeProvenance(input, sourceAdapterId) {
  return {
    ...clonePlain(input || {}),
    sourceAdapterId: cleanText(sourceAdapterId) || "unknown-source"
  };
}

function normalizeAttachmentProvenance(input) {
  return clonePlain(input || {});
}

function normalizeAuthors(authors) {
  return (Array.isArray(authors) ? authors : [])
    .map((author) => {
      if (typeof author === "string") {
        return { name: cleanText(author) };
      }
      return {
        ...clonePlain(author || {}),
        name: cleanText(author?.name || [author?.given, author?.family].filter(Boolean).join(" "))
      };
    })
    .filter((author) => cleanText(author.name));
}

function cleanYear(value) {
  const text = cleanText(value);
  if (!text) {
    return "";
  }
  const match = text.match(/\b\d{4}\b/);
  return match ? match[0] : text;
}

function isSuspiciousYear(value) {
  const year = Number(cleanYear(value));
  if (!Number.isFinite(year)) {
    return Boolean(cleanText(value));
  }
  const currentYear = new Date().getUTCFullYear();
  return year < 1500 || year > currentYear + 1;
}

function normalizeDoi(value) {
  return cleanText(value)
    .replace(/^doi:\s*/i, "")
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .toLowerCase();
}

function normalizeArxivId(value) {
  return cleanText(value).replace(/^arxiv:\s*/i, "");
}

function normalizeStableUrl(value) {
  const text = cleanText(value);
  if (!text) {
    return "";
  }
  try {
    const url = new URL(text);
    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase();
    const normalized = url.toString();
    return normalized.endsWith("/") && url.pathname !== "/" ? normalized.slice(0, -1) : normalized;
  } catch (_error) {
    return text;
  }
}

function normalizeTitleKey(value) {
  return cleanText(value).toLowerCase().replace(/\s+/g, " ");
}

function normalizeScore(value) {
  if (value === undefined || value === null || value === "") {
    return 0;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.max(0, Math.min(1, numeric));
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_error) {
    return false;
  }
}

function isPdfUrl(value) {
  try {
    return new URL(value).pathname.toLowerCase().endsWith(".pdf");
  } catch (_error) {
    return false;
  }
}

function slug(value) {
  return cleanText(value).toLowerCase().replace(/[^0-9a-z]+/g, "-").replace(/^-+|-+$/g, "") || "unknown";
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

function pickLongerText(left, right) {
  const leftText = cleanText(left);
  const rightText = cleanText(right);
  return rightText.length > leftText.length ? rightText : leftText;
}

function pickLongerArray(left, right) {
  const leftItems = Array.isArray(left) ? left : [];
  const rightItems = Array.isArray(right) ? right : [];
  return rightItems.length > leftItems.length ? clonePlain(rightItems) : clonePlain(leftItems);
}

function maxText(left, right) {
  return cleanText(right).localeCompare(cleanText(left)) > 0 ? cleanText(right) : cleanText(left);
}

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

const WorkbenchDocumentCandidateProtocol = {
  CANDIDATE_ANOMALY_TAGS,
  cleanText,
  cleanYear,
  clonePlain,
  deriveAnomalyTags,
  deriveCandidateIdentityKeys,
  mergeDocumentCandidates,
  normalizeAttachmentReference,
  normalizeAttachmentReferences,
  normalizeAuthors,
  normalizeDocumentCandidate,
  normalizeDoi,
  normalizeProvenance,
  normalizeScore,
  normalizeStableUrl,
  normalizeTitleKey,
  slug,
  uniqueClean
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = WorkbenchDocumentCandidateProtocol;
}

if (typeof window !== "undefined") {
  window.WorkbenchDocumentCandidateProtocol = WorkbenchDocumentCandidateProtocol;
}
