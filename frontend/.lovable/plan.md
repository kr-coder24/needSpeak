## 1. Mock data — fill every surface

- **Watchlist (`src/lib/watchlist-mock.ts` + `useWatchStore`)**: expand `MOCK_WATCHES` from 6 → 12 items (add Samsung Galaxy Buds, iPad Air, Nespresso Vertuo, Mi Air Purifier, Levi's 511 jeans, Kindle Paperwhite). Each gets 30-day history, varied statuses (`watching` / `price_dropped` / `neighbor_match` / `already_cheaper`), competitor sources, neighbor matches where relevant. Bump `MOCK_STATS` totals accordingly. Hydrate the store from mocks on first load if the API returns empty.
- **History (`src/routes/history.tsx`)**: seed `cart-history` localStorage with 6 realistic past carts (IPL party, birthday, weekly groceries, Diwali, recipe, restock) when empty.
- **Restock (`src/routes/restock.tsx`)** + **Occasions (`src/routes/occasions.tsx`)**: add mock items/occasions so the lists are populated on a fresh load.
- **Preferences / Shopper DNA**: pre-populate `useShopperDnaStore` with mock dietary tags, budget fingerprint, brand affinities so the page never looks empty.

## 2. Chat / Cart page — collapsible cards + premium feel (image 1 + 2)

In `src/routes/chat.tsx`:

- **Collapsible product cards**: collapse every item by default to a compact row (name • qty • price • status chip). Click the card (or chevron) to expand and reveal: matched-from line, "Watch price" button, ALTERNATIVES grid. Track open state with a `Set<string>` keyed by item id. Only one card open at a time (accordion behavior) to keep the page short.
- **Scroll bug**: remove the inner `overflow-y-auto` from the cart column / `Conversation` wrapper so the page uses a single natural document scroll. Sticky right-rail (`Why this cart?` + `Final Review`) becomes `position: sticky; top: 96px` instead of its own scroll container.
- **Shorten without losing features**: collapsed rows are ~56px tall vs current ~280px. All features (alternatives, swap, watch price, matched-from, badges) stay — just hidden until expanded.
- **History cards (image 2)**: trim card chrome — remove the redundant `Generated via AI prompt` line under each title (keep it once as a small chip), shrink the ITEMS/TOTAL stat blocks to a single inline row, tighten padding from `p-6` → `p-5`, switch the box-icon placeholder to a real category emoji-free lucide icon (`Package` outline) at smaller size. Both action buttons get equal weight in a single row.

## 3. Watchlist page — premium polish (image 3)

In `src/routes/watchlist.tsx`:

- **Header**: serif H1 `Price Guardian` paired with an espresso eyebrow `LIVE TRACKING`. KPI strip becomes 4 uniform cream cards with hairline borders, uppercase micro-labels, large serif numbers, and a small trend chip (`↑ ₹2,340 this week` etc.) under each. Right-aligned action cluster: ghost `Simulate`, solid espresso `+ Add watch`, icon-only refresh — all sharing one rounded pill group.
- **Left list**: each watch row is a uniform card with thumbnail placeholder, name, brand, price, and a single `Chip` (success/warning/danger) for deal status — no inline `Best price / Fair price / Higher than usual` text noise.
- **Right detail**: graph height fixed at `h-[320px]`, soft espresso area fill on cream, hairline grid, popover tooltip. KPI tiles above the graph. Neighbor-match / competitor cards below in a uniform 2-col grid.
- **Hover on left card** opens a `HoverCard` with 30-day low/high, confidence %, and last-checked timestamp.
- Replace any hardcoded greens/reds with `--chip-success-*` / `--chip-warning-*` / `--chip-danger-*` tokens.

## 4. Remove banners (images 4–7)

- Delete the `Zero-Shot Cart Generation Pilot` banner from `src/routes/occasions.tsx` (and any `⚡ Zap` lead icon).
- Delete the `Recipe-to-Cart AI Pipeline` + `PILOT FEATURE` banner from `src/routes/recipe.tsx`.
- Remove the residual lightning-bolt icon and party-popper SVG/emoji wherever they appear in `history.tsx` / chat header.
- Sweep all routes for stray decorative emojis (🎉 🎊 ⚡ 🛍️) and drop them — lucide icons only, sized consistently.

## 5. Verify

- Typecheck.
- Walk `/chat` (collapse/expand, no inner scroll), `/watchlist` (hover, graph, KPIs), `/history`, `/occasions`, `/recipe` in preview at 1280 + 414 widths.

### Technical notes

- New mock seeds live in `src/lib/watchlist-mock.ts`, `src/lib/mock/needspeak.ts`, and a new `src/lib/mock/history-seed.ts`.
- Card collapse state: local `useState<Set<string>>` in chat page; one-at-a-time toggle.
- No new dependencies. Reuses existing `Chip`, `HoverCard`, `recharts`.
