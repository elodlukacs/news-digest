const { createHash } = require('crypto');

async function fetchWithTimeout(url, signal, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();

  if (signal) {
    if (signal.aborted) {
      clearTimeout(timeout);
      throw new DOMException('Aborted', 'AbortError');
    }
    signal.addEventListener('abort', onAbort, { once: true });
  }

  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      },
    });
    return resp;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onAbort);
  }
}

function abortableDelay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort);
  });
}

function generateJobId(source, title, company) {
  const hash = createHash('sha256')
    .update(`${source}:${title}:${company}`)
    .digest('hex')
    .slice(0, 16);
  return `${source}_${hash}`;
}

function normalizeJob(partial) {
  return {
    id: partial.id,
    title: (partial.title || '').trim(),
    company: (partial.company || '').trim(),
    url: partial.url,
    source: partial.source,
    datePosted: partial.datePosted,
    status: 'new',
    country: (partial.country || '').trim(),
    workType: (partial.workType || '').trim(),
    description: (partial.description || '').trim() || '',
  };
}

function formatUnixDate(epoch) {
  if (!epoch) return new Date().toISOString().split('T')[0];
  return new Date(epoch * 1000).toISOString().split('T')[0];
}

function extractCountry(location) {
  if (!location) return '';
  const parts = location.split(',').map(s => s.trim());
  return parts[parts.length - 1] || '';
}

function determineWorkType(location, remote, tags) {
  const combined = [location, ...(tags || [])].join(' ').toLowerCase();
  if (combined.includes('hybrid')) return 'hybrid';
  if (combined.includes('onsite') || combined.includes('on-site') || combined.includes('in-person') || combined.includes('office'))
    return 'onsite';
  if (remote || combined.includes('remote')) return 'remote';
  return '';
}

function parseDate(dateStr) {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  } catch {}
  return new Date().toISOString().split('T')[0];
}

module.exports = {
  fetchWithTimeout,
  abortableDelay,
  generateJobId,
  normalizeJob,
  formatUnixDate,
  extractCountry,
  determineWorkType,
  parseDate,
};
