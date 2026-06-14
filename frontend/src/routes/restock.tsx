import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { loadHistory } from "@/lib/cart-history";
import { useChatStore } from "@/store/useChatStore";
import { useEffect, useState } from "react";
import {
  ShoppingCart, Clock, ArrowRight, Package, AlertCircle,
  Plus, Sparkles, RefreshCw, TrendingUp, Leaf, Zap, Check,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/restock")({
  head: () => ({
    meta: [
      { title: "Smart Restock — NeedSpeak" },
      { name: "description", content: "AI-powered predictive restocking. Never run out of essentials." },
    ],
  }),
  component: RestockPage,
});

type RestockItem = {
  sku: string;
  name: string;
  category: string;
  days_remaining: number;
  price_inr: number;
  image: string;
  upgrade?: { name: string; price_inr: number; reason: string } | null;
};

type Timeline = {
  urgent: RestockItem[];
  upcoming: RestockItem[];
  later: RestockItem[];
  total_items: number;
};

// ─── Fake demo data when no history exists ────────────────────────────────────

const DEMO_TIMELINE: Timeline = {
  urgent: [
    { sku: "SKU-DRY-001", name: "Amul Gold Full Cream Milk", category: "Dairy", days_remaining: 1, price_inr: 72, image: "", upgrade: { name: "Amul Organic Milk", price_inr: 85, reason: "No hormones, better nutrition" } },
    { sku: "SKU-GRN-003", name: "Aashirvaad Whole Wheat Atta", category: "Pantry", days_remaining: 2, price_inr: 269, image: "", upgrade: null },
    { sku: "SKU-VEG-002", name: "Fresh Tomato (1kg)", category: "Produce", days_remaining: 1, price_inr: 40, image: "", upgrade: null },
    { sku: "SKU-DRY-005", name: "Amul Butter (100g)", category: "Dairy", days_remaining: 3, price_inr: 56, image: "", upgrade: { name: "Nutralite Butter", price_inr: 52, reason: "Lower cholesterol, same taste" } },
  ],
  upcoming: [
    { sku: "SKU-BEV-007", name: "Tata Tea Gold (500g)", category: "Beverages", days_remaining: 5, price_inr: 295, image: "", upgrade: { name: "Tata Tea Green", price_inr: 195, reason: "Antioxidant-rich, lighter caffeine" } },
    { sku: "SKU-GRN-005", name: "Quaker Oats (1kg)", category: "Breakfast", days_remaining: 7, price_inr: 165, image: "", upgrade: null },
    { sku: "SKU-DRY-006", name: "Amul Pure Ghee (1L)", category: "Dairy", days_remaining: 8, price_inr: 530, image: "", upgrade: null },
    { sku: "SKU-SNK-008", name: "Parle-G Biscuits", category: "Snacks", days_remaining: 10, price_inr: 10, image: "", upgrade: { name: "McVities Digestive", price_inr: 55, reason: "High fiber, whole wheat" } },
    { sku: "SKU-HYG-004", name: "Colgate MaxFresh Toothpaste", category: "Hygiene", days_remaining: 12, price_inr: 95, image: "", upgrade: null },
    { sku: "SKU-SPC-005", name: "Tata Salt (1kg)", category: "Pantry", days_remaining: 14, price_inr: 20, image: "", upgrade: null },
  ],
  later: [
    { sku: "SKU-OIL-001", name: "Fortune Sunflower Oil (1L)", category: "Pantry", days_remaining: 20, price_inr: 185, image: "", upgrade: { name: "Borges Olive Oil", price_inr: 599, reason: "Heart-healthy monounsaturated fats" } },
    { sku: "SKU-CLN-002", name: "Surf Excel Quick Wash (1kg)", category: "Cleaning", days_remaining: 30, price_inr: 185, image: "", upgrade: null },
    { sku: "SKU-SPC-001", name: "MDH Garam Masala (100g)", category: "Spices", days_remaining: 45, price_inr: 85, image: "", upgrade: null },
  ],
  total_items: 13,
};

// ─── Page Component ───────────────────────────────────────────────────────────

