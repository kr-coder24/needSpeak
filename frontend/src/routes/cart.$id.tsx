import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  ArrowLeftRight,
  Check,
  Download,
  Info,
  Share2,
  Sparkles,
  Wallet,
  Loader2,
  Plus,
  Minus,
  ArrowRight,
  Users,
  Leaf,
  AlertTriangle,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { downloadCSV, copyWhatsAppToClipboard, type ExportableCart } from "@/lib/cart-export";
import { SemanticSearchSkeleton } from "@/components/common/SemanticSearchSkeleton";

export const Route = createFileRoute("/cart/$id")({
  head: () => ({
    meta: [
      { title: "Review cart — NeedSpeak" },
      {
        name: "description",
        content:
          "Review every item with reasoning, alternatives, and budget control before checkout.",
      },
      { property: "og:title", content: "ReviewCart — NeedSpeak" },
      { property: "og:description", content: "Explainable shopping with budget control." },
    ],
  }),
  component: CartPage,
});

function UnavailableItemRow({ item }: { item: any }) {
  const reasonText = item.reason
    ? item.reason.replace(/_/g, " ")
    : "Unavailable";
  
  const isOutOfStock = item.reason === "out_of_stock";
  const badgeBg = isOutOfStock
    ? "bg-gradient-to-br from-amber-500/15 to-amber-600/10 text-amber-700 dark:text-amber-400 border-amber-500/25 shadow-sm shadow-amber-500/10"
    : "bg-gradient-to-br from-destructive/15 to-destructive/10 text-destructive border-destructive/25 shadow-sm shadow-destructive/10";
  const iconColor = isOutOfStock 
    ? "bg-gradient-to-br from-amber-500/15 to-amber-600/10 text-amber-600 dark:text-amber-400 shadow-sm shadow-amber-500/5" 
    : "bg-gradient-to-br from-destructive/15 to-destructive/10 text-destructive shadow-sm shadow-destructive/5";

  return (
    <div className="group rounded-2xl border border-border/60 bg-gradient-to-br from-background/70 to-background/40 p-4 shadow-sm backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:shadow-destructive/5 hover:border-destructive/40 hover:scale-[1.01]">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 ${iconColor}`}>
            <AlertTriangle className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold capitalize text-foreground">{item.name}</div>
            <div className="mt-0.5 text-xs font-medium text-muted-foreground">
              Not added to cart
            </div>
          </div>
        </div>
        <div className="shrink-0">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold capitalize tracking-wide transition-transform duration-300 group-hover:scale-105 ${badgeBg}`}>
            {reasonText}
          </span>
        </div>
      </div>
    </div>
  );
}

function CartPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [whatIfBudget, setWhatIfBudget] = useState(1500);
  const [whatIfAttendees, setWhatIfAttendees] = useState<number>(10);
  const [whatIfDietary, setWhatIfDietary] = useState<string>("any");
  const [copySuccess, setCopySuccess] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizationSummary, setOptimizationSummary] = useState<string | null>(null);
  const [reserving, setReserving] = useState(false);
  const [reservationStatus, setReservationStatus] = useState<"idle" | "success" | "error">("idle");
  const [reservationMessage, setReservationMessage] = useState<string>("");

  // Fetch session data from the backend
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch(`/api/session/${id}`);
        if (!res.ok) {
          throw new Error(res.status === 404 ? "Session not found" : `Error ${res.status}`);
        }
        const data = await res.json();
        setSession(data);
        setSession(data);
      } catch (e: any) {
        setError(e.message || "Failed to load session");
      } finally {
        setLoading(false);
      }
    };
    fetchSession();
  }, [id]);

  // Compute cart data from session
  const resolvedIntents: any[] = session?.resolved_intents ?? [];
  const cartItems =
    resolvedIntents.length > 0
      ? resolvedIntents.flatMap((g: any) => g.cart ?? [])
      : session?.cart_items || session?.cart || [];
  const unavailableItems =
    resolvedIntents.length > 0
      ? resolvedIntents.flatMap((g: any) => g.unavailable_items ?? [])
      : (session?.unavailable_items ?? []);
  const intentSummary = resolvedIntents
    .map((g: any) => g.context_summary)
    .filter(Boolean)
    .join(" · ");
  const intentTypeLabel = resolvedIntents
    .map((g: any) => g.intent_type)
    .filter(Boolean)
    .join(", ");
  const budget = session?.budget_inr || null;
  const total =
    session?.total_price_inr ||
    cartItems.reduce((s: number, it: any) => s + (it.total_price_inr || 0), 0);
  const budgetPct = budget ? Math.min(100, (total / budget) * 100) : 0;

  const runAutoOptimize = async () => {
    if (!session) return;
    setOptimizing(true);
    setOptimizationSummary(null);
    try {
      // Artificial delay to showcase the semantic search loader
      await new Promise(resolve => setTimeout(resolve, 2500));

      const res = await fetch("/api/recompare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: session.session_id,
          budget_inr: budget,
          budget_mode: "value",
        }),
      });

      if (!res.ok) throw new Error("Auto-optimize failed");
      
      const data = await res.json();
      const oldTotal = total;
      const newTotal = data.total_price_inr;
      const savings = oldTotal - newTotal;

      if (savings > 0) {
        setOptimizationSummary(`✨ Successfully optimized! Saved ₹${savings} by swapping items for better value alternatives.`);
      } else {
        setOptimizationSummary("✨ Cart is already fully optimized for the best value.");
      }

      setSession((prev: any) => ({
        ...prev,
        resolved_intents: data.intents,
        total_price_inr: data.total_price_inr,
      }));

    } catch (err) {
      console.error("Optimize error:", err);
    } finally {
      setOptimizing(false);
    }
  };

  const handleSwap = (currentSku: string, alt: any) => {
    setSession((prev: any) => {
      if (!prev) return prev;
      const newSession = JSON.parse(JSON.stringify(prev)); // deep copy
      let newTotal = prev.total_price_inr;
      let found = false;

      if (newSession.resolved_intents) {
        for (const group of newSession.resolved_intents) {
          if (!group.cart) continue;
          const itemIdx = group.cart.findIndex((i: any) => i.sku === currentSku);
          if (itemIdx !== -1) {
            const oldItem = group.cart[itemIdx];
            newTotal = newTotal - (oldItem.total_price_inr || 0) + (alt.total_price_inr || 0);
            group.cart[itemIdx] = {
              ...oldItem,
              sku: alt.sku,
              name: alt.name,
              brand: alt.brand,
              price_per_unit_inr: alt.price_per_unit_inr,
              total_price_inr: alt.total_price_inr,
              rating: alt.rating,
              substituted: true,
              substitution_reason: `Swapped to ${alt.brand} (${alt.reason})`
            };
            found = true;
            break;
          }
        }
      }

      if (!found && newSession.cart_items) {
        const itemIdx = newSession.cart_items.findIndex((i: any) => i.sku === currentSku);
        if (itemIdx !== -1) {
          const oldItem = newSession.cart_items[itemIdx];
          newTotal = newTotal - (oldItem.total_price_inr || 0) + (alt.total_price_inr || 0);
          newSession.cart_items[itemIdx] = {
            ...oldItem,
            sku: alt.sku,
            name: alt.name,
            brand: alt.brand,
            price_per_unit_inr: alt.price_per_unit_inr,
            total_price_inr: alt.total_price_inr,
            rating: alt.rating,
            substituted: true,
            substitution_reason: `Swapped to ${alt.brand} (${alt.reason})`
          };
        }
      }

      newSession.total_price_inr = newTotal;
      return newSession;
    });
  };

  const handleReserve = async () => {
    if (!session || reserving) return;
    setReserving(true);
    setReservationStatus("idle");

    try {
      // Map cartItems to {sku, qty}
      const itemsToReserve = cartItems.filter((i: any) => i.sku).map((i: any) => ({
        sku: i.sku,
        qty: i.quantity_units || 1,
        location_id: "DEFAULT",
      }));

      const res = await fetch(`/api/cart/${session.session_id}/reserve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          items: itemsToReserve,
          idempotency_key: `cart_${session.session_id}_${Date.now()}`
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to reserve items");
      }

      // Check for partial failures
      if (data.status === "partial_failed") {
        setReservationStatus("error");
        setReservationMessage(
          `Some items unavailable: ${data.failed_items.map((i: any) => i.message).join(", ")}`
        );
        return;
      }

      if (data.status === "failed") {
        throw new Error(data.message);
      }

      setReservationStatus("success");
      setReservationMessage("Items reserved! Redirecting to payment...");

      // Phase 6: Log purchase event
      try {
        await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: "demo_user", // Fixed for now
            session_id: session.session_id,
            event_type: "checkout_initiated",
            intent_type: session.intent_type,
            context: "ReviewCart reservation"
          })
        });
      } catch (err) {
        console.error("Telemetry error:", err);
      }
      
      // Redirect to checkout page
      setTimeout(() => navigate({ to: "/checkout/$id", params: { id: data.reservation_id } }), 1500);

    } catch (e: any) {
      setReservationStatus("error");
      setReservationMessage(e.message || "Something went wrong.");
    } finally {
      setReserving(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
        </div>
      </AppShell>
    );
  }

  if (error || !session) {
    return (
      <AppShell>
        <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center gap-4 text-center">
          <div className="text-lg font-semibold">Cart not found</div>
          <div className="text-sm text-muted-foreground">
            {error || "This session does not exist."}
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 sm:py-12">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-6">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-brand/15 to-brand/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-brand shadow-sm shadow-brand/10 border border-brand/20">
              <Sparkles className="h-3 w-3 animate-pulse" /> ReviewCart
            </div>
            <h1 className="mt-4 truncate bg-gradient-to-br from-foreground via-foreground/90 to-foreground/60 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
              {intentSummary || intentTypeLabel || "Your Cart"}
            </h1>
            <p className="mt-3 flex flex-wrap items-center gap-2 text-sm font-medium text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-surface/80 to-surface/40 px-3 py-1.5 backdrop-blur-sm border border-border/40 shadow-sm">
                <span className="text-foreground font-semibold">{cartItems.length}</span> items
              </span>
              {budget && (
                <>
                  <span className="text-border">·</span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-surface/80 to-surface/40 px-3 py-1.5 backdrop-blur-sm border border-border/40 shadow-sm">
                    budget <span className="text-foreground font-semibold">₹{budget}</span>
                  </span>
                </>
              )}
              <span className="text-border">·</span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-brand/10 to-brand/5 px-3 py-1.5 backdrop-blur-sm border border-brand/20 text-foreground font-semibold shadow-sm shadow-brand/5">
                total <span className="text-brand">₹{total}</span>
              </span>
            </p>
          </div>
          <button
            onClick={() => setCompareOpen(true)}
            className="group inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border-2 border-border/60 bg-gradient-to-br from-card to-background/50 px-4 text-sm font-semibold shadow-sm backdrop-blur-sm transition-all duration-300 hover:border-brand/50 hover:shadow-lg hover:shadow-brand/10 hover:scale-105 active:scale-100"
          >
            <ArrowLeftRight className="h-4 w-4 transition-transform duration-300 group-hover:rotate-180" />
            <span className="hidden sm:inline">CompareCart</span>
          </button>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
          {/* Items */}
          <div className="space-y-4">
            {cartItems.map((it: any, idx: number) => (
              <div 
                key={it.sku || idx} 
                className="group rounded-2xl border-2 border-border/50 bg-gradient-to-br from-background/80 via-background/60 to-background/40 shadow-md backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:shadow-brand/5 hover:border-brand/40 hover:scale-[1.02] active:scale-100"
                style={{
                  animationDelay: `${idx * 50}ms`,
                  animationFillMode: 'backwards'
                }}
              >
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-5 p-5">
                  <div className="min-w-0 space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-surface/80 to-surface/40 px-2.5 py-1 text-xs font-semibold text-foreground/70 border border-border/40 shadow-sm">
                        {it.brand}
                      </span>
                      {it.substituted && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-br from-success/20 to-success/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-success border border-success/30 shadow-sm shadow-success/10">
                          <Check className="h-3 w-3" />
                          Substituted
                        </span>
                      )}
                    </div>
                    <div className="truncate text-lg font-bold text-foreground leading-tight">{it.name}</div>
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <span className="inline-flex items-center gap-1 rounded-md bg-surface/60 px-2 py-0.5 border border-border/30">
                        <span className="font-semibold text-foreground">{it.quantity_units}</span> × {it.unit_quantity}{it.unit}
                      </span>
                    </div>

                    {/* Why */}
                    <div className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-brand/10 to-brand/5 px-3 py-2 text-xs font-medium text-foreground/80 border border-brand/20 shadow-sm">
                      <Info className="h-4 w-4 text-brand flex-shrink-0" />
                      <span className="line-clamp-2">
                        {it.substituted
                          ? `Substituted: ${it.substitution_reason || "better match"}`
                          : it.matched_from?.length > 0
                            ? `Matched from: ${it.matched_from.join(", ")}`
                            : "Matched from catalog"}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right space-y-1.5">
                    <div className="text-2xl font-bold bg-gradient-to-br from-brand to-brand/70 bg-clip-text text-transparent">
                      ₹{it.total_price_inr}
                    </div>
                    <div className="inline-flex items-center gap-1 rounded-md bg-surface/60 px-2 py-1 text-[10px] font-medium text-muted-foreground border border-border/30">
                      ₹{it.price_per_unit_inr}/unit
                    </div>
                  </div>
                </div>

                {/* Alternatives */}
                {it.alternatives && it.alternatives.length > 0 && (
                  <div className="border-t border-border/30 bg-surface/30 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Alternatives
                      </span>
                      <div className="h-px flex-1 bg-border/40" />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {it.alternatives.map((alt: any, altIdx: number) => (
                        <div
                          key={altIdx}
                          onClick={() => handleSwap(it.sku, alt)}
                          className="group relative flex cursor-pointer flex-col gap-1.5 rounded-xl border border-border/40 bg-background/50 p-3 shadow-sm transition-all hover:border-brand/40 hover:bg-brand/5 hover:shadow-md"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="truncate text-sm font-semibold text-foreground group-hover:text-brand transition-colors">
                              {alt.name}
                            </span>
                            <span className="shrink-0 text-sm font-bold text-foreground">
                              ₹{alt.total_price_inr}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1 rounded bg-surface px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground border border-border/50">
                              {alt.brand}
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-brand">
                              Swap →
                            </span>
                          </div>
                          {alt.reason && (
                            <div className="mt-1 text-[10px] font-medium text-muted-foreground line-clamp-1">
                              {alt.reason}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Unavailable items */}
            {unavailableItems.length > 0 && (
              <div className="mt-8 p-6 rounded-2xl bg-gradient-to-br from-destructive/5 to-amber-500/5 border-2 border-dashed border-destructive/20">
                <div className="mb-4 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-destructive/15 to-destructive/10 shadow-sm">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-foreground uppercase tracking-wide">
                      Unavailable Items
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {unavailableItems.length} item{unavailableItems.length !== 1 ? 's' : ''} could not be added
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  {unavailableItems.map((it: any, idx: number) => (
                    <UnavailableItemRow key={idx} item={it} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar: budget + review */}
          <aside className="space-y-5">
            <div className="sticky top-6 space-y-5">
              {optimizationSummary && (
                <div className="rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm font-semibold text-success shadow-sm animate-fade-in">
                  {optimizationSummary}
                </div>
              )}

              {budget ? (
                <div className="rounded-2xl border-2 border-border/50 bg-gradient-to-br from-background/90 via-background/70 to-background/50 p-6 shadow-xl backdrop-blur-md">
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand/20 to-brand/10 shadow-sm shadow-brand/10">
                      <Wallet className="h-4.5 w-4.5 text-brand" />
                    </div>
                    <span className="text-sm font-bold text-foreground">Budget Tracker</span>
                  </div>
                  <div className="flex items-baseline justify-between mb-4">
                    <span className="text-3xl font-bold bg-gradient-to-br from-brand to-brand/70 bg-clip-text text-transparent">₹{total}</span>
                    <span className="text-sm font-medium text-muted-foreground">of ₹{budget}</span>
                  </div>
                  <div className="relative h-3 overflow-hidden rounded-full bg-gradient-to-r from-surface/80 to-surface/40 shadow-inner">
                    <div
                      className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out ${
                        total > budget 
                          ? "bg-gradient-to-r from-destructive to-destructive/80 shadow-lg shadow-destructive/20" 
                          : "bg-gradient-to-r from-brand to-brand/80 shadow-lg shadow-brand/20"
                      }`}
                      style={{ width: `${budgetPct}%` }}
                    />
                  </div>
                  <div className={`mt-3 flex items-center justify-between text-xs font-bold ${
                    total > budget ? "text-destructive" : "text-success"
                  }`}>
                    <div className="flex items-center gap-1.5">
                      {total > budget ? (
                        <>
                          <AlertTriangle className="h-3.5 w-3.5" />
                          ₹{total - budget} over budget
                        </>
                      ) : (
                        <>
                          <Check className="h-3.5 w-3.5" />
                        ₹{budget - total} remaining
                      </>
                    )}
                  </div>
                  <button
                    onClick={runAutoOptimize}
                    disabled={optimizing}
                    className="flex items-center gap-1 text-brand hover:text-brand/80 transition-colors disabled:opacity-50"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Auto-Optimize
                  </button>
                </div>
              </div>
              ) : (
                <div className="rounded-2xl border-2 border-border/50 bg-gradient-to-br from-background/90 via-background/70 to-background/50 p-6 shadow-xl backdrop-blur-md">
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand/20 to-brand/10 shadow-sm shadow-brand/10">
                      <Wallet className="h-4.5 w-4.5 text-brand" />
                    </div>
                    <span className="text-sm font-bold text-foreground">Cart Total</span>
                  </div>
                  <div className="mb-2">
                    <span className="text-3xl font-bold bg-gradient-to-br from-brand to-brand/70 bg-clip-text text-transparent">₹{total}</span>
                  </div>
                  <div className="text-xs text-muted-foreground font-medium">
                    No budget constraint
                  </div>
                </div>
              )}

              {/* Summary */}
              {session.summary && (
                <div className="rounded-2xl border-2 border-border/50 bg-gradient-to-br from-brand/5 to-background/50 p-5 shadow-lg backdrop-blur-md">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand/20 to-brand/10 shadow-sm">
                      <Sparkles className="h-4 w-4 text-brand" />
                    </div>
                    <span className="text-sm font-bold text-foreground">AI Summary</span>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground font-medium">
                    {session.summary}
                  </p>
                </div>
              )}

            <div className="rounded-2xl border-2 border-border/50 bg-gradient-to-br from-background/80 to-background/50 p-6 shadow-lg backdrop-blur-md">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-success/20 to-success/10 shadow-sm">
                  <Check className="h-4 w-4 text-success" />
                </div>
                <span className="text-sm font-bold text-foreground">Final Review</span>
              </div>
              <ul className="space-y-3 text-xs font-medium text-muted-foreground">
                {[
                  "Assumptions look right",
                  "Quantities match attendees",
                  "Budget within range",
                  "Reviewed alternatives",
                ].map((q, i) => (
                  <li 
                    key={q} 
                    className="flex items-center gap-2.5 p-2 rounded-lg bg-surface/40 border border-border/30 transition-all duration-300 hover:bg-surface/60 hover:border-success/30"
                    style={{
                      animationDelay: `${i * 100}ms`,
                    }}
                  >
                    <div className="flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-success/20 to-success/10 shadow-sm">
                      <Check className="h-3 w-3 text-success" />
                    </div>
                    <span className="text-foreground/80">{q}</span>
                  </li>
                ))}
              </ul>
              {reservationStatus === "error" && (
                <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-gradient-to-br from-destructive/15 to-destructive/10 px-4 py-3 text-xs font-semibold text-destructive border-2 border-destructive/30 shadow-lg shadow-destructive/10 animate-shake">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span>{reservationMessage}</span>
                </div>
              )}
              {reservationStatus === "success" && (
                <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-gradient-to-br from-success/15 to-success/10 px-4 py-3 text-xs font-semibold text-success border-2 border-success/30 shadow-lg shadow-success/10 animate-bounce-in">
                  <Check className="h-4 w-4 flex-shrink-0" />
                  <span>{reservationMessage}</span>
                </div>
              )}
              <button 
                onClick={handleReserve}
                disabled={reserving || reservationStatus === "success"}
                className="group relative mt-6 inline-flex h-12 w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-r from-brand via-brand to-brand/90 text-sm font-bold text-brand-foreground shadow-[0_4px_24px_rgba(var(--color-brand),0.25)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_8px_32px_rgba(var(--color-brand),0.35)] active:scale-100 disabled:pointer-events-none disabled:opacity-60 disabled:grayscale"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
                {reserving ? (
                  <>
                    <Loader2 className="mr-2 h-4.5 w-4.5 animate-spin" /> 
                    <span>Reserving...</span>
                  </>
                ) : reservationStatus === "success" ? (
                  <>
                    <Check className="mr-2 h-4.5 w-4.5" /> 
                    <span>Reserved</span>
                  </>
                ) : (
                  <>
                    <span>Proceed to Checkout</span>
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </div>

            {/* Export */}
            <div className="rounded-2xl border-2 border-border/50 bg-gradient-to-br from-background/80 to-background/50 p-6 shadow-lg backdrop-blur-md">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand/20 to-brand/10 shadow-sm">
                  <Share2 className="h-4 w-4 text-brand" />
                </div>
                <span className="text-sm font-bold text-foreground">Export Cart</span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={async () => {
                    const exportData: ExportableCart = {
                      context_summary: intentSummary || "My Cart",
                      intent_type: intentTypeLabel || "general",
                      cart: cartItems,
                      total_price_inr: total,
                    };
                    const ok = await copyWhatsAppToClipboard(exportData);
                    if (ok) {
                      setCopySuccess(true);
                      setTimeout(() => setCopySuccess(false), 2000);
                    }
                  }}
                  className="group inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border-2 border-border/60 bg-gradient-to-br from-background to-surface/40 text-xs font-semibold shadow-sm backdrop-blur-sm transition-all duration-300 hover:border-brand/50 hover:shadow-md hover:shadow-brand/10 hover:scale-105 active:scale-100"
                >
                  <Share2 className="h-4 w-4 transition-transform duration-300 group-hover:rotate-12" />
                  {copySuccess ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-success" />
                      <span className="text-success">Copied!</span>
                    </>
                  ) : (
                    "WhatsApp"
                  )}
                </button>
                <button
                  onClick={() => {
                    const exportData: ExportableCart = {
                      context_summary: intentSummary || "My Cart",
                      intent_type: intentTypeLabel || "general",
                      cart: cartItems,
                      total_price_inr: total,
                    };
                    downloadCSV(exportData);
                  }}
                  className="group inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border-2 border-border/60 bg-gradient-to-br from-background to-surface/40 text-xs font-semibold shadow-sm backdrop-blur-sm transition-all duration-300 hover:border-brand/50 hover:shadow-md hover:shadow-brand/10 hover:scale-105 active:scale-100"
                >
                  <Download className="h-4 w-4 transition-transform duration-300 group-hover:translate-y-0.5" />
                  CSV
                </button>
              </div>
            </div>
          </div>
          </aside>
        </div>
      </div>

      {optimizing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-2xl animate-in zoom-in-95">
            <h3 className="mb-6 text-xl font-bold text-foreground">AI Auto-Optimizing...</h3>
            <SemanticSearchSkeleton />
          </div>
        </div>
      )}
    </AppShell>
  );
}
