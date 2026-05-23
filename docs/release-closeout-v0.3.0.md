# Zotero Research Workbench v0.3.0 Release Closeout

Date: 2026-05-23

## Release Artifact

- Version: `0.3.0`
- XPI: `dist/zotero-research-workbench-0.3.0.xpi`
- SHA256: `8FE7710024F732731761925A7CE377F36F2EE64CCE58D3A1A15FD81C768566A2`
- Add-on id: `zotero-research-workbench@local`
- Zotero compatibility: `8.0` to `9.*`

## What v0.3.0 Delivers

v0.3.0 closes the first AI Task Workspace slice. The Research Panel can create a user-reviewed AI Job Plan from the current Zotero selection, classify multi-paper requests, run visible AI Task Queue entries through the configured OpenAI-compatible provider, persist task state locally, and keep Zotero-native writes behind an explicit user confirmation.

Key user-facing behavior:

- Natural-language AI Task Workspace over the current Zotero selection.
- Task classification for multi-paper requests:
  - per-paper summaries when the request says `分别`, `逐篇`, `每篇`, or similar;
  - one commonality synthesis note when the request says `共同点`, `综合`, `比较`, `归纳`, or similar;
  - AI classification for ambiguous multi-paper requests.
- Plan preview before execution, including scope, recognized task type, provider/model, task count, and expected side effects.
- Visible queue states with Chinese labels such as `待确认`, `待执行`, `运行中`, and `已完成`.
- Provider concurrency limit, queue progress callbacks, pause/cancel support, retry/skip behavior, and provider failure diagnosis.
- Commonality synthesis output saved as a local Research Note Draft.
- Completed commonality drafts automatically load into the main `生成结果` reading area.
- The user can explicitly click `确认并写入 Zotero 笔记` to save a commonality draft as a Zotero standalone note.
- Restart/resume groundwork: interrupted running jobs are preserved for manual review rather than hidden background resume.

## Boundaries Preserved

v0.3.0 still does not:

- automatically write Zotero notes, tags, metadata, attachments, native relations, or item fields;
- treat natural-language intent as permission for provider calls or Zotero writes;
- automatically import documents;
- ship source-specific connectors for blocked or unauthorized literature sources;
- automatically resume jobs in the background after restart;
- run Zotero-native writes concurrently.

## Important Known Installation Note

The command runner repeatedly failed to overwrite the active Zotero profile XPI with `Access denied`, even after `zotero.exe` was stopped and the active XPI was backed up. Because the active profile can contain an older package with the same pre-release version number, install v0.3.0 through Zotero's Add-ons UI:

1. Open Zotero.
2. Open Add-ons / Plugins.
3. Choose install add-on from file.
4. Select `dist/zotero-research-workbench-0.3.0.xpi`.
5. Restart Zotero.

After installation, verify the package by checking the Add-ons version is `0.3.0`. If possible, also compare the installed XPI hash with the release hash above.

## Verification

Fresh verification before packaging:

- `npm run check`: passed.
- `npm test`: 226 passed, 0 failed.
- `node --test tests/package.test.js`: 3 passed, 0 failed.
- `npm run package`: built `dist/zotero-research-workbench-0.3.0.xpi`.
- XPI manifest extraction confirmed `version: 0.3.0`.
- XPI content checks confirmed:
  - `loadCreatedAiTaskDraft`
  - `loadDraftIntoSummaryReader`
  - `formatAiJobStateLabel`
  - `formatAiTaskStateLabel`
  - `待确认`
  - `待执行`

## Recommended Manual QA

Run this in Zotero after installing the v0.3.0 XPI:

1. Select two or more Zotero items.
2. Open `工具 -> 打开研究工作台`.
3. Enter `请找出这些文献的共同点，并写成一篇笔记`.
4. Click `生成任务计划`.
5. Confirm the preview recognizes `共同点综合` and shows one commonality note task.
6. Click `确认并开始`.
7. Confirm the queue moves through Chinese status labels and finishes successfully.
8. Confirm the generated text appears in the main `生成结果` reading area.
9. Confirm `最近草稿` contains the commonality note.
10. Click `确认并写入 Zotero 笔记`.
11. Confirm Zotero creates a standalone note, not a child note under one selected item.

## Next Version Candidates

Good follow-up work for a later version:

- Better cleanup controls for stale draft job plans.
- Per-paper AI Task Workspace results saved as readable drafts and optional batch note writes.
- Retry-failed-only controls.
- Selected collection / local Zotero library search scope.
- Generic lawful connector and document candidate review boundary.
- Zotero context-menu launch surface.
