# ZIP Export Import Design

## Scope

This slice adds local ZIP export/import for the Workbench Local Store snapshot.

The ZIP package is a convenience wrapper around the existing redacted JSON export package. It does not include PDFs, attachments, logs, credentials, cache files, or generated binary assets.

## Package Format

ZIP contents:

```text
manifest.json
snapshot.json
```

`manifest.json` contains:

- `packageKind`: `zotero-research-workbench-zip-export`;
- `packageVersion`: `1`;
- `exportedAt`;
- `snapshotPath`: `snapshot.json`.

`snapshot.json` contains the existing `zotero-research-workbench-export` JSON package produced by `createWorkbenchExportPackage()`.

## Architecture

Core helpers build and parse an abstract ZIP payload so secret redaction can be tested without relying on Zotero APIs:

- `createWorkbenchZipExportPayload({ snapshot, exportedAt })`;
- `importWorkbenchZipExportPayload(payload)`.

The browser/runtime layer turns that payload into a real `.zip` file using Mozilla/Zotero chrome APIs when available. The existing JSON export/import path stays unchanged.

The runtime import path accepts both JSON and ZIP via separate buttons. ZIP import validates `manifest.json`, finds `snapshot.json`, then delegates to the existing JSON package validator.

## UI

The Research Panel keeps the current JSON buttons and adds:

- `导出 ZIP`;
- `导入 ZIP`.

Status messages are Chinese and explicit:

- `已导出 ZIP 工作台状态`;
- `已导入 ZIP 工作台状态`;
- `ZIP 导出包缺少 snapshot.json`;
- `不支持的 ZIP 工作台导出包`.

## Security

ZIP export must never bypass existing redaction. `snapshot.json` is generated from the existing redacted export package. Secret fields such as `apiKey`, `password`, `token`, `authorization`, and `secret` remain `<redacted>`.

ZIP export is not encrypted. That remains a future feature.

## Testing

Core tests verify:

- ZIP payload contains `manifest.json` and `snapshot.json`;
- `snapshot.json` contains the existing redacted JSON export package;
- ZIP payload import restores the snapshot arrays;
- invalid manifest/package content fails clearly.

UI tests verify:

- Chinese ZIP export/import buttons and ids exist;
- runtime contains ZIP export/import functions and event bindings;
- package includes the runtime strings.

## Deferred

- encrypted export;
- WebDAV export target;
- PDF or attachment inclusion;
- automatic background export;
- ZIP streaming for large stores.
