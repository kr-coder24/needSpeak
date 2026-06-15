## Goal

Overhaul `src/routes/watchlist.tsx` so it feels as clean as the rest of the app: one chart, compact cards that reveal detail on hover, and a strict neutral palette — without losing any data.

## Color scheme (strict)

Remove every ad-hoc emerald/orange/amber/red tint used today (`bg-emerald-500/8`, `from-emerald-500/12 ... to-orange-500/10`, green/orange/red status badges, colored CO2 icon, orange `ReferenceLine`, etc.).

Use only the existing tokens already used by the rest of the site:
- surfaces: `bg-background`, `bg-card`, `bg-surface`
- borders: `border-border`
- text: `text-foreground`, `text-muted-foreground`
- accent: `text-brand` / `bg-brand` (sparingly, for the one selected state and chart line)
- destructive only for the remove button

Status / trend / "best price" badges all collapse to the same neutral pill (`border-border bg-surface text-muted-foreground`) with the brand token used only for the currently-selected item. Chart reference lines become `var(--border)` / `var(--muted-foreground)` dashed strokes instead of orange/slate.

## Layout (new structure)

```text
┌──────────────────────────────────────────────────────────┐
│ HeroCommandCenter  (kept, recolored to neutral)          │
├──────────────────────────────────────────────────────────┤
│ SignalRail         (kept, recolored to neutral)          │
├──────────────────────────────────────────────────────────┤
│ Price Guardian banner  (kept, recolored to neutral)      │
├──────────────────────────────────────────────────────────┤
│ ┌─ Compact watch list (left) ──┐ ┌─ Detail panel (right)┐│
│ │ • Sony WH-1000XM5            │ │  Selected item title  ││
│ │ • LG Washing Machine  ←hover │ │  Current / target /   ││
│ │ • Air Fryer                  │ │  low / high / vol /   ││
│ │ • …                          │ │  AI confidence        ││
│ │                              │ │                       ││
│ │                              │ │  ── ONE chart ──      ││
│ │                              │ │  full price history   ││
│ │                              │ │  + target + competitor││
│ │                              │ │  + neighbor dot       ││
│ │                              │ │                       ││
│ │                              │ │  Why-this-price /     ││
│ │                              │ │  neighbor breakdown   ││
│ └──────────────────────────────┘ └───────────────────────┘│
├──────────────────────────────────────────────────────────┤
│ WatchMatrix table  (kept, recolored to neutral)          │
└──────────────────────────────────────────────────────────┘
```

### Compact cards (left column)
- Replace the current 2-col grid of large `WatchCard`s with a single vertical list of slim rows (~56px tall).
- Collapsed row shows only: product name (truncate), current price, tiny trend pill.
- On `hover` (and on the currently-selected row) the row expands inline to reveal: SKU/brand, target price, low/high/volatility/AI-confidence chips, status badge, email-on badge, remove button. Implemented with `group` + `group-hover:` height/opacity transitions (no JS state for hover).
- Clicking a row sets it as the selected item that drives the right-side detail panel.
- Default selection: first watch on load.

### Detail panel (right column) — the single chart
- One `ComparisonChart` instance, fed by the selected watch. All sparklines per card are removed.
- Chart keeps every data series currently rendered (price area, target reference line, competitor reference line, neighbor match dot) — just restyled to neutral tokens.
- Above the chart: the selected item's headline numbers (current, target, low/high, volatility, AI confidence) that used to live inside each card.
- Below the chart: the `Breakdown` block (neighbor-match math or "why this price" math) for the selected item only.

### Data preservation checklist
Nothing is dropped — each field just moves location:
| Data | Old location | New location |
|---|---|---|
| name / brand / SKU | each card header | compact row (name) + detail panel header (brand+SKU) |
| status / trend / email-on badges | each card | expanded row (hover) |
| current / target price | each card | compact row (current) + detail panel |
| 30-day low / high / volatility / AI confidence | each card chip row | expanded row chips + detail panel summary |
| sparkline per card | each card | removed — superseded by single full chart |
| neighbor-match breakdown | each card | detail panel |
| "why this price" breakdown | each card | detail panel |
| full price-history chart | each card (expandable) | single shared chart in detail panel |
| remove action | each card | expanded row (hover) |

Empty state and loading state remain, restyled to neutral.

## Technical notes

- File touched: `src/routes/watchlist.tsx` only. `useWatchStore`, `watchlist-api`, and `AppShell` are untouched.
- New local component `WatchRow` (compact, hover-expand via Tailwind `group`/`group-hover` — no extra state).
- Lift selection state into `WatchlistPage`: `const [selectedId, setSelectedId] = useState<string | null>(null)`, default to `watches[0]?.watch_id` once data loads.
- `WatchCard`, `Sparkline`, and the per-card `expanded` state are removed.
- `ComparisonChart` and `Breakdown` are kept but recolored (no orange/slate/emerald hex literals — use CSS vars).
- `PriceTrendBadge` / `WatchStatusBadge` simplified to a single neutral pill variant; label text preserved.
- Page wrapper loses the `bg-gradient-to-b from-emerald-500/8 …` and the emerald/orange banner gradient; both become plain `bg-background` / `bg-card`.
