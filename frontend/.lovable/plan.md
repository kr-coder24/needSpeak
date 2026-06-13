
## Goal

Replace the blank Lovable scaffold with your actual needSpeak codebase from the uploaded ZIP, then enhance only the **homepage UX** with:
1. A subtle cursor-following ambient light (no bright colors — stays inside the warm beige/ink palette).
2. More content broken into small, modular components.
3. A lightweight engaging visual on the hero (no heavy 3D — keeps bundle small and on-brand).

Everything else (AppShell, routes, mock data, backend wiring) stays untouched.

---

## Step 1 — Import the project

- Extract `needspeak-src.zip` into `/dev-server/`, overwriting the scaffold. Skip `.git`, `node_modules`, `.tanstack`, `.lovable` cache.
- Run `bun install` so the lockfile resolves.

## Step 2 — Cursor-follow ambient lighting (global, very subtle)

Add a tiny hook + provider that tracks the cursor and writes `--cursor-x` / `--cursor-y` CSS variables on `<body>`. Use it to drive a fixed radial gradient layer behind the app:

```
background: radial-gradient(
  600px circle at var(--cursor-x) var(--cursor-y),
  oklch(0.93 0.02 75 / 0.55), transparent 60%
);
```

- Uses existing `--surface` / `--accent` tones only — no neon, no purples.
- Layer sits behind content with `pointer-events: none`, `z-index: -1`.
- Throttled with `requestAnimationFrame`; disabled on touch devices and when `prefers-reduced-motion`.
- Each interactive card on the homepage also gets a localized "spotlight" border tint via `onMouseMove` updating its own `--mx/--my`. Keeps the effect feeling alive without being loud.

Files:
- `src/hooks/use-cursor-glow.ts` (new) — global tracker.
- `src/components/effects/CursorGlow.tsx` (new) — fixed background layer.
- `src/components/effects/SpotlightCard.tsx` (new) — wrapper for hover-tinted cards.
- Mount `<CursorGlow />` once inside `AppShell` (only file touched outside the homepage).

## Step 3 — Modular homepage sections

Break `src/routes/index.tsx` into small section components under `src/components/home/`:

- `HeroPrompt.tsx` — existing hero + prompt box, now wrapped in a soft animated gradient mesh (pure CSS, slow drifting blobs in beige/clay tones, ~5% opacity).
- `OccasionsStrip.tsx` — existing occasions grid, now using `SpotlightCard`.
- `HowItWorks.tsx` (new) — 3 steps: Describe → Review → Checkout. Numbered, editorial, serif headings.
- `InputTypesGrid.tsx` (new) — promotes the 5 input types (text, recipe, image, WhatsApp, PDF) as their own bento section with mini examples.
- `LiveExamples.tsx` (new) — "prompt → cart preview" cards using items from `lib/mock/needspeak.ts` so it stays in sync with backend data shape. Pure presentation, no new API calls.
- `Stats.tsx` (new) — small editorial stat row (avg cart time, items matched, ₹ saved) sourced from mock constants.
- `FaqTeaser.tsx` (new) — 3 collapsible FAQs using existing `accordion` shadcn component.
- `FinalCta.tsx` — existing dark CTA, unchanged styling.

`index.tsx` just composes these in order. No backend calls added or changed.

## Step 4 — Visual polish (still subtle)

- Hero gets one slow CSS-animated "aurora" layer (two large blurred radial gradients in `--surface` and `--accent` drifting over 30s). No WebGL, no Spline runtime — keeps the page fast and consistent with the editorial Anthropic-style aesthetic you already established. If you specifically want a Spline scene later, I can swap the aurora for a `@splinetool/react-spline` embed in one section; I'm leaving it out by default because it adds ~300KB and clashes slightly with the calm beige look.
- All new colors pulled from existing tokens (`--surface`, `--accent`, `--brand` at low alpha). Zero hardcoded hex.

## Out of scope

- No backend / API / auth changes.
- No edits to other routes (`/chat`, `/occasions`, etc.) beyond the single `AppShell` line that mounts `<CursorGlow />`.
- No new dependencies unless you approve adding Spline.

## Technical notes

- All cursor tracking uses `pointermove` + `requestAnimationFrame` coalescing; no re-renders.
- `prefers-reduced-motion: reduce` disables both the cursor glow and the hero aurora.
- New section components are pure presentational and tree-shake cleanly.
