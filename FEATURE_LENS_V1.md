# Bias Radar — V1 Implementation Spec

> **Scope:** Minimum shippable first version  
> **Modes included:** A (Framing Comparison) + B (Technique Spotting)  
> **Modes deferred:** C, D, E (steelman, timeline, missing story — Phase 2)  
> **Stack assumption:** Next.js frontend, existing RSS feed pipeline, LLM API, n8n for automation

---

## What V1 Does

A user reads an article in The Daily Brief. They click **"Analyze with Bias Radar"**. A side panel opens with two tabs:

- **Compare** — shows the same story from up to 3 sources with different political leanings, side by side
- **Decode** — runs the article through the LLM and surfaces the top manipulation technique detected, with a quote and explanation

That's it. No accounts, no streaks, no quiz mechanics in v1. Just the two most valuable interactions, clean.

---

## UI Flow

```
Article card / detail view
└── [📡 Scan with Bias Radar] button (bottom of article)
    └── Side panel slides in (or modal on mobile)
        ├── Tab: COMPARE COVERAGE
        │   ├── Gut-check prompt (radio buttons, required)
        │   ├── Source cards (Left / Center / Right versions)
        │   └── Reflection question
        └── Tab: DECODE THIS ARTICLE
            ├── [Analyze] button → loading state → result
            ├── Technique card (name + quote + explanation)
            └── "Was this obvious to you?" thumbs feedback
```

---

## Data Flow

```
User clicks "Analyze with Bias Radar"
│
├── COMPARE tab (immediate, no API call)
│   ├── Query internal topic cluster for this article's story ID
│   ├── Fetch up to 3 articles with different bias ratings on same story
│   └── Render side-by-side cards
│
└── DECODE tab (on-demand, LLM API call)
    ├── User clicks [Analyze]
    ├── POST /api/bias-radar/decode { articleId, content }
    ├── Server calls the LLM with the technique-detection prompt
    └── Stream result back → render technique card
```

---

## File Structure

Add these to the existing Next.js project:

```
app/
└── api/
    └── bias-radar/
        └── decode/
            └── route.ts          ← LLM API call, technique detection

components/
└── bias-radar/
    ├── BiasRadarPanel.tsx             ← Main panel wrapper (tabs, open/close)
    ├── BiasRadarCompare.tsx           ← Compare tab content
    ├── BiasRadarDecode.tsx            ← Decode tab content
    ├── SourceCard.tsx            ← Single source article card
    ├── TechniqueCard.tsx         ← Technique result display
    └── GutCheck.tsx              ← Gut-check radio component

lib/
└── bias-radar/
    ├── prompts.ts                ← All LLM prompt strings (centralized)
    ├── topicCluster.ts           ← Logic to find same-story articles
    └── biasRatings.ts            ← Static AllSides bias data / lookup

types/
└── lens.ts                       ← Shared types (Technique, SourceBias, etc.)
```

---

## Types

```typescript
// types/lens.ts

export type BiasRating = 'left' | 'lean-left' | 'center' | 'lean-right' | 'right'

export interface SourceArticle {
  id: string
  title: string
  url: string
  source: string
  biasRating: BiasRating
  publishedAt: string
  excerpt: string // first 2-3 paragraphs
}

export type TechniqueName =
  | 'fear-mongering'
  | 'outrage-bait'
  | 'false-urgency'
  | 'us-vs-them'
  | 'tribal-signaling'
  | 'vague-attribution'
  | 'false-dichotomy'
  | 'anecdote-as-trend'
  | 'framing-by-omission'
  | 'headline-body-mismatch'
  | 'source-laundering'
  | 'none'

export interface TechniqueResult {
  technique: TechniqueName
  displayName: string
  evidence: string       // direct quote from article
  explanation: string    // 1-2 sentences: what + why it works
  difficulty: 'easy' | 'medium' | 'hard'
  confidence: 'high' | 'medium' | 'low'
}

export type GutCheckReaction = 'outraged' | 'skeptical' | 'interested' | 'bored'
```

---

## API Route

