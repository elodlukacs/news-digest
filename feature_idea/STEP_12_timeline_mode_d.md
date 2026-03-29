# Step 12 — Mode D: Timeline Check (Disinformation Forensics)

> **Phase:** 3 — Advanced  
> **Effort:** ~4–5 hours  
> **Depends on:** Steps 01–09 (V1), article history storage  
> **Output:** DB schema addition, `app/api/bias-radar/timeline/route.ts`, `components/bias-radar/BiasRadarTimeline.tsx`

---

## What & Why

Mode D teaches **narrative drift awareness** — how stories evolve, shift framing, and sometimes quietly contradict earlier reporting from the same outlet. This is one of the most underrated disinformation vectors: stories don't start false, they drift through selective updates and omitted corrections.

This is the most technically complex mode because it requires **article history storage** per topic. Build this only after topic clustering is solid and you have at least a few weeks of article history.

---

## Prerequisites

Before building this step:
- [ ] Topic clustering (Step 03) is in production and grouping articles reliably
- [ ] Articles have been stored with `topicId` or a similar cluster key for at least 2–4 weeks
- [ ] You have a database (Postgres, SQLite, or similar) accessible from the Next.js API

---

## Database Schema Addition

Add to your existing articles table (or create a new one):

```sql
-- Add to articles table if not already present
ALTER TABLE articles ADD COLUMN IF NOT EXISTS topic_id TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS body_text TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS stored_at TIMESTAMPTZ DEFAULT NOW();

-- Index for fast topic lookups
CREATE INDEX IF NOT EXISTS idx_articles_topic_id ON articles(topic_id);
CREATE INDEX IF NOT EXISTS idx_articles_source_topic ON articles(source, topic_id, published_at);
```

### Article ingestion update

When your RSS fetcher stores articles, also assign and store `topic_id` using the clustering logic:

```typescript
// In your RSS ingestion pipeline (n8n function node or Next.js cron):
import { extractKeywords } from '@/lib/bias-radar/topicCluster'

// Simple topic_id: sorted canonical keywords joined
function deriveTopicId(title: string): string {
  return extractKeywords(title).sort().slice(0, 5).join('-')
}

// When storing each article:
const topicId = deriveTopicId(article.title)
await db.article.upsert({
  where: { url: article.url },
  create: { ...article, topicId, bodyText: article.content },
  update: { bodyText: article.content },
})
```

---

## API Route

### `app/api/bias-radar/timeline/route.ts`

