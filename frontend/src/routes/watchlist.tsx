import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Leaf,
  Loader2,
  MapPin,
  PlusCircle,
  RefreshCw,
  Target,
  Trash2,
  TrendingDown,
} from "lucide-react";
import {
  Area as ReArea,
  AreaChart as ReAreaChart,
  CartesianGrid,
  Line as ReLine,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/layout/AppShell";
import { DealStatusPill } from "@/components/common/DealStatusIndicator";
import { useWatchStore } from "@/store/useWatchStore";
import { type WatchedItem } from "@/lib/watchlist-api";
import { MOCK_STATS, MOCK_WATCHES } from "@/lib/watchlist-mock";

export const Route = createFileRoute("/watchlist")({
  component: WatchlistPage,
});

const statusCopy: Record<WatchedItem["status"], string> = {
  watching: "Watching",
  price_dropped: "Price dropped",
  neighbor_match: "Neighbor match",
  already_cheaper: "Already cheaper",
};

function money(value: number | null | undefined) {
  return `Rs ${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function getPriceMetrics(item: WatchedItem) {
  const prices = item.price_history.map((p) => p.price);
  const min = prices.length ? Math.min(...prices) : item.current_price_inr;
  const max = prices.length ? Math.max(...prices) : item.current_price_inr;
  const first = prices[0] || item.current_price_inr;
  const savings = Math.max(0, first - item.current_price_inr);
  const volatility = max > 0 ? ((max - min) / max) * 100 : 0;
  const confidence = Math.min(98, Math.max(62, 100 - volatility + (item.status !== "watching" ? 7 : 0)));
  return { min, max, savings, volatility, confidence };
}

function getStoredUserId(): string {
  if (typeof window === "undefined") return "demo_user";
  try {
    const raw = localStorage.getItem("needspeak-auth");
    if (!raw) return "demo_user";
    const parsed = JSON.parse(raw);
    return parsed?.user?.user_id || parsed?.user?.id || "demo_user";
  } catch {
    return "demo_user";
  }
}

function getTrendLabel(item: WatchedItem) {
  const prices = item.price_history.map((p) => p.price);
  if (prices.length < 2) return "Tracking";
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = Math.max(1, max - min);
  const position = (item.current_price_inr - min) / range;
  return position <= 0.1 ? "Best price" : position >= 0.9 ? "High price" : "Average";
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
      {children}
    </span>
  );
}

function CompactHero({
  watches,
  stats,
  simulating,
  onSimulate,
  onRefresh,
  onAddDemo,
  addingDemo,
}: {
  watches: WatchedItem[];
  stats: { total_saved_inr: number; total_co2_saved_kg: number; alerts: number };
  simulating: boolean;
  onSimulate: () => void;
  onRefresh: () => void;
  onAddDemo: () => void;
  addingDemo: boolean;
}) {
  const watchedValue = watches.reduce((sum, item) => sum + item.current_price_inr, 0);
  const bestPriceCount = watches.filter((item) => {
    const m = getPriceMetrics(item);
    return item.current_price_inr <= m.min + Math.max(1, (m.max - m.min) * 0.1);
  }).length;

  const metrics = [
    { label: "Watched value", value: money(watchedValue) },
    { label: "Saved", value: money(stats.total_saved_inr) },
    { label: "Active alerts", value: String(stats.alerts) },
    { label: "Best price", value: String(bestPriceCount) },
  ];

  return (
    <section className="mb-6 rounded-xl border border-foreground/10 bg-foreground px-5 py-5 text-background shadow-pop">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Price Guardian
          </h1>
          <p className="mt-0.5 truncate text-sm text-background/60">
            {watches.length} watches · seeded 30-day history · neighbor + competitor signals
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          {metrics.map((m) => (
            <div key={m.label} className="leading-tight">
              <div className="text-[11px] font-medium uppercase tracking-wider text-background/50">
                {m.label}
              </div>
              <div className="mt-0.5 text-base font-bold sm:text-lg">{m.value}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onSimulate}
            disabled={simulating || watches.length === 0}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-background px-4 text-xs font-bold text-foreground transition-colors hover:bg-background/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {simulating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            Simulate
          </button>
          <button
            onClick={onAddDemo}
            disabled={addingDemo}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-background/20 bg-foreground px-4 text-xs font-bold text-background transition-colors hover:bg-foreground/80 disabled:opacity-50"
          >
            {addingDemo ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PlusCircle className="h-4 w-4" />
            )}
            Add watch
          </button>
          <button
            onClick={onRefresh}
            aria-label="Refresh"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-background/20 bg-foreground text-background/80 transition-colors hover:bg-foreground/80"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}

function ComparisonChart({ item }: { item: WatchedItem }) {
  const data = item.price_history.map((point) => ({
    ...point,
    neighbor: item.neighbor_match?.day_appeared === point.day ? item.neighbor_match.neighbor_price_inr : null,
  }));

  return (
    <div className="h-64 w-full rounded-lg border border-border bg-background p-3">
      <ResponsiveContainer>
        <ReAreaChart data={data}>
          <defs>
            <linearGradient id={`price-${item.watch_id}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="var(--color-foreground)" stopOpacity={0.18} />
              <stop offset="95%" stopColor="var(--color-foreground)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
          <YAxis tickLine={false} axisLine={false} width={56} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickFormatter={(value) => `Rs ${value}`} />
          <Tooltip
            formatter={(value) => money(Number(value))}
            labelFormatter={(label) => `Day ${label}`}
            contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }}
          />
          <ReferenceLine y={item.target_price_inr} stroke="var(--color-muted-foreground)" strokeDasharray="4 4" label={{ value: "Target", fill: "var(--color-muted-foreground)", fontSize: 10, position: "insideTopRight" }} />
          {item.competitor_price_inr && (
            <ReferenceLine y={item.competitor_price_inr} stroke="var(--color-border)" strokeDasharray="5 5" label={{ value: "Competitor", fill: "var(--color-muted-foreground)", fontSize: 10, position: "insideTopRight" }} />
          )}
          <ReArea type="monotone" dataKey="price" stroke="var(--color-foreground)" fill={`url(#price-${item.watch_id})`} strokeWidth={2} />
          <ReLine type="monotone" dataKey="neighbor" stroke="var(--color-foreground)" strokeWidth={0} dot={{ r: 5, fill: "var(--color-foreground)" }} />
        </ReAreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function Breakdown({ item }: { item: WatchedItem }) {
  if (item.neighbor_match) {
    const m = item.neighbor_match;
    return (
      <div className="rounded-md border border-border bg-surface/60 p-3 text-xs">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          <MapPin className="h-3 w-3" /> Neighbor price · {m.distance_km} km
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div><div className="text-[10px] text-muted-foreground">Original</div><div className="font-semibold">{money(m.original_price_inr)}</div></div>
          <div><div className="text-[10px] text-muted-foreground">Logistics saved</div><div className="font-semibold">-{money(m.logistics_cost_saved_inr)}</div></div>
          <div><div className="text-[10px] text-muted-foreground">Your price</div><div className="font-bold">{money(m.neighbor_price_inr)}</div></div>
        </div>
        <div className="mt-1.5 text-[10px] text-muted-foreground">CO2 avoided ≈ {m.co2_saved_kg.toFixed(2)} kg</div>
      </div>
    );
  }
  return (
    <div className="rounded-md border border-border bg-surface/60 p-3 text-xs">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        <Target className="h-3 w-3" /> Price math
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div><div className="text-[10px] text-muted-foreground">Target</div><div className="font-semibold">{money(item.target_price_inr)}</div></div>
        <div><div className="text-[10px] text-muted-foreground">Current</div><div className="font-bold">{money(item.current_price_inr)}</div></div>
        {item.competitor_price_inr ? (
          <div><div className="text-[10px] text-muted-foreground">{item.competitor_source || "Competitor"}</div><div className="font-semibold">{money(item.competitor_price_inr)}</div></div>
        ) : (
          <div><div className="text-[10px] text-muted-foreground">Status</div><div className="font-semibold">{statusCopy[item.status]}</div></div>
        )}
      </div>
    </div>
  );
}