```typescript
// app/api/bias-radar/decode/route.ts

// Use your preferred LLM client (example shown with Anthropic SDK)
import Anthropic from '@anthropic-ai/sdk'
import { TECHNIQUE_DETECTION_PROMPT } from '@/lib/bias-radar/prompts'
import type { TechniqueResult } from '@/types/lens'

const client = new Anthropic() // swap for OpenAI, Ollama, etc.

export async function POST(req: Request) {
  const { content, headline } = await req.json()

  if (!content || !headline) {
    return Response.json({ error: 'Missing content or headline' }, { status: 400 })
  }

  const message = await client.messages.create({
    model: process.env.LLM_MODEL ?? 'claude-sonnet-4-6', // configurable
    max_tokens: 600,
    messages: [
      {
        role: 'user',
        content: TECHNIQUE_DETECTION_PROMPT
          .replace('{{HEADLINE}}', headline)
          .replace('{{CONTENT}}', content.slice(0, 3000)), // cap at ~3k chars
      },
    ],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text : ''

  try {
    // The LLM is instructed to return pure JSON — strip any accidental fences
    const clean = raw.replace(/```json|```/g, '').trim()
    const result: TechniqueResult = JSON.parse(clean)
    return Response.json(result)
  } catch {
    return Response.json({ error: 'Failed to parse LLM response', raw }, { status: 500 })
  }
}
```

---

## Prompts

```typescript
// lib/bias-radar/prompts.ts

export const TECHNIQUE_DETECTION_PROMPT = `
You are a media literacy analyst. Analyze the article below and identify the single most prominent manipulation technique present.

Choose from this exact list:
- fear-mongering
- outrage-bait
- false-urgency
- us-vs-them
- tribal-signaling
- vague-attribution
- false-dichotomy
- anecdote-as-trend
- framing-by-omission
- headline-body-mismatch
- source-laundering
- none

Respond ONLY with a valid JSON object. No preamble, no markdown fences, no commentary.

{
  "technique": "<one of the technique names above>",
  "displayName": "<human-readable label, e.g. 'Framing by Omission'>",
  "evidence": "<direct quote from the article, max 40 words, showing the technique>",
  "explanation": "<1-2 sentences: what this technique is and why it works psychologically>",
  "difficulty": "<easy|medium|hard>",
  "confidence": "<high|medium|low>"
}

If no technique is clearly present, set technique to "none" and explain in the explanation field why this appears to be straightforward reporting.

HEADLINE: {{HEADLINE}}

ARTICLE:
{{CONTENT}}
`.trim()
```

---

## Topic Clustering (Compare Tab)

V1 uses a simple heuristic — no ML required yet:

```typescript
// lib/bias-radar/topicCluster.ts

import type { SourceArticle } from '@/types/lens'

/**
 * Finds articles covering the same story as the given article.
 * V1 strategy: keyword overlap on title + published within 48h window.
 * Replace with proper clustering (embeddings) in v2.
 */
export function findRelatedArticles(
  articleId: string,
  allArticles: SourceArticle[],
  windowHours = 48,
  maxResults = 3
): SourceArticle[] {
  const target = allArticles.find((a) => a.id === articleId)
  if (!target) return []

  const targetWords = extractKeywords(target.title)
  const targetTime = new Date(target.publishedAt).getTime()
  const windowMs = windowHours * 60 * 60 * 1000

  const candidates = allArticles
    .filter((a) => {
      if (a.id === articleId) return false
      if (a.source === target.source) return false // different outlet required
      const timeDiff = Math.abs(new Date(a.publishedAt).getTime() - targetTime)
      if (timeDiff > windowMs) return false
      const overlap = keywordOverlap(targetWords, extractKeywords(a.title))
      return overlap >= 2 // at least 2 significant keywords in common
    })
    .sort((a, b) => {
      // Prefer variety across the bias spectrum
      const biasOrder: Record<string, number> = {
        left: 0, 'lean-left': 1, center: 2, 'lean-right': 3, right: 4,
      }
      return biasOrder[a.biasRating] - biasOrder[b.biasRating]
    })

  // Pick at most one per bias category
  const seen = new Set<string>()
  return candidates
    .filter((a) => {
      if (seen.has(a.biasRating)) return false
      seen.add(a.biasRating)
      return true
    })
    .slice(0, maxResults)
}

function extractKeywords(title: string): string[] {
  const stopwords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'in', 'on', 'at',
    'to', 'for', 'of', 'and', 'or', 'but', 'with', 'as', 'by', 'from',
    'that', 'this', 'it', 'its', 'be', 'have', 'has', 'had', 'not',
    'over', 'after', 'before', 'says', 'said',
  ])
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopwords.has(w))
}

function keywordOverlap(a: string[], b: string[]): number {
  const setB = new Set(b)
  return a.filter((w) => setB.has(w)).length
}
```

