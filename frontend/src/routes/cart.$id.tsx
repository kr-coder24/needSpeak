import { createFileRoute } from "@tanstack/react-router";
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

function CartPage() {
  const { id } = Route.useParams();
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

  // Run CompareCart comparison with new parameters
  const runCompare = useCallback(async (newBudget: number, attendees: number, dietary: string) => {
    if (!session) return;

    setComparing(true);

    // Build the input text - use original input or context summary
    let inputText = session.original_input || session.context_summary || intentSummary || "general groceries";

    // Modify attendee count in the input text
    const attendeePattern = /(\d+)\s*(people|guests|attendees|persons?)/gi;
    if (attendeePattern.test(inputText)) {
      inputText = inputText.replace(attendeePattern, `${attendees} people`);
    } else {
      inputText += ` for ${attendees} people`;
    }

    // Add dietary constraint if not "any"
    if (dietary && dietary !== "any") {
      inputText += ` (${dietary} only)`;
    }

    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: inputText,
          input_type: "text",
          budget_inr: newBudget,
          dietary_pref: dietary !== "any" ? dietary : undefined,
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
  }, [session, intentSummary, cartItems]);

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
      
      // We could redirect to a checkout page here, but for now we just show success
      // setTimeout(() => router.navigate({ to: "/checkout", params: { id: data.reservation_id } }), 1500);

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
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">ReviewCart</div>
            <h1 className="mt-1 truncate text-3xl font-semibold tracking-tight">
              {intentSummary || intentTypeLabel || "Your Cart"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {cartItems.length} items · budget ₹{budget} · total ₹{total}
            </p>
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
          <div className="space-y-3">
            {cartItems.map((it: any, idx: number) => (
              <div key={it.sku || idx} className="rounded-2xl border border-border bg-card">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{it.brand}</span>
                      {it.substituted && (
                        <span className="rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-medium text-success">
                          Substituted
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-base font-medium">{it.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {it.quantity_units} × {it.unit_quantity}
                      {it.unit}
                    </div>

                    {/* Why */}
                    <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-xs text-muted-foreground">
                      <Info className="h-3.5 w-3.5 text-brand" />
                      {it.substituted
                        ? `Substituted: ${it.substitution_reason || "better match"}`
                        : it.matched_from?.length > 0
                          ? `Matched from: ${it.matched_from.join(", ")}`
                          : "Matched from catalog"}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-lg font-semibold">₹{it.total_price_inr}</div>
                    <div className="text-xs text-muted-foreground">
                      ₹{it.price_per_unit_inr}/unit
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Unavailable items */}
            {unavailableItems.length > 0 && (
              <div className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
                <div className="mb-3 text-xs font-medium uppercase tracking-wider text-destructive">
                  Unavailable items
                </div>
                {unavailableItems.map((it: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-2 py-1.5 text-sm">
                    <span className="font-medium">{it.name}</span>
                    <span className="text-xs text-muted-foreground">
                      — {it.reason?.replace(/_/g, " ")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar: budget + review */}
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

            {/* Summary */}
            {session.summary && (
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 text-sm">
                  <Sparkles className="h-4 w-4 text-brand" />
                  <span className="font-medium">Summary</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {session.summary}
                </p>
              </div>
            )}

            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="text-sm font-medium">Final review</div>
              <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                {[
                  "Assumptions look right",
                  "Quantities match attendees",
                  "Budget within range",
                  "Reviewed alternatives",
                ].map((q) => (
                  <li key={q} className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-brand" />
                    {q}
                  </li>
                ))}
              </ul>
              {reservationStatus === "error" && (
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {reservationMessage}
                </div>
              )}
              {reservationStatus === "success" && (
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2 text-xs text-success">
                  <Check className="h-3.5 w-3.5" />
                  {reservationMessage}
                </div>
              )}
              <button 
                onClick={handleReserve}
                disabled={reserving || reservationStatus === "success"}
                className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-lg bg-brand text-sm font-semibold text-brand-foreground hover:bg-brand/90 disabled:opacity-50"
              >
                {reserving ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reserving...</>
                ) : reservationStatus === "success" ? (
                  <><Check className="mr-2 h-4 w-4" /> Reserved</>
                ) : (
                  "Proceed to checkout"
                )}
              </button>
            </div>

            {/* Export */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="text-sm font-medium">Export cart</div>
              <div className="mt-3 flex gap-2">
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
                  className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-background text-xs hover:bg-surface"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  {copySuccess ? "Copied!" : "WhatsApp"}
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
                  className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-background text-xs hover:bg-surface"
                >
                  <Download className="h-3.5 w-3.5" />
                  CSV
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* CompareCart modal */}
      {compareOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4 overflow-y-auto"
          onClick={() => setCompareOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-pop my-8"
          >
            <div className="text-lg font-semibold">CompareCart — What if?</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Adjust parameters to see how your cart would change.
            </p>

            {/* Budget slider */}
            <div className="mt-5">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Wallet className="h-3.5 w-3.5" />
                  Budget
                </span>
                <span className="font-medium">₹{whatIfBudget}</span>
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
                className="mt-2 w-full accent-[var(--color-brand)]"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>₹500</span>
                <span>₹5000</span>
              </div>
            </div>

            {/* Attendees input */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  Attendees
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const val = Math.max(1, whatIfAttendees - 1);
                      setWhatIfAttendees(val);
                      debouncedCompare(whatIfBudget, val, whatIfDietary);
                    }}
                    className="h-6 w-6 rounded border border-border flex items-center justify-center hover:bg-surface"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="font-medium w-8 text-center">{whatIfAttendees}</span>
                  <button
                    onClick={() => {
                      const val = whatIfAttendees + 1;
                      setWhatIfAttendees(val);
                      debouncedCompare(whatIfBudget, val, whatIfDietary);
                    }}
                    className="h-6 w-6 rounded border border-border flex items-center justify-center hover:bg-surface"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>

            {/* Dietary preference */}
            <div className="mt-4">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                <Leaf className="h-3.5 w-3.5" />
                Dietary preference
              </div>
              <div className="flex gap-2 flex-wrap">
                {["any", "veg", "vegan", "jain"].map((opt) => (
                  <button
                    key={opt}
                    onClick={() => {
                      setWhatIfDietary(opt);
                      debouncedCompare(whatIfBudget, whatIfAttendees, opt);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                      whatIfDietary === opt
                        ? "bg-brand text-brand-foreground border-brand"
                        : "border-border hover:bg-surface"
                    }`}
                  >
                    {opt === "any" ? "Any" : opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Comparison results */}
            <div className="mt-5 space-y-2 text-sm">
              <div className="flex items-center justify-between rounded-lg bg-surface px-3 py-2">
                <span className="text-muted-foreground">Current total</span>
                <span className="font-semibold">₹{total}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-surface px-3 py-2">
                <span className="text-muted-foreground">New budget</span>
                <span className="font-semibold">₹{whatIfBudget}</span>
              </div>
              {newCartTotal !== null && (
                <div className="flex items-center justify-between rounded-lg bg-surface px-3 py-2">
                  <span className="text-muted-foreground">New cart total</span>
                  <span className="font-semibold">₹{newCartTotal}</span>
                </div>
              )}
              <div className="flex items-center justify-between rounded-lg bg-surface px-3 py-2">
                <span className="text-muted-foreground">Status</span>
                {comparing ? (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Comparing...
                  </span>
                ) : (
                  <span
                    className={`font-semibold ${(newCartTotal ?? total) > whatIfBudget ? "text-destructive" : "text-success"}`}
                  >
                    {(newCartTotal ?? total) > whatIfBudget
                      ? `₹${(newCartTotal ?? total) - whatIfBudget} over`
                      : `₹${whatIfBudget - (newCartTotal ?? total)} under`}
                  </span>
                )}
              </div>
            </div>

            {/* Diff view */}
            {diffResult && hasDiffChanges(diffResult) && (
              <div className="mt-4 border-t border-border pt-4">
                <div className="text-xs font-medium text-muted-foreground mb-3">Cart Changes</div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {/* Added items */}
                  {diffResult.added.map((item) => (
                    <div
                      key={item.sku}
                      className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2 text-xs"
                    >
                      <Plus className="h-3.5 w-3.5 text-success" />
                      <span className="flex-1 truncate text-success">{item.name}</span>
                      <span className="text-success font-medium">+₹{item.total_price_inr}</span>
                    </div>
                  ))}

                  {/* Removed items */}
                  {diffResult.removed.map((item) => (
                    <div
                      key={item.sku}
                      className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs"
                    >
                      <Minus className="h-3.5 w-3.5 text-destructive" />
                      <span className="flex-1 truncate text-destructive">{item.name}</span>
                      <span className="text-destructive font-medium">−₹{item.total_price_inr}</span>
                    </div>
                  ))}

                  {/* Swapped items */}
                  {diffResult.swapped.map((swap) => (
                    <div
                      key={swap.new.sku}
                      className="flex items-center gap-2 rounded-lg bg-brand/10 px-3 py-2 text-xs"
                    >
                      <ArrowRight className="h-3.5 w-3.5 text-brand" />
                      <span className="flex-1 truncate">
                        <span className="text-muted-foreground line-through">{swap.old.name}</span>
                        <span className="mx-1">→</span>
                        <span className="text-brand">{swap.new.name}</span>
                      </span>
                      <span className={`font-medium ${swap.savings > 0 ? "text-success" : swap.savings < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                        {swap.savings > 0 ? `Save ₹${swap.savings}` : swap.savings < 0 ? `+₹${Math.abs(swap.savings)}` : "Same"}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Summary */}
                {diffResult.summary.difference !== 0 && (
                  <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Total savings</span>
                    <span className={`font-semibold ${diffResult.summary.difference > 0 ? "text-success" : "text-destructive"}`}>
                      {diffResult.summary.difference > 0 
                        ? `Save ₹${diffResult.summary.difference}` 
                        : `Spend ₹${Math.abs(diffResult.summary.difference)} more`}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* No changes message */}
            {diffResult && !hasDiffChanges(diffResult) && !comparing && (
              <div className="mt-4 text-center text-xs text-muted-foreground py-3 border-t border-border">
                No changes with these parameters
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setCompareOpen(false)}
                className="h-10 rounded-lg border border-border bg-background px-4 text-sm hover:bg-surface"
              >
                Close
              </button>
              <button
                onClick={() => {
                  // Trigger a fresh compare if needed
                  runCompare(whatIfBudget, whatIfAttendees, whatIfDietary);
                }}
                disabled={comparing}
                className="h-10 rounded-lg bg-foreground px-4 text-sm font-medium text-background hover:bg-foreground/90 disabled:opacity-50"
              >
                {comparing ? "Comparing..." : "Compare Now"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
