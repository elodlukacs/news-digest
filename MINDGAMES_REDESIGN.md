# MindGames Redesign Plan

## Goals

1. Make the UI feel engaging and approachable, not academic or geeky
2. Fix the navigation — wrong colors, unclear labels, poor mobile UX
3. Redesign the BiasRadarPanel slide-in (better mobile, better structure)
4. Improve the Overview/home tab with onboarding and better copy
5. Plain-language rewrites throughout

---

## Phase 1 — Navigation (CognitiveTabNav)

**File:** `client/src/features/mindgames/dashboard/CognitiveTabNav.tsx`

### 1.1 Rename tab labels

Replace academic labels with action-oriented language:

| Current `label` | New `label` | Current `shortLabel` | New `shortLabel` |
|---|---|---|---|
| Overview | Today | Home | Today |
| Training | Spot It | Train | Spot It |
| Analysis | Dissect | Analyze | Dissect |
| Reflection | Think Harder | Reflect | Think |
| Reference | Playbook | Library | Playbook |
| Daily Quiz | Daily Challenge | Quiz | Challenge |

### 1.2 Fix active tab color

Current active state uses `bg-masthead text-white` — same as the site header masthead, which makes tabs look like they are part of the header chrome.

Replace active state class on both the mobile grid buttons and the desktop inline buttons:

```
Before: bg-masthead text-white shadow-sm
After:  bg-paper text-ink shadow-sm border border-rule
```

And add a colored left-border accent to the active tab so it has personality without competing with the header:

```
After (desktop): bg-paper text-ink shadow-sm border border-rule relative
  + add a 3px bottom border in a feature-specific color (e.g. var(--color-observation))
```

Use `border-b-[3px] border-observation` for the active underline instead of a filled background.

### 1.3 Mobile: convert to sticky bottom navigation bar

The current 3-column grid at the top of the page is hard to reach on phones (thumb zone is at the bottom) and uses `bg-masthead` which looks like a secondary header.

Replace the `md:hidden` grid with a **fixed bottom nav bar**:

```tsx
<nav className="fixed bottom-0 inset-x-0 z-30 md:hidden bg-paper border-t border-rule
                flex items-stretch h-16 safe-area-pb">
  {TABS.map(tab => (
    <button className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px]
                       font-semibold transition-colors
                       active:bg-paper-dark
                       [&.active]:text-observation text-ink-muted">
      {tab.icon}
      <span>{tab.shortLabel}</span>
    </button>
  ))}
</nav>
```

Also add `pb-16` to `CognitiveDashboard`'s wrapper div when on mobile so content isn't hidden behind the nav bar.

Icons to update to match the new labels (import from lucide-react — all already available):
- Today: `Home` (replace `Shield`)
- Spot It: `Target` (keep)
- Dissect: `Scissors` (replace `Search`)
- Think Harder: `Microscope` (keep)
- Playbook: `BookOpen` (keep)
- Daily Challenge: `Zap` (keep)

---

## Phase 2 — BiasRadarPanel Redesign

**File:** `client/src/features/mindgames/bias-radar/BiasRadarPanel.tsx`

### 2.1 Rename "Challenge Me" tab

In the `TAB_LABELS` constant:

```ts
// Before
steelman: 'Challenge Me',

// After
steelman: 'Steelman',
```

### 2.2 Show headline in the panel header

After the title row (`Bias Radar` + close button), add the article headline so users don't lose context:

```tsx
{/* After the existing header div */}
<div className="px-5 py-3 border-b border-rule bg-paper-dark">
  <p className="text-[13px] font-serif font-semibold text-ink line-clamp-2 leading-snug">
    {headline}
  </p>
  <p className="text-[11px] text-ink-muted mt-0.5">{sourceName}</p>
</div>
```

### 2.3 Tab overflow — make primary tabs more discoverable

The current `overflow-x-auto` on the tab row hides Timeline and Diet Report unless you scroll horizontally — not discoverable.

Split tabs into **3 primary + a "More" dropdown**:

```ts
const PRIMARY_TABS: Tab[] = ['compare', 'decode', 'steelman'];
const SECONDARY_TABS: Tab[] = ['timeline', 'diet'];
```

Render the 3 primary tabs normally. Add a `More ▾` button at the end that opens a small dropdown menu listing the secondary tabs.

