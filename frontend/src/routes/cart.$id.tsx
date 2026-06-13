import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Check, ChevronDown, Info, Sparkles, TrendingDown, Wallet } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { toast } from "sonner";

export const Route = createFileRoute("/cart/$id")({
  head: () => ({
    meta: [
      { title: "Review cart — NeedSpeak" },
      { name: "description", content: "Review every item with reasoning, alternatives, and budget control before checkout." },
      { property: "og:title", content: "ReviewCart — NeedSpeak" },
      { property: "og:description", content: "Explainable shopping with budget control." },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const { id } = Route.useParams();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/session/${id}`)
      .then(res => res.json())
      .then(data => {
        setSession(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [id]);

  const [compareOpen, setCompareOpen] = useState(false);
  const [whatIfBudget, setWhatIfBudget] = useState(1200);

  if (loading) {
    return <AppShell><div className="flex items-center justify-center p-20 text-muted-foreground">Loading cart details...</div></AppShell>;
  }

  if (!session) {
    return <AppShell><div className="flex items-center justify-center p-20 text-muted-foreground">Cart not found</div></AppShell>;
  }

  const updateItemQuantity = (intentIdx: number, sku: string, delta: number) => {
    if (!session) return;
    const newSession = JSON.parse(JSON.stringify(session));
    const intentGroup = newSession.resolved_intents[intentIdx];
    if (!intentGroup) return;
    
    const itemIdx = intentGroup.cart.findIndex((it: any) => it.sku === sku);
    if (itemIdx === -1) return;
    
    const item = intentGroup.cart[itemIdx];
    const newQty = item.quantity_units + delta;
    
    if (newQty <= 0) {
      intentGroup.cart.splice(itemIdx, 1);
    } else {
      item.quantity_units = newQty;
      item.total_price_inr = newQty * item.price_per_unit_inr;
    }
    
    // Recompute total price for the session
    let newTotal = 0;
    newSession.resolved_intents.forEach((group: any) => {
      group.cart.forEach((it: any) => {
        newTotal += it.total_price_inr;
      });
    });
    newSession.total_price_inr = newTotal;
    
    setSession(newSession);
  };

  const budget = session.budget_inr || 1500;
  const allItems = session.resolved_intents?.flatMap((i: any) => i.cart) || [];
  
  const total = useMemo(
    () => allItems.reduce((s: number, it: any) => s + it.total_price_inr, 0),
    [allItems]
  );

  const budgetPct = Math.min(100, (total / budget) * 100);
  const potentialSavings = 0; // Not fully implemented in backend yet

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">ReviewCart</div>
            <h1 className="mt-1 truncate text-3xl font-semibold tracking-tight">Your Cart</h1>
            <p className="mt-1 text-sm text-muted-foreground">budget ₹{budget}</p>
          </div>
          <button
            onClick={() => setCompareOpen(true)}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm hover:border-foreground"
          >
            <ArrowLeftRight className="h-4 w-4" />
            <span className="hidden sm:inline">CompareCart</span>
          </button>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
          {/* Items */}
          <div className="space-y-6">
            {session.resolved_intents?.map((intentGroup: any, idx: number) => (
              <div key={idx} className="space-y-3">
                <div className="text-lg font-semibold border-b border-border pb-2">{intentGroup.intent_type}</div>
                {intentGroup.cart?.map((it: any) => {
                  return (
                    <div key={it.sku || it.name} className="rounded-2xl border border-border bg-card">
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 p-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{it.brand}</span>
                            {it.substituted && (
                              <span className="rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-medium text-success">Substituted</span>
                            )}
                          </div>
                          <div className="mt-0.5 truncate text-base font-medium">{it.name}</div>
                          
                          <div className="mt-2 flex items-center gap-2">
                            <div className="flex items-center rounded-lg border border-border bg-surface text-xs font-semibold overflow-hidden">
                              <button 
                                onClick={() => updateItemQuantity(idx, it.sku, -1)}
                                className="px-2.5 py-1 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground cursor-pointer select-none"
                              >
                                -
                              </button>
                              <span className="px-2.5 font-mono text-xs min-w-[14px] text-center select-none">{it.quantity_units}</span>
                              <button 
                                onClick={() => updateItemQuantity(idx, it.sku, 1)}
                                className="px-2.5 py-1 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground cursor-pointer select-none"
                              >
                                +
                              </button>
                            </div>
                            <span className="text-xs text-muted-foreground">· {it.category}</span>
                          </div>

                          {/* Why */}
                          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-xs text-muted-foreground">
                            <Info className="h-3.5 w-3.5 text-brand" />
                            Why? {it.substituted ? it.substitution_reason : `Matched from: ${it.matched_from?.join(", ") || it.name}`}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-lg font-semibold">₹{it.total_price_inr}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {intentGroup.unavailable_items?.length > 0 && (
                  <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 mt-2">
                    <div className="text-sm font-semibold text-destructive mb-2">Unavailable Items</div>
                    <ul className="text-xs text-destructive/80 space-y-1">
                      {intentGroup.unavailable_items.map((it: any, i: number) => (
                        <li key={i}>• {it.name} - {it.reason}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Sidebar: budget + goal + review */}
          <aside className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 text-sm">
                <Wallet className="h-4 w-4 text-brand" />
                <span className="font-medium">Budget</span>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-2xl font-semibold">₹{total}</span>
                <span className="text-sm text-muted-foreground">/ ₹{budget}</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface">
                <div
                  className={`h-full ${total > budget ? "bg-destructive" : "bg-brand"}`}
                  style={{ width: `${budgetPct}%` }}
                />
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {total > budget ? `₹${total - budget} over budget` : `₹${budget - total} remaining`}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4 text-brand" />
                <span className="font-medium">GoalCart suggestions</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">You're in control. Budget optimization active.</p>
              <ul className="mt-3 space-y-2">
                {allItems.filter((i: any) => i.substituted).map((it: any, i: number) => (
                  <li key={i} className="flex items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2 text-xs">
                    <span className="min-w-0 truncate">Substituted for {it.category}</span>
                    <span className="shrink-0 font-medium text-success">Cheaper alt</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="text-sm font-medium">Final review</div>
              <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                {["Assumptions look right", "Quantities matched", "Budget within range"].map((q) => (
                  <li key={q} className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-brand" />
                    {q}
                  </li>
                ))}
              </ul>
              <button 
                onClick={() => toast.success("Checkout successful! Mock order placed.")}
                className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-lg bg-brand text-sm font-semibold text-brand-foreground hover:bg-brand/90"
              >
                Proceed to checkout
              </button>
            </div>
          </aside>
        </div>
      </div>

      {/* CompareCart modal */}
      {compareOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4" onClick={() => setCompareOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-pop">
            <div className="text-lg font-semibold">CompareCart — What if?</div>
            <p className="mt-1 text-sm text-muted-foreground">Tweak inputs to see how your cart changes.</p>

            <div className="mt-5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Budget</span>
                <span className="font-medium">₹{whatIfBudget}</span>
              </div>
              <input
                type="range"
                min={500}
                max={3000}
                step={100}
                value={whatIfBudget}
                onChange={(e) => setWhatIfBudget(Number(e.target.value))}
                className="mt-2 w-full accent-[var(--color-brand)]"
              />
            </div>

            <div className="mt-5 space-y-2 text-sm">
              <div className="flex items-center justify-between rounded-lg bg-surface px-3 py-2">
                <span className="text-muted-foreground">New estimated total</span>
                <span className="font-semibold">₹{Math.round(total * (whatIfBudget / budget))}</span>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setCompareOpen(false)} className="h-10 rounded-lg border border-border bg-background px-4 text-sm hover:bg-surface">Close</button>
              <button onClick={() => { setCompareOpen(false); toast.info("CompareCart simulation applied. Backend integration coming soon."); }} className="h-10 rounded-lg bg-foreground px-4 text-sm font-medium text-background hover:bg-foreground/90">Apply changes</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
