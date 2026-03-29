# Bias Radar — Implementation Roadmap

> **Project:** The Daily Brief  
> **Feature:** Bias Radar (critical thinking & media literacy layer)  
> **Created:** 2026-03-28

This folder contains one `.md` file per implementation step. Execute them in order within each phase. Steps within the same phase can be parallelised if needed.

---

## Phase Map

```
Phase 1 — V1 Foundation & Core (ship this first)
├── STEP_01  Shared Types                              ✅ DONE
├── STEP_02  Bias Ratings Lookup                       ✅ DONE
├── STEP_03  Topic Clustering                          ✅ DONE
├── STEP_04  LLM Prompts                               ✅ DONE
├── STEP_05  API Routes (decode + related)             ✅ DONE
├── STEP_06  GutCheck & SourceCard components          ✅ DONE
├── STEP_07  BiasRadarCompare (Compare tab)            ✅ DONE
├── STEP_08  TechniqueCard & BiasRadarDecode (Decode tab) ✅ DONE
└── STEP_09  BiasRadarPanel + Entry Point Integration  ✅ DONE

Phase 2 — Depth Layer (after V1 is stable)
├── STEP_10  Mode C — Steelmanning (Challenge Me tab)
└── STEP_11  Mode E — Weekly Missing Story (n8n + Telegram)

Phase 3 — Habit & Advanced (after Phase 2)
├── STEP_12  Mode D — Timeline Check (article history required)
├── STEP_13  Mode B V2 — Blind Prediction Quiz + Daily Quiz page
└── STEP_14  Mode F — Weekly Media Diet Report
```

---

## Step Reference Table

| Step | File | Phase | Effort | Output |
|------|------|-------|--------|--------|
| 01 | `STEP_01_types.md` | 1 | 15 min | `types/bias-radar.ts` |
| 02 | `STEP_02_bias_ratings.md` | 1 | 20 min | `lib/bias-radar/biasRatings.ts` |
| 03 | `STEP_03_topic_cluster.md` | 1 | 30 min | `lib/bias-radar/topicCluster.ts` |
| 04 | `STEP_04_prompts.md` | 1 | 20 min | `lib/bias-radar/prompts.ts` |
| 05 | `STEP_05_api_routes.md` | 1 | 30 min | `app/api/bias-radar/decode/route.ts` + `related/route.ts` |
| 06 | `STEP_06_gutcheck_sourcecard.md` | 1 | 25 min | `components/bias-radar/GutCheck.tsx` + `SourceCard.tsx` |
| 07 | `STEP_07_compare_tab.md` | 1 | 30 min | `components/bias-radar/BiasRadarCompare.tsx` |
| 08 | `STEP_08_decode_tab.md` | 1 | 30 min | `components/bias-radar/TechniqueCard.tsx` + `BiasRadarDecode.tsx` |
| 09 | `STEP_09_panel_entrypoint.md` | 1 | 30 min | `components/bias-radar/BiasRadarPanel.tsx` + article integration |
| 10 | `STEP_10_steelman_mode_c.md` | 2 | 2–3 h | Steelman API + `BiasRadarSteelman.tsx` + new tab |
| 11 | `STEP_11_missing_story_n8n.md` | 2 | 2 h | Missing story API + n8n workflow |
| 12 | `STEP_12_timeline_mode_d.md` | 3 | 4–5 h | DB schema + timeline API + `BiasRadarTimeline.tsx` |
| 13 | `STEP_13_technique_quiz_v2.md` | 3 | 2 h | `TechniquePicker.tsx` + blind prediction + daily quiz page |
| 14 | `STEP_14_diet_report.md` | 3 | 2–3 h | Diet report API + `DietReport.tsx` |

**Phase 1 total: ~3.5 hours**  
**Phase 2 total: ~4–5 hours**  
**Phase 3 total: ~9–11 hours**

---

## Final File Tree (all phases complete)

```
app/
├── api/
│   └── bias-radar/
│       ├── decode/route.ts
│       ├── related/route.ts
│       ├── steelman/route.ts
│       ├── missing-story/route.ts
│       ├── timeline/route.ts
│       └── diet-report/route.ts
└── daily-quiz/
    ├── page.tsx
    └── DailyQuizClient.tsx

components/
└── bias-radar/
    ├── BiasRadarPanel.tsx
    ├── BiasRadarCompare.tsx
    ├── BiasRadarDecode.tsx
    ├── BiasRadarSteelman.tsx
    ├── BiasRadarTimeline.tsx
    ├── GutCheck.tsx
    ├── SourceCard.tsx
    ├── TechniqueCard.tsx
    ├── TechniquePicker.tsx
    └── DietReport.tsx

lib/
└── bias-radar/
    ├── biasRatings.ts
    ├── topicCluster.ts
    └── prompts.ts

types/
└── bias-radar.ts

n8n/
└── bias-radar-missing-story.workflow.json
```

---

## Dependency Graph

```
types ──────────────────────────────────────────────────┐
                                                         │
biasRatings ────────────────────────────────────────┐   │
                                                     │   │
topicCluster (depends on: types, biasRatings) ───┐  │   │
                                                  │  │   │
prompts (depends on: types) ──────────────────┐  │  │   │
                                              │  │  │   │
API routes (depend on: all lib) ───────────┐  │  │  │   │
                                           │  │  │  │   │
GutCheck, SourceCard (depend on: types) ─┐ │  │  │  │   │
                                         │ │  │  │  │   │
BiasRadarCompare (depends on: ^) ──────┐ │ │  │  │  │   │
BiasRadarDecode (depends on: ^) ───────┤ │ │  │  │  │   │
                                       │ │ │  │  │  │   │
BiasRadarPanel (depends on: all ──────-┘-┘-┘──┘──┘──┘───┘
  components above)
```

---

## Mode → Feature → Step Mapping

| Mode | Feature | Steps |
|------|---------|-------|
| A | Compare Coverage (source comparison) | 01–03, 05–07, 09 |
| B V1 | Decode Article (show result) | 01, 04–05, 08–09 |
| B V2 | Blind Prediction + Daily Quiz | 13 |
| C | Steelmanning (Challenge Me) | 04, 10 |
| D | Timeline Check | 04, 12 |
| E | Weekly Missing Story | 04, 11 |
| F | Media Diet Report | 14 |

---

## Key Design Invariants (don't break these)

1. **User commits before seeing analysis.** The gut-check (Compare) and blind prediction (Decode V2) must always come first. This is the core pedagogical mechanism.

2. **LLM analysis is about craft, not truth.** The feature never declares an article "wrong" or "false" — only describes rhetorical technique. This is essential for political neutrality.

3. **Generic LLM calls.** All API routes use `process.env.LLM_MODEL` — no hardcoded model strings in components or routes. Provider can be swapped without touching UI code.

4. **Graceful empty states everywhere.** Clustering, timeline, and diet report all have paths that return no data. Every one of these must render a calm, non-alarming message — not a broken state.

5. **AllSides attribution.** Must appear in any UI that displays bias ratings. CC BY-NC 4.0 requires attribution for non-commercial use.
