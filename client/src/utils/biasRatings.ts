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
  unknown: 'Unrated',
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
  // Left
  'msnbc.com': 'left',
  'dailykos.com': 'left',
  'jacobin.com': 'left',
  'thenation.com': 'left',
  'democracynow.org': 'left',
  'currentaffairs.org': 'left',
  'truthout.org': 'left',
  'commondreams.org': 'left',
  'alternet.org': 'left',
  'rawstory.com': 'left',
  'theintercept.com': 'left',

  // Lean Left
  'nytimes.com': 'lean-left',
  'washingtonpost.com': 'lean-left',
  'theguardian.com': 'lean-left',
  'cnn.com': 'lean-left',
  'huffpost.com': 'lean-left',
  'vox.com': 'lean-left',
  'motherjones.com': 'lean-left',
  'slate.com': 'lean-left',
  'politico.com': 'lean-left',
  'nbcnews.com': 'lean-left',
  'cbsnews.com': 'lean-left',
  'abcnews.go.com': 'lean-left',
  'latimes.com': 'lean-left',
  'npr.org': 'lean-left',
  'pbs.org': 'lean-left',
  'theatlantic.com': 'lean-left',
  'newyorker.com': 'lean-left',
  'buzzfeednews.com': 'lean-left',
  'thedailybeast.com': 'lean-left',
  'time.com': 'lean-left',
  'insider.com': 'lean-left',
  'businessinsider.com': 'lean-left',
  'usatoday.com': 'lean-left',
  'vice.com': 'lean-left',
  'salon.com': 'lean-left',
  'rollingstone.com': 'lean-left',
  'vanityfair.com': 'lean-left',
  'techcrunch.com': 'lean-left',
  'theverge.com': 'lean-left',
  'wired.com': 'lean-left',
  'engadget.com': 'lean-left',
  'mashable.com': 'lean-left',
  'talkingpointsmemo.com': 'lean-left',
  'nymag.com': 'lean-left',

  // Center
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
  'arstechnica.com': 'center',
  'ft.com': 'center',
  'marketwatch.com': 'center',
  'cnbc.com': 'center',
  'nature.com': 'center',
  'scientificamerican.com': 'center',
  'newscientist.com': 'center',
  'raconteur.net': 'center',
  'realclearpolitics.com': 'center',
  'allsides.com': 'center',
  'c-span.org': 'center',
  'factcheck.org': 'center',
  'snopes.com': 'center',
  'politifact.com': 'center',
  'ground.news': 'center',
  'propublica.org': 'center',
  'aljazeera.com': 'center',
  'dw.com': 'center',
  'france24.com': 'center',
  'euronews.com': 'center',
  'abc.net.au': 'center',
  'smh.com.au': 'center',
  'theaustralian.com.au': 'center',
  'cbc.ca': 'center',
  'globalnews.ca': 'center',
  'scmp.com': 'center',
  'theglobeandmail.com': 'center',
  'foreignaffairs.com': 'center',
  'foreignpolicy.com': 'center',
  'theconversation.com': 'center',

  // Lean Right
  'nypost.com': 'lean-right',
  'wsj.com': 'lean-right',
  'wallstreetjournal.com': 'lean-right',
  'thefederalist.com': 'lean-right',
  'bloomberg.com': 'lean-right',
  'forbes.com': 'lean-right',
  'washingtontimes.com': 'lean-right',
  'washingtonexaminer.com': 'lean-right',
  'dailymail.co.uk': 'lean-right',
  'telegraph.co.uk': 'lean-right',
  'spectator.co.uk': 'lean-right',
  'reason.com': 'lean-right',
  'freebeacon.com': 'lean-right',
  'ijr.com': 'lean-right',
  'dailycaller.com': 'lean-right',
  'theamericanconservative.com': 'lean-right',
  'semafor.com': 'lean-right',
  'thedispatch.com': 'lean-right',
  'spectator.org': 'lean-right',

  // Right
  'foxnews.com': 'right',
  'breitbart.com': 'right',
  'dailywire.com': 'right',
  'nationalreview.com': 'right',
  'newsmax.com': 'right',
  'oann.com': 'right',
  'thegatewaypundit.com': 'right',
  'townhall.com': 'right',
  'pjmedia.com': 'right',
  'redstate.com': 'right',
  'theblaze.com': 'right',
  'epochtimes.com': 'right',
  'westernjournal.com': 'right',
  'zerohedge.com': 'right',
};

export function getBiasRating(url: string): BiasRating {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace('www.', '').toLowerCase();

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
