# Search-First Development

Before writing any new code, check these in order:

1. **Repo search** — Does this already exist? `rg` through relevant modules for similar utilities, hooks, components
2. **ShadCN** — Is there a ShadCN primitive in `components/ui/` that handles this? Extend it, don't duplicate
3. **Existing hooks** — Check `hooks/` and `features/` for data-fetching or state hooks that can be reused
4. ** barrel exports** — Check `index.ts` files in feature folders — the export may already exist

Only create new files/functions if existing ones genuinely cannot be extended.

## Coding Standards

### Immutability
- Always use spread operator: `{ ...obj, key: value }`, `[...arr, item]`
- Never mutate state directly

### Functions
- Functions >50 lines: split into smaller functions
- Nesting >4 levels: use early returns to flatten
- Magic numbers: extract to named UPPER_SNAKE_CASE constants

### Async Patterns
- Use `Promise.all` for independent async calls
- Never use `async` inside `forEach` — use `for...of` or `Promise.all`
- Every `async` call must be awaited, caught, or explicitly voided

### Error Handling
- `try/catch` in all async hooks with `AbortError` check
- Empty catch blocks are forbidden
- API responses checked with `!res.ok` before parsing
