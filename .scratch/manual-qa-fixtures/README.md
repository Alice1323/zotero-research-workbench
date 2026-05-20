# Manual QA Fixtures

This folder contains fake Workbench Local Store snapshots for Zotero Research Workbench manual QA.

Use these files only in an isolated Zotero test profile or an explicitly approved active profile. They are imported through the plugin's `导入工作台状态` action and are intended to exercise read-only review aids:

- `引用关系图谱` quality tags and filters.
- `作品身份线索` status tags and filters.
- `重复作品候选` matching reasons and evidence.
- JSON/ZIP secret redaction checks.

The fixtures do not contain real API keys, WebDAV passwords, bearer tokens, SMTP codes, user library records, attachments, PDFs, or Zotero-native metadata writes. They are not release artifacts.

## How To Use

1. Start Zotero 8/9 in a test profile with the v0.1 XPI installed.
2. Open `Zotero 研究工作台`.
3. Click `导入工作台状态`.
4. Select `zrw-manual-qa-workbench-snapshot.json`.
5. Refresh `引用关系图谱`, `作品身份线索`, and `重复作品候选`.

Expected visible hints:

- Citation relation quality tags: `缺少目标`, `缺少证据`, `低置信度`, `缺少来源种子`.
- Work identity status tags: `无 DOI`, `多来源`, `有引用关系`, `孤立线索`.
- Duplicate candidate reasons: shared DOI, shared Zotero item key, and similar title.
