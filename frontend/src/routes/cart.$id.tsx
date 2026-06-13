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
import { diffCarts, hasDiffChanges, type CartDiff } from "@/lib/cart-diff";

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
  const [reserving, setReserving] = useState(false);
  const [reservationStatus, setReservationStatus] = useState<"idle" | "success" | "error">("idle");
  const [reservationMessage, setReservationMessage] = useState<string>("");

  // CompareCart states
  const [comparing, setComparing] = useState(false);
  const [diffResult, setDiffResult] = useState<CartDiff | null>(null);
  const [newCartTotal, setNewCartTotal] = useState<number | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

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
        if (data.budget_inr) setWhatIfBudget(data.budget_inr);
        // Extract attendees from context if available
        const contextText = data.context_summary || data.original_input || "";
        const attendeeMatch = contextText.match(/(\d+)\s*(people|guests|attendees|persons?)/i);
        if (attendeeMatch) setWhatIfAttendees(parseInt(attendeeMatch[1], 10));
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
  const budget = session?.budget_inr || 1500;
  const total =
    session?.total_price_inr ||
    cartItems.reduce((s: number, it: any) => s + (it.total_price_inr || 0), 0);
  const budgetPct = Math.min(100, (total / budget) * 100);

  // Run CompareCart — calls /api/recompare to re-resolve same items with new params (no LLM)
  const runCompare = useCallback(async (newBudget: number, attendees: number, dietary: string) => {
    if (!session) return;

    setComparing(true);

    // Determine original servings from session context
    const contextText = session.context_summary || session.original_input || "";
    const attendeeMatch = contextText.match(/(\d+)\s*(people|guests|attendees|persons?)/i);
    const originalServings = attendeeMatch ? parseInt(attendeeMatch[1], 10) : undefined;

    try {
      const res = await fetch("/api/recompare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: session.session_id,
          budget_inr: newBudget,
          servings_override: attendees,
          original_servings: originalServings,
          dietary_pref: dietary !== "any" ? dietary : null,
          budget_mode: "balanced",
        }),
      });

      if (!res.ok) {
        throw new Error("Compare failed");
      }

      const data = await res.json();
      const newCart = (data.intents ?? []).flatMap((g: any) => g.cart ?? []);
      const newTotal = newCart.reduce((s: number, it: any) => s + (it.total_price_inr || 0), 0);
      setNewCartTotal(newTotal);
      setDiffResult(diffCarts(cartItems, newCart));
    } catch (err) {
      console.error("Compare error:", err);
      setDiffResult(null);
      setNewCartTotal(null);
    } finally {
      setComparing(false);
    }
  }, [session, cartItems]);

  // Debounced compare on parameter change
  const debouncedCompare = useCallback((budget: number, attendees: number, dietary: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      runCompare(budget, attendees, dietary);
    }, 600);
  }, [runCompare]);

  // Reset diff when modal closes
  useEffect(() => {
    if (!compareOpen) {
      setDiffResult(null);
      setNewCartTotal(null);
    }
  }, [compareOpen]);

  const handleReserve = async () => {
    if (!session || reserving) return;
    setReserving(true);
    setReservationStatus("idle");

    try {
      // Map cartItems to {sku, qty}
      const itemsToReserve = cartItems.filter((i: any) => i.sku).map((i: any) => ({
        sku: i.sku,
        qty: i.quantity_units
      }));

      const res = await fetch(`/api/cart/${session.session_id}/reserve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: itemsToReserve })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to reserve items");
      }

      setReservationStatus("success");
      setReservationMessage("Items reserved successfully! Redirecting to checkout...");

      // Phase 6: Log purchase event
      try {
        await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: "demo_user", // Fixed for now
            session_id: session.session_id,
            event_type: "purchase",
            intent_type: session.intent_type,
            context: "Completed checkout from cart review"
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
            <h1 className="mt-4 truncate bg-gradient-to-br from-foreground via-foreground/90 to-foreground/60 bg-clip-text text-5xl font-bold tracking-tight text-transparent sm:text-6xl">
              {intentSummary || intentTypeLabel || "Your Cart"}
            </h1>
            <p className="mt-3 flex flex-wrap items-center gap-2 text-sm font-medium text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-surface/80 to-surface/40 px-3 py-1.5 backdrop-blur-sm border border-border/40 shadow-sm">
                <span className="text-foreground font-semibold">{cartItems.length}</span> items
              </span>
              <span className="text-border">·</span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-surface/80 to-surface/40 px-3 py-1.5 backdrop-blur-sm border border-border/40 shadow-sm">
                budget <span className="text-foreground font-semibold">₹{budget}</span>
              </span>
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
                <div className={`mt-3 flex items-center gap-1.5 text-xs font-bold ${
                  total > budget ? "text-destructive" : "text-success"
                }`}>
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
              </div>

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

      {/* CompareCart modal */}
      {compareOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-foreground/60 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in"
          onClick={() => setCompareOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl rounded-3xl border-2 border-border/60 bg-gradient-to-br from-card via-background to-card p-8 shadow-2xl shadow-brand/10 backdrop-blur-xl my-8 animate-scale-in"
          >
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="text-2xl font-bold bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
                  CompareCart — What if?
                </div>
                <p className="mt-2 text-sm text-muted-foreground font-medium">
                  Adjust parameters to see how your cart would change.
                </p>
              </div>
              <button
                onClick={() => setCompareOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-border/60 bg-surface/40 text-muted-foreground transition-all duration-300 hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive hover:rotate-90"
              >
                <Plus className="h-5 w-5 rotate-45" />
              </button>
            </div>

            {/* Budget slider */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-surface/60 to-surface/30 border-2 border-border/40 shadow-inner">
              <div className="flex items-center justify-between mb-3">
                <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand/20 to-brand/10">
                    <Wallet className="h-4 w-4 text-brand" />
                  </div>
                  Budget
                </span>
                <span className="text-xl font-bold bg-gradient-to-br from-brand to-brand/70 bg-clip-text text-transparent">₹{whatIfBudget}</span>
              </div>
              <input
                type="range"
                min={500}
                max={5000}
                step={100}
                value={whatIfBudget}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setWhatIfBudget(val);
                  debouncedCompare(val, whatIfAttendees, whatIfDietary);
                }}
                className="mt-3 w-full h-2 rounded-full appearance-none cursor-pointer accent-brand [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-br [&::-webkit-slider-thumb]:from-brand [&::-webkit-slider-thumb]:to-brand/80 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-brand/30 [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110"
              />
              <div className="flex justify-between text-[10px] font-medium text-muted-foreground mt-2">
                <span>₹500</span>
                <span>₹5000</span>
              </div>
            </div>

            {/* Attendees input */}
            <div className="mt-5 p-5 rounded-2xl bg-gradient-to-br from-surface/60 to-surface/30 border-2 border-border/40 shadow-inner">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand/20 to-brand/10">
                    <Users className="h-4 w-4 text-brand" />
                  </div>
                  Attendees
                </span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      const val = Math.max(1, whatIfAttendees - 1);
                      setWhatIfAttendees(val);
                      debouncedCompare(whatIfBudget, val, whatIfDietary);
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-border/60 bg-background/60 transition-all duration-300 hover:border-brand/50 hover:bg-brand/10 hover:scale-110 active:scale-95"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="text-xl font-bold bg-gradient-to-br from-brand to-brand/70 bg-clip-text text-transparent w-10 text-center">{whatIfAttendees}</span>
                  <button
                    onClick={() => {
                      const val = whatIfAttendees + 1;
                      setWhatIfAttendees(val);
                      debouncedCompare(whatIfBudget, val, whatIfDietary);
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-border/60 bg-background/60 transition-all duration-300 hover:border-brand/50 hover:bg-brand/10 hover:scale-110 active:scale-95"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Dietary preference */}
            <div className="mt-5 p-5 rounded-2xl bg-gradient-to-br from-surface/60 to-surface/30 border-2 border-border/40 shadow-inner">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand/20 to-brand/10">
                  <Leaf className="h-4 w-4 text-brand" />
                </div>
                <span className="text-sm font-semibold text-foreground">Dietary preference</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {["any", "veg", "vegan", "jain"].map((opt) => (
                  <button
                    key={opt}
                    onClick={() => {
                      setWhatIfDietary(opt);
                      debouncedCompare(whatIfBudget, whatIfAttendees, opt);
                    }}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold border-2 transition-all duration-300 ${
                      whatIfDietary === opt
                        ? "bg-gradient-to-br from-brand to-brand/80 text-brand-foreground border-brand shadow-lg shadow-brand/20 scale-105"
                        : "border-border/60 bg-background/60 hover:border-brand/40 hover:bg-brand/5 hover:scale-105"
                    }`}
                  >
                    {opt === "any" ? "Any" : opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Comparison results */}
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-gradient-to-br from-surface/80 to-surface/40 px-4 py-3 border-2 border-border/40 shadow-sm">
                <span className="text-sm font-semibold text-muted-foreground">Current total</span>
                <span className="text-lg font-bold text-foreground">₹{total}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-gradient-to-br from-surface/80 to-surface/40 px-4 py-3 border-2 border-border/40 shadow-sm">
                <span className="text-sm font-semibold text-muted-foreground">New budget</span>
                <span className="text-lg font-bold text-foreground">₹{whatIfBudget}</span>
              </div>
              {newCartTotal !== null && (
                <div className="flex items-center justify-between rounded-xl bg-gradient-to-br from-brand/10 to-brand/5 px-4 py-3 border-2 border-brand/30 shadow-md shadow-brand/10">
                  <span className="text-sm font-semibold text-foreground">New cart total</span>
                  <span className="text-lg font-bold bg-gradient-to-br from-brand to-brand/70 bg-clip-text text-transparent">₹{newCartTotal}</span>
                </div>
              )}
              <div className="flex items-center justify-between rounded-xl bg-gradient-to-br from-surface/80 to-surface/40 px-4 py-3 border-2 border-border/40 shadow-sm">
                <span className="text-sm font-semibold text-muted-foreground">Status</span>
                {comparing ? (
                  <span className="flex items-center gap-2 text-muted-foreground font-medium">
                    <Loader2 className="h-4 w-4 animate-spin text-brand" />
                    Comparing...
                  </span>
                ) : (
                  <span
                    className={`text-sm font-bold flex items-center gap-1.5 ${
                      (newCartTotal ?? total) > whatIfBudget ? "text-destructive" : "text-success"
                    }`}
                  >
                    {(newCartTotal ?? total) > whatIfBudget ? (
                      <>
                        <AlertTriangle className="h-4 w-4" />
                        ₹{(newCartTotal ?? total) - whatIfBudget} over
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        ₹{whatIfBudget - (newCartTotal ?? total)} under
                      </>
                    )}
                  </span>
                )}
              </div>
            </div>

            {/* Diff view */}
            {diffResult && hasDiffChanges(diffResult) && (
              <div className="mt-6 p-5 border-2 border-dashed border-border/60 rounded-2xl bg-gradient-to-br from-surface/40 to-background/20">
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand/20 to-brand/10">
                    <ArrowLeftRight className="h-4 w-4 text-brand" />
                  </div>
                  <span className="text-sm font-bold text-foreground">Cart Changes</span>
                </div>
                <div className="space-y-2.5 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                  {/* Added items */}
                  {diffResult.added.map((item) => (
                    <div
                      key={item.sku}
                      className="flex items-center gap-3 rounded-xl bg-gradient-to-br from-success/15 to-success/5 px-4 py-3 border-2 border-success/30 shadow-sm shadow-success/10 transition-all duration-300 hover:scale-[1.02]"
                    >
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-success/30 to-success/20 shadow-sm">
                        <Plus className="h-4 w-4 text-success" />
                      </div>
                      <span className="flex-1 truncate text-sm font-semibold text-success">{item.name}</span>
                      <span className="text-sm font-bold text-success">+₹{item.total_price_inr}</span>
                    </div>
                  ))}

                  {/* Removed items */}
                  {diffResult.removed.map((item) => (
                    <div
                      key={item.sku}
                      className="flex items-center gap-3 rounded-xl bg-gradient-to-br from-destructive/15 to-destructive/5 px-4 py-3 border-2 border-destructive/30 shadow-sm shadow-destructive/10 transition-all duration-300 hover:scale-[1.02]"
                    >
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-destructive/30 to-destructive/20 shadow-sm">
                        <Minus className="h-4 w-4 text-destructive" />
                      </div>
                      <span className="flex-1 truncate text-sm font-semibold text-destructive">{item.name}</span>
                      <span className="text-sm font-bold text-destructive">−₹{item.total_price_inr}</span>
                    </div>
                  ))}

                  {/* Swapped items */}
                  {diffResult.swapped.map((swap) => (
                    <div
                      key={swap.new.sku}
                      className="flex items-center gap-3 rounded-xl bg-gradient-to-br from-brand/15 to-brand/5 px-4 py-3 border-2 border-brand/30 shadow-sm shadow-brand/10 transition-all duration-300 hover:scale-[1.02]"
                    >
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand/30 to-brand/20 shadow-sm">
                        <ArrowRight className="h-4 w-4 text-brand" />
                      </div>
                      <span className="flex-1 truncate text-xs">
                        <span className="text-muted-foreground line-through font-medium">{swap.old.name}</span>
                        <span className="mx-1.5 text-brand font-bold">→</span>
                        <span className="text-brand font-semibold">{swap.new.name}</span>
                      </span>
                      <span className={`text-sm font-bold whitespace-nowrap ${
                        swap.savings > 0 ? "text-success" : swap.savings < 0 ? "text-destructive" : "text-muted-foreground"
                      }`}>
                        {swap.savings > 0 ? `−₹${swap.savings}` : swap.savings < 0 ? `+₹${Math.abs(swap.savings)}` : "Same"}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Summary */}
                {diffResult.summary.difference !== 0 && (
                  <div className="mt-4 pt-4 border-t-2 border-dashed border-border/50 flex items-center justify-between">
                    <span className="text-sm font-bold text-muted-foreground">Total impact</span>
                    <span className={`text-lg font-bold flex items-center gap-1.5 ${
                      diffResult.summary.difference > 0 ? "text-success" : "text-destructive"
                    }`}>
                      {diffResult.summary.difference > 0 ? (
                        <>
                          <Check className="h-4.5 w-4.5" />
                          Save ₹{diffResult.summary.difference}
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="h-4.5 w-4.5" />
                          +₹{Math.abs(diffResult.summary.difference)}
                        </>
                      )}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* No changes message */}
            {diffResult && !hasDiffChanges(diffResult) && !comparing && (
              <div className="mt-6 text-center rounded-xl bg-gradient-to-br from-surface/40 to-background/20 border-2 border-dashed border-border/50 px-6 py-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-brand/20 to-brand/10 mx-auto mb-3 shadow-sm">
                  <Check className="h-6 w-6 text-brand" />
                </div>
                <p className="text-sm font-semibold text-muted-foreground">
                  No changes with these parameters
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Your cart is already optimized
                </p>
              </div>
            )}

            <div className="mt-8 flex justify-end gap-3">
              <button
                onClick={() => setCompareOpen(false)}
                className="h-11 rounded-xl border-2 border-border/60 bg-gradient-to-br from-background to-surface/40 px-6 text-sm font-semibold shadow-sm backdrop-blur-sm transition-all duration-300 hover:border-border hover:bg-surface/60 hover:scale-105 active:scale-100"
              >
                Close
              </button>
              <button
                onClick={() => {
                  runCompare(whatIfBudget, whatIfAttendees, whatIfDietary);
                }}
                disabled={comparing}
                className="group relative h-11 overflow-hidden rounded-xl bg-gradient-to-r from-brand via-brand to-brand/90 px-6 text-sm font-bold text-brand-foreground shadow-lg shadow-brand/25 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-brand/30 active:scale-100 disabled:opacity-60 disabled:pointer-events-none"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
                {comparing ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Comparing...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Compare Now
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
