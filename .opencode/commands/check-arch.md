---
description: Check architecture health — data flow, patterns, structural integrity
subtask: true
---

Run an architecture review on the codebase.

Launch the architect agent to evaluate:
1. Outlet context consistency between `types/routing.ts` and `App.tsx`
2. Data flow patterns — no duplicate fetching, proper AbortController usage
3. Feature folder structure — barrel exports, component organization
4. Server route patterns — one file per resource, parameterized queries
5. TypeScript config compliance — strict mode, verbatimModuleSyntax
6. API proxy and caching setup

Output the architecture review table with severity, area, issue, file, and recommendation.
Include structural score X/10 and recommended action.