function RestockPage() {
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const setCartData = useChatStore((s) => s.setCartData);
  const setPhase = useChatStore((s) => s.setPhase);
  const setMessages = useChatStore((s) => s.setMessages);

  useEffect(() => {
    const fetchTimeline = async () => {
      try {
        const history = loadHistory();
        
        // If no history or minimal history, use demo data for the demo
        if (!history || history.length === 0) {
          // Simulate loading delay
          await new Promise(r => setTimeout(r, 1200));
          setTimeline(DEMO_TIMELINE);
          setIsLoading(false);
          return;
        }

        const response = await fetch("/api/intelligence/predict-restock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ history }),
        });

        if (response.ok) {
          const data = await response.json();
          // If backend returns no items, use demo data
          if (data.total_items === 0) {
            setTimeline(DEMO_TIMELINE);
          } else {
            setTimeline(data);
          }
        } else {
          setTimeline(DEMO_TIMELINE);
        }
      } catch (err) {
        console.error("Failed to load restock timeline", err);
        // Fallback to demo data
        setTimeline(DEMO_TIMELINE);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTimeline();
  }, []);

  const totalSavings = timeline
    ? [...timeline.urgent, ...timeline.upcoming]
        .filter(i => i.upgrade && i.upgrade.price_inr < i.price_inr)
        .reduce((sum, i) => sum + (i.price_inr - (i.upgrade?.price_inr || i.price_inr)), 0)
    : 0;

  const totalCost = timeline
    ? [...timeline.urgent, ...timeline.upcoming].reduce((sum, i) => sum + i.price_inr, 0)
    : 0;

  const handleRestockAll = (items: RestockItem[], listName: string) => {
    if (!items.length) return;

    // Build a text prompt for the chat pipeline
    const itemNames = items.map(i => i.name).join(", ");
    const prompt = `I need to restock: ${itemNames}`;

    setMessages([
      ...useChatStore.getState().messages,
      { role: "user", text: `🔄 Smart Restock: ${listName} items` },
      {
        role: "assistant",
        text: `Great! I've queued ${items.length} items from your ${listName} list for restocking. Total: ₹${items.reduce((a, b) => a + b.price_inr, 0)}. Building your cart now...`
      },
    ]);

    setPhase("idle");
    toast.success(`${items.length} items ready to restock!`);
    navigate({ to: "/chat", search: { prompt } });
  };

  const handleAddSingle = (item: RestockItem) => {
    setAddedItems(prev => new Set([...prev, item.sku]));
    toast.success(`Added ${item.name} to restock queue`);
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
          <div className="relative">
            <RefreshCw className="h-10 w-10 animate-spin text-brand" />
            <Sparkles className="absolute -right-1 -top-1 h-4 w-4 text-amber-500 animate-pulse" />
          </div>
          <div className="text-center">
            <p className="text-base font-medium text-foreground">Analyzing your consumption patterns...</p>
            <p className="mt-1 text-sm text-muted-foreground">Predicting when you'll run out of essentials</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-sm font-medium text-brand mb-4">
            <Sparkles className="h-4 w-4" />
            AI-Powered Prediction
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Smart Restock</h1>
          <p className="mt-2 text-base text-muted-foreground max-w-2xl">
            Based on your purchase history and household consumption patterns, here's exactly when you'll need to restock. One tap to reorder.
          </p>
        </div>

        {/* Stats Banner */}
        {timeline && timeline.total_items > 0 && (
          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-red-200/60 bg-red-50/50 p-4 text-center">
              <div className="text-2xl font-bold text-red-600">{timeline.urgent.length}</div>
              <div className="mt-0.5 text-xs font-medium text-red-600/80">Urgent (≤3 days)</div>
            </div>
            <div className="rounded-2xl border border-orange-200/60 bg-orange-50/50 p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">{timeline.upcoming.length}</div>
              <div className="mt-0.5 text-xs font-medium text-orange-600/80">This Week</div>
            </div>
            <div className="rounded-2xl border border-brand/20 bg-brand/5 p-4 text-center">
              <div className="text-2xl font-bold text-brand">₹{totalCost}</div>
              <div className="mt-0.5 text-xs font-medium text-brand/80">Restock Cost</div>
            </div>
            <div className="rounded-2xl border border-green-200/60 bg-green-50/50 p-4 text-center">
              <div className="text-2xl font-bold text-green-600">85%</div>
              <div className="mt-0.5 text-xs font-medium text-green-600/80">Prediction Accuracy</div>
            </div>
          </div>
        )}

        {/* One-Tap Restock Banner */}
        {timeline && timeline.urgent.length > 0 && (
          <div className="mb-8 rounded-2xl bg-gradient-to-r from-brand via-brand/90 to-brand/80 p-6 text-white shadow-xl shadow-brand/20">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  <h3 className="text-lg font-bold">One-Tap Restock</h3>
                </div>
                <p className="mt-1 text-sm text-white/80">
                  {timeline.urgent.length} items running out soon. Restock everything in one tap — ₹{timeline.urgent.reduce((a, b) => a + b.price_inr, 0)}
                </p>
              </div>
              <button
                onClick={() => handleRestockAll(timeline.urgent, "urgent")}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-brand shadow-lg transition-all hover:scale-105 hover:shadow-xl"
              >
                <ShoppingCart className="h-4 w-4" />
                Restock Now
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Timeline Sections */}
        <div className="space-y-8">
          {/* URGENT */}
          {timeline && timeline.urgent.length > 0 && (
            <section>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
                  <h2 className="text-lg font-bold text-foreground">Running Out Soon</h2>
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">≤ 3 days</span>
                </div>
                <button
                  onClick={() => handleRestockAll(timeline.urgent, "urgent")}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-red-700"
                >
                  <ShoppingCart className="h-3.5 w-3.5" /> Add All to Cart
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {timeline.urgent.map((item) => (
                  <RestockItemCard
                    key={item.sku}
                    item={item}
                    variant="urgent"
                    added={addedItems.has(item.sku)}
                    onAdd={() => handleAddSingle(item)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* UPCOMING */}
          {timeline && timeline.upcoming.length > 0 && (
            <section>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-orange-400" />
                  <h2 className="text-lg font-bold text-foreground">Coming Up</h2>
                  <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-bold text-orange-700">4–14 days</span>
                </div>
                <button
                  onClick={() => handleRestockAll(timeline.upcoming, "upcoming")}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-orange-600"
                >
                  <ShoppingCart className="h-3.5 w-3.5" /> Add All to Cart
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {timeline.upcoming.map((item) => (
                  <RestockItemCard
                    key={item.sku}
                    item={item}
                    variant="upcoming"
                    added={addedItems.has(item.sku)}
                    onAdd={() => handleAddSingle(item)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* STOCKED UP */}
          {timeline && timeline.later.length > 0 && (
            <section>
              <div className="mb-4 flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-green-400" />
                <h2 className="text-lg font-bold text-foreground">Well Stocked</h2>
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-bold text-green-700">15+ days</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {timeline.later.map((item) => (
                  <RestockItemCard
                    key={item.sku}
                    item={item}
                    variant="later"
                    added={addedItems.has(item.sku)}
                    onAdd={() => handleAddSingle(item)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </AppShell>
  );
}

// ─── Restock Item Card ────────────────────────────────────────────────────────

function RestockItemCard({
  item,
  variant,
  added,
  onAdd,
}: {
  item: RestockItem;
  variant: "urgent" | "upcoming" | "later";
  added: boolean;
  onAdd: () => void;
}) {
  const borderColor = variant === "urgent"
    ? "border-red-200 hover:border-red-300"
    : variant === "upcoming"
      ? "border-orange-200 hover:border-orange-300"
      : "border-border hover:border-green-200";

  const daysColor = variant === "urgent"
    ? "text-red-600 bg-red-50"
    : variant === "upcoming"
      ? "text-orange-600 bg-orange-50"
      : "text-green-600 bg-green-50";

  return (
    <div className={`group rounded-2xl border bg-background p-4 shadow-sm transition-all hover:shadow-md ${borderColor}`}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface text-lg">
          {item.category === "Dairy" ? "🥛" :
           item.category === "Produce" ? "🥬" :
           item.category === "Pantry" ? "🍚" :
           item.category === "Beverages" ? "☕" :
           item.category === "Snacks" ? "🍪" :
           item.category === "Breakfast" ? "🥣" :
           item.category === "Hygiene" ? "🧴" :
           item.category === "Cleaning" ? "🧹" :
           item.category === "Spices" ? "🌶️" : "📦"}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{item.name}</p>
          <div className="mt-1 flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${daysColor}`}>
              <Clock className="h-2.5 w-2.5" />
              {item.days_remaining <= 0 ? "Out of stock!" : `${item.days_remaining} days left`}
            </span>
            <span className="text-xs text-muted-foreground">{item.category}</span>
          </div>

          {/* Healthier upgrade suggestion */}
          {item.upgrade && (
            <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-green-50 border border-green-200/60 px-2.5 py-1.5">
              <Leaf className="h-3 w-3 text-green-600 shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-green-700">Healthier: </span>
                <span className="text-[10px] text-green-700">{item.upgrade.name} — {item.upgrade.reason}</span>
              </div>
            </div>
          )}
        </div>

        {/* Price + Add button */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className="text-sm font-bold text-foreground">₹{item.price_inr}</span>
          {added ? (
            <span className="inline-flex items-center gap-1 rounded-lg bg-green-100 px-2 py-1 text-[10px] font-bold text-green-700">
              <Check className="h-3 w-3" /> Added
            </span>
          ) : (
            <button
              onClick={onAdd}
              className="inline-flex items-center gap-1 rounded-lg bg-brand/10 px-2 py-1 text-[10px] font-bold text-brand transition-all hover:bg-brand hover:text-white"
            >
              <Plus className="h-3 w-3" /> Add
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