When a secondary tab is active, show its label in place of the "More" button (so the user can always see what's active).

### 2.4 Mobile: bottom sheet instead of right-side panel

On screens narrower than `md` (768px), the panel should slide up from the bottom instead of from the right. This matches native mobile UX conventions (iOS/Android sheets).

**Changes:**

Add responsive class logic to the panel wrapper:

```tsx
// Desktop: right-side panel (existing behavior)
// Mobile: bottom sheet

className={`
  fixed z-50 bg-paper shadow-2xl flex flex-col border-rule

  /* Mobile: bottom sheet */
  inset-x-0 bottom-0 rounded-t-2xl border-t max-h-[90dvh]

  /* Desktop: right panel */
  md:inset-y-0 md:right-0 md:bottom-auto md:rounded-none
  md:w-full md:max-w-[560px] md:border-l md:border-t-0 md:max-h-full

  panel-slide-in
`}
```

Add a drag handle indicator at the top of the mobile sheet:

```tsx
{/* Mobile drag handle — hidden on desktop */}
<div className="md:hidden flex justify-center pt-3 pb-1">
  <div className="w-10 h-1 rounded-full bg-rule" />
</div>
```

Update `panel-slide-in` animation in `index.css` to have two variants:
- Desktop: `translateX(100%) → translateX(0)` (existing, keep as-is for `md:`)
- Mobile: `translateY(100%) → translateY(0)`

```css
/* Add to index.css */
@keyframes slideUp {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}

/* Mobile bottom sheet animation */
.panel-slide-in {
  animation: slideUp 0.25s ease-out;
}

/* Desktop right-panel animation */
@media (min-width: 768px) {
  .panel-slide-in {
    animation: panel-slide-in 0.25s ease-out;
  }
}
```

---

## Phase 3 — Overview Tab Improvements

**File:** `client/src/features/mindgames/overview/OverviewTab.tsx`

### 3.1 Empty state for new users

When `stats` is null or all counts are 0, show an onboarding card instead of the stats grid:

```tsx
const isNewUser = !stats || (
  stats.forensicCount === 0 &&
  stats.inoculationSessions === 0 &&
  stats.journalEntries === 0 &&
  stats.auditCount === 0
);
```

If `isNewUser`, replace the stats section with:

```tsx
<div className="rounded-xl border border-rule bg-paper-dark p-6 text-center space-y-4">
  <p className="text-[15px] font-serif font-semibold text-ink">
    Welcome to MindGames
  </p>
  <p className="text-[13px] text-ink-muted max-w-md mx-auto">
    Practice spotting manipulation, analyze news critically, and track how your
    thinking evolves over time. Pick a starting point below.
  </p>
  <div className="flex flex-wrap justify-center gap-2 pt-2">
    <button onClick={() => navigate('/mindgames/quiz')} className="...">
      Take today's challenge →
    </button>
    <button onClick={() => setStressDiagOpen(true)} className="...">
      Check your reading mood →
    </button>
    <button onClick={() => navigate('/mindgames/training')} className="...">
      Start training →
    </button>
  </div>
</div>
```

### 3.2 Copy rewrites

| Current | Replacement |
|---|---|
| `title="Your Mental Antibody Journey"` | `title="Getting Harder to Fool"` |
| `description="Build psychological defenses against misinformation through interactive training, analysis, and reflection exercises."` | `description="Practice spotting manipulation, challenge your own beliefs, and see how your thinking changes over time."` |
| `title="Stress Check"` | `title="Reading Mood"` |
| `description="Evaluate your cognitive state before reading"` | `description="How sharp is your guard today?"` |
| `title="Start Training"` | `title="Spot It"` |
| `description="Build mental antibodies"` | `description="Can you catch the manipulation?"` |
| `title="Analyze Content"` | `title="Dissect an Article"` |
| `description="Deconstruct news and studies"` | `description="Pull apart a piece of writing"` |
| `title="Reflect"` | `title="Think Harder"` |
| `description="Examine your beliefs"` | `description="Debate yourself and find common ground"` |
| StatCard label `"Analyses"` | `"Articles dissected"` |
| StatCard label `"Inoculations"` | `"Training rounds"` |
| StatCard label `"Debates"` | `"Beliefs challenged"` |
| StatCard label `"Audits"` | `"Echo chamber checks"` |
| sub `"Best: trolling"` → | `"Reached: trolling level"` |
| sub `"Avg silo: X/10"` | `"Echo score: X/10"` |
| sub `"Avg shift: X%"` | `"Avg mind-shift: X%"` |

### 3.3 Add Daily Challenge card to Overview

Add a 5th quick-action card that links to the quiz — making it the most prominent call-to-action (place it first in the grid):

```tsx
<QuickActionCard
  icon={<Zap size={20} className="text-curiosity" />}
  title="Today's Challenge"
  description="1 headline — spot the trick"
  onClick={() => navigate('/mindgames/quiz')}
  highlight  // new optional prop that adds a subtle colored border
/>
```

Add an optional `highlight` prop to `QuickActionCard` that adds `border-curiosity` to the card border when true.

Change the grid to `grid-cols-2 md:grid-cols-3 lg:grid-cols-5` to fit 5 cards.

---

## Phase 4 — Plain Language Rewrites (Other Components)

These are copy-only changes — no structural edits.

### 4.1 `training/InoculationPanel.tsx`

| Current | Replacement |
|---|---|
| Section heading "Inoculation Lab" | "Spot the Trick" |
| Mode "Detective Mode" | "Catch It" |
| Mode "CDO Mode — Chief Disinformation Officer" | "Write It Yourself" |
| Description of CDO mode | "Understanding how manipulation is crafted makes you better at spotting it." |
| "Mental antibodies" (keep — it's a good metaphor, explained in context) | keep |
| Level names: `trolling → emotional → amplification → escalation` | keep (they're meaningful) |

### 4.2 `analysis/ForensicPanel.tsx`

| Current | Replacement |
|---|---|
| Panel title "Forensic Panel" | "Take Apart This Article" |
| Tab "Forensic" | "Analyze" |
| "Emotional intensity" metric label | "Emotional charge" |
| "Sales funnel stage" | "Persuasion technique" |

### 4.3 `reflection/BridgePanel.tsx`

| Current | Replacement |
|---|---|
| Sub-tab "SOS Audit" | "Echo Chamber Check" |
| "Siloing score" (everywhere) | "Echo score" |
| Sub-tab "Bridge Builder" | "Find Common Ground" |
| Sub-tab "Information Diet" | "My News Sources" |

### 4.4 `reflection/ScientistPanel.tsx`

Keep the Preacher / Prosecutor / Politician / Scientist mode names — they are from Adam Grant's *Think Again* and are engaging once explained. But add a short one-line tooltip or label under the mode badge explaining each:

- Scientist: "Open to evidence"
- Preacher: "Certain of the truth"
- Prosecutor: "Attacking the other side"
- Politician: "Seeking approval"

### 4.5 `reflection/StressDiagnostic.tsx`

| Current | Replacement |
|---|---|
| Dialog title "Cognitive Vulnerability Assessment" | "How Sharp Is Your Guard Today?" |
| "Cognitive vulnerability" label | "Reading guard" |
| Risk level "Medium cognitive vulnerability" | "Moderate — worth being aware" |

---

## Phase 5 — Dashboard Layout Tweak

**File:** `client/src/features/mindgames/dashboard/CognitiveDashboard.tsx`

Add bottom padding on mobile to account for the new fixed bottom nav bar:

```tsx
<div className="max-w-[1600px] mx-auto px-3 md:px-4 pb-20 md:pb-12">
```

(`pb-20` = 80px, enough to clear the `h-16` bottom nav + safe area)

---

## Implementation Order

| # | Task | File(s) | Effort |
|---|---|---|---|
| 1 | Rename tab labels + fix active color | `CognitiveTabNav.tsx` | Small |
| 2 | Mobile bottom nav bar | `CognitiveTabNav.tsx`, `CognitiveDashboard.tsx` | Medium |
| 3 | BiasRadarPanel: rename tab + show headline | `BiasRadarPanel.tsx` | Small |
| 4 | BiasRadarPanel: primary tabs + More dropdown | `BiasRadarPanel.tsx` | Medium |
| 5 | BiasRadarPanel: mobile bottom sheet | `BiasRadarPanel.tsx`, `index.css` | Medium |
| 6 | OverviewTab: empty state + copy rewrites | `OverviewTab.tsx` | Small |
| 7 | OverviewTab: add Daily Challenge card | `OverviewTab.tsx` | Small |
| 8 | Copy rewrites in other panels | `InoculationPanel.tsx`, `ForensicPanel.tsx`, `BridgePanel.tsx`, `ScientistPanel.tsx`, `StressDiagnostic.tsx` | Small |

Total estimated scope: ~5-6 focused editing sessions, no new files needed, no backend changes.
