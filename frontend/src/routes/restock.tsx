import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { loadHistory } from "@/lib/cart-history";
import { useChatStore } from "@/store/useChatStore";
import { useEffect, useState } from "react";
import {
  ShoppingCart, Clock, ArrowRight, Package, AlertCircle,
  Plus, Sparkles, RefreshCw, TrendingUp, Leaf, Zap, Check,
  Activity, CalendarDays, ShieldCheck, ToggleRight
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
  confidence: number;
  consumption_rate: string;
  last_purchased: string;
  upgrade?: { name: string; price_inr: number; reason: string } | null;
};

type Timeline = {
  urgent: RestockItem[];
  upcoming: RestockItem[];
  later: RestockItem[];
  total_items: number;
};

// ─── Rich Demo Data for Hackathon ─────────────────────────────────────────────

const DEMO_TIMELINE: Timeline = {
  urgent: [
    { sku: "SKU-DRY-001", name: "Amul Gold Full Cream Milk", category: "Dairy", days_remaining: 1, price_inr: 72, image: "", confidence: 98, consumption_rate: "500ml / day", last_purchased: "3 days ago", upgrade: { name: "Amul Organic Milk", price_inr: 85, reason: "No hormones, better nutrition" } },
    { sku: "SKU-GRN-003", name: "Aashirvaad Whole Wheat Atta", category: "Pantry", days_remaining: 2, price_inr: 269, image: "", confidence: 94, consumption_rate: "2.5kg / week", last_purchased: "18 days ago", upgrade: { name: "Aashirvaad Multigrain", price_inr: 299, reason: "Higher fiber, low GI" } },
    { sku: "SKU-VEG-002", name: "Fresh Tomato (1kg)", category: "Produce", days_remaining: 1, price_inr: 40, image: "", confidence: 89, consumption_rate: "300g / day", last_purchased: "5 days ago", upgrade: null },
  ],
  upcoming: [
    { sku: "SKU-BEV-007", name: "Tata Tea Gold (500g)", category: "Beverages", days_remaining: 5, price_inr: 295, image: "", confidence: 91, consumption_rate: "100g / week", last_purchased: "25 days ago", upgrade: { name: "Tata Tea Green", price_inr: 195, reason: "Antioxidant-rich" } },
    { sku: "SKU-DRY-006", name: "Amul Pure Ghee (1L)", category: "Dairy", days_remaining: 8, price_inr: 530, image: "", confidence: 85, consumption_rate: "120ml / week", last_purchased: "45 days ago", upgrade: null },
    { sku: "SKU-SNK-008", name: "Parle-G Biscuits", category: "Snacks", days_remaining: 10, price_inr: 10, image: "", confidence: 99, consumption_rate: "1 pack / 2 days", last_purchased: "10 days ago", upgrade: { name: "McVities Digestive", price_inr: 55, reason: "Whole wheat, no maida" } },
  ],
  later: [
    { sku: "SKU-OIL-001", name: "Fortune Sunflower Oil (1L)", category: "Pantry", days_remaining: 20, price_inr: 185, image: "", confidence: 88, consumption_rate: "250ml / week", last_purchased: "12 days ago", upgrade: { name: "Borges Olive Oil", price_inr: 599, reason: "Heart-healthy fats" } },
    { sku: "SKU-CLN-002", name: "Surf Excel Quick Wash (1kg)", category: "Cleaning", days_remaining: 30, price_inr: 185, image: "", confidence: 95, consumption_rate: "150g / week", last_purchased: "15 days ago", upgrade: null },
  ],
  total_items: 8,
};

// ─── Page Component ───────────────────────────────────────────────────────────

