# Contributing

Zotero Research Workbench is a Zotero 8/9 plugin for Chinese research workflows, literature discovery, LLM-assisted note drafting, and explicit Zotero write queues.

## Development Setup

Use Node.js 20 or newer.

```powershell
npm run check
npm test
npm run package
```

The package command creates a sideload beta XPI under `dist/`.

## Pull Requests

Before opening a pull request:

- Keep Zotero item, note, and attachment writes behind explicit user actions.
- Preserve secret redaction for API keys, bearer tokens, WebDAV passwords, cookies, and exported snapshots.
- Add or update tests for behavior changes.
- Run `npm run check` and `npm test`.
- Do not commit local Zotero profiles, generated logs, credentials, or ignored XPI artifacts.

## Project Boundaries

The plugin may read the active Zotero selection, local Workbench snapshot preferences, and explicit user input. It must not silently write Zotero notes, tags, item fields, relations, attachments, or global resolver settings.

PDF acquisition sources must show provenance before any import. Users are responsible for using sources they are authorized to access.

## License

This project is distributed under `AGPL-3.0-or-later`. The vendored Sci-PDF snapshot keeps its upstream AGPL license and notice materials under `vendor/zotero-scipdf/`.
