---
name: needs-stories
description: Create and update user stories with EARS acceptance criteria for a feature. Use when the proven-needs orchestrator determines that a feature needs user stories created or updated. Operates within a single feature package at docs/features/<slug>/. Stories explain WHY from the user's perspective — the needs, motivations, and value a feature delivers.
---

## Prerequisites

Load the `ears-requirements` skill before writing acceptance criteria. It provides the EARS sentence types and templates.

This skill is invoked by the `proven-needs` orchestrator, which provides the feature context (slug, intent, current state).

## Observe

Assess the current state of user stories for this feature.

### 1. Check feature directory

Look for `docs/features/<slug>/`. If the directory does not exist, note that this is a new feature -- no stories exist yet.

### 2. Read existing stories

If `docs/features/<slug>/user-stories.adoc` exists:
- Read `:version:` and `:last-updated:`
- Extract all story IDs, titles, and acceptance criteria
- Count total stories

### 3. Read constraints

Read `constraints.adoc` from the project root. Identify any constraints relevant to story quality (e.g., quality constraints about testability, completeness).

### 4. Report observation

Return to the orchestrator:
```
Feature: <slug>
Stories: {exists: true/false, version: "X.Y.Z", count: N, story_ids: [...]}
```

## Evaluate

Given the desired state from the orchestrator, determine what action is needed.

### 1. Does the desired state require new stories?

- If no stories exist and the intent requires them → create stories
- If stories exist but the intent adds new functionality → add stories
- If stories exist but the intent modifies existing behavior → modify stories
- If stories exist and fully cover the desired state → no action needed

### 2. Check constraints

Verify that proposed stories would not violate any constraints:
- Stories must be testable (quality constraint)
- Stories must not duplicate constraint-level requirements (cross-cutting requirements belong in `constraints.adoc`, not stories)
- Each story must be scoped to this one feature (must not require knowledge of other features)

### 3. Report evaluation

Return to the orchestrator:
```
Action: create / add / modify / none
Stories to create: N
Stories to modify: [list]
Constraint issues: [list or none]
```

## Execute

### Creating stories for a new feature

#### 1. Analyze the intent

Read the intent (desired state) provided by the orchestrator. Identify:
- The main functionality requested
- Who the users are (roles)
- What problems they want solved
- Any specific requirements mentioned

#### 2. Decompose into stories

Break functionality into atomic user stories. Each story must:
- Be implementable in 1-3 days
- Deliver clear user value
- Have testable acceptance criteria
- Be scoped entirely within this feature (no cross-feature dependencies)

A story must not be phrased so broadly that it spans multiple features. If a story seems too broad, split it or flag it to the orchestrator for potential feature decomposition.

Common decomposition patterns:

| Feature Type | Typical Stories |
|---|---|
| Authentication | Login, Logout, Registration, Password Reset, Session Management |
| CRUD Operations | Create, Read, Update, Delete, List/Search |
| User Settings | View Settings, Update Settings, Preferences |
| Notifications | Subscribe, Receive, View History, Manage Preferences |

#### 3. Write each story

For each story provide:

**Title:** Concise, descriptive (e.g., "User Registration")

**User story statement:**

```
As a [specific user role],
I want [specific action/feature],
so that [benefit/value].
```

**Acceptance criteria:** Write each criterion using the appropriate EARS sentence type from the `ears-requirements` skill. Each criterion must be specific, unambiguous, and verifiable. Cover happy path, edge cases, and error scenarios.

#### 4. Check for constraint-level requirements

While writing acceptance criteria, check each criterion:
- Does this criterion apply only to this feature? → Keep as acceptance criterion
- Would this criterion apply to other features too? → Flag to the orchestrator as a potential constraint

Example: "The system shall enforce minimum password security requirements" applies to registration, password reset, and any future password feature → flag as potential constraint.

#### 5. Write the file

Create `docs/features/<slug>/user-stories.adoc`:

```asciidoc
= User Stories: <Feature Name>
:version: 1.0.0
:last-updated: YYYY-MM-DD
:feature: <slug>
:toc:

== US-001: <Title>
As a [role],
I want [goal],
so that [benefit].

Acceptance Criteria:

* [ ] The system shall [ubiquitous requirement].
* [ ] When [trigger], the system shall [response].
* [ ] If [error condition], then the system shall [response].

== US-002: <Title>
...
```

Story IDs are sequential within this feature file (US-001, US-002, ...). IDs are unique within the feature, not globally.

### Adding stories to an existing feature

1. Read the existing stories and the next available US-NNN ID.
2. Before adding, check for stories with substantially similar scope. If a potential duplicate is found, present both to the user and ask whether to merge, replace, or keep both.
3. Assign the next sequential `US-NNN` ID after the highest existing ID.
4. Bump the version: MINOR (new content added).
5. Update `:last-updated:` to today's date.

### Modifying existing stories

1. Identify which stories the user wants to modify.
2. Present the proposed changes: show the current text alongside the new text.
3. Ask the user to confirm before applying.
4. Bump the version:
   - Acceptance criteria fundamentally rewritten: MAJOR
   - Criteria refined or adjusted (non-breaking): MINOR
   - Typos, formatting, clarifications: PATCH
5. Update `:last-updated:` to today's date.

### Removing stories

1. Identify the stories to remove.
2. **Warn about downstream impact:** Removing stories may make the feature's spec and design stale. Inform the user.
3. Ask the user to confirm.
4. Remove the stories. Do not renumber remaining stories (IDs are stable).
5. Bump the version: MAJOR (content removed).
6. Update `:last-updated:` to today's date.

## Quality Checklist (INVEST)

Before finalizing, verify:
- Each story has clear user value
- Acceptance criteria use the correct EARS sentence type
- Acceptance criteria are specific, unambiguous, and verifiable
- Stories are independent and can be implemented in any order
- No story is too large (break down if needed)
- Error and edge case scenarios are covered using the "If ... then" (unwanted behavior) EARS type
- No story spans multiple features
- Cross-cutting requirements have been flagged as potential constraints
- Version and date are updated

INVEST criteria: **I**ndependent, **N**egotiable, **V**aluable, **E**stimable, **S**mall, **T**estable.

## Reference

See `references/example.adoc` for a complete example showing how a feature intent becomes structured user stories within a feature package.