---

## Bias Ratings

V1 ships a small static JSON of ~50–100 common news sources. Extend as needed.

```typescript
// lib/bias-radar/biasRatings.ts

// Ratings sourced from AllSides (allsides.com), CC BY-NC 4.0
// https://www.allsides.com/media-bias/ratings

import type { BiasRating } from '@/types/lens'

const ratings: Record<string, BiasRating> = {
  'nytimes.com': 'lean-left',
  'washingtonpost.com': 'lean-left',
  'theguardian.com': 'lean-left',
  'bbc.com': 'center',
  'reuters.com': 'center',
  'apnews.com': 'center',
  'axios.com': 'center',
  'thehill.com': 'center',
  'foxnews.com': 'right',
  'nypost.com': 'lean-right',
  'wsj.com': 'lean-right',
  'economist.com': 'center',
  // Add more as your RSS feed grows
}

export function getBiasRating(url: string): BiasRating | null {
  try {
    const domain = new URL(url).hostname.replace('www.', '')
    return ratings[domain] ?? null
  } catch {
    return null
  }
}

export const BIAS_LABELS: Record<BiasRating, string> = {
  left: 'Left',
  'lean-left': 'Lean Left',
  center: 'Center',
  'lean-right': 'Lean Right',
  right: 'Right',
}

export const BIAS_COLORS: Record<BiasRating, string> = {
  left: '#2563eb',        // blue-600
  'lean-left': '#60a5fa', // blue-400
  center: '#6b7280',      // gray-500
  'lean-right': '#f87171', // red-400
  right: '#dc2626',        // red-600
}
```

---

## Components

### BiasRadarPanel.tsx

```tsx
// components/bias-radar/BiasRadarPanel.tsx
'use client'

import { useState } from 'react'
import BiasRadarCompare from './BiasRadarCompare'
import BiasRadarDecode from './BiasRadarDecode'
import type { SourceArticle } from '@/types/lens'

interface BiasRadarPanelProps {
  articleId: string
  headline: string
  content: string
  currentArticle: SourceArticle
  onClose: () => void
}

type Tab = 'compare' | 'decode'

export default function BiasRadarPanel({
  articleId,
  headline,
  content,
  currentArticle,
  onClose,
}: BiasRadarPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('compare')

  return (
    <div className="fixed inset-y-0 right-0 w-[420px] bg-white shadow-2xl flex flex-col z-50 border-l border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-lg">🔍</span>
          <span className="font-semibold text-gray-900">Bias Radar</span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100">
        {(['compare', 'decode'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'border-b-2 border-gray-900 text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'compare' ? 'Compare Coverage' : 'Decode Article'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'compare' ? (
          <BiasRadarCompare articleId={articleId} currentArticle={currentArticle} />
        ) : (
          <BiasRadarDecode headline={headline} content={content} />
        )}
      </div>
    </div>
  )
}
```

### GutCheck.tsx

