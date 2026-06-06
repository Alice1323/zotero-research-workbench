# Security Policy

## Vulnerability Reporting

Please report security issues privately by opening a GitHub security advisory for this repository or by contacting the maintainer through the email address on the GitHub profile. Do not file public issues for vulnerabilities until a fix or mitigation is available.

Do not include full API keys, bearer tokens, SMTP authorization codes, WebDAV passwords, Zotero profile data, cookies, or exported private snapshots in public reports. Redact secrets before sharing logs or reproduction steps.

## Scope

Security-sensitive areas include:

- OpenAI-compatible provider settings and connection tests.
- API key redaction in UI, exports, diagnostics, and tests.
- WebDAV export targets and authentication handling.
- JSON/ZIP import and export validation.
- Zotero note, item, and attachment write queues.
- PDF acquisition source provenance and user confirmation gates.

## Supported Versions

The current supported development line is `0.4.0-beta.3` on `master`. Older `v0.1.0` and `v0.2.0` release artifacts are kept for audit and rollback history only.

## Expected Handling

Reports that can expose user credentials, private Zotero library metadata, or unintended Zotero writes are treated as high priority. Fixes should include regression tests when practical and should preserve the explicit user confirmation boundary before Zotero writes.
