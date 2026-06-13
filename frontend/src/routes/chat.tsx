import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  ArrowRight,
  Check,
  FileText,
  Image as ImageIcon,
  IndianRupee,
  Link as LinkIcon,
  Minus,
  Paperclip,
  Plus,
  Sparkles,
  Users,
  Wallet,
  AlertTriangle,
  X,
  History,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { samplePrompts } from "@/lib/mock/needspeak";
import { saveToHistory, loadHistory, type CartHistoryEntry } from "@/lib/cart-history";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "Chat — NeedSpeak" },
      {
        name: "description",
        content: "Describe what you're planning. NeedSpeak extracts intent and builds a cart in real time.",
      },
      { property: "og:title", content: "Chat — NeedSpeak" },
      { property: "og:description", content: "Context-to-Cart workspace with live intent extraction." },
    ],
  }),
  component: ChatPage,
});

type Phase = "idle" | "thinking" | "cart";

// ─── helpers ────────────────────────────────────────────────────────────────

function extractBudgetFromText(text: string): number | undefined {
  const patterns = [
    /(?:budget|budjet)\s*(?:₹|rs\.?|inr)?\s*(\d[\d,]*)/i,
    /(?:₹|rs\.?|inr)\s*(\d[\d,]*)/i,
    /(\d[\d,]*)\s*(?:rupees?|rs\.?|₹|inr)/i,
    /(?:under|within|around|roughly|about)\s*(?:₹|rs\.?|inr)?\s*(\d[\d,]*)/i,
  ];
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      const num = parseInt(m[1].replace(/,/g, ""), 10);
      if (num >= 50) return num;
    }
  }
  return undefined;
}

// ─── QuantityControl ─────────────────────────────────────────────────────────

