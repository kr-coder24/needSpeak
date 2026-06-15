## Step 0 — Sync the real app into the sandbox

The sandbox only has the starter template; the real app lives in `important-files3.zip`. Before any UI work:

- Extract the zip to a temp dir, verify there is no `.git` directory inside (already confirmed: none).
- `rsync -a --exclude='.git' --exclude='.git/**'` the extracted tree into `/dev-server/`, overwriting `src/`, `package.json`, `tsconfig.json`, `vite.config.ts`.
- `bun install` so the new dependencies (zustand store, etc.) resolve.
- Sanity-check that `src/routes/watchlist.tsx`, `preferences.tsx`, `cart.$id.tsx`, `components/common/DealStatusIndicator.tsx`, `components/common/BudgetFingerprint.tsx`, `components/layout/AppShell.tsx` are now present.

No edits land until this sync is clean.

## Step 1 — Watchlist: lock page scroll, only left column scrolls

File: `src/routes/watchlist.tsx`

- Wrap the page in `h-screen overflow-hidden flex flex-col` so the route itself never scrolls.
- Convert the main body to a two-column grid (`grid-cols-[minmax(0,1fr)_minmax(0,2fr)]` on `lg`, stacked on mobile) that fills remaining height.
- Left column (the watched-items list): `h-full overflow-y-auto pr-2` — the only scroll region.
- Right column (chart / hero product / detail panel): `h-full overflow-hidden`, chart container is `sticky top-0` and sized to its parent, no inner scroll, no `overflow-x-auto` on the graph.
- Mobile fallback: keep page scroll disabled, swap to vertical stack where the list region still owns the scroll.

## Step 2 — Cart page: vertical alignment + sizing overhaul

File: `src/routes/cart.$id.tsx` (the page from image 4 downward — Total / Shopper DNA / following sections).

- From the price summary card onward, drop the multi-column grid and stack everything in a single `max-w-2xl mx-auto flex flex-col gap-6` column so Total → Shopper DNA → following blocks all share the same width and vertical rhythm.
- Normalize card sizing: `rounded-2xl p-6`, headings `text-sm font-semibold uppercase tracking-wide text-muted-foreground`, primary numeric value `text-3xl font-semibold`, supporting copy `text-sm text-muted-foreground`.
- Kill ad-hoc oversized boxes (the `₹1748` card currently dwarfs its neighbours): clamp value typography to one scale, remove extra inner padding, equalize gap with siblings.
- Ensure the top metrics strip (image 5: AVG/ITEM, YOU SAVE, CO₂, BRANDS) uses `grid-cols-2 md:grid-cols-4`, equal card heights via `auto-rows-fr`, single text scale.

## Step 3 — DealStatusIndicator: formal copy + restore traffic-light dots

File: `src/components/common/DealStatusIndicator.tsx`

- Remove the 📉 / 📈 / sparkles emojis from header and label.
- Replace `Buy Now` / `Wait` / `Avoid` emoji-led copy with a small uppercase status label (`BUY NOW`, `HOLD`, `OVERPRICED`) plus a one-line formal description ("Currently 18% below the 30-day average.").
- Bring back the colored dot: `span` with `h-2 w-2 rounded-full` and `bg-emerald-500` (good price), `bg-amber-500` (fair), `bg-rose-500` (poor). Dot sits left of the status label.
- Keep the 30-day pill timeline but recolor the trailing "Now" pill to match the same status color so the signal is consistent.

## Step 4 — BudgetFingerprint + Review Cart button: de-emoji, professionalize

Files: `src/components/common/BudgetFingerprint.tsx`, plus the Review Cart button (currently in `src/routes/cart.$id.tsx` / `AppShell.tsx`).

- Strip emojis (💎, 💰, 📊, ❤️, 🍗, fingerprint) from each persona row. Replace with a 20px lucide icon (`Gem`, `Wallet`, `BarChart3`, `Leaf`, `Drumstick`, `Fingerprint`) in a neutral square `h-9 w-9 rounded-lg bg-muted` container.
- Persona row typography: title `text-sm font-semibold`, subtitle `text-xs text-muted-foreground`, active-state ring instead of filled pill.
- Review Cart CTA: rebuild as a single `Button` variant — `h-11 px-5 rounded-xl text-sm font-semibold tracking-tight`, label `Review Cart` (no emoji, no compounded word), with a `ChevronRight` trailing icon. Remove the oversized treatment.

## Step 5 — Remove the blue handbag logo

The logo from image 6 (`src/assets/needspeak-logo.png` based on the zip listing) appears in `AppShell.tsx` and likely `Footer.tsx` / `login.tsx`.

- Delete every `<img src={logo}>` / import referencing `needspeak-logo`.
- Replace with a text wordmark only (existing brand name in `font-semibold tracking-tight`) so nav layouts don't collapse.
- Remove the now-unused asset import; leave the file on disk untouched (no asset deletion).

## Step 6 — Preferences page: vertical structure + size cleanup

File: `src/routes/preferences.tsx`

- Restructure the page as a single-column `max-w-3xl mx-auto space-y-8` flow: Strategy → Brands → Constraints stacked vertically (no side-by-side sections, no oversized full-width container).
- Each section becomes a `Card` with `p-6`, section header pattern: small uppercase eyebrow (`text-xs font-semibold tracking-[0.14em] text-muted-foreground`) + `text-lg font-semibold` title + one-line helper.
- Strategy: 3 option cards in a `grid grid-cols-1 sm:grid-cols-3 gap-3`, each card `p-4 rounded-xl`, icon `h-5 w-5`, title `text-base font-semibold`, body `text-sm text-muted-foreground`. Sub-sections (Quality Bias, Pack Sizing) sit BELOW in a single inner card with `grid-cols-2`, chip buttons reduced to `h-9 px-3 text-sm`.
- Brands and Constraints follow the same sizing primitives so the three sections read as one consistent stack.
- Remove the existing oversized outer container and any `min-h-screen` padding that's inflating perceived box size.

## Step 7 — Restore red / yellow / green dots wherever deal status renders

Audit usages of `DealStatusIndicator` and any inline price-quality badges in `cart.$id.tsx`, `watchlist.tsx`, `restock.tsx`, `chat.tsx`. Replace any text-only / emoji-only status with the shared 8px colored dot from Step 3 so the traffic-light signal is consistent across the app.

## Cross-cutting design rules (apply during every step)

- Section eyebrows and metric labels in UPPERCASE with `tracking-[0.12em]`.
- Visual hierarchy by size: hero metric `text-3xl`, section title `text-lg`, body `text-sm`, meta `text-xs`. No mid-range sizes.
- Icons: lucide only, `h-4 w-4` inline / `h-5 w-5` in cards. No emojis anywhere user-facing.
- Cards: `rounded-2xl`, `border`, `p-6`, consistent `gap-6` between siblings.
- Respect responsive pattern: text containers `min-w-0`, fixed widgets `shrink-0`.

## Technical notes

- All edits stay in presentation layer: route files + `components/common/*` + `components/layout/AppShell.tsx`. No store, API, or schema changes.
- After Step 0 the regenerated `routeTree.gen.ts` from the zip will be picked up; if Vite complains, delete it and let the plugin regenerate.
- Verification: build output clean, then visual check of `/watchlist`, `/cart/:id`, `/preferences` at desktop and mobile widths via the preview.