function getGreenScore(item: WatchedItem) {
  // 0–100 score: rewards neighbor matches, CO2 avoided, logistics avoided.
  const co2 = Math.min(40, item.co2_saved_kg * 30);
  const logistics = Math.min(30, item.logistics_saved_inr / 20);
  const neighbor = item.neighbor_match ? 30 : 0;
  const base = item.status === "watching" ? 5 : 12;
  return Math.round(Math.min(100, base + co2 + logistics + neighbor));
}

function WatchRow({
  item,
  selected,
  onSelect,
  onRemove,
}: {
  item: WatchedItem;
  selected: boolean;
  onSelect: () => void;
  onRemove: (id: string) => void;
}) {
  const trend = getTrendLabel(item);
  const metrics = getPriceMetrics(item);
  const green = getGreenScore(item);
  return (
    <div
      onClick={onSelect}
      onMouseEnter={onSelect}
      className={`group cursor-pointer rounded-md border transition-colors ${
        selected ? "border-foreground/40 bg-surface" : "border-border bg-card hover:border-foreground/30"
      }`}
    >
      <div className="flex items-center gap-3 px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold">{item.name}</div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <Pill>{trend}</Pill>
            <span className="truncate text-[10px] text-muted-foreground">{item.brand}</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-xs font-bold">{money(item.current_price_inr)}</div>
          <div className="text-[10px] text-muted-foreground">tgt {money(item.target_price_inr)}</div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(item.watch_id);
          }}
          aria-label={`Remove ${item.name}`}
          className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive group-hover:flex"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Hover / selected expansion */}
      <div
        className={`grid overflow-hidden transition-all duration-200 ${
          selected ? "grid-rows-[1fr]" : "grid-rows-[0fr] group-hover:grid-rows-[1fr]"
        }`}
      >
        <div className="min-h-0">
          <div className="space-y-2 border-t border-border px-3 py-2">
            <div className="flex flex-wrap items-center gap-1">
              <Pill>{statusCopy[item.status]}</Pill>
              <DealStatusPill status={item.price_status} />
              {item.email && (
                <Pill>
                  <span className="inline-flex items-center gap-1">
                    <Bell className="h-2.5 w-2.5" /> {item.email_sent ? "Email sent" : "Email on"}
                  </span>
                </Pill>
              )}
              {item.neighbor_match && (
                <Pill>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-2.5 w-2.5" /> {item.neighbor_match.distance_km} km
                  </span>
                </Pill>
              )}
              <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-border bg-background px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">
                <Leaf className="h-2.5 w-2.5" /> {green}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5 text-center">
              <div className="rounded border border-border bg-background py-1">
                <div className="text-[8px] font-semibold uppercase text-muted-foreground">Low</div>
                <div className="text-[10px] font-bold">{money(metrics.min)}</div>
              </div>
              <div className="rounded border border-border bg-background py-1">
                <div className="text-[8px] font-semibold uppercase text-muted-foreground">High</div>
                <div className="text-[10px] font-bold">{money(metrics.max)}</div>
              </div>
              <div className="rounded border border-border bg-background py-1">
                <div className="text-[8px] font-semibold uppercase text-muted-foreground">Vol.</div>
                <div className="text-[10px] font-bold">{metrics.volatility.toFixed(1)}%</div>
              </div>
              <div className="rounded border border-border bg-background py-1">
                <div className="text-[8px] font-semibold uppercase text-muted-foreground">Conf.</div>
                <div className="text-[10px] font-bold">{metrics.confidence.toFixed(0)}%</div>
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground">
              SKU {item.sku}
              {item.competitor_price_inr ? ` · vs ${item.competitor_source || "competitor"} ${money(item.competitor_price_inr)}` : ""}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailPanel({ item }: { item: WatchedItem | null }) {
  if (!item) {
    return (
      <div className="flex h-full min-h-[420px] items-center justify-center rounded-lg border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
        Hover an item on the left to inspect its full price history.
      </div>
    );
  }
  const metrics = getPriceMetrics(item);
  const green = getGreenScore(item);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <Pill>{statusCopy[item.status]}</Pill>
            <DealStatusPill status={item.price_status} />
            <Pill>{getTrendLabel(item)}</Pill>
            {item.email && (
              <Pill>
                <span className="inline-flex items-center gap-1">
                  <Bell className="h-2.5 w-2.5" /> {item.email_sent ? "Email sent" : "Email on"}
                </span>
              </Pill>
            )}
            {item.neighbor_match && (
              <Pill>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-2.5 w-2.5" /> {item.neighbor_match.distance_km} km
                </span>
              </Pill>
            )}
          </div>
          <h2 className="line-clamp-1 text-base font-bold tracking-tight">{item.name}</h2>
          <p className="text-[11px] text-muted-foreground">{item.brand} · SKU {item.sku}</p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-xl font-bold leading-tight">{money(item.current_price_inr)}</div>
          <div className="text-[10px] text-muted-foreground">target {money(item.target_price_inr)}</div>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-6 text-center">
        {[
          { label: "Low", value: money(metrics.min) },
          { label: "High", value: money(metrics.max) },
          { label: "Volatility", value: `${metrics.volatility.toFixed(1)}%` },
          { label: "Confidence", value: `${metrics.confidence.toFixed(0)}%` },
          { label: "Saved", value: money(metrics.savings) },
          {
            label: "Green",
            value: (
              <span className="inline-flex items-center gap-1">
                <Leaf className="h-3 w-3" />
                {green}
              </span>
            ),
          },
        ].map((s) => (
          <div key={s.label} className="rounded-md border border-border bg-background py-1.5">
            <div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{s.label}</div>
            <div className="text-xs font-bold">{s.value}</div>
          </div>
        ))}
      </div>

      <ComparisonChart item={item} />

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-md border border-border bg-background py-1.5">
          <div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">CO2 avoided</div>
          <div className="text-xs font-bold">{item.co2_saved_kg.toFixed(2)} kg</div>
        </div>
        <div className="rounded-md border border-border bg-background py-1.5">
          <div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Logistics saved</div>
          <div className="text-xs font-bold">{money(item.logistics_saved_inr)}</div>
        </div>
        <div className="rounded-md border border-border bg-background py-1.5">
          <div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Competitor</div>
          <div className="text-xs font-bold">
            {item.competitor_price_inr ? money(item.competitor_price_inr) : "—"}
          </div>
          {item.competitor_source && (
            <div className="text-[9px] text-muted-foreground">{item.competitor_source}</div>
          )}
        </div>
      </div>

      <div className="mt-3">
        <Breakdown item={item} />
      </div>
    </div>
  );
}

