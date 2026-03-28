import type { BiasRating } from '../types/lens';

const ratings: Record<string, BiasRating> = {
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

export function getBiasRating(url: string): BiasRating {
  try {
    const urlObj = new URL(url);
    let domain = urlObj.hostname.replace('www.', '').toLowerCase();

    if (domain.includes('bbc.co.uk')) domain = 'bbc.co.uk';
    else if (domain.includes('wsj.com') || domain.includes('wallstreetjournal.com')) domain = 'wsj.com';

    return ratings[domain] || 'center';
  } catch {
    return 'center';
  }
}
