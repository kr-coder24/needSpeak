import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { useWatchStore } from "@/store/useWatchStore";
import { useEffect, useState, useMemo } from "react";
import {
  Bell, Plus, RefreshCw, Sparkles, TrendingDown, TrendingUp, AlertCircle,
  Mail, ShieldCheck, Check, DollarSign, Scale, ArrowRight, X, Heart, Loader2
} from "lucide-react";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/watchlist")({
  head: () => ({
    meta: [
      { title: "Price Guardian — NeedSpeak" },
      { name: "description", content: "AI-powered price tracking and competitor matching." },
    ],
  }),
  component: WatchlistPage,
});

function getStoredUserId(): string {
  try {
    const raw = localStorage.getItem("needspeak-auth");
    if (!raw) return "demo_user";
    const parsed = JSON.parse(raw);
    return parsed?.user?.user_id || parsed?.user?.id || parsed?.user?.email || "demo_user";
  } catch {
    return "demo_user";
  }
}

const statusCopy: Record<string, string> = {
  watching: "Watching",
  price_dropped: "Price dropped",
  neighbor_match: "Neighbor match",
  already_cheaper: "Already cheaper",
};

function WatchlistPage() {
  const { watches, stats, loading, simulating, fetchWatches, addWatch, removeWatch, simulateDay } = useWatchStore();
  const [selectedSku, setSelectedSku] = useState<string>("");
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Add Watch Form States
  const [newSku, setNewSku] = useState("");
  const [newName, setNewName] = useState("");
  const [newBrand, setNewBrand] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newTarget, setNewTarget] = useState("");
  const [newEmail, setNewEmail] = useState("");

  const userId = getStoredUserId();

  useEffect(() => {
    fetchWatches(userId).catch(console.error);
  }, [userId, fetchWatches]);

  // Set default selection when watches load
  useEffect(() => {
    if (watches.length > 0 && !selectedSku) {
      // Prefer Kent Purifier if it exists
      const hasKent = watches.find(w => w.sku === "DEMO-PURIFIER");
      if (hasKent) {
        setSelectedSku("DEMO-PURIFIER");
      } else {
        setSelectedSku(watches[0].sku);
      }
    }
  }, [watches, selectedSku]);

  const handleRefresh = async () => {
    toast.info("Syncing prices with Live Tracker...");
    await fetchWatches(userId);
    toast.success("Watchlist synced!");
  };

  const handleSimulate = async () => {
    toast.info("Advancing simulation by 1 day...");
    await simulateDay(userId);
  };

  const handleAddWatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSku || !newName || !newPrice) {
      toast.error("Please fill in SKU, Name, and Current Price.");
      return;
    }

    toast.info("Adding item to Price Guardian...");
    await addWatch({
      sku: newSku,
      name: newName,
      brand: newBrand || "",
      current_price_inr: parseFloat(newPrice),
      target_price_inr: newTarget ? parseFloat(newTarget) : parseFloat(newPrice),
      email: newEmail || undefined,
      user_id: userId,
    });

    setIsAddOpen(false);
    setSelectedSku(newSku);
    // Reset form
    setNewSku("");
    setNewName("");
    setNewBrand("");
    setNewPrice("");
    setNewTarget("");
    setNewEmail("");
  };

  const selectedItem = watches.find((w) => w.sku === selectedSku);

  // Stats Calculations
  const watchedValue = watches.reduce((sum, w) => sum + w.current_price_inr, 0);
  const activeAlerts = stats.alerts;
  const savedValue = stats.total_saved_inr;
  const bestPriceCount = watches.filter(w => w.price_status?.status === "best").length;

  // Selected item calculated metrics
  const itemLow = selectedItem?.price_status?.thirty_day_low_inr || (selectedItem ? selectedItem.current_price_inr * 0.85 : 0);
  const itemHigh = selectedItem?.price_status?.thirty_day_high_inr || (selectedItem ? selectedItem.current_price_inr * 1.15 : 0);
  const itemVolatility = selectedItem ? ((itemHigh - itemLow) / Math.max(1, itemLow) * 100).toFixed(1) : "0.0";
  const itemConfidence = selectedItem?.price_status?.confidence || 72;
  const itemSaved = selectedItem?.target_price_inr && selectedItem.current_price_inr <= selectedItem.target_price_inr
    ? Math.max(0, selectedItem.target_price_inr - selectedItem.current_price_inr)
    : 0;

  // Chart data mapping
  const chartData = selectedItem?.price_history?.map((pt) => {
    return {
      day: `${pt.day}`,
      Price: pt.price,
      "Competitor price": selectedItem.competitor_price_inr || pt.price * 0.95
    };
  }) || [];

  return (
    <AppShell noFooter={true}>
      <div className="flex h-full flex-col overflow-hidden bg-background/30 text-foreground">
        
        {/* Main Header Card */}
        <div className="shrink-0 px-6 py-4 border-b border-border bg-card/65 backdrop-blur-md">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            {/* Title Block */}
            <div className="min-w-0">
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
                Price Guardian
              </h1>
              <p className="text-sm text-muted-foreground truncate mt-1">
                {watches.length} watches · seeded 30-day history · neighbor + competitor matching
              </p>
            </div>

            {/* Stats Dashboard */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs md:text-sm font-semibold">
              <div className="border-l-2 border-border pl-3">
                <div className="text-[10px] uppercase text-muted-foreground tracking-wider font-bold">Watched Value</div>
                <div className="text-base font-black text-foreground">Rs {watchedValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</div>
              </div>
              <div className="border-l-2 border-border pl-3">
                <div className="text-[10px] uppercase text-muted-foreground tracking-wider font-bold">Saved</div>
                <div className="text-base font-black text-success">Rs {savedValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</div>
              </div>
              <div className="border-l-2 border-border pl-3">
                <div className="text-[10px] uppercase text-muted-foreground tracking-wider font-bold">Active Alerts</div>
                <div className="text-base font-black text-foreground">{activeAlerts}</div>
              </div>
              <div className="border-l-2 border-border pl-3">
                <div className="text-[10px] uppercase text-muted-foreground tracking-wider font-bold">Best Price</div>
                <div className="text-base font-black text-brand">{bestPriceCount}</div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 ml-4">
                <button
                  onClick={handleSimulate}
                  disabled={simulating || watches.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-4 py-2 text-xs font-bold text-foreground transition-all hover:bg-surface hover:shadow-soft active:scale-[0.98] disabled:opacity-50"
                >
                  <Sparkles className={`h-3.5 w-3.5 text-brand ${simulating ? "animate-spin" : ""}`} />
                  Simulate
                </button>
                <button
                  onClick={() => setIsAddOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-foreground px-4 py-2 text-xs font-bold text-background transition-all hover:bg-foreground/90 active:scale-[0.98]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add watch
                </button>
                <button
                  onClick={handleRefresh}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background hover:bg-surface transition-colors active:scale-95"
                  title="Force refresh prices"
                >
                  <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Outer Split Pane Layout — only left list scrolls */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row max-w-7xl w-full mx-auto p-4 md:p-6 gap-6 overflow-hidden">

          {/* Left Panel: Watchlist Cards — the only scroll region */}
          <div className="w-full md:w-[350px] shrink-0 flex flex-col gap-3 h-full overflow-y-auto pr-1">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground text-xs">
                <Loader2 className="h-6 w-6 animate-spin mb-2" /> Loading...
              </div>
            ) : (
              watches.map((item) => {
                const isSelected = item.sku === selectedSku;
                const statusKey = item.price_status?.status || "fair";
                
                const statusColor = 
                  statusKey === "best" ? "bg-green-500/10 text-green-700 border-green-500/25" :
                  statusKey === "high" ? "bg-red-500/10 text-red-700 border-red-500/25" :
                  "bg-yellow-500/10 text-yellow-700 border-yellow-500/25";
                  
                const labelText = 
                  item.status === "watching" ? `Fair Price ${itemConfidence}%` :
                  statusCopy[item.status] || "Watching";

                // Hover badges: pulled from the old detail header so they
                // live with the product they describe.
                const hoverBadges: { label: string; cls: string }[] = [];
                if (item.status === "already_cheaper" || item.price_status?.status === "best") {
                  hoverBadges.push({
                    label: "Already cheaper",
                    cls: "bg-green-500/10 text-green-700 border-green-500/25",
                  });
                }
                if (item.price_status?.confidence) {
                  hoverBadges.push({
                    label: `FAIR ${item.price_status.confidence}%`,
                    cls: "bg-yellow-500/10 text-yellow-700 border-yellow-500/25",
                  });
                }
                if (item.email) {
                  hoverBadges.push({
                    label: "Email sent",
                    cls: "bg-brand/10 text-brand border-brand/20",
                  });
                }
                if (item.neighbor_match) {
                  hoverBadges.push({
                    label: `${item.neighbor_match.distance_km} km`,
                    cls: "bg-indigo-500/10 text-indigo-700 border-indigo-500/20",
                  });
                }

                return (
                  <button
                    key={item.sku}
                    onClick={() => setSelectedSku(item.sku)}
                    className={`group relative flex flex-col text-left p-4 rounded-2xl border backdrop-blur-xl transition-all duration-300 ${
                      isSelected
                        ? "border-brand/40 bg-white/55 dark:bg-white/[0.06] shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)]"
                        : "border-white/40 dark:border-white/[0.06] bg-white/35 dark:bg-white/[0.03] hover:bg-white/55 dark:hover:bg-white/[0.06] hover:border-white/60 hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.10)]"
                    }`}
                  >
                    {/* Default: name + price + brand only */}
                    <div className="flex justify-between items-start gap-3 w-full">
                      <h3 className="font-semibold text-[15px] leading-snug text-foreground line-clamp-1 tracking-tight">
                        {item.name}
                      </h3>
                      <span className="font-semibold text-[15px] text-foreground shrink-0 tabular-nums">
                        Rs {item.current_price_inr.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground/80 font-medium">
                      {item.brand || "Generic"}
                    </p>

                    {/* Hover: reveal all properties */}
                    <div className="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] transition-[grid-template-rows] duration-300 ease-out">
                      <div className="overflow-hidden">
                        <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${statusColor}`}>
                              {labelText}
                            </span>
                            {item.target_price_inr && (
                              <span className="text-muted-foreground font-medium tabular-nums">
                                tgt Rs {item.target_price_inr.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                              </span>
                            )}
                          </div>
                          {(hoverBadges.length > 0 || item.neighbor_match) && (
                            <div className="flex flex-wrap gap-1">
                              {hoverBadges.map((b) => (
                                <span
                                  key={b.label}
                                  className={`px-2 py-0.5 rounded-full border text-[9px] font-semibold uppercase tracking-wider ${b.cls}`}
                                >
                                  {b.label}
                                </span>
                              ))}
                              {item.neighbor_match && (
                                <span className="px-2 py-0.5 rounded-full border border-brand/20 bg-brand/5 text-brand text-[9px] font-semibold uppercase tracking-wider inline-flex items-center gap-0.5">
                                  <Check className="h-2.5 w-2.5" /> local match
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Right Panel: Selected Item Detail — fixed, no inner scroll */}
          <div className="flex-1 min-w-0 h-full overflow-hidden rounded-3xl border border-white/40 dark:border-white/[0.06] bg-white/45 dark:bg-white/[0.04] backdrop-blur-xl p-6 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.10)]">
            {selectedItem ? (
              <div className="flex h-full flex-col gap-5 overflow-y-auto">

                {/* Badge row */}
                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  {selectedItem.status && (
                    <span className="px-2 py-0.5 rounded-md bg-brand/10 text-brand text-[10px] font-bold uppercase tracking-wide">
                      {statusCopy[selectedItem.status] || selectedItem.status}
                    </span>
                  )}
                  {selectedItem.price_status && (
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${
                      selectedItem.price_status.color_key === "green" ? "bg-emerald-100 text-emerald-700" :
                      selectedItem.price_status.color_key === "yellow" ? "bg-amber-100 text-amber-700" :
                      "bg-red-100 text-red-700"
                    }`}>
                      {selectedItem.price_status.label} {selectedItem.price_status.confidence}%
                    </span>
                  )}
                  {selectedItem.email_sent && (
                    <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-medium">
                      ✉ Email sent
                    </span>
                  )}
                  {selectedItem.neighbor_match && (
                    <span className="px-2 py-0.5 rounded-md bg-brand/10 text-brand text-[10px] font-medium">
                      📍 {selectedItem.neighbor_match.distance_km} km
                    </span>
                  )}
                  {selectedItem.co2_saved_kg > 0 && (
                    <span className="px-2 py-0.5 rounded-md bg-green-50 text-green-700 text-[10px] font-medium">
                      🌱 {selectedItem.co2_saved_kg} kg CO₂
                    </span>
                  )}
                </div>

                {/* Product header */}
                <div className="flex justify-between items-start gap-4 shrink-0">
                  <div className="min-w-0">
                    <h2 className="text-xl font-bold tracking-tight text-foreground truncate">{selectedItem.name}</h2>
                    <p className="text-[11px] text-muted-foreground mt-1 font-medium">
                      {selectedItem.brand || "Generic"} · SKU {selectedItem.sku}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-2xl font-bold text-foreground tabular-nums tracking-tight">
                      Rs {selectedItem.current_price_inr.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </div>
                    {selectedItem.target_price_inr && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                        target Rs {selectedItem.target_price_inr.toLocaleString("en-IN")}
                      </p>
                    )}
                  </div>
                </div>

                {/* Stats row: LOW | HIGH | VOLATILITY | CONFIDENCE | SAVED | GREEN */}
                <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 shrink-0">
                  <div className="rounded-xl border border-border/40 bg-surface/50 p-2.5 text-center">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Low</div>
                    <div className="text-sm font-bold tabular-nums mt-0.5">
                      Rs {(selectedItem.price_status?.thirty_day_low_inr || selectedItem.current_price_inr * 0.85).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                  <div className="rounded-xl border border-border/40 bg-surface/50 p-2.5 text-center">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">High</div>
                    <div className="text-sm font-bold tabular-nums mt-0.5">
                      Rs {(selectedItem.price_status?.thirty_day_high_inr || selectedItem.current_price_inr * 1.15).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                  <div className="rounded-xl border border-border/40 bg-surface/50 p-2.5 text-center">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Volatility</div>
                    <div className="text-sm font-bold tabular-nums mt-0.5">
                      {(() => {
                        const low = selectedItem.price_status?.thirty_day_low_inr || selectedItem.current_price_inr * 0.85;
                        const high = selectedItem.price_status?.thirty_day_high_inr || selectedItem.current_price_inr * 1.15;
                        return (((high - low) / high) * 100).toFixed(1);
                      })()}%
                    </div>
                  </div>
                  <div className="rounded-xl border border-border/40 bg-surface/50 p-2.5 text-center">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Confidence</div>
                    <div className="text-sm font-bold tabular-nums mt-0.5">
                      {selectedItem.price_status?.confidence || 80}%
                    </div>
                  </div>
                  <div className="rounded-xl border border-border/40 bg-surface/50 p-2.5 text-center">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Saved</div>
                    <div className="text-sm font-bold tabular-nums mt-0.5 text-emerald-600">
                      Rs {(selectedItem.logistics_saved_inr || 0).toLocaleString("en-IN")}
                    </div>
                  </div>
                  <div className="rounded-xl border border-border/40 bg-surface/50 p-2.5 text-center">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Green</div>
                    <div className="text-sm font-bold tabular-nums mt-0.5 text-green-600">
                      🌱 {selectedItem.co2_saved_kg || 0}
                    </div>
                  </div>
                </div>

                {/* Price history chart */}
                <div className="flex-1 min-h-[200px] rounded-2xl border border-border/30 bg-surface/30 p-4 flex flex-col">
                  <h3 className="font-semibold text-[11px] text-muted-foreground mb-3 uppercase tracking-wider shrink-0">
                    Price History · 30 Days
                  </h3>
                  <div className="flex-1 min-h-0 w-full">
                    {chartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="var(--color-brand, #3b82f6)" stopOpacity={0.25}/>
                              <stop offset="95%" stopColor="var(--color-brand, #3b82f6)" stopOpacity={0.0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(156,163,175,0.15)" vertical={false} />
                          <XAxis dataKey="day" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} tickCount={15} />
                          <YAxis stroke="#888888" fontSize={10} tickLine={false} axisLine={false} domain={['auto', 'auto']} tickFormatter={(v) => `₹${v}`} />
                          <Tooltip contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '11px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                          <Area type="monotone" dataKey="Price" stroke="var(--color-brand, #3b82f6)" strokeWidth={2} fillOpacity={1} fill="url(#priceGrad)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                        Calculating price history...
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom cards: CO2 | Logistics | Competitor */}
                <div className="grid grid-cols-3 gap-2 shrink-0">
                  <div className="rounded-xl border border-green-200/60 bg-green-50/50 p-3 text-center">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-green-600">CO₂ Avoided</div>
                    <div className="text-base font-bold text-green-700 mt-1">{selectedItem.co2_saved_kg || 0} kg</div>
                  </div>
                  <div className="rounded-xl border border-blue-200/60 bg-blue-50/50 p-3 text-center">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-blue-600">Logistics Saved</div>
                    <div className="text-base font-bold text-blue-700 mt-1">Rs {(selectedItem.logistics_saved_inr || 0).toLocaleString("en-IN")}</div>
                  </div>
                  <div className="rounded-xl border border-purple-200/60 bg-purple-50/50 p-3 text-center">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-purple-600">Competitor</div>
                    <div className="text-base font-bold text-purple-700 mt-1">
                      {selectedItem.competitor_price_inr ? `Rs ${selectedItem.competitor_price_inr.toLocaleString("en-IN")}` : "N/A"}
                    </div>
                    {selectedItem.competitor_source && (
                      <div className="text-[9px] text-purple-600 mt-0.5">{selectedItem.competitor_source}</div>
                    )}
                  </div>
                </div>

                {/* Neighbor match section */}
                {selectedItem.neighbor_match && (
                  <div className="rounded-xl border border-brand/20 bg-brand/5 p-4 shrink-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm">📍</span>
                      <span className="text-xs font-bold uppercase tracking-wider text-brand">
                        Neighbor Price · {selectedItem.neighbor_match.distance_km} km
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <div className="text-[9px] text-muted-foreground font-medium">Original</div>
                        <div className="text-sm font-bold">Rs {selectedItem.neighbor_match.original_price_inr.toLocaleString("en-IN")}</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-muted-foreground font-medium">Logistics saved</div>
                        <div className="text-sm font-bold text-blue-600">Rs {selectedItem.neighbor_match.logistics_cost_saved_inr.toLocaleString("en-IN")}</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-muted-foreground font-medium">Your price</div>
                        <div className="text-sm font-bold text-emerald-600">Rs {selectedItem.neighbor_match.neighbor_price_inr.toLocaleString("en-IN")}</div>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-muted-foreground h-full">
                <AlertCircle className="h-10 w-10 text-muted-foreground/50 mb-3" />
                <h4 className="font-semibold text-foreground">No watch selected</h4>
                <p className="text-xs max-w-xs mt-1">Select an item from the left to view its price history.</p>
              </div>
            )}
          </div>

        </div>

        {/* Modal: Add Watch Form */}
        {isAddOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setIsAddOpen(false)} />
            <div className="relative w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-black text-foreground flex items-center gap-1.5">
                  <Bell className="h-5 w-5 text-brand" /> Add Watch Item
                </h3>
                <button
                  onClick={() => setIsAddOpen(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-surface hover:bg-surface-hover text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleAddWatchSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">SKU Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SKU-DEMO-PURIFIER"
                    value={newSku}
                    onChange={(e) => setNewSku(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-brand"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Product Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kent Supreme RO Purifier"
                    value={newSku ? newName : ""}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-brand"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Brand</label>
                    <input
                      type="text"
                      placeholder="e.g. Kent"
                      value={newBrand}
                      onChange={(e) => setNewBrand(e.target.value)}
                      className="w-full h-10 px-3.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-brand"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Price (Rs)</label>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 14715"
                      value={newPrice}
                      onChange={(e) => setNewPrice(e.target.value)}
                      className="w-full h-10 px-3.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-brand"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Target Price (Rs)</label>
                    <input
                      type="number"
                      placeholder="e.g. 13499"
                      value={newTarget}
                      onChange={(e) => setNewTarget(e.target.value)}
                      className="w-full h-10 px-3.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-brand"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Email (Alerts)</label>
                    <input
                      type="email"
                      placeholder="alerts@domain.com"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="w-full h-10 px-3.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-brand"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full h-11 bg-brand text-white font-bold text-sm rounded-xl mt-6 transition-all hover:bg-brand/90 active:scale-[0.98]"
                >
                  Create Watch Alert
                </button>
              </form>

            </div>
          </div>
        )}

      </div>
    </AppShell>
  );
}
