# WebDAV Export Target Design

## Goal

Add an optional manual WebDAV export target for the Workbench Local Store.

The feature uploads the same redacted JSON export package used by `导出工作台状态`. It is not sync, import, conflict resolution, ZIP upload, encrypted backup, or attachment/PDF backup.

## Scope

The Research Panel adds a `WebDAV 导出目标` section under the global entry area with:

- server URL;
- username;
- password;
- remote directory;
- save settings action;
- connection test action;
- manual JSON upload action.

Nutstore is supported as a compatible WebDAV server by using its standard WebDAV URL, username, and application password. The UI provides a Nutstore example, but the implementation stays generic WebDAV.

## Storage And Secrets

Settings are stored in Zotero preferences:

- `extensions.zotero-research-workbench.webdav.serverUrl`;
- `extensions.zotero-research-workbench.webdav.username`;
- `extensions.zotero-research-workbench.webdav.password`;
- `extensions.zotero-research-workbench.webdav.remoteDirectory`.

The password field is blank when the panel opens. Saving with an empty password preserves the stored password. Exports, task records, UI status messages, README examples, and checkpoint records must not echo the password or authorization header.

## Export Behavior

`上传 JSON 到 WebDAV` builds:

- filename: `zotero-research-workbench-<stable timestamp>.json`;
- body: `JSON.stringify(createWorkbenchExportPackage({ snapshot, exportedAt }), null, 2)`;
- method: `PUT`;
- target URL: server URL + optional remote directory + filename.

The JSON body is the existing redacted package, so API keys, WebDAV passwords, bearer tokens, authorization headers, and `secret` fields remain `<redacted>`.

## Connection Test

`测试 WebDAV` sends a lightweight `PROPFIND` with `Depth: 0` to the configured remote directory URL. HTTP 200, 204, or 207 are treated as success. 401 and 403 map to `WebDAV 认证失败`. Other non-2xx responses map to `WebDAV 连接失败：HTTP <status>`. Network errors map to `WebDAV 连接失败`.

The feature does not create remote directories. Users must choose an existing directory or leave the directory blank to upload to the server root/path they configured.

## Error Handling

Validation errors are user-facing Chinese messages:

- `请填写 WebDAV 服务器地址`;
- `WebDAV 服务器地址必须是 http(s) URL`;
- `请填写 WebDAV 用户名`;
- `请填写 WebDAV 密码`;
- `请先保存 WebDAV 设置`;
- `WebDAV 上传失败：HTTP <status>`.

Technical details are not shown if they might include secrets.

## Tests

Core tests cover:

- target normalization and URL building;
- invalid server URL rejection;
- JSON upload request body using the existing redacted export package;
- authorization header creation without plaintext password in the JSON body.

UI/runtime tests cover:

- WebDAV labels and field IDs;
- password input type;
- runtime functions and event bindings for save, test, and upload actions.

## Non-Goals

- no automatic export schedule;
- no WebDAV import;
- no live sync;
- no conflict handling;
- no remote directory creation;
- no ZIP upload;
- no encrypted export.
