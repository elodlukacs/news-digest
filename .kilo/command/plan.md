---
description: Plan a feature before implementing — research, design, then output a plan
subtask: true
---

Plan the following feature or change: $ARGUMENTS

Steps:
1. Search the codebase for related existing code — use Grep/Glob to find files that will be affected
2. Check `types/routing.ts` and `App.tsx` for outlet context impact
3. Check server routes for API changes needed
4. Identify all files that need modification
5. Output a structured plan:

```
## Plan: [feature name]

### Files to Modify
| File | Change | Risk |
|------|--------|------|

### New Files Needed
| File | Purpose |
|------|---------|

### Outlet Context Changes
[if any — list both routing.ts and App.tsx updates]

### API Changes
[if any — list route + method + request/response shape]

### Implementation Order
1. [first step]
2. [next step]

### Risks & Mitigations
- [risk]: [mitigation]
```

Do NOT implement. Only plan. Ask clarifying questions if the request is ambiguous.