```typescript
import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { TIMELINE_CHECK_PROMPT } from '@/lib/bias-radar/prompts'
import { db } from '@/lib/db'  // your db client

const llm = new Anthropic()

export interface TimelineEntry {
  articleId: string
  source: string
  publishedAt: string
  title: string
  excerpt: string
}

export interface TimelineResult {
  framingShift: string        // how framing changed over time
  claimEvolution: string      // claims that were revised or dropped
  inconsistency: string       // conflicts between earlier/current coverage
  significance: string        // why the shift matters (1-2 sentences)
  entries: TimelineEntry[]    // the articles analyzed, chronological
}

export async function GET(req: NextRequest) {
  const articleId = req.nextUrl.searchParams.get('articleId')
  if (!articleId) {
    return Response.json({ error: 'articleId required' }, { status: 400 })
  }

  // Fetch the current article
  const current = await db.article.findUnique({ where: { id: articleId } })
  if (!current) {
    return Response.json({ error: 'Article not found' }, { status: 404 })
  }

  if (!current.topicId) {
    return Response.json({ error: 'Article has no topic cluster', code: 'NO_CLUSTER' }, { status: 422 })
  }

  // Fetch historical articles on same topic from same source, last 60 days
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
  const historical = await db.article.findMany({
    where: {
      topicId: current.topicId,
      source: current.source,
      publishedAt: { gte: sixtyDaysAgo },
      id: { not: articleId },
    },
    orderBy: { publishedAt: 'asc' },
    take: 10,
  })

  if (historical.length === 0) {
    return Response.json({
      result: null,
      note: 'No historical coverage found for this story from the same source.',
    })
  }

  // Build chronological article list for the prompt
  const allArticles = [...historical, current].sort(
    (a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()
  )

  const articlesText = allArticles
    .map(
      (a, i) =>
        `[Article ${i + 1} — ${a.publishedAt.slice(0, 10)}]\nHeadline: ${a.title}\nExcerpt: ${(a.bodyText ?? '').slice(0, 400)}`
    )
    .join('\n\n---\n\n')

  const prompt = TIMELINE_CHECK_PROMPT
    .replace('{{STORY_TOPIC}}', current.topicId)
    .replace('{{CURRENT_ARTICLE}}', `${current.title}\n\n${(current.bodyText ?? '').slice(0, 800)}`)
    .replace('{{PREVIOUS_ARTICLES}}', articlesText)

  // Call LLM
  let raw = ''
  try {
    const message = await llm.messages.create({
      model: process.env.LLM_MODEL ?? 'claude-sonnet-4-6',
      max_tokens: 700,
      messages: [{ role: 'user', content: prompt }],
    })
    raw = message.content[0].type === 'text' ? message.content[0].text : '{}'
  } catch (err) {
    console.error('[bias-radar/timeline] LLM call failed:', err)
    return Response.json({ error: 'LLM request failed' }, { status: 502 })
  }

  try {
    const clean = raw.replace(/```json|```/g, '').trim()
    const analysis = JSON.parse(clean)

    const entries: TimelineEntry[] = allArticles.map((a) => ({
      articleId: a.id,
      source: a.source,
      publishedAt: a.publishedAt,
      title: a.title,
      excerpt: (a.bodyText ?? '').slice(0, 200),
    }))

    const result: TimelineResult = { ...analysis, entries }
    return Response.json({ result })
  } catch {
    return Response.json({ error: 'Failed to parse LLM response', raw }, { status: 500 })
  }
}
```

---

## Add Timeline Prompt to prompts.ts

Add to `lib/bias-radar/prompts.ts`:

```typescript
// ─── v1.0 — Timeline / Narrative Drift Analysis (Mode D) ─────────────────────

export const TIMELINE_CHECK_PROMPT = `
You are analyzing how coverage of a specific story has evolved over time from the same news outlet.

STORY TOPIC: {{STORY_TOPIC}}

PREVIOUS ARTICLES (chronological, oldest first):
{{PREVIOUS_ARTICLES}}

CURRENT ARTICLE:
{{CURRENT_ARTICLE}}

Identify how the story's framing has shifted. Respond ONLY with a valid JSON object.

{
  "framingShift": "<How has the angle, tone, or central narrative changed from earliest to most recent coverage? 2-3 sentences.>",
  "claimEvolution": "<Have specific claims been revised, dropped, or quietly updated? Quote both the original and revised version if found. If none: 'No significant claim changes detected.'>",
  "inconsistency": "<Does the current framing conflict with how the outlet covered similar events previously? Be specific. If none: 'No inconsistency detected.'>",
  "significance": "<In 1-2 sentences: why does this shift matter for how readers should interpret the current story?>"
}

Rules:
- Quote the articles directly when referencing specific language.
- Distinguish between legitimate updates-as-facts-emerge vs. unexplained framing shifts.
- If the coverage is consistent and the story simply developed naturally, say so clearly.
- Do NOT speculate about editorial intent — describe what changed, not why.
`.trim()
```

---

## Component

### `components/bias-radar/BiasRadarTimeline.tsx`

