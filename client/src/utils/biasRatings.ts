// Bias ratings data derived from AllSides Media Bias Ratings (https://www.allsides.com/media-bias/ratings)
// Licensed under Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)

import type { BiasRating } from '../types/lens';

export const BIAS_SORT_ORDER: BiasRating[] = ['left', 'lean-left', 'center', 'lean-right', 'right', 'unknown'];

export const BIAS_LABELS: Record<BiasRating, string> = {
  left: 'Left',
  'lean-left': 'Lean Left',
  center: 'Center',
  'lean-right': 'Lean Right',
  right: 'Right',
  unknown: 'Unknown',
};

export const BIAS_COLORS: Record<BiasRating, string> = {
  left: '#2563eb',
  'lean-left': '#60a5fa',
  center: '#6b7280',
  'lean-right': '#f87171',
  right: '#dc2626',
  unknown: '#6b7280',
};

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

    return ratings[domain] || 'unknown';
  } catch {
    return 'unknown';
  }
}
