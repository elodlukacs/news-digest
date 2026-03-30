---
description: Full UI/visual review of recent frontend changes across all themes and breakpoints
subtask: true
---

Review the UI/visual quality of recent frontend changes.

Steps:
1. Run `git diff HEAD -- client/src/` to see frontend changes
2. Launch the frontend-reviewer agent to check:
   - Theme consistency across all 4 themes (classic, broadsheet, evening, morning)
   - Typography hierarchy (Playfair → headings, Libre Franklin → body, Inter → UI)
   - Responsive design at mobile/tablet/desktop
   - ShadCN component usage (extend, don't duplicate)
   - Loading/error states
   - Accessibility (keyboard nav, ARIA, focus management)
   - Dark mode (evening theme) contrast and colors

Output the review with theme check table, responsive check table, and design score.
