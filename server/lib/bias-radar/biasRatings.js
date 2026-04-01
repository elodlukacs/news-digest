// Bias ratings data derived from AllSides Media Bias Ratings (https://www.allsides.com/media-bias/ratings)
// Licensed under Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)

const BIAS_SORT_ORDER = ['left', 'lean-left', 'center', 'lean-right', 'right', 'unknown'];

const ratings = {
  'nytimes.com': 'lean-left',
  'washingtonpost.com': 'lean-left',
  'theguardian.com': 'lean-left',
  'cnn.com': 'lean-left',
  'msnbc.com': 'left',
  'huffpost.com': 'lean-left',
  'dailykos.com': 'left',
  'vox.com': 'lean-left',
  'motherjones.com': 'lean-left',
  'slate.com': 'lean-left',

  'bbc.com': 'center',
  'bbc.co.uk': 'center',
  'reuters.com': 'center',
  'apnews.com': 'center',
  'axios.com': 'center',
  'thehill.com': 'center',
  'economist.com': 'center',
  'csmonitor.com': 'center',
  'upi.com': 'center',
  'newsweek.com': 'center',

  'foxnews.com': 'right',
  'nypost.com': 'lean-right',
  'wsj.com': 'lean-right',
  'wallstreetjournal.com': 'lean-right',
  'breitbart.com': 'right',
  'dailywire.com': 'right',
  'nationalreview.com': 'right',
  'newsmax.com': 'right',
  'thefederalist.com': 'lean-right',
  'raconteur.net': 'center',

  'techcrunch.com': 'lean-left',
  'arstechnica.com': 'center',
  'theverge.com': 'lean-left',
  'wired.com': 'lean-left',
  'engadget.com': 'lean-left',

  'bloomberg.com': 'lean-right',
  'ft.com': 'center',
  'marketwatch.com': 'center',
  'cnbc.com': 'center',
  'forbes.com': 'lean-right',
  'businessinsider.com': 'lean-left',

  'nature.com': 'center',
  'scientificamerican.com': 'center',
  'newscientist.com': 'center',
};

const BIAS_LABELS = {
  left: 'Left',
  'lean-left': 'Lean Left',
  center: 'Center',
  'lean-right': 'Lean Right',
  right: 'Right',
  unknown: 'Unrated',
};

const BIAS_COLORS = {
  left: '#2563eb',
  'lean-left': '#60a5fa',
  center: '#6b7280',
  'lean-right': '#f87171',
  right: '#dc2626',
  unknown: '#6b7280',
};

function getBiasRating(url) {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    let domain = urlObj.hostname.replace('www.', '').toLowerCase();

    // Exact match first
    if (ratings[domain]) return ratings[domain];

    // Subdomain fallback: try parent domains (e.g. edition.cnn.com → cnn.com)
    const parts = domain.split('.');
    for (let i = 1; i < parts.length - 1; i++) {
      const parent = parts.slice(i).join('.');
      if (ratings[parent]) return ratings[parent];
    }

    return 'unknown';
  } catch {
    return 'unknown';
  }
}

function getBiasLabel(rating) {
  return BIAS_LABELS[rating] || 'Unknown';
}

function getBiasColor(rating) {
  return BIAS_COLORS[rating] || '#6b7280';
}

module.exports = {
  getBiasRating,
  getBiasLabel,
  getBiasColor,
  BIAS_LABELS,
  BIAS_COLORS,
  BIAS_SORT_ORDER,
  ratings,
};