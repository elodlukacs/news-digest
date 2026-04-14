// Utility to sanitize article content pulled from RSS feeds.
// Strips HTML, decodes entities, removes common boilerplate / nav remnants,
// and collapses whitespace into readable paragraphs.

function stripHtml(s) {
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<(?:br|p|div|li|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
}

const NAMED_ENTITIES = {
  nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>',
  hellip: '…', mdash: '—', ndash: '–', lsquo: '\u2018', rsquo: '\u2019',
  ldquo: '\u201C', rdquo: '\u201D', trade: '™', copy: '©', reg: '®',
};

function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, d) => {
      const code = parseInt(d, 10);
      return Number.isFinite(code) ? String.fromCharCode(code) : '';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => {
      const code = parseInt(h, 16);
      return Number.isFinite(code) ? String.fromCharCode(code) : '';
    })
    .replace(/&([a-zA-Z]+);/g, (m, name) => (NAMED_ENTITIES[name.toLowerCase()] ?? m));
}

// Lines matching any of these are dropped entirely (case-insensitive).
const JUNK_LINE_PATTERNS = [
  /^\s*(continue reading|read (the )?full (article|story)|read more|learn more|view more)\s*[→»>\]\.]*\s*$/i,
  /^\s*(subscribe|sign up|sign-up|follow us|newsletter|join our)\b.*$/i,
  /^\s*share(?:\s+this)?\s*(:|on)?.*$/i,
  /^\s*(tags?|categor(?:y|ies)|filed under)\s*:.*$/i,
  /^\s*posted\s+(by|on|in)\s+.+$/i,
  /^\s*(photo|image|credit|source|getty|reuters)\s*:.*$/i,
  /^\s*the post .+? appeared first on .+?\.?\s*$/i,
  /^\s*(©|copyright).+$/i,
  /^\s*(related|also|more)\s*(articles|posts|reading|stories)\s*:?.*$/i,
  /^\s*advertisement\s*$/i,
  /^\s*\[(?:…|\.{3})\]\s*$/,
];

function stripJunkLines(s) {
  return s
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true; // keep blank lines; collapsed later
      return !JUNK_LINE_PATTERNS.some((p) => p.test(trimmed));
    })
    .join('\n');
}

// Strip trailing attributions / ellipses after content is otherwise clean.
function stripTrailingBoilerplate(s) {
  return s
    .replace(/\[(?:…|\.{3})\]\s*$/g, '')
    .replace(/(continue reading|read more|read the full article)[\s…»→>\.]*$/i, '')
    .trim();
}

function collapseWhitespace(s) {
  return s
    .replace(/\r\n?/g, '\n')
    .replace(/[\t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function cleanArticleText(raw) {
  if (!raw) return '';
  let s = String(raw);
  s = stripHtml(s);
  s = decodeEntities(s);
  s = stripJunkLines(s);
  s = stripTrailingBoilerplate(s);
  s = collapseWhitespace(s);
  return s;
}

module.exports = { cleanArticleText };
