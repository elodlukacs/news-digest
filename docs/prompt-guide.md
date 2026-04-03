# Prompt Guide

How to write prompts that fully leverage the sub-agents, iterative retrieval, search-first patterns, and phased workflow configured in this project.

## The Formula

```
[WHAT] + [CONSTRAINTS] + [WORKFLOW TRIGGER]
```

| Component | Purpose | Example |
|---|---|---|
| **WHAT** | What you want built/changed | "Add a bookmark button to article cards" |
| **CONSTRAINTS** | Scope limits, existing patterns to follow | "Follow existing component patterns in features/" |
| **WORKFLOW TRIGGER** | Which agents/pipeline to activate | "Plan first, then implement, then review" |

---

## Frontend / UI Prompts

### New Feature (full pipeline)

```
Add a "bookmark articles" feature. Users should be able to save articles
to read later. Bookmarks should persist across sessions.

Use the frontend-design skill for UI. Follow the phased workflow:
plan first, then implement, then review.

Existing bookmark data: check if there's already a bookmarks table or
any bookmark-related code in the codebase.
```

Why this works:
- "frontend-design skill" triggers polished UI generation
- "phased workflow" triggers RESEARCH -> PLAN -> IMPLEMENT -> REVIEW -> UI CHECK -> BUILD CHECK -> BUILD FIX
- "check if there's already..." triggers search-first and iterative retrieval

### Quick UI Fix (targeted)

```
The article card titles in the broadsheet theme are too small on mobile.
Fix the typography hierarchy — titles should use Playfair Display at
a readable size on 375px viewport.

After fixing, launch frontend-reviewer to verify across all 4 themes.
```

### Component Addition

```
Add a "share article" dropdown to the article card component. Should
have share options for Twitter, Facebook, and copy link.

Check components/ui/ first for an existing Dropdown or Popover primitive.
Extend it — don't create from scratch. Follow the newspaper aesthetic
with warm tones matching the current card design.
```

### Design Overhaul

```
Redesign the widget sidebar to use a collapsible accordion pattern.
Each widget (weather, crypto, rates) should be independently collapsible.

Use the frontend-design skill. After implementing:
1. Launch frontend-reviewer for theme/responsive check
2. Launch code-reviewer for quality check
3. Run tsc --noEmit && npm run build
```

### Theme Work

```
The evening (dark) theme has poor contrast on the article summary text.
Fix the text color to meet WCAG AA contrast ratio (4.5:1 minimum).

Check how the current theme colors are defined in index.css CSS variables.
Test against the dark variant that targets [data-theme="evening"].
```

---

## Backend Prompts

### New API Endpoint (full pipeline)

```
Add a /api/bookmarks endpoint with full CRUD.
Fields: id, article_url, title, saved_at.
Use existing route patterns from routes/ — one file per resource,
validateId middleware, parameterized queries.

Plan first with the planner agent, then implement.
Check if there's already a bookmarks table in the database schema.
```

### Bug Fix (targeted)

```
The /api/categories endpoint returns duplicate entries when called
rapidly. Investigate the caching layer and fix the race condition.

Launch code-reviewer after the fix.
```

### Database Schema Change

```
Add a "reading_time_minutes" column to the articles table.
Update the relevant API endpoints to include this field.

Search for all places that query the articles table — there may be
multiple routes that need updating. Use iterative retrieval.
```

### Performance Fix

```
The homepage API is slow — it makes 3 separate LLM calls sequentially.
Refactor to use Promise.all for parallel execution.

Only change the parallelization — don't refactor anything else.
Launch architect to review the change, then build-error-resolver if
tsc fails.
```

### LLM / Provider Change

```
Add Mistral as a fallback provider after OpenRouter in server/lib/llm.js.
Check the existing fallback chain before adding — there may already be
a similar pattern in place.
```

---

## Workflow Trigger Cheat Sheet

| What you say | What happens |
|---|---|
| "plan first" / "phased workflow" | Full 7-step pipeline (research -> plan -> implement -> review -> UI check -> build -> fix) |
| "launch [agent-name]" | Specific sub-agent invoked (planner, architect, code-reviewer, typescript-reviewer, frontend-reviewer, build-error-resolver) |
| "use frontend-design skill" | Polished UI generation via skill |
| "check if already exists" | Search-first + iterative retrieval |
| "minimal fix only" | build-error-resolver philosophy — smallest possible diff |
| "don't refactor anything else" | Constrains scope to the specific request |
| "verify across all themes" | frontend-reviewer multi-theme check |
| "run full review" | code-reviewer + typescript-reviewer combined |
| "check architecture" | architect agent structural review |
| "use iterative retrieval" | Dispatch -> evaluate -> refine loop (max 3 cycles) |

---

## Prompt Quality Scale

### Too vague (avoid)
```
make the app better
```
No constraints, no workflow trigger, no scope. Agent will guess what "better" means.

### Too prescriptive (avoid)
```
Create a file called BookmarkButton.tsx in src/features/bookmarks/components/,
import useState from react, create an interface called BookmarkProps with
articleId: string and onSave: () => void, then render a button with className
"px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"...
```
You're doing the agent's job. Wastes tokens and produces worse results than letting it follow established patterns.

### Right level (use this)
```
Add a bookmark button to article cards. Follow existing component patterns
in features/ — check how similar buttons are built. Use the frontend-design
skill for styling.
```
Clear what + constraints + workflow trigger. Agent has room to follow project conventions.

---

## Composing Multi-Step Work

For larger tasks, chain the phases explicitly:

```
Implement a reading list feature end-to-end:

Phase 1: Plan with the planner agent. Check existing code for any
reading-list or bookmark functionality already in the codebase.

Phase 2: Backend first — add the API endpoint and database table.
Follow existing route patterns. Launch code-reviewer after.

Phase 3: Frontend — add reading list UI with the frontend-design skill.
Must work across all 4 themes.

Phase 4: Review — launch frontend-reviewer for themes, then run
tsc --noEmit && npm run build. If build fails, launch build-error-resolver.
```

This gives the agent the full roadmap while leaving implementation details to each sub-agent.

---

## Quick-Reference: Agent Selection

| Situation | Agent | Why |
|---|---|---|
| Starting a new feature | `planner` | Structured plan before code |
| Evaluating system design | `architect` | Data flow, patterns, structural integrity |
| After implementing code | `code-reviewer` | Bugs, quality, conventions |
| After writing TypeScript | `typescript-reviewer` | Type safety, strict mode, imports |
| After UI/styling changes | `frontend-reviewer` | Themes, responsive, accessibility |
| Build/type error | `build-error-resolver` | Minimal fix, no scope creep |

---

## Composing Multi-Step Work

For larger tasks, chain the phases explicitly:

```
Implement a reading list feature end-to-end:

Phase 1: Plan with the planner agent. Check existing code for any
reading-list or bookmark functionality already in the codebase.

Phase 2: Backend first — add the API endpoint and database table.
Follow existing route patterns. Launch code-reviewer after.

Phase 3: Frontend — add reading list UI with the frontend-design skill.
Must work across all 4 themes.

Phase 4: Review — launch frontend-reviewer for themes, then run
tsc --noEmit && npm run build. If build fails, launch build-error-resolver.
```

This gives the agent the full roadmap while leaving implementation details to each sub-agent.
