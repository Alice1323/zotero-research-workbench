Title: Split runtime core bundle behind explicit Module Interfaces

Status: ready-for-agent

## Problem

The runtime core currently behaves like one dense bundle where Module boundaries are hard to see and several Implementation details leak across call sites. This reduces Depth because callers must know too much about runtime wiring, provider setup, prompt assembly, persistence, and Zotero-facing behavior at the same time.

The most valuable debt to pay down is to create clear Interface seams around runtime responsibilities without changing behavior. A narrower public surface should make each Module deeper, keep Implementation choices local, and give future agents more Leverage when changing provider or runtime behavior.

## Scope

- Identify the runtime core responsibilities that are currently coupled through direct calls or shared state.
- Define stable Module Interfaces for the runtime-facing operations that other parts of the plugin need.
- Move Implementation details behind those Interfaces while preserving current behavior.
- Introduce explicit Adapter boundaries where runtime code crosses into Zotero APIs, provider APIs, storage, or UI-facing surfaces.
- Improve Locality so a future provider, prompt, or runtime orchestration change can be made in the owning Module instead of across unrelated files.
- Add tests around the new Seam to prove the old behavior is still available through the new Interface.

## Acceptance Criteria

- [ ] Runtime-facing callers depend on one or more explicit Module Interfaces instead of reaching into bundled Implementation details.
- [ ] At least one high-value Seam separates runtime orchestration from an external Adapter such as Zotero, provider access, or persistence.
- [ ] Existing user-visible runtime behavior is preserved.
- [ ] Tests cover the Interface contract and at least one Adapter-backed path.
- [ ] The resulting Module has greater Depth: its public API is smaller than the behavior it encapsulates.
- [ ] The change improves Locality for future runtime/provider modifications and does not require unrelated UI or workbench edits.

## Suggested TDD Steps

- Write characterization tests around the current runtime behavior that should remain stable.
- Add failing tests for the desired Module Interface, using a fake Adapter to isolate Implementation details.
- Implement the smallest Interface and Adapter extraction needed to make the tests pass.
- Move coupled Implementation code behind the new Seam in small steps, keeping characterization tests green.
- Add regression coverage for error handling and provider/runtime edge cases discovered during the extraction.
- Refactor names and exports so the Module boundary is obvious to the next issue worker.

## Out of Scope

- No feature changes to prompts, providers, summaries, workbench behavior, active profile files, or XPI packaging.
- No broad rewrite of runtime architecture beyond the highest-Leverage Seam.
- No UI redesign or localization changes.
- No migration to a new state management, build, or dependency framework.