function QuantityControl({
  value,
  onDecrement,
  onIncrement,
}: {
  value: number;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-border bg-background px-1 py-0.5">
      <button
        onClick={onDecrement}
        disabled={value <= 1}
        aria-label="Decrease quantity"
        className="flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Minus className="h-3 w-3" />
      </button>
      <span className="min-w-[1.25rem] text-center text-xs font-medium tabular-nums">{value}</span>
      <button
        onClick={onIncrement}
        aria-label="Increase quantity"
        className="flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}

// ─── CartItem row ─────────────────────────────────────────────────────────────

function CartItemRow({
  item,
  qty,
  onDecrement,
  onIncrement,
}: {
  item: any;
  qty: number;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  const effectiveTotal = (item.price_per_unit_inr * qty).toFixed(0);

  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{item.name}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {item.brand} · {item.unit_quantity}{item.unit}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <QuantityControl value={qty} onDecrement={onDecrement} onIncrement={onIncrement} />
            <div className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-[10px] text-muted-foreground">
              <Check className="h-3 w-3 text-brand" />
              {item.substituted
                ? item.substitution_reason || "Substituted"
                : item.matched_from?.length > 0
                ? item.matched_from.join(", ")
                : "Matched"}
            </div>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-sm font-semibold">₹{effectiveTotal}</div>
          <div className="text-[10px] text-muted-foreground">₹{item.price_per_unit_inr}/unit</div>
        </div>
      </div>
    </div>
  );
}

// ─── HistoryPanel ─────────────────────────────────────────────────────────────

function HistoryPanel({
  open,
  onClose,
  onRestore,
}: {
  open: boolean;
  onClose: () => void;
  onRestore: (entry: CartHistoryEntry) => void;
}) {
  const history = loadHistory();

  if (!open) return null;

  return (
    <div className="absolute inset-y-0 left-0 z-30 flex w-72 flex-col border-r border-border bg-background shadow-pop">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm font-medium">Cart history</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground">
            <History className="h-8 w-8 opacity-30" />
            <p>No saved carts yet. Build one from chat!</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {history.map((entry) => (
              <button
                key={entry.session_id}
                onClick={() => {
                  onRestore(entry);
                  onClose();
                }}
                className="w-full px-4 py-3 text-left transition-colors hover:bg-surface"
              >
                <div className="flex items-center justify-between">
                  <span className="truncate text-sm font-medium">{entry.context_summary || entry.intent_type}</span>
                  <span className="ml-2 shrink-0 text-xs font-semibold text-brand">₹{entry.total_price_inr}</span>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {entry.item_count} items · {new Date(entry.saved_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </div>
                {entry.budget_inr && (
                  <div className="mt-0.5 text-xs text-muted-foreground">Budget ₹{entry.budget_inr}</div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ChatPage ─────────────────────────────────────────────────────────────────

function ChatPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [text, setText] = useState(samplePrompts[0]);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([
    { role: "assistant", text: "Describe your occasion or paste a recipe, and I'll build a cart for you." },
  ]);
  const [cartData, setCartData] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [budgetInput, setBudgetInput] = useState<string>("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [historyOpen, setHistoryOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, phase]);

  // When cartData changes, reset quantity overrides to backend-resolved values.
  useEffect(() => {
    if (!cartData?.cart) return;
    const initial: Record<string, number> = {};
    cartData.cart.forEach((item: any, idx: number) => {
      initial[item.sku ?? idx] = item.quantity_units;
    });
    setQuantities(initial);
  }, [cartData]);

  const adjustQty = useCallback((key: string, delta: number) => {
    setQuantities((prev) => {
      const next = Math.max(1, (prev[key] ?? 1) + delta);
      return { ...prev, [key]: next };
    });
  }, []);

  // Derived total based on quantity overrides.
  const computedTotal = cartData?.cart
    ? cartData.cart.reduce((sum: number, item: any, idx: number) => {
        const key = item.sku ?? idx;
        const qty = quantities[key] ?? item.quantity_units;
        return sum + item.price_per_unit_inr * qty;
      }, 0)
    : 0;

  const onSubmit = async () => {
    if (!text.trim() || phase === "thinking") return;

    const inputText = text.trim();
    setMessages((m) => [...m, { role: "user", text: inputText }]);
    setPhase("thinking");
    setText("");
    setErrorMsg(null);

    // Budget: prefer explicit field, fall back to parsing text.
    const budgetFromField = budgetInput ? parseInt(budgetInput, 10) : undefined;
    const budgetFromText = extractBudgetFromText(inputText);
    const budget = budgetFromField && budgetFromField >= 50 ? budgetFromField : budgetFromText;

    try {
      const body: any = { content: inputText, input_type: "text" };
      if (budget) body.budget_inr = budget;

      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        let errDetail = `Server error (${res.status})`;
        try {
          const errData = await res.json();
          errDetail = errData.message || errData.detail || errDetail;
        } catch { /* ignore */ }
        throw new Error(errDetail);
      }

      const data = await res.json();

      // Flatten multi-intent shape.
      const intents: any[] = data.intents ?? [];
      const allCartItems = intents.flatMap((g: any) => g.cart ?? []);
      const allUnavailable = intents.flatMap((g: any) => g.unavailable_items ?? []);
      const intentType = intents.map((g: any) => g.intent_type).filter(Boolean).join(", ");
      const contextSummary = intents.map((g: any) => g.context_summary).filter(Boolean).join(" · ");

      // Low-confidence → ask a clarifying question.
      if (data.confidence === "low" && data.clarification_question) {
        setMessages((m) => [...m, { role: "assistant", text: data.clarification_question }]);
        setPhase("idle");
        return;
      }

      const normalized = {
        ...data,
        cart: allCartItems,
        unavailable_items: allUnavailable,
        intent_type: intentType || "shopping",
        context_summary: contextSummary,
      };

      setCartData(normalized);

      // Save to localStorage history.
      const entry: CartHistoryEntry = {
        session_id: data.session_id,
        saved_at: new Date().toISOString(),
        intent_type: intentType || "shopping",
        context_summary: contextSummary,
        total_price_inr: data.total_price_inr,
        item_count: allCartItems.length,
        cart: allCartItems,
        unavailable_items: allUnavailable,
        summary: data.summary || "",
        budget_inr: budget,
      };
      saveToHistory(entry);
      window.dispatchEvent(new Event("cart-history-updated"));

      const itemCount = allCartItems.length;
      const unavailCount = allUnavailable.length;
      let summaryText =
        data.summary ||
        `I found ${itemCount} items for your ${intentType || "shopping"} list, totaling ₹${data.total_price_inr}.`;
      if (unavailCount > 0)
        summaryText += ` (${unavailCount} item${unavailCount > 1 ? "s" : ""} unavailable)`;

      setMessages((m) => [...m, { role: "assistant", text: summaryText }]);
      setPhase("cart");
    } catch (e: any) {
      const msg = e.message || "Something went wrong. Please try again.";
      setErrorMsg(msg);
      setMessages((m) => [...m, { role: "assistant", text: `⚠️ ${msg}` }]);
      setPhase("idle");
    }
  };

  const restoreFromHistory = (entry: CartHistoryEntry) => {
    const normalized = {
      session_id: entry.session_id,
      cart: entry.cart,
      unavailable_items: entry.unavailable_items,
      intent_type: entry.intent_type,
      context_summary: entry.context_summary,
      total_price_inr: entry.total_price_inr,
      budget_exceeded: false,
      summary: entry.summary,
    };
    setCartData(normalized);
    if (entry.budget_inr) setBudgetInput(String(entry.budget_inr));
    setMessages((m) => [
      ...m,
      { role: "assistant", text: `Restored cart: ${entry.context_summary || entry.intent_type} — ₹${entry.total_price_inr}` },
    ]);
    setPhase("cart");
  };

  return (
    <AppShell>
      <div className="relative mx-auto grid h-[calc(100vh-4rem)] max-w-7xl grid-cols-1 lg:grid-cols-[1fr_440px]">

        {/* Slide-in history panel */}
        <HistoryPanel
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          onRestore={restoreFromHistory}
        />

        {/* Left: conversation */}
        <div className="flex min-h-0 flex-col border-r border-border">
          <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
            <div className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-brand" />
              <span className="font-medium">Context-to-Cart</span>
              <span className="text-muted-foreground">· Describe it, paste it, drop it</span>
            </div>
            <button
              onClick={() => setHistoryOpen((o) => !o)}
              title="Cart history"
              className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-surface px-2 text-xs text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
            >
              <History className="h-3.5 w-3.5" />
              History
            </button>
          </div>

          <Conversation className="flex-1">
            <ConversationContent>
              {messages.map((m, i) => (
                <Message key={i} from={m.role}>
                  {m.role === "assistant" ? (
                    <MessageContent>
                      <MessageResponse>{m.text}</MessageResponse>
                    </MessageContent>
                  ) : (
                    <MessageContent>{m.text}</MessageContent>
                  )}
                </Message>
              ))}

              {phase === "thinking" && (
                <Message from="assistant">
                  <MessageContent>
                    <Shimmer>Extracting intent and building your cart…</Shimmer>
                  </MessageContent>
                </Message>
              )}

              {phase === "cart" && cartData && (
                <Message from="assistant">
                  <MessageContent>
                    <div className="space-y-3">
                      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Intent extracted
                      </div>
                      <pre className="overflow-x-auto rounded-lg bg-surface p-3 text-xs leading-relaxed text-foreground">
                        {JSON.stringify(
                          { intent: cartData.intent_type, summary: cartData.context_summary },
                          null,
                          2,
                        )}
                      </pre>
                    </div>
                  </MessageContent>
                </Message>
              )}
              <div ref={bottomRef} />
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          {/* Error banner */}
          {errorMsg && (
            <div className="flex items-center gap-2 border-t border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1">{errorMsg}</span>
              <button onClick={() => setErrorMsg(null)}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <div className="border-t border-border bg-background p-3 sm:p-4">
            {/* Budget input */}
            <div className="mb-2 flex items-center gap-2">
              <label
                htmlFor="budget-input"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground"
              >
                <IndianRupee className="h-3.5 w-3.5" />
                Budget
              </label>
              <input
                id="budget-input"
                type="number"
                min={50}
                step={100}
                placeholder="optional"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                className="h-7 w-28 rounded-md border border-border bg-surface px-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-brand focus:outline-none"
              />
              {budgetInput && (
                <span className="text-xs text-muted-foreground">
                  ₹{parseInt(budgetInput || "0", 10).toLocaleString("en-IN")} limit
                </span>
              )}
            </div>

            {/* Attachment chip strip */}
            <div className="mb-2 flex flex-wrap gap-1.5">
              {[
                { i: LinkIcon, l: "Paste URL" },
                { i: ImageIcon, l: "Image" },
                { i: FileText, l: "PDF" },
                { i: Paperclip, l: "WhatsApp" },
              ].map((c) => (
                <button
                  key={c.l}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-muted-foreground hover:border-foreground hover:text-foreground"
                >
                  <c.i className="h-3.5 w-3.5" />
                  {c.l}
                </button>
              ))}
            </div>

            <PromptInput onSubmit={onSubmit}>
              <PromptInputTextarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Describe what you're planning…"
              />
              <div className="flex items-center justify-end p-2">
                <PromptInputSubmit status={phase === "thinking" ? "submitted" : undefined} />
              </div>
            </PromptInput>
          </div>
        </div>

        {/* Right: live cart pane */}
        <aside className="hidden min-h-0 flex-col bg-surface lg:flex">
          {cartData ? (
            <>
              <div className="border-b border-border px-5 py-3">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Live cart
                </div>
                <div className="mt-1 text-base font-semibold">{cartData.intent_type}</div>
                <div className="mt-1 text-xs text-muted-foreground">{cartData.context_summary}</div>
                <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Wallet className="h-3.5 w-3.5" /> ₹{computedTotal.toFixed(0)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> {cartData.cart?.length ?? 0} items
                  </span>
                  {budgetInput && Number(budgetInput) > 0 && (
                    <span
                      className={`inline-flex items-center gap-1 font-medium ${
                        computedTotal > Number(budgetInput) ? "text-destructive" : "text-success"
                      }`}
                    >
                      {computedTotal > Number(budgetInput)
                        ? `₹${(computedTotal - Number(budgetInput)).toFixed(0)} over`
                        : `₹${(Number(budgetInput) - computedTotal).toFixed(0)} under`}
                    </span>
                  )}
                  {cartData.budget_exceeded && !budgetInput && (
                    <span className="inline-flex items-center gap-1 text-destructive">
                      <AlertTriangle className="h-3.5 w-3.5" /> Over budget
                    </span>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-2">
                  {cartData.cart?.map((item: any, idx: number) => {
                    const key = item.sku ?? idx;
                    const qty = quantities[key] ?? item.quantity_units;
                    return (
                      <CartItemRow
                        key={key}
                        item={item}
                        qty={qty}
                        onDecrement={() => adjustQty(key, -1)}
                        onIncrement={() => adjustQty(key, 1)}
                      />
                    );
                  })}
                </div>

                {cartData.unavailable_items?.length > 0 && (
                  <div className="mt-4">
                    <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Unavailable
                    </div>
                    <div className="space-y-1.5">
                      {cartData.unavailable_items.map((it: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 rounded-lg border border-border/50 bg-destructive/5 px-3 py-2 text-xs"
                        >
                          <AlertTriangle className="h-3 w-3 shrink-0 text-destructive" />
                          <span className="font-medium">{it.name}</span>
                          <span className="text-muted-foreground">
                            — {it.reason?.replace(/_/g, " ")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-border bg-background p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total</span>
                  <span className="text-lg font-semibold">₹{computedTotal.toFixed(0)}</span>
                </div>
                {budgetInput && Number(budgetInput) > 0 && (
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface">
                    <div
                      className={`h-full transition-all ${
                        computedTotal > Number(budgetInput) ? "bg-destructive" : "bg-brand"
                      }`}
                      style={{ width: `${Math.min(100, (computedTotal / Number(budgetInput)) * 100)}%` }}
                    />
                  </div>
                )}
                <Link
                  to="/cart/$id"
                  params={{ id: cartData.session_id }}
                  className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-foreground text-sm font-medium text-background hover:bg-foreground/90"
                >
                  Review cart
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4 text-sm text-muted-foreground">
              <Sparkles className="h-8 w-8 opacity-20" />
              Your cart will appear here
            </div>
          )}
        </aside>
      </div>
    </AppShell>
  );
}