```tsx
// components/bias-radar/GutCheck.tsx
'use client'

import { useState } from 'react'
import type { GutCheckReaction } from '@/types/lens'

const OPTIONS: { value: GutCheckReaction; label: string; emoji: string }[] = [
  { value: 'outraged', label: 'Outraged', emoji: '😡' },
  { value: 'skeptical', label: 'Skeptical', emoji: '🤨' },
  { value: 'interested', label: 'Interested', emoji: '🤔' },
  { value: 'bored', label: 'Bored', emoji: '😐' },
]

interface GutCheckProps {
  onComplete: (reaction: GutCheckReaction) => void
}

export default function GutCheck({ onComplete }: GutCheckProps) {
  const [selected, setSelected] = useState<GutCheckReaction | null>(null)

  function handleSelect(value: GutCheckReaction) {
    setSelected(value)
    onComplete(value)
  }

  return (
    <div className="px-5 py-4 bg-gray-50 rounded-lg mx-4 mt-4">
      <p className="text-sm text-gray-600 mb-3">
        Before we dig in — what was your gut reaction to this headline?
      </p>
      <div className="grid grid-cols-2 gap-2">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleSelect(opt.value)}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm border transition-all ${
              selected === opt.value
                ? 'border-gray-900 bg-gray-900 text-white'
                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
            }`}
          >
            <span>{opt.emoji}</span>
            <span>{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
```

### BiasRadarCompare.tsx

```tsx
// components/bias-radar/BiasRadarCompare.tsx
'use client'

import { useEffect, useState } from 'react'
import GutCheck from './GutCheck'
import SourceCard from './SourceCard'
import type { SourceArticle, GutCheckReaction } from '@/types/lens'

interface BiasRadarCompareProps {
  articleId: string
  currentArticle: SourceArticle
}

export default function BiasRadarCompare({ articleId, currentArticle }: BiasRadarCompareProps) {
  const [gutDone, setGutDone] = useState(false)
  const [gutReaction, setGutReaction] = useState<GutCheckReaction | null>(null)
  const [related, setRelated] = useState<SourceArticle[]>([])
  const [loading, setLoading] = useState(false)

  // Fetch related articles when gut check is done
  useEffect(() => {
    if (!gutDone) return
    setLoading(true)
    fetch(`/api/bias-radar/related?articleId=${articleId}`)
      .then((r) => r.json())
      .then((data) => setRelated(data.articles ?? []))
      .finally(() => setLoading(false))
  }, [gutDone, articleId])

  if (!gutDone) {
    return (
      <GutCheck
        onComplete={(reaction) => {
          setGutReaction(reaction)
          setGutDone(true)
        }}
      />
    )
  }

  return (
    <div className="px-4 py-4 space-y-4">
      {gutReaction && (
        <p className="text-xs text-gray-500">
          You felt <strong>{gutReaction}</strong>. Now let's see how different outlets covered this.
        </p>
      )}

      {/* Current article */}
      <SourceCard article={currentArticle} isMain />

      {/* Related articles */}
      {loading && (
        <p className="text-sm text-gray-400 text-center py-6">Finding other perspectives…</p>
      )}

      {!loading && related.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-6">
          No other sources found covering this story in the last 48 hours.
        </p>
      )}

      {!loading && related.map((article) => (
        <SourceCard key={article.id} article={article} />
      ))}

      {/* Reflection question */}
      {!loading && related.length > 0 && (
        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800">
            💭 <strong>Think about it:</strong> What single fact would change how you interpret this story?
          </p>
        </div>
      )}
    </div>
  )
}
```

### SourceCard.tsx

```tsx
// components/bias-radar/SourceCard.tsx
import type { SourceArticle } from '@/types/lens'
import { BIAS_LABELS, BIAS_COLORS } from '@/lib/bias-radar/biasRatings'

interface SourceCardProps {
  article: SourceArticle
  isMain?: boolean
}