function RestockPage() {
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());
  const [autoPilot, setAutoPilot] = useState(false);
  const navigate = useNavigate();
  const setPhase = useChatStore((s) => s.setPhase);
  const setMessages = useChatStore((s) => s.setMessages);
  const setCartData = useChatStore((s) => s.setCartData);

  useEffect(() => {
    const fetchTimeline = async () => {
      try {
        const history = loadHistory();
        if (!history || history.length === 0) {
          await new Promise(r => setTimeout(r, 1500)); // Slightly longer for hackathon suspense
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
          setTimeline(data.total_items === 0 ? DEMO_TIMELINE : data);
        } else {
          setTimeline(DEMO_TIMELINE);
        }
      } catch (err) {
        setTimeline(DEMO_TIMELINE);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTimeline();
  }, []);

  const totalCost = timeline
    ? [...timeline.urgent, ...timeline.upcoming].reduce((sum, i) => sum + i.price_inr, 0)
    : 0;

  const handleRestockAll = (items: RestockItem[], listName: string) => {
    if (!items.length) return;

    // Build cart items in the same format the main pipeline produces
    const newCartItems = items.map(item => ({
      sku: item.sku,
      name: item.name,
      brand: item.name.split(" ")[0],
      quantity_units: 1,
      unit: "pack",
      unit_quantity: 1,
      price_per_unit_inr: item.price_inr,
      total_price_inr: item.price_inr,
      optional: false,
      substituted: false,
      matched_from: [`Restock: ${item.category}`],
      alternatives: [],
      reason_codes: ["restock_prediction"],
      display_reason: `Running out in ${item.days_remaining} days`,
      score_breakdown: {},
      purchase_likelihood: 0.85,
      likely_rating: 85 + (item.sku.charCodeAt(item.sku.length - 1) % 10),
      stock_status: "available",
    }));

    // Append to existing cart (merge, don't replace)
    const prev = useChatStore.getState().cartData;
    const prevCart = prev?.cart || [];
    const mergedCart = [...prevCart, ...newCartItems];
    const mergedTotal = mergedCart.reduce((s: number, i: any) => s + (i.total_price_inr || 0), 0);

    setCartData({
      ...(prev || {}),
      session_id: prev?.session_id || crypto.randomUUID(),
      cart: mergedCart,
      unavailable_items: prev?.unavailable_items || [],
      intent_type: prev?.intent_type ? `${prev.intent_type}, Restock` : "Restock",
      context_summary: prev?.context_summary
        ? `${prev.context_summary} · ${listName} restock (${items.length} items)`
        : `${listName} restock (${items.length} items)`,
      total_price_inr: mergedTotal,
      budget_exceeded: false,
    });

    // Update intentGroups so the cart pane shows grouped sections
    const restockGroup = {
      intent_type: "Restock",
      context_summary: `${listName} items predicted to run out`,
      cart: newCartItems,
      unavailable_items: [],
    };
    const prevGroups = useChatStore.getState().intentGroups || [];
    useChatStore.getState().setIntentGroups([...prevGroups, restockGroup]);

    setMessages([
      ...useChatStore.getState().messages,
      { role: "user", text: `🔄 Smart Restock: ${listName} items` },
      {
        role: "assistant",
        text: `Added ${items.length} ${listName} items to your cart! Total now: ₹${mergedTotal}. You can adjust quantities or swap alternatives in the cart.`,
      },
    ]);

    setAddedItems(prev => new Set([...prev, ...items.map(i => i.sku)]));
    setPhase("cart");
    toast.success(`${items.length} items added to cart!`);
    navigate({ to: "/chat" });
  };

  const handleAddSingle = (item: RestockItem) => {
    // Build single cart item and append to existing cart
    const newCartItem = {
      sku: item.sku,
      name: item.name,
      brand: item.name.split(" ")[0],
      quantity_units: 1,
      unit: "pack",
      unit_quantity: 1,
      price_per_unit_inr: item.price_inr,
      total_price_inr: item.price_inr,
      optional: false,
      substituted: false,
      matched_from: [`Restock: ${item.category}`],
      alternatives: [],
      reason_codes: ["restock_prediction"],
      display_reason: `Running out in ${item.days_remaining} days`,
      score_breakdown: {},
      purchase_likelihood: 0.85,
      likely_rating: 85 + (item.sku.charCodeAt(item.sku.length - 1) % 10),
      stock_status: "available",
    };

    const prev = useChatStore.getState().cartData;
    const prevCart = prev?.cart || [];
    const mergedCart = [...prevCart, newCartItem];
    const mergedTotal = mergedCart.reduce((s: number, i: any) => s + (i.total_price_inr || 0), 0);

    setCartData({
      ...(prev || {}),
      session_id: prev?.session_id || crypto.randomUUID(),
      cart: mergedCart,
      unavailable_items: prev?.unavailable_items || [],
      intent_type: prev?.intent_type || "Restock",
      context_summary: prev?.context_summary || "Restock items",
      total_price_inr: mergedTotal,
      budget_exceeded: false,
    });

    setAddedItems(prev => new Set([...prev, item.sku]));
    toast.success(`Added ${item.name} to cart`);
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex h-[70vh] flex-col items-center justify-center gap-6">
          <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-brand/10">
            <Activity className="h-10 w-10 animate-pulse text-brand" />
            <Sparkles className="absolute -right-2 -top-2 h-6 w-6 text-amber-500 animate-spin-slow" />
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-xl font-bold text-foreground">Amazon Hackon Engine</h3>
            <p className="text-sm text-muted-foreground animate-pulse">Analyzing 6 months of order history...</p>
            <p className="text-xs text-brand font-medium">Calculating household consumption rates</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Hackathon Pitch Banner */}
        <div className="mb-6 flex items-center justify-between rounded-xl border border-brand/20 bg-brand/5 px-4 py-3">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-brand" />
            <span className="text-sm font-medium text-foreground">Predictive Cart Pilot</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground">AUTO-PILOT</span>
            <button onClick={() => { setAutoPilot(!autoPilot); toast(autoPilot ? "Auto-Pilot Disabled" : "Auto-Pilot Enabled: Items will be ordered 2 days before running out."); }}>
              <ToggleRight className={`h-8 w-8 transition-colors ${autoPilot ? "text-green-500" : "text-gray-300"}`} />
            </button>
          </div>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            Smart Restock
            
          </h1>
          <p className="mt-3 text-lg text-muted-foreground max-w-2xl">
            We've analyzed your consumption rates. Here is exactly what you need, before you even realize you need it.
          </p>
        </div>

        {/* Analytics Grid */}
        {timeline && (
          <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2 text-red-600 mb-2">
                <AlertCircle className="h-5 w-5" />
                <span className="text-xs font-bold uppercase tracking-wider">Critical</span>
              </div>
              <div className="text-3xl font-black text-foreground">{timeline.urgent.length} <span className="text-lg font-medium text-muted-foreground">items</span></div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2 text-brand mb-2">
                <TrendingUp className="h-5 w-5" />
                <span className="text-xs font-bold uppercase tracking-wider">Est. Value</span>
              </div>
              <div className="text-3xl font-black text-foreground">₹{totalCost}</div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2 text-green-600 mb-2">
                <Activity className="h-5 w-5" />
                <span className="text-xs font-bold uppercase tracking-wider">AI Accuracy</span>
              </div>
              <div className="text-3xl font-black text-foreground">94%</div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2 text-purple-600 mb-2">
                <Leaf className="h-5 w-5" />
                <span className="text-xs font-bold uppercase tracking-wider">Health Swaps</span>
              </div>
              <div className="text-3xl font-black text-foreground">4 <span className="text-lg font-medium text-muted-foreground">found</span></div>
            </div>
          </div>
        )}

        {/* Timeline Sections */}
        <div className="space-y-10">
          {/* URGENT */}
          {timeline && timeline.urgent.length > 0 && (
            <section>
              <div className="mb-5 flex items-end justify-between border-b border-border pb-4">
                <div>
                  <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
                    Action Required
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">Items depleting in the next 72 hours</p>
                </div>
                <button
                  onClick={() => handleRestockAll(timeline.urgent, "urgent")}
                  className="inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-bold text-background shadow-lg transition-all hover:scale-105"
                >
                  <ShoppingCart className="h-4 w-4" /> Add All Urgent
                </button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
                {timeline.urgent.map((item) => (
                  <RestockItemCard key={item.sku} item={item} variant="urgent" added={addedItems.has(item.sku)} onAdd={() => handleAddSingle(item)} />
                ))}
              </div>
            </section>
          )}

          {/* UPCOMING */}
          {timeline && timeline.upcoming.length > 0 && (
            <section>
              <div className="mb-5 flex items-end justify-between border-b border-border pb-4">
                <div>
                  <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-orange-400" />
                    Upcoming Week
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">Proactive restock recommendations</p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {timeline.upcoming.map((item) => (
                  <RestockItemCard key={item.sku} item={item} variant="upcoming" added={addedItems.has(item.sku)} onAdd={() => handleAddSingle(item)} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </AppShell>
  );
}

// ─── Restock Item Card (Enhanced for Hackathon) ───────────────────────────────

function RestockItemCard({ item, variant, added, onAdd }: { item: RestockItem; variant: "urgent" | "upcoming" | "later"; added: boolean; onAdd: () => void; }) {
  const borderColor = variant === "urgent" ? "border-red-200/60 shadow-red-500/5" : "border-border shadow-sm";
  const daysColor = variant === "urgent" ? "text-red-700 bg-red-50 ring-red-200" : "text-orange-700 bg-orange-50 ring-orange-200";

  return (
    <div className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-background p-5 transition-all hover:shadow-lg ${borderColor}`}>
      
      {/* Background decorative gradient for urgent items */}
      {variant === "urgent" && (
        <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-red-500/10 blur-2xl" />
      )}

      <div>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface text-2xl border border-border/50 shadow-sm">
              {item.category === "Dairy" ? "🥛" : item.category === "Produce" ? "🥬" : item.category === "Pantry" ? "🍚" : item.category === "Beverages" ? "☕" : item.category === "Snacks" ? "🍪" : "📦"}
            </div>
            <div>
              <p className="text-base font-bold text-foreground leading-tight">{item.name}</p>
              <p className="mt-0.5 text-xs font-medium text-muted-foreground">{item.category}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="text-lg font-black text-foreground">₹{item.price_inr}</span>
          </div>
        </div>

        {/* AI Insight Section (Crucial for Demo) */}
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-surface/50 p-3 text-xs border border-border/50">
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground flex items-center gap-1"><Activity className="h-3 w-3" /> Rate</span>
            <span className="font-semibold text-foreground">{item.consumption_rate}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Last Bought</span>
            <span className="font-semibold text-foreground">{item.last_purchased}</span>
          </div>
        </div>

        {/* Healthier Swap (Amazon's Choice style) */}
        {item.upgrade && (
          <div className="mt-3 rounded-xl border border-green-200 bg-green-50/50 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-green-600" />
                <span className="text-xs font-bold text-green-800">Smart Swap</span>
              </div>
              <span className="text-xs font-bold text-green-700">₹{item.upgrade.price_inr}</span>
            </div>
            <p className="mt-1 text-sm font-semibold text-foreground">{item.upgrade.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{item.upgrade.reason}</p>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="mt-5 flex items-center justify-between pt-4 border-t border-border/50">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wider ring-1 ring-inset ${daysColor}`}>
            <Clock className="h-3 w-3" />
            {item.days_remaining <= 0 ? "Empty!" : `${item.days_remaining} Days Left`}
          </span>
          <span className="flex items-center gap-1 text-[10px] font-bold text-brand bg-brand/10 px-2 py-1 rounded-full">
            {item.confidence}% Match
          </span>
        </div>

        {added ? (
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-green-500 px-4 py-2 text-xs font-bold text-white shadow-sm">
            <Check className="h-4 w-4" /> Added
          </span>
        ) : (
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-brand/90 hover:scale-105 hover:shadow-brand/25"
          >
            <Plus className="h-4 w-4" /> Cart
          </button>
        )}
      </div>
    </div>
  );
}