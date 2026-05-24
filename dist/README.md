# Zotero Research Workbench Artifact Inventory

This folder is organized like a small enterprise artifact repository. It separates release channels, environment snapshots, and historical archives so installable packages are not mixed with rollback or diagnostic files.

Binary and export payloads are intentionally ignored by Git. This README is the tracked inventory and operating guide.

## Current Source State

| Field | Value |
| --- | --- |
| Repository remote | `git@github.com:Alice1323/zotero-research-workbench.git` |
| Source package | `zotero-research-workbench` |
| Source `package.json` version | `0.4.0-beta.1` |
| Source `manifest.json` name | `Zotero 研究工作台` |
| Source `manifest.json` version | `0.4.0beta1` |
| Add-on id | `zotero-research-workbench@local` |
| Zotero compatibility | `8.0` to `9.*` |
| Build command | `npm run package` |
| Build staging directory | `dist/package/` |
| Fresh build output | `dist/zotero-research-workbench-0.4.0beta1.xpi` |

## Enterprise Classification

| Class | Directory | Use |
| --- | --- | --- |
| Stable releases | `releases/stable/<version>/` | Candidate packages for normal installation or rollback to a known release. |
| Prerelease builds | `releases/prerelease/<version>/` | Beta/RC/preview packages. Use only when testing or intentionally installing a preview. |
| Installed snapshots | `snapshots/installed/<version>/` | Copies taken from a real Zotero profile. These prove what was installed in an environment. |
| Test profile snapshots | `snapshots/test-profiles/<profile>/<version>/` | Copies found in temporary or smoke-test Zotero profiles. These are not release packages. |
| Rollback archive | `archive/rollback/<reason>/` | Broken-state or pre-rollback backups. Keep for forensics, not normal installation. |
| Export archive | `archive/exports/<date>/` | JSON/ZIP export diagnostics and old workbench snapshots. |
| Build staging | `package/` | Temporary package assembly directory recreated by `scripts/build-xpi.ps1`; safe to delete. |

## Naming Rules

The GitHub remote, local `origin/master`, `scripts/build-xpi.ps1`, `README.md`, and `tests/package.test.js` all use the release artifact pattern:

```text
zotero-research-workbench-<manifest.version>.xpi
```

Rules used here:

- Use the internal `manifest.json` version as the source of truth.
- Stable/prerelease release artifacts use `zotero-research-workbench-<manifest.version>.xpi`.
- If multiple packages share the same manifest version, the preferred/current package keeps the plain name and older duplicates get `-build-<yyyyMMddTHHmmss>`.
- Environment snapshots append their source, for example `-installed-profile-<timestamp>` or `-smoke-profile-<timestamp>`.
- Rollback archives keep their incident suffix so the reason is visible.
- Exports keep their original stable timestamp names.

## Stable Releases

These are the normal install/rollback candidates.

| Version | Path | Original filename | Size | Last write time | Entries | SHA256 | Notes |
| --- | --- | --- | ---: | --- | ---: | --- | --- |
| `0.4.0` | `zotero-research-workbench-0.4.0.xpi` | `zotero-research-workbench-0.4.0.xpi` | `106501` | `2026-05-24 00:44:02` | `35` | `994C85328BB4ACDB7BEE7B571902807C11BA93BAE7F07EC2E73A05A28DC8D7F0` | Superseded by `0.4.0beta1` for toolbar placement testing. |
| `0.3.0` | `zotero-research-workbench-0.3.0.xpi` | `zotero-research-workbench-0.3.0.xpi` | `106500` | `2026-05-24 00:22:49` | `35` | `CE4CF14294B125CDE9C9FEE6395BE194754D12DA75E7043E019B127B313B1CBB` | Preserved v0.3 rollback package after the v0.4 bump. |
| `0.1.0` | `releases/stable/0.1.0/zotero-research-workbench-0.1.0.xpi` | `zotero-research-workbench-0.1.0.xpi` | `47702` | `2026-05-21 04:36:32` | `19` | `4B5254BDA5C96B9C7716B28D2CB9E718EDDD1E48F59B099E632FF1094A678E9A` | Early stable build. |
| `0.2.0` | `releases/stable/0.2.0/zotero-research-workbench-0.2.0.xpi` | `zotero-research-workbench-V0.21.xpi` | `59712` | `2026-05-21 22:20:19` | `24` | `AC0020630979D1E5F88C6B95D053E7AE88DEC34FA06C7FE88CC19DCE032F5F34` | Renamed to the GitHub build-script pattern. Original filename said `V0.21`, but package manifest says `0.2.0`. |

## Prerelease Builds

These are preview/beta packages. Prefer the plain filename unless intentionally testing an older duplicate build.

| Version | Path | Original filename | Size | Last write time | Entries | SHA256 | Notes |
| --- | --- | --- | ---: | --- | ---: | --- | --- |
| `0.4.0beta1` | `zotero-research-workbench-0.4.0beta1.xpi` | `zotero-research-workbench-0.4.0beta1.xpi` | `107249` | `2026-05-24 05:26:09` | `35` | `6AC0FC066BF6C36F966AE170A562BFA469D8742E2E6397C2FC1CB33B3B673FE0` | Current v0.4 beta package with toolbar placement and icon-button fix. |
| `0.21.0-beta.1` | `releases/prerelease/0.21.0-beta.1/zotero-research-workbench-0.21.0-beta.1.xpi` | `zotero-research-workbench-0.21.0-beta.1.xpi` | `69959` | `2026-05-22 03:51:32` | `27` | `E575354236EABA58F4FB40F095D2943BEC9BF03E37DDAAC3CFA8E59F6DAC3110` | Preferred prerelease build for this version. |
| `0.21.0-beta.1` | `releases/prerelease/0.21.0-beta.1/zotero-research-workbench-0.21.0-beta.1-build-20260522T000234.xpi` | `zotero-research-workbench-0.2.0.xpi` | `59718` | `2026-05-22 00:02:34` | `24` | `293E663D0FCE8692F0DF1D6C1DC25611271BA263A8AFAF4FACFE7F75A24EF4EB` | Older duplicate build. Original filename said `0.2.0`, but package manifest says `0.21.0-beta.1`. |

## Installed Environment Snapshots

These are evidence of what was installed in a real Zotero profile, not canonical release artifacts.

| Version | Path | Source profile/package | Size | Last write time | Entries | SHA256 | Notes |
| --- | --- | --- | ---: | --- | ---: | --- | --- |
| `0.3.0-beta.1` | `snapshots/installed/0.3.0-beta.1/zotero-research-workbench-0.3.0-beta.1-installed-profile-20260522T183928.xpi` | `%APPDATA%/Zotero/Zotero/Profiles/8gsk6fny.default/extensions/zotero-research-workbench@local.xpi` | `73759` | `2026-05-22 18:39:28` | `27` | `53EA855FE0A3EDA736451D006C7464F95D78C7CDE594234DC2F37CBBC19341BF` | Active Zotero profile package copy. Zotero reports active `True` and user-disabled `False`. |

## Test Profile Snapshots

These are useful for reproducing smoke-test behavior, but they are not normal install candidates.

| Version | Path | Source profile/package | Size | Last write time | Entries | SHA256 | Notes |
| --- | --- | --- | ---: | --- | ---: | --- | --- |
| `0.1.0` | `snapshots/test-profiles/smoke/0.1.0/zotero-research-workbench-0.1.0-smoke-profile-20260518T150251.xpi` | `tmp/zotero-profile-smoke/extensions/zotero-research-workbench@local.xpi` | `2487` | `2026-05-18 15:02:51` | `4` | `1D9431F676C8808F92B2FB70C7B7B73C633AF82A0EE1AAF24B2F11A254572CAA` | Minimal smoke-test package. Manifest name is `Zotero Research Workbench`, not the later Chinese name. |

## Rollback Archive

Rollback files are retained for incident analysis or emergency recovery. They are lower trust than `releases/stable`.

| Version | Path | Original filename | Size | Last write time | Entries | SHA256 | Notes |
| --- | --- | --- | ---: | --- | ---: | --- | --- |
| `0.2.0` | `archive/rollback/broken-before-rollback-20260521/zotero-research-workbench-0.2.0.xpi.zrw-broken-before-rollback-20260521.bak` | `zotero-research-workbench-0.2.0.xpi.zrw-broken-before-rollback-20260521.bak` | `52077` | `2026-05-21 06:54:02` | `20` | `3A2F2D63851ED0F861F78C6B8921081109A642A4C052913760D79334166DE388` | Despite `.bak`, it is a readable Zotero package. Keep for forensics, not routine install. |

## Export Archive

| Path | Kind | Size | Last write time | SHA256 | Notes |
| --- | --- | ---: | --- | --- | --- |
| `archive/exports/2026-05-18/zotero-research-workbench-2026-05-18T14-05-08-737Z.json` | JSON export | `31977` | `2026-05-18 22:05:16` | `A7CD0424608AAE99F060760928E75ADEDD02AEFB1EEE3B6E0F3418308816E661` | Older exported metadata/snapshot. |
| `archive/exports/2026-05-18/zotero-research-workbench-2026-05-18T16-52-02-151Z.zip` | ZIP/export artifact | `22` | `2026-05-19 00:52:08` | `8739C76E681F900923B900C9DF0EF75CF421D39CABB54650C4B9AD19B6A76D85` | Older exported package/snapshot placeholder-sized archive. |

## Known Naming Corrections

| Original filename | Manifest version | Enterprise path | Meaning |
| --- | --- | --- | --- |
| `zotero-research-workbench-V0.21.xpi` | `0.2.0` | `releases/stable/0.2.0/zotero-research-workbench-0.2.0.xpi` | Original filename overstated/mislabelled the version. |
| `zotero-research-workbench-0.2.0.xpi` | `0.21.0-beta.1` | `releases/prerelease/0.21.0-beta.1/zotero-research-workbench-0.21.0-beta.1-build-20260522T000234.xpi` | Original filename lagged behind the manifest and was converted to a timestamped duplicate prerelease build. |

## Active Zotero Profile

| Field | Value |
| --- | --- |
| Profile | `8gsk6fny.default` |
| Profile path | `%APPDATA%/Zotero/Zotero/Profiles/8gsk6fny.default` |
| Installed package | `extensions/zotero-research-workbench@local.xpi` |
| Add-on id | `zotero-research-workbench@local` |
| Reported version | `0.3.0-beta.1` |
| Active | `True` |
| User disabled | `False` |
| Package SHA256 | `53EA855FE0A3EDA736451D006C7464F95D78C7CDE594234DC2F37CBBC19341BF` |

## Adjacent Files Not Treated As Releases

| Path | Reason |
| --- | --- |
| `tmp/zotero-profile-smoke/extensions/zotero-research-workbench@local.xpi` | Original smoke-test profile state; copied into `snapshots/test-profiles/smoke/0.1.0/` for inventory. |
| `.scratch/manual-qa-fixtures/zrw-manual-qa-workbench-snapshot.json` | Manual QA fixture data, not a plugin package or release artifact. |
| `tmp/zotero-profile-smoke/*.json` and browser/profile databases | Zotero/Firefox smoke profile runtime metadata, not plugin versions. |

## Git Ignore Policy

The repository ignores version payloads under `dist/`:

- `dist/*.xpi`, `dist/**/*.xpi`
- `dist/*.json`, `dist/**/*.json`
- `dist/*.zip`, `dist/**/*.zip`
- `dist/*.bak`, `dist/**/*.bak`
- `dist/*.xpi.*`, `dist/**/*.xpi.*`
- `dist/package/`

`dist/README.md` is explicitly unignored so this inventory can be tracked.