export default function SourceCard({ article, isMain }: SourceCardProps) {
  const color = article.biasRating ? BIAS_COLORS[article.biasRating] : '#6b7280'
  const label = article.biasRating ? BIAS_LABELS[article.biasRating] : 'Unknown'

  return (
    <div className={`rounded-lg border p-4 space-y-2 ${isMain ? 'border-gray-900' : 'border-gray-200'}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500">{article.source}</span>
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
          style={{ backgroundColor: color }}
        >
          {label}
        </span>
      </div>
      <p className="text-sm font-medium text-gray-900 leading-snug">{article.title}</p>
      <p className="text-xs text-gray-500 line-clamp-3">{article.excerpt}</p>
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-blue-600 hover:underline"
      >
        Read full article →
      </a>
    </div>
  )
}
```

### BiasRadarDecode.tsx

```tsx
// components/bias-radar/BiasRadarDecode.tsx
'use client'

import { useState } from 'react'
import TechniqueCard from './TechniqueCard'
import type { TechniqueResult } from '@/types/lens'

interface BiasRadarDecodeProps {
  headline: string
  content: string
}

type State = 'idle' | 'loading' | 'done' | 'error'

export default function BiasRadarDecode({ headline, content }: BiasRadarDecodeProps) {
  const [state, setState] = useState<State>('idle')
  const [result, setResult] = useState<TechniqueResult | null>(null)
  const [feedback, setFeedback] = useState<'obvious' | 'surprising' | null>(null)

  async function analyze() {
    setState('loading')
    try {
      const res = await fetch('/api/bias-radar/decode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headline, content }),
      })
      if (!res.ok) throw new Error('API error')
      const data: TechniqueResult = await res.json()
      setResult(data)
      setState('done')
    } catch {
      setState('error')
    }
  }

  return (
    <div className="px-4 py-4 space-y-4">
      <p className="text-sm text-gray-600">
        This article will be analyzed for common manipulation techniques — framing choices, emotional language, logical gaps.
      </p>

      {state === 'idle' && (
        <button
          onClick={analyze}
          className="w-full py-3 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
        >
          Scan this article
        </button>
      )}

      {state === 'loading' && (
        <div className="text-center py-8 text-sm text-gray-400">Scanning…</div>
      )}

      {state === 'error' && (
        <div className="text-center py-4">
          <p className="text-sm text-red-500">Something went wrong. Try again?</p>
          <button onClick={analyze} className="mt-2 text-sm underline text-gray-600">
            Retry
          </button>
        </div>
      )}

      {state === 'done' && result && (
        <>
          <TechniqueCard result={result} />

          {/* Feedback */}
          {!feedback && (
            <div className="pt-2">
              <p className="text-xs text-gray-500 mb-2">Was this obvious to you before you read the analysis?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setFeedback('obvious')}
                  className="flex-1 py-2 text-xs border border-gray-200 rounded-md hover:bg-gray-50"
                >
                  👍 I saw it
                </button>
                <button
                  onClick={() => setFeedback('surprising')}
                  className="flex-1 py-2 text-xs border border-gray-200 rounded-md hover:bg-gray-50"
                >
                  💡 Didn't notice
                </button>
              </div>
            </div>
          )}

          {feedback === 'surprising' && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-md p-3">
              That's the point — these techniques work <em>because</em> they're subtle. You'll spot it faster next time.
            </p>
          )}
        </>
      )}
    </div>
  )
}
```

### TechniqueCard.tsx

```tsx
// components/bias-radar/TechniqueCard.tsx
import type { TechniqueResult } from '@/types/lens'

const DIFFICULTY_STYLES = {
  easy: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  hard: 'bg-red-100 text-red-700',
}

interface TechniqueCardProps {
  result: TechniqueResult
}

export default function TechniqueCard({ result }: TechniqueCardProps) {
  if (result.technique === 'none') {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-2">
        <p className="text-sm font-semibold text-green-800">✅ No major technique detected</p>
        <p className="text-sm text-green-700">{result.explanation}</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-gray-200 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Technique detected</p>
          <p className="text-base font-semibold text-gray-900">{result.displayName}</p>
        </div>
        <span className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${DIFFICULTY_STYLES[result.difficulty]}`}>
          {result.difficulty}
        </span>
      </div>

      {/* Evidence quote */}
      <blockquote className="border-l-4 border-gray-300 pl-3 italic text-sm text-gray-600">
        "{result.evidence}"
      </blockquote>

      {/* Explanation */}
      <p className="text-sm text-gray-700">{result.explanation}</p>
    </div>
  )
}
```

---

## Related Articles API Route

```typescript
// app/api/bias-radar/related/route.ts