```tsx
'use client'

import { useEffect, useState } from 'react'
import type { TimelineResult } from '@/app/api/bias-radar/timeline/route'

interface BiasRadarTimelineProps {
  articleId: string
}

type LoadState = 'loading' | 'done' | 'error' | 'no-history' | 'no-cluster'

export default function BiasRadarTimeline({ articleId }: BiasRadarTimelineProps) {
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [result, setResult] = useState<TimelineResult | null>(null)

  useEffect(() => {
    fetch(`/api/bias-radar/timeline?articleId=${encodeURIComponent(articleId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          if (data.code === 'NO_CLUSTER') { setLoadState('no-cluster'); return }
          setLoadState('error'); return
        }
        if (!data.result) { setLoadState('no-history'); return }
        setResult(data.result)
        setLoadState('done')
      })
      .catch(() => setLoadState('error'))
  }, [articleId])

  if (loadState === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-sm text-gray-400">
        <span className="animate-pulse text-2xl mb-3">⏱️</span>
        Checking story history…
      </div>
    )
  }

  if (loadState === 'no-cluster') {
    return (
      <div className="px-4 py-6 text-center text-sm text-gray-400">
        This article hasn't been grouped into a topic cluster yet.
        <br />
        The timeline check needs a few weeks of stored history to work.
      </div>
    )
  }

  if (loadState === 'no-history') {
    return (
      <div className="px-4 py-6 text-center text-sm text-gray-400">
        No earlier coverage found from this source on this story.
        <br />
        Timeline check works best on ongoing stories covered over multiple days.
      </div>
    )
  }

  if (loadState === 'error') {
    return (
      <div className="px-4 py-6 text-center text-sm text-red-500">
        Could not load timeline data.
      </div>
    )
  }

  if (!result) return null

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Timeline entries */}
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
          Coverage history ({result.entries.length} articles)
        </p>
        {result.entries.map((entry, i) => (
          <div key={entry.articleId} className="flex gap-3 items-start">
            <div className="flex flex-col items-center">
              <div className="h-2.5 w-2.5 rounded-full bg-gray-300 mt-1" />
              {i < result.entries.length - 1 && (
                <div className="w-px flex-1 bg-gray-200 my-1" />
              )}
            </div>
            <div className="pb-3">
              <p className="text-xs text-gray-400">{entry.publishedAt.slice(0, 10)}</p>
              <p className="text-sm text-gray-700 leading-snug">{entry.title}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Analysis blocks */}
      {[
        { label: 'Framing shift', value: result.framingShift },
        { label: 'Claim evolution', value: result.claimEvolution },
        { label: 'Inconsistency', value: result.inconsistency },
      ].map(({ label, value }) => (
        <div key={label} className="rounded-lg border border-gray-200 px-4 py-3 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
          <p className="text-sm text-gray-700 leading-relaxed">{value}</p>
        </div>
      ))}

      {/* Significance callout */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-500 mb-1">
          Why this matters
        </p>
        <p className="text-sm text-amber-800">{result.significance}</p>
      </div>
    </div>
  )
}
```

---

## Add "Timeline" Tab to Panel

In `BiasRadarPanel.tsx`:

```tsx
const TABS = [
  { id: 'compare'  as const, label: 'Compare'      },
  { id: 'decode'   as const, label: 'Decode'        },
  { id: 'steelman' as const, label: 'Challenge Me'  },
  { id: 'timeline' as const, label: 'Timeline'      },
]

type Tab = 'compare' | 'decode' | 'steelman' | 'timeline'

// In content section:
{activeTab === 'timeline' && (
  <BiasRadarTimeline articleId={articleId} />
)}
```

---

## Checklist

- [x] `topic_id` and `body_text` columns exist in articles table
- [x] RSS ingestion assigns `topic_id` to every new article
- [ ] At least 2 weeks of history stored before testing
- [x] Route handles `NO_CLUSTER` case with `422` and `code` field
- [x] Route returns `{ result: null }` (not error) when no historical articles exist
- [x] Timeline entries render in chronological order
- [x] Empty state messages are clear and non-alarming
- [x] "Timeline" tab appears in panel
