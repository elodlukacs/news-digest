# Preserving Existing Functionality

Before implementing any new feature or requirement, you MUST:

1. **Audit existing code first**
   - Scan the relevant files and identify any functionality that already exists
   - Flag it explicitly in your response before writing any code

2. **Flag existing functionality**
   - List what already exists that overlaps with the new requirement
   - Example format:
     :warning: EXISTING: `getUserData()` in `services/user.ts` already handles user fetching.
     → Do you want to keep, extend, or replace it?

3. **Wait for confirmation**
   - Do NOT overwrite or refactor existing code unless explicitly told to
   - If unsure, ask: "This already exists — should I keep it, extend it, or replace it?"

4. **Never silently replace**
   - Do not rename, remove, or rewrite existing functions/components without flagging it first
   - Prefer extending existing code over replacing it

5. **When adding new code**
   - Reuse existing utilities, hooks, services, and helpers where possible
   - Only create new files/functions if the existing ones cannot be extended

## Response Format for New Requirements

When given a new task, structure your response like this:

### :mag: Existing Functionality Found
- [list anything relevant that already exists]

### :warning: Conflicts or Overlaps
- [list anything the new requirement might overwrite or duplicate]

### :white_check_mark: Proposed Approach
- [what you plan to do, keeping the above in mind]

### :octagonal_sign: Needs Confirmation
- [anything you need a yes/no on before proceeding]