function WatchlistPage() {
  const { watches: storeWatches, stats: storeStats, loading, simulating, fetchWatches, simulateDay, removeWatch, addWatch } = useWatchStore();
  const userId = useMemo(() => getStoredUserId(), []);
  const [addingDemo, setAddingDemo] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [removedMock, setRemovedMock] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchWatches(userId).catch(console.error);
  }, [fetchWatches, userId]);

  const usingMock = !loading && storeWatches.length === 0;
  const watches = usingMock ? MOCK_WATCHES.filter((w) => !removedMock.has(w.watch_id)) : storeWatches;
  const stats = usingMock ? MOCK_STATS : storeStats;

  useEffect(() => {
    if (!selectedId && watches.length > 0) {
      setSelectedId(watches[0].watch_id);
    }
    if (selectedId && !watches.some((w) => w.watch_id === selectedId)) {
      setSelectedId(watches[0]?.watch_id ?? null);
    }
  }, [watches, selectedId]);

  const selectedItem = useMemo(
    () => watches.find((w) => w.watch_id === selectedId) ?? watches[0] ?? null,
    [watches, selectedId]
  );

  const handleAddDemoWatch = async () => {
    setAddingDemo(true);
    try {
      const suffix = Date.now().toString().slice(-5);
      await addWatch({
        sku: `JUDGE-DEMO-${suffix}`,
        name: `Judge Demo Smart Monitor ${suffix}`,
        brand: "Acer",
        current_price_inr: 12990,
        target_price_inr: 13499,
        competitor_text: "Flipkart - Rs 13990",
        user_id: userId,
        email: "demo@example.com",
      });
    } catch (e) {
      console.error(e);
    } finally {
      setAddingDemo(false);
    }
  };

  const handleRemove = (id: string) => {
    if (usingMock) {
      setRemovedMock((prev) => new Set(prev).add(id));
    } else {
      removeWatch(userId, id).catch(console.error);
    }
  };

  return (
    <AppShell>
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <CompactHero
            watches={watches}
            stats={stats}
            simulating={simulating}
            addingDemo={addingDemo}
            onSimulate={() => simulateDay(userId).catch(console.error)}
            onRefresh={() => fetchWatches(userId).catch(console.error)}
            onAddDemo={handleAddDemoWatch}
          />

          {usingMock && (
            <div className="mb-3 rounded-md border border-dashed border-border bg-surface/60 px-3 py-2 text-[11px] text-muted-foreground">
              Showing seeded demo watches — connect the backend to load your own.
            </div>
          )}

          {loading ? (
            <div className="rounded-lg border border-border bg-card p-10 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-muted-foreground" /> Loading watched items...
            </div>
          ) : watches.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
              <Bell className="mx-auto mb-3 h-7 w-7 text-muted-foreground" />
              <h2 className="text-sm font-bold">No watched items</h2>
              <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
                Use the Watch button on any cart item and alerts will appear here.
              </p>
            </div>
          ) : (
            <section className="grid gap-4 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
              <div className="space-y-1.5">
                {watches.map((item) => (
                  <WatchRow
                    key={item.watch_id}
                    item={item}
                    selected={selectedItem?.watch_id === item.watch_id}
                    onSelect={() => setSelectedId(item.watch_id)}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
              <DetailPanel item={selectedItem} />
            </section>
          )}
        </div>
      </div>
    </AppShell>
  );
}
