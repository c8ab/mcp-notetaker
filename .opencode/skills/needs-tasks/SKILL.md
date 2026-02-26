---
name: needs-tasks
description: Create phased implementation task lists for a feature. Use when the proven-needs orchestrator determines that a feature needs a task breakdown. Operates within a single feature package at docs/features/<slug>/. Tasks define the WORK — discrete coding units organized into sequential phases with parallelism markers and full traceability back to the feature's specs and stories.
---

## Prerequisites

This skill is invoked by the `proven-needs` orchestrator, which provides the feature context (slug, intent, current state).

## Observe

Assess the current state of the task list for this feature.

### 1. Read feature design

Read `docs/features/<slug>/design.adoc`. Extract `:version:`, `:status:`, system design sections, story resolution mappings. Also read `data-model.adoc` and `contracts/` if they exist within the feature package.

**If missing:** Note that design is unavailable. Report to the orchestrator. Tasks will be derived directly from user stories (story-driven derivation). If proceeding: set `:source-design-version:` to `n/a`.

### 2. Read feature stories and spec

- **`docs/features/<slug>/user-stories.adoc`** -- extract story IDs, titles, acceptance criteria, and `:version:`.
- **`docs/features/<slug>/spec.adoc`** -- extract spec IDs and `:version:`. If missing, set `:source-spec-version:` to `n/a`.

### 3. Read existing task list

If `docs/features/<slug>/tasks.adoc` exists:
- Read `:version:`, `:status:`, `:source-design-version:`, `:source-stories-version:`, `:source-spec-version:`
- Read all phases, tasks, tick states, and metadata

### 4. Read constraints

Read `constraints.adoc` from the project root. Identify quality constraints relevant to task planning.

### 5. Analyze codebase

If this is not a greenfield project, analyze what already exists to avoid creating tasks for things already implemented.

### 6. Report observation

Return to the orchestrator:
```
Feature: <slug>
Design: {exists: true/false, version: "X.Y.Z", status: "Current/Stale"}
Stories: {exists: true, version: "X.Y.Z"}
Spec: {exists: true/false, version: "X.Y.Z"}
Tasks: {exists: true/false, version: "X.Y.Z", status: "Current/Stale/Implemented", progress: "N/M ticked"}
```

## Evaluate

Given the desired state from the orchestrator, determine what action is needed.

### 1. Does the desired state require task changes?

| Condition | Action |
|---|---|
| No task list exists | Create task list |
| Task list exists, `:status:` is `Implemented` | Previous cycle complete. Create fresh task list (overwrite). |
| Source versions match, no tasks ticked | Task list appears current. Report to orchestrator. |
| Source versions match, some tasks ticked | Partial progress. Report to orchestrator. |
| `:source-design-version:` differs from current design | Task list is stale. Determine whether to recreate or incrementally update. |

### 2. Transitive staleness check

If `:source-design-version:` matches the current design version, trust that the design is current -- the design skill is responsible for tracking its own upstream staleness against stories and specs.

If `:source-design-version:` does not match, the task list is stale. Warn the orchestrator and recommend updating the design first (which will cascade any upstream story/spec changes into the design before tasks are regenerated).

Do not independently compare `:source-stories-version:` or `:source-spec-version:` against their current versions. Those are recorded for traceability, but staleness detection flows through the design.

### 3. Check constraints

Verify that task organization respects quality constraints (e.g., test coverage must not decrease -- ensure testing tasks exist).

### 4. Report evaluation

Return to the orchestrator:
```
Action: create / update / none
Staleness: {design: true/false, transitive: true/false}
Constraint issues: [list or none]
```

## Execute

### Design-driven task decomposition (default)

When a design document exists, walk through it systematically to identify discrete implementation units. Each task should be a single coding unit -- small enough to implement in one sitting.

**Sources of tasks:**

| Design Section | Task Types |
|---|---|
| Data model entities | Entity/model creation, migrations, validation rules |
| System design components | Module/service setup, core logic implementation |
| Interface contracts / API endpoints | Endpoint implementation, request/response handling |
| Frontend components | Component creation, state management wiring |
| External integrations | Service client setup, integration logic |
| Story resolution -- error cases | Error handling, edge cases |
| Story resolution -- notifications | Notification/email implementation |

