import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { loadHistory } from "@/lib/cart-history";
import { useChatStore } from "@/store/useChatStore";
import { useEffect, useState } from "react";
import { ShoppingCart, Clock, ArrowRight, Package, AlertCircle, Plus, Sparkles, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/restock")({
  component: RestockPage,
});

type RestockItem = {
  sku: string;
  name: string;
  category: string;
  days_remaining: number;
  price_inr: number;
  image: string;
};

type Timeline = {
  urgent: RestockItem[];
  upcoming: RestockItem[];
  later: RestockItem[];
  total_items: number;
};

function RestockPage() {
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const setCartData = useChatStore((s) => s.setCartData);
  const setPhase = useChatStore((s) => s.setPhase);
  const setMessages = useChatStore((s) => s.setMessages);

  useEffect(() => {
    const fetchTimeline = async () => {
      try {
        const history = loadHistory();
        const response = await fetch("/api/intelligence/predict-restock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ history }),
        });
        
        if (response.ok) {
          const data = await response.json();
          setTimeline(data);
        }
      } catch (err) {
        console.error("Failed to load restock timeline", err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchTimeline();
  }, []);

  const handleRestockAll = (items: RestockItem[], listName: string) => {
    if (!items.length) return;
    
    // Convert to cart items
    const newCartItems = items.map(item => ({
      ...item,
      quantity: 1,
      id: crypto.randomUUID(),
      unit: "unit",
      unit_quantity: 1,
      total_price_inr: item.price_inr
    }));
    
    const cartData = useChatStore.getState().cartData;
    const currentItems = cartData?.items || [];
    
    setCartData({
      session_id: cartData?.session_id || crypto.randomUUID(),
      items: [...currentItems, ...newCartItems],
      total_price_inr: (cartData?.total_price_inr || 0) + newCartItems.reduce((a, b) => a + b.price_inr, 0),
      budget_inr: cartData?.budget_inr || 0,
      context_summary: `Restocked ${listName} items`,
      intents: cartData?.intents || [],
      saved_at: new Date().toISOString(),
      item_count: currentItems.length + newCartItems.length
    });
    
    toast.success(`Added ${newCartItems.length} items to your cart!`);
    
    // Quick prompt the AI
    setMessages([
      ...useChatStore.getState().messages,
      {
        role: "assistant",
        text: `I've added the ${listName} items to your active cart to prevent you from running out! Would you like me to find alternatives or are we ready to checkout?`
      }
    ]);
    
    setPhase("cart");
    navigate({ to: "/chat" });
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
          <RefreshCw className="h-8 w-8 animate-spin text-brand" />
          <p className="text-muted-foreground animate-pulse">Analyzing your consumption habits...</p>
        </div>
      </AppShell>
    );
  }

  const hasItems = timeline && timeline.total_items > 0;

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-sm font-medium text-brand mb-4">
            <Sparkles className="h-4 w-4" />
            Zero-Waste Intelligence
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Predictive Restock</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
            We've analyzed your household's consumption rate. Here is exactly when you'll run out of your staples. Restock just in time, and never over-subscribe again.
          </p>
        </div>

        {!hasItems ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/60 bg-surface/30 py-24 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface/50">
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">Not enough data yet</h3>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              We need a few more past orders to accurately predict your household consumption horizons.
            </p>
            <button
              onClick={() => navigate({ to: "/chat" })}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground shadow-lg shadow-brand/20 transition-all hover:scale-105 hover:bg-brand/90"
            >
              Start Shopping
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Urgent Restock */}
            {timeline.urgent.length > 0 && (
              <div className="rounded-3xl border border-red-500/20 bg-red-500/5 overflow-hidden">
                <div className="bg-red-500/10 px-6 py-4 flex items-center justify-between border-b border-red-500/10">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    <h2 className="text-lg font-bold text-red-900">Urgent: Running out in 3 days</h2>
                  </div>
                  <button 
                    onClick={() => handleRestockAll(timeline.urgent, "urgent")}
                    className="bg-red-600 hover:bg-red-700 text-white text-sm px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2 shadow-sm"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    Restock All
                  </button>
                </div>
                <div className="p-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {timeline.urgent.map((item, i) => (
                    <div key={i} className="flex gap-4 items-center bg-background rounded-2xl p-4 border border-red-100 shadow-sm">
                      <div className="h-12 w-12 rounded-xl bg-surface flex items-center justify-center text-xl shrink-0 overflow-hidden">
                         {item.image ? <img src={item.image} className="object-cover w-full h-full" /> : "📦"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{item.name}</p>
                        <p className="text-xs text-red-600 font-medium">{item.days_remaining} days left</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming Restock */}
            {timeline.upcoming.length > 0 && (
              <div className="rounded-3xl border border-orange-500/20 bg-orange-500/5 overflow-hidden">
                <div className="bg-orange-500/10 px-6 py-4 flex items-center justify-between border-b border-orange-500/10">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-orange-600" />
                    <h2 className="text-lg font-bold text-orange-900">Upcoming: Next 2 weeks</h2>
                  </div>
                  <button 
                    onClick={() => handleRestockAll(timeline.upcoming, "upcoming")}
                    className="bg-orange-600 hover:bg-orange-700 text-white text-sm px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2 shadow-sm"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    Restock All
                  </button>
                </div>
                <div className="p-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {timeline.upcoming.map((item, i) => (
                    <div key={i} className="flex gap-4 items-center bg-background rounded-2xl p-4 border border-orange-100 shadow-sm hover:border-orange-200 transition-colors">
                      <div className="h-12 w-12 rounded-xl bg-surface flex items-center justify-center text-xl shrink-0 overflow-hidden">
                         {item.image ? <img src={item.image} className="object-cover w-full h-full" /> : "📦"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{item.name}</p>
                        <p className="text-xs text-orange-600 font-medium">Runs out in {item.days_remaining} days</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Later Restock */}
            {timeline.later.length > 0 && (
              <div className="rounded-3xl border border-border bg-card overflow-hidden">
                <div className="bg-surface/50 px-6 py-4 flex items-center justify-between border-b border-border">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-muted-foreground" />
                    <h2 className="text-lg font-bold">You're stocked up for now</h2>
                  </div>
                </div>
                <div className="p-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {timeline.later.map((item, i) => (
                    <div key={i} className="flex gap-4 items-center bg-background rounded-2xl p-4 border border-border shadow-sm">
                      <div className="h-12 w-12 rounded-xl bg-surface flex items-center justify-center text-xl shrink-0 overflow-hidden">
                         {item.image ? <img src={item.image} className="object-cover w-full h-full" /> : "📦"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground font-medium">{item.days_remaining} days left</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </AppShell>
  );
}
