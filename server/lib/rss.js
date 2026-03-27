const RSSParser = require('rss-parser');

const parser = new RSSParser({
  customFields: {
    item: [
      ['media:content', 'media:content', { keepArray: true }],
      ['media:thumbnail', 'media:thumbnail', { keepArray: true }],
      ['media:group', 'media:group'],
      ['enclosure', 'enclosure'],
      ['content:encoded', 'content:encoded'],
    ],
  },
});

function extractImageFromHtml(html) {
  const imgMatch = String(html).match(/<img[^>]+src=["']([^"'>]+)["']/);
  return imgMatch ? imgMatch[1] : '';
}

function extractMediaUrl(obj) {
  if (!obj) return '';
  const arr = Array.isArray(obj) ? obj : [obj];
  for (const item of arr) {
    const url = item?.$?.url || item?.url || item?.href || item?.$?.href || '';
    if (url) return url;
  }
  return '';
}

function extractImage(item) {
  if (item.enclosure?.url) {
    const encType = item.enclosure?.type || '';
    if (encType.startsWith('image/') || !encType) {
      const url = item.enclosure.url;
      if (url && /\.(jpg|jpeg|png|gif|webp|avif)($|\?)/i.test(url)) return url;
    }
  }

  const mcUrl = extractMediaUrl(item['media:content']);
  if (mcUrl && /\.(jpg|jpeg|png|gif|webp|avif)($|\?)/i.test(mcUrl)) return mcUrl;

  const mtUrl = extractMediaUrl(item['media:thumbnail']);
  if (mtUrl && /\.(jpg|jpeg|png|gif|webp|avif)($|\?)/i.test(mtUrl)) return mtUrl;

  if (item['media:group']) {
    const group = item['media:group'];
    const groupUrl = extractMediaUrl(group?.['media:content'] || group?.['media:thumbnail']);
    if (groupUrl && /\.(jpg|jpeg|png|gif|webp|avif)($|\?)/i.test(groupUrl)) return groupUrl;
  }

  if (item['itunes:image']) {
    const itunes = Array.isArray(item['itunes:image']) ? item['itunes:image'][0] : item['itunes:image'];
    const itunesUrl = itunes?.href || itunes?.$?.href || '';
    if (itunesUrl && /\.(jpg|jpeg|png|gif|webp|avif)($|\?)/i.test(itunesUrl)) return itunesUrl;
  }

  const htmlImage = extractImageFromHtml(item['content:encoded']) || extractImageFromHtml(item.content) || extractImageFromHtml(item.description) || '';
  if (htmlImage && /\.(jpg|jpeg|png|gif|webp|avif)($|\?)/i.test(htmlImage)) return htmlImage;
  
  return '';
}

module.exports = { parser, extractImageFromHtml, extractMediaUrl, extractImage };