**For each task, record:**
- A clear, actionable title
- Which design components are involved
- Which spec IDs it satisfies (when spec exists)
- Which user stories it contributes to
- Whether it depends on other tasks (determines phase placement and parallelism)

### Story-driven task derivation (when no design exists)

When `:source-design-version:` is `n/a`, derive tasks directly from user stories:

1. Read each story and its acceptance criteria
2. For each story, create one or more tasks. Group related criteria into a single task when tightly coupled; split when independently implementable.
3. For each task, record:
   - A clear, actionable title
   - Which user stories it implements
   - Which spec IDs it satisfies (when spec exists; omit `Specs::` if also `n/a`)
   - `Components::` is omitted since there is no design to reference
4. Use story groupings to inform phase organization

### Organize into phases

Group tasks into sequential phases based on implementation dependencies.

**Typical phase progression** (adapt to the project):

| Phase | Purpose | Examples |
|---|---|---|
| Foundation | Infrastructure, data model, configuration | Database setup, entity creation, project scaffolding |
| Core Logic | Business logic, services, core modules | Service implementations, domain logic |
| Interface Layer | APIs, UI components, CLI commands | Endpoint handlers, React components, command parsers |
| Integration | External services, cross-cutting concerns | Payment providers, email services, auth |
| Polish | Error handling, edge cases, notifications | Error responses, validation messages, notification triggers |

Within each phase, mark every task:
- **`[parallel]`** -- can be implemented concurrently. No dependency on other tasks within the phase.
- **`[sequential]`** -- must be completed before subsequent sequential tasks in the same phase.

**Guidelines:**
- A task belongs in the earliest phase where all its dependencies are satisfied
- Prefer more parallel tasks over fewer sequential ones
- If a phase would contain only one task, consider merging with an adjacent phase

### Write task list

Create `docs/features/<slug>/tasks.adoc`:

```asciidoc
= Implementation Tasks: <Feature Name>
:version: 1.0.0
:status: Current
:source-design-version: <design version>
:source-stories-version: <user-stories version>
:source-spec-version: <spec version>
:last-updated: YYYY-MM-DD
:feature: <slug>
:toc:

== Overview

<Brief summary: what is being implemented, number of phases, total tasks.>

== Phase 1: <Phase Name>

<One-sentence phase purpose.>

* [ ] TASK-001: <Task title> [parallel]
+
Components:: <design components involved>
Stories:: <story numbers>
Specs:: <spec IDs>
Description:: <What to implement and key details>

* [ ] TASK-002: <Task title> [sequential]
+
Components:: <design components involved>
Stories:: <story numbers>
Specs:: <spec IDs>
Description:: <What to implement and key details>

== Phase 2: <Phase Name>

...

== Traceability

[cols="1,1,1", options="header"]
|===
| Story | Spec IDs | Tasks

| US-001: <title> | PROD-001, PROD-002 | TASK-001, TASK-005
| US-002: <title> | PROD-005, PROD-006 | TASK-002, TASK-006
|===
```

**`:status:` values:**
- `Current` -- task list is valid and aligned with design
- `Stale` -- design has changed since this task list was created
- `Implemented` -- all tasks are ticked off

**Version rules:**
- `:version:` uses SemVer, starts at `1.0.0`
- `:source-design-version:` records which design version was used; `n/a` if design was skipped
- `:source-stories-version:` and `:source-spec-version:` record upstream versions; `n/a` if skipped
- `:last-updated:` set to today's date

**Task IDs:** Sequential within the document: TASK-001, TASK-002, etc. IDs are stable -- do not renumber when updating.

**Ticking off tasks:** When a task is completed, change `[ ]` to `[x]`. When all tasks are ticked, set `:status:` to `Implemented`.

## Quality Checklist

Before finalizing, verify:
- Every spec ID from the feature's `spec.adoc` appears in at least one task (skip if `:source-spec-version:` is `n/a`)
- Every user story is covered by the aggregate tasks
- Every design section has corresponding tasks (skip if `:source-design-version:` is `n/a`)
- No circular dependencies between phases
- Phase ordering respects actual implementation dependencies
- Each task is a discrete, implementable coding unit
- Parallel/sequential markers are correct
- The traceability section is complete and accurate
- Source versions are recorded correctly
- Quality constraints from `constraints.adoc` are addressed (e.g., testing tasks exist if coverage constraints apply)

## Reference

See `references/example.adoc` for a complete example showing how a feature design becomes a phased task list with traceability.
