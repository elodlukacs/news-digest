function fetchWithTimeout(url, opts = {}, ms = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(id));
}

module.exports = { fetchWithTimeout };
