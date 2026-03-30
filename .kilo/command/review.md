---
description: Review code changes for quality, types, conventions, and bugs
subtask: true
---

Run a comprehensive code review on recent changes.

Steps:
1. Run `git diff HEAD` to see all uncommitted changes
2. Launch the code-reviewer agent to check for bugs, error handling, dead code, and convention violations
3. Launch the typescript-reviewer agent to check type safety and strict mode compliance
4. Combine findings into a single prioritized report

Output a consolidated review table with severity, file:line, issue, and fix.
Verdict: PASS (no HIGH/CRITICAL), WARNING (MEDIUM only), or BLOCK (any CRITICAL/HIGH).