import { NextRequest } from 'next/server'
import { getAllArticles } from '@/lib/feed' // your existing feed data access
import { findRelatedArticles } from '@/lib/bias-radar/topicCluster'
import { getBiasRating } from '@/lib/bias-radar/biasRatings'
import type { SourceArticle } from '@/types/lens'

export async function GET(req: NextRequest) {
  const articleId = req.nextUrl.searchParams.get('articleId')
  if (!articleId) {
    return Response.json({ error: 'Missing articleId' }, { status: 400 })
  }

  const allRaw = await getAllArticles() // returns your existing article objects

  // Map to SourceArticle shape, attach bias ratings
  const allArticles: SourceArticle[] = allRaw.map((a) => ({
    id: a.id,
    title: a.title,
    url: a.url,
    source: a.source,
    biasRating: getBiasRating(a.url) ?? 'center',
    publishedAt: a.publishedAt,
    excerpt: a.content?.slice(0, 400) ?? '',
  }))

  const related = findRelatedArticles(articleId, allArticles)

  return Response.json({ articles: related })
}
```

---

## Entry Point: Adding the Button to Article Cards

In your existing article card or detail component, add:

```tsx
// Somewhere in your article detail or card component

import { useState } from 'react'
import BiasRadarPanel from '@/components/bias-radar/BiasRadarPanel'
import { getBiasRating } from '@/lib/bias-radar/biasRatings'
import type { SourceArticle } from '@/types/lens'

// Inside your component:
const [lensOpen, setLensOpen] = useState(false)

const thisArticle: SourceArticle = {
  id: article.id,
  title: article.title,
  url: article.url,
  source: article.source,
  biasRating: getBiasRating(article.url) ?? 'center',
  publishedAt: article.publishedAt,
  excerpt: article.content?.slice(0, 400) ?? '',
}

// In the JSX:
<button
  onClick={() => setLensOpen(true)}
  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
>
  <span>📡</span>
  <span>Analyze with Bias Radar</span>
</button>

{lensOpen && (
  <BiasRadarPanel
    articleId={article.id}
    headline={article.title}
    content={article.content ?? ''}
    currentArticle={thisArticle}
    onClose={() => setLensOpen(false)}
  />
)}
```

---

## Environment Variables

Add to `.env.local`:

```bash
# Set whichever key your chosen LLM provider requires
LLM_MODEL=claude-sonnet-4-6   # or gpt-4o, etc.
ANTHROPIC_API_KEY=sk-ant-...  # if using Anthropic
```

No new services required for V1.

---

## What V1 Does NOT Include

Deliberately deferred:

| Feature | Why deferred |
|---------|-------------|
| Steelmanning (Mode C) | Needs more complex UI + user input flow |
| Timeline check (Mode D) | Needs article history storage schema |
| Missing story digest (Mode E) | Needs n8n workflow + separate Telegram card template |
| User streaks / collections | Needs auth + persistent user state |
| Technique quiz (blind prediction) | Good for v2; v1 just shows the result |
| AllSides API integration | Static lookup table sufficient for v1 |
| Local LLM for Decode | Test quality first with frontier model, then migrate |

---

## Definition of Done for V1

- [ ] `BiasRadarPanel` opens from any article and closes cleanly
- [ ] `Compare` tab shows gut-check → loads same-story articles with bias labels
- [ ] `Compare` tab shows "no related articles" gracefully when clustering finds nothing
- [ ] `Decode` tab calls `/api/bias-radar/decode` and renders technique card
- [ ] `Decode` tab handles API error with retry option
- [ ] `none` technique result renders as a "clean article" positive card
- [ ] Mobile: panel renders as a bottom sheet or full-screen modal
- [ ] Bias rating attribution note visible somewhere in the UI (AllSides CC BY-NC 4.0)
- [ ] No console errors in production build
