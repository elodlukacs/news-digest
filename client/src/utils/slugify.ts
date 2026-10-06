/**
 * URL slug for a category name. Letters in any script are kept (accents are
 * folded: "Hírek" → "hirek") — stripping everything outside a-z turned a
 * Cyrillic or Greek name into "" and its link into a blank page.
 */
export function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '');
}
