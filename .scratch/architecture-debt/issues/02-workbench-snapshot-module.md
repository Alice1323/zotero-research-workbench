Title: Extract workbench snapshot behavior into a deep Module

Status: ready-for-agent

## Problem

Workbench snapshot behavior appears to be spread across UI/store/runtime-adjacent Implementation code instead of owned by a single deep Module. That makes the snapshot lifecycle hard to reason about: callers may need to understand capture timing, serialization shape, restoration behavior, persistence, and UI refresh details together.

This debt lowers Locality and weakens the Seam between workbench state and the rest of the plugin. A dedicated snapshot Module with a narrow Interface would hide volatile Implementation details, provide a clear Adapter point for storage or runtime dependencies, and give future issue workers more Leverage when changing snapshot format or recovery behavior.

## Scope

- Identify the current snapshot lifecycle: create, serialize, persist, restore, validate, and surface errors.
- Define a workbench snapshot Module Interface that represents the lifecycle in domain terms.
- Move snapshot Implementation details behind the Interface without changing current workbench behavior.
- Introduce Adapter boundaries for persistence, runtime context, or UI notification dependencies where they cross the snapshot Seam.
- Keep snapshot format decisions local to the Module and expose only the stable contract needed by callers.
- Add tests that verify the Interface contract, snapshot round trip behavior, and Adapter error paths.

## Acceptance Criteria

- [ ] Workbench snapshot behavior is owned by a named Module with an explicit Interface.
- [ ] Snapshot callers no longer coordinate low-level Implementation details such as persistence shape, restore ordering, or validation internals.
- [ ] A clear Seam exists between snapshot logic and at least one Adapter dependency.
- [ ] Tests prove snapshot create/restore or serialize/deserialize behavior through the public Interface.
- [ ] Error handling is covered for one important Adapter failure path.
- [ ] The Module increases Depth by hiding snapshot mechanics while preserving the current workbench-facing behavior.
- [ ] The change improves Locality for future snapshot format or restore logic changes.

## Suggested TDD Steps

- Write characterization tests for the current workbench snapshot round trip that must not regress.
- Add failing Interface-level tests for the snapshot Module using fake Adapters.
- Implement the minimal Module wrapper and route one caller through the new Seam.
- Move serialization, validation, or restore ordering Implementation into the Module while keeping tests green.
- Add an Adapter failure test for persistence or runtime context access.
- Refactor exports and names so future workbench code depends on the Interface instead of snapshot internals.

## Out of Scope

- No new workbench features, UI flows, snapshot formats, or migration behavior unless required to preserve existing behavior.
- No changes to runtime core extraction beyond consuming an already available Interface if one exists.
- No active profile, XPI, README, docs/agents, or localization edits.
- No broad state-store rewrite outside the snapshot Module boundary.
