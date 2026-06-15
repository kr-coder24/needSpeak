import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { useWishlistStore, type WatchlistItem } from "@/store/useWishlistStore";
import { useEffect, useState } from "react";
import {
  Bell, Plus, RefreshCw, Sparkles, TrendingDown, TrendingUp, AlertCircle,
  Mail, ShieldCheck, Check, DollarSign, Scale, ArrowRight, X, Heart
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

function WatchlistPage() {
  const { wishlist, fetchWishlist, addToWishlist, simulateRestock } = useWishlistStore();
  const [selectedSku, setSelectedSku] = useState<string>("");
  const [isSimulating, setIsSimulating] = useState(false);
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
    fetchWishlist(userId);
  }, [userId]);

  // Set default selection when wishlist loads
  useEffect(() => {
    if (wishlist.length > 0 && !selectedSku) {
      // Prefer Kent Supreme RO if it exists
      const hasKent = wishlist.find(w => w.sku === "DEMO-PURIFIER");
      if (hasKent) {
        setSelectedSku("DEMO-PURIFIER");
      } else {
        setSelectedSku(wishlist[0].sku);
      }
    }
  }, [wishlist, selectedSku]);

  const handleRefresh = async () => {
    toast.info("Syncing prices with Live Tracker...");
    await fetchWishlist(userId);
    toast.success("Watchlist synced!");
  };

  const handleSimulate = async () => {
    setIsSimulating(true);
    toast.info("Advancing simulation by 1 day...");
    await simulateRestock(userId);
    setIsSimulating(false);
    toast.success("Simulation complete! Prices updated, check notifications.");
  };

  const handleAddWatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSku || !newName || !newPrice) {
      toast.error("Please fill in SKU, Name, and Current Price.");
      return;
    }

    toast.info("Adding item to Price Guardian...");
    await addToWishlist(userId, {
      id: newSku,
      sku: newSku,
      name: newName,
      brand: newBrand || undefined,
      current_price_inr: parseFloat(newPrice),
      target_price_inr: newTarget ? parseFloat(newTarget) : undefined,
      email: newEmail || undefined,
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
    toast.success("Item is now being watched!");
  };

  const selectedItem = wishlist.find((w) => w.sku === selectedSku);

  // Stats Calculations
  const watchedValue = wishlist.reduce((sum, w) => sum + w.current_price_inr, 0);
  const activeAlerts = wishlist.filter(w => w.target_price_inr).length;
  
  // Calculate simulated savings (differences from high point)
  const savedValue = wishlist.reduce((sum, w) => {
    const low = w.price_status?.thirty_day_low_inr || w.current_price_inr * 0.85;
    const current = w.current_price_inr;
    // Assume high is approximately the top of history
    const high = w.price_status?.thirty_day_high_inr || w.current_price_inr * 1.15;
    return sum + Math.max(0, high - current);
  }, 0);

  const bestPriceCount = wishlist.filter(w => w.price_status?.status === "best").length;

  // Selected item calculated metrics
  const itemLow = selectedItem?.price_status?.thirty_day_low_inr || (selectedItem ? selectedItem.current_price_inr * 0.85 : 0);
  const itemHigh = selectedItem?.price_status?.thirty_day_high_inr || (selectedItem ? selectedItem.current_price_inr * 1.15 : 0);
  const itemVolatility = selectedItem ? ((itemHigh - itemLow) / itemLow * 100).toFixed(1) : "0.0";
  const itemConfidence = selectedItem?.price_status?.confidence || 72;
  const itemSaved = selectedItem?.target_price_inr && selectedItem.current_price_inr <= selectedItem.target_price_inr
    ? Math.max(0, selectedItem.target_price_inr - selectedItem.current_price_inr)
    : 0;

  // Chart data mapping
  const chartData = selectedItem?.price_history?.map((pt, index) => {
    // Label as relative day offset (e.g. -29 to 0) to match screenshot
    const dayOffset = index - 29;
    return {
      day: dayOffset <= 0 ? `${dayOffset}` : `+${dayOffset}`,
      Price: pt.price_inr,
      "Competitor price": selectedItem.competitor_price_inr || pt.price_inr * 0.95
    };
  }) || [];

  return (
    <AppShell noFooter={true}>
      <div className="flex flex-col h-full bg-background/30 text-foreground overflow-hidden">
        
        {/* Main Header Card */}
        <div className="shrink-0 px-6 py-4 border-b border-border bg-card/65 backdrop-blur-md">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            {/* Title Block */}
            <div className="min-w-0">
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
                Price Guardian
              </h1>
              <p className="text-sm text-muted-foreground truncate mt-1">
                {wishlist.length} watches · seeded 30-day history · neighbor + competitor matching
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
                  disabled={isSimulating || wishlist.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-4 py-2 text-xs font-bold text-foreground transition-all hover:bg-surface hover:shadow-soft active:scale-[0.98] disabled:opacity-50"
                >
                  <Sparkles className={`h-3.5 w-3.5 text-brand ${isSimulating ? "animate-spin" : ""}`} />
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

        {/* Outer Split Pane Layout */}
        <div className="flex-1 flex overflow-hidden max-w-7xl w-full mx-auto p-4 md:p-6 gap-6">
          
          {/* Left Panel: Watchlist Cards */}
          <div className="w-full md:w-[350px] shrink-0 flex flex-col gap-3 overflow-y-auto pr-1">
            {wishlist.map((item) => {
              const isSelected = item.sku === selectedSku;
              const statusKey = item.price_status?.status || "fair";
              
              // Colors matching the design of dot highlights
              const statusColor = 
                statusKey === "best" ? "bg-green-500/10 text-green-700 border-green-500/25" :
                statusKey === "high" ? "bg-red-500/10 text-red-700 border-red-500/25" :
                "bg-yellow-500/10 text-yellow-700 border-yellow-500/25";
                
              const labelText = 
                statusKey === "best" ? "Already cheaper" :
                statusKey === "high" ? "Price Peak" :
                `Fair Price ${item.price_status?.confidence || 82}%`;

              return (
                <button
                  key={item.sku}
                  onClick={() => setSelectedSku(item.sku)}
                  className={`flex flex-col text-left p-4 rounded-2xl border transition-all duration-200 hover:shadow-soft group relative ${
                    isSelected 
                      ? "border-brand bg-card shadow-md shadow-brand/5 scale-[0.99]" 
                      : "border-border bg-card/45 hover:border-border-hover hover:bg-card"
                  }`}
                >
                  <div className="flex justify-between items-start gap-2 w-full">
                    <h3 className="font-bold text-sm text-foreground line-clamp-1 group-hover:text-brand transition-colors">
                      {item.name}
                    </h3>
                    <span className="font-black text-sm text-foreground shrink-0">
                      Rs {item.current_price_inr.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between w-full text-xs">
                    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${statusColor}`}>
                      {labelText}
                    </span>
                    {item.target_price_inr && (
                      <span className="text-muted-foreground font-semibold">
                        tgt Rs {item.target_price_inr.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                      </span>
                    )}
                  </div>

                  <div className="mt-2.5 pt-2.5 border-t border-border/40 flex items-center justify-between w-full text-[10px] text-muted-foreground font-semibold">
                    <span className="capitalize">{item.brand || "Generic"}</span>
                    {item.neighbor_match && (
                      <span className="text-brand flex items-center gap-0.5">
                        <Check className="h-3 w-3" /> local match
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Panel: Selected Item Detail */}
          <div className="flex-1 flex flex-col bg-card border border-border rounded-3xl overflow-y-auto p-6 shadow-soft">
            {selectedItem ? (
              <div className="flex flex-col gap-6">
                
                {/* Product Meta Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border/50 pb-5">
                  <div>
                    {/* Top Badges Row */}
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className="px-2.5 py-1 rounded-full border text-xs font-bold bg-green-500/10 text-green-700 border-green-500/25 flex items-center gap-1">
                        Already cheaper
                      </span>
                      <span className="px-2.5 py-1 rounded-full border text-xs font-bold bg-yellow-500/10 text-yellow-700 border-yellow-500/25">
                        FAIR PRICE {itemConfidence}%
                      </span>
                      <span className="px-2.5 py-1 rounded-full border text-xs font-bold bg-muted/30 text-muted-foreground border-border/50">
                        Average
                      </span>
                      {selectedItem.email && (
                        <span className="px-2.5 py-1 rounded-full border text-xs font-bold bg-brand/10 text-brand border-brand/20 flex items-center gap-1">
                          <Mail className="h-3.5 w-3.5" /> Email sent
                        </span>
                      )}
                      <span className="px-2.5 py-1 rounded-full border text-xs font-bold bg-indigo-500/10 text-indigo-700 border-indigo-500/20">
                        5.7 km
                      </span>
                    </div>

                    <h2 className="text-2xl font-black text-foreground">{selectedItem.name}</h2>
                    <p className="text-xs text-muted-foreground mt-1 font-semibold uppercase tracking-wider">
                      {selectedItem.brand || "Generic"} · SKU {selectedItem.sku}
                    </p>
                  </div>

                  <div className="text-left md:text-right shrink-0">
                    <div className="text-3xl font-black text-foreground">
                      Rs {selectedItem.current_price_inr.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </div>
                    {selectedItem.target_price_inr && (
                      <p className="text-xs text-muted-foreground mt-1 font-semibold">
                        target Rs {selectedItem.target_price_inr.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                      </p>
                    )}
                  </div>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                  <div className="bg-surface/50 border border-border/50 rounded-2xl p-4 text-center">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block mb-1">LOW</span>
                    <span className="text-base font-black text-foreground">Rs {itemLow.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
                  </div>
                  <div className="bg-surface/50 border border-border/50 rounded-2xl p-4 text-center">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block mb-1">HIGH</span>
                    <span className="text-base font-black text-foreground">Rs {itemHigh.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
                  </div>
                  <div className="bg-surface/50 border border-border/50 rounded-2xl p-4 text-center">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block mb-1">VOLATILITY</span>
                    <span className="text-base font-black text-foreground">{itemVolatility}%</span>
                  </div>
                  <div className="bg-surface/50 border border-border/50 rounded-2xl p-4 text-center">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block mb-1">CONFIDENCE</span>
                    <span className="text-base font-black text-foreground">{itemConfidence}%</span>
                  </div>
                  <div className="bg-surface/50 border border-border/50 rounded-2xl p-4 text-center">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block mb-1">SAVED</span>
                    <span className="text-base font-black text-success">Rs {itemSaved.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
                  </div>
                  <div className="bg-surface/50 border border-border/50 rounded-2xl p-4 text-center">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block mb-1">GREEN</span>
                    <span className="text-base font-black text-brand">{itemConfidence}</span>
                  </div>
                </div>

                {/* Recharts Price History Plot */}
                <div className="bg-surface/30 border border-border rounded-2xl p-4 md:p-6">
                  <h3 className="font-bold text-sm text-foreground mb-4 flex items-center gap-1.5">
                    Price History (30 Days + Projections)
                  </h3>
                  <div className="h-[260px] w-full">
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
                          <XAxis 
                            dataKey="day" 
                            stroke="#888888" 
                            fontSize={10} 
                            tickLine={false} 
                            axisLine={false} 
                            tickCount={15}
                          />
                          <YAxis 
                            stroke="#888888" 
                            fontSize={10} 
                            tickLine={false} 
                            axisLine={false}
                            domain={['auto', 'auto']}
                            tickFormatter={(v) => `₹${v}`}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              background: 'var(--background)', 
                              border: '1px border var(--border)', 
                              borderRadius: '12px',
                              fontSize: '11px',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                            }} 
                          />
                          <Area 
                            type="monotone" 
                            dataKey="Price" 
                            stroke="var(--color-brand, #3b82f6)" 
                            strokeWidth={2} 
                            fillOpacity={1} 
                            fill="url(#priceGrad)" 
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                        Calculating price history...
                      </div>
                    )}
                  </div>
                </div>

                {/* Under-Graph Information Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-card border border-border rounded-2xl p-4 flex flex-col justify-between">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-2">CO2 AVOIDED</span>
                    <span className="text-xl font-black text-foreground">0.00 kg</span>
                  </div>
                  <div className="bg-card border border-border rounded-2xl p-4 flex flex-col justify-between">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-2">LOGISTICS SAVED</span>
                    <span className="text-xl font-black text-foreground">Rs 3,642</span>
                  </div>
                  <div className="bg-card border border-border rounded-2xl p-4 flex flex-col justify-between">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-2">COMPETITOR</span>
                    <div className="flex items-baseline justify-between mt-1">
                      <span className="text-xl font-black text-foreground">
                        Rs {selectedItem.competitor_price_inr ? selectedItem.competitor_price_inr.toLocaleString("en-IN", { maximumFractionDigits: 0 }) : "N/A"}
                      </span>
                      <span className="text-xs font-bold text-brand uppercase">{selectedItem.competitor_source || "None"}</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Neighbor Price Match Display */}
                <div className="bg-surface/45 border border-border rounded-2xl p-5">
                  <h3 className="font-extrabold text-sm text-foreground uppercase tracking-wider flex items-center gap-1.5 mb-4">
                    <Scale className="h-4 w-4 text-brand" />
                    Neighbor Price - 5.7 km
                  </h3>
                  
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Original</div>
                      <div className="text-sm font-black text-foreground">
                        Rs {(selectedItem.current_price_inr * 0.99).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Logistics Saved</div>
                      <div className="text-sm font-black text-destructive">-Rs 3,642</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-brand mb-1">Your Price</div>
                      <div className="text-sm font-black text-brand">
                        Rs {(selectedItem.current_price_inr - 3642).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
                <AlertCircle className="h-10 w-10 text-muted-foreground/50 mb-3" />
                <h4 className="font-bold text-foreground">No watch selected</h4>
                <p className="text-xs max-w-xs mt-1">Select an item from the left pane to view detailed price history, neighbor matching, and logistics.</p>
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
                    value={newName}
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
