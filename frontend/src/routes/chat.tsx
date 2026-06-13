import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  ArrowRight,
  Check,
  FileText,
  Image as ImageIcon,
  IndianRupee,
  Link as LinkIcon,
  Mic,
  MicOff,
  Minus,
  Paperclip,
  Plus,
  Sparkles,
  Users,
  Wallet,
  AlertTriangle,
  X,
  History,
  ShoppingCart,
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
import { loadPreferences } from "@/lib/preferences";
import { useVoiceInput } from "@/hooks/use-voice-input";
import { getItemBadge } from "@/lib/mock/item-badges";

export const Route = createFileRoute("/chat")({
  validateSearch: (search: Record<string, unknown>): { prompt?: string, occasion?: string } => ({
    prompt: typeof search.prompt === "string" ? search.prompt : undefined,
    occasion: typeof search.occasion === "string" ? search.occasion : undefined,
  }),
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
  onRemove,
}: {
  item: any;
  qty: number;
  onDecrement: () => void;
  onIncrement: () => void;
  onRemove: () => void;
}) {
  const effectiveTotal = (item.price_per_unit_inr * qty).toFixed(0);

  return (
    <div className="group rounded-xl border border-border bg-background p-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{item.name}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>{item.brand} · {item.unit_quantity}{item.unit}</span>
            {getItemBadge(item.sku) && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${getItemBadge(item.sku)!.color}`}>
                {getItemBadge(item.sku)!.label}
              </span>
            )}
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
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={onRemove}
            aria-label="Remove item"
            className="flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-all hover:text-destructive group-hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
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
  const [history, setHistory] = useState<CartHistoryEntry[]>([]);

  useEffect(() => {
    if (open) {
      setHistory(loadHistory());
    }
  }, [open]);

  useEffect(() => {
    const handleUpdate = () => {
      setHistory(loadHistory());
    };
    window.addEventListener("cart-history-updated", handleUpdate);
    return () => {
      window.removeEventListener("cart-history-updated", handleUpdate);
    };
  }, []);

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
  const { prompt: prefillPrompt, occasion: prefillOccasion } = Route.useSearch();
  const [phase, setPhase] = useState<Phase>("idle");
  const [text, setText] = useState(samplePrompts[0]);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([
    { role: "assistant", text: "Describe your occasion or paste a recipe, and I'll build a cart for you." },
  ]);

  // Pre-fill from occasion tile navigation
  useEffect(() => {
    if (prefillPrompt) {
      setText(prefillPrompt);
    }
  }, [prefillPrompt]);
  const [cartData, setCartData] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [budgetInput, setBudgetInput] = useState<string>("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [removedKeys, setRemovedKeys] = useState<Set<string>>(new Set());
  const [intentGroups, setIntentGroups] = useState<any[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [inputType, setInputType] = useState<"text" | "whatsapp">("text");

  // Voice input via MediaRecorder + backend transcription
  const voice = useVoiceInput({
    onResult: (transcript) => {
      setText((prev) => (prev ? prev + " " + transcript : transcript));
    },
  });

  // Auto-restore the most recent cart from history on mount (if no prefill prompt)
  const hasRestoredRef = useRef(false);
  useEffect(() => {
    if (hasRestoredRef.current) return;
    if (prefillPrompt) return; // Don't restore if coming from an occasion tile
    const history = loadHistory();
    if (history.length > 0) {
      hasRestoredRef.current = true;
      const latest = history[0];
      const normalized = {
        session_id: latest.session_id,
        cart: latest.cart,
        unavailable_items: latest.unavailable_items,
        intent_type: latest.intent_type,
        context_summary: latest.context_summary,
        total_price_inr: latest.total_price_inr,
        budget_exceeded: false,
        summary: latest.summary,
      };
      setCartData(normalized);
      setIntentGroups([]);
      if (latest.budget_inr) setBudgetInput(String(latest.budget_inr));
      setMessages((m) => [
        ...m,
        { role: "assistant", text: `Restored your last cart: ${latest.context_summary || latest.intent_type} — ₹${latest.total_price_inr}` },
      ]);
      setPhase("cart");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setRemovedKeys(new Set());
  }, [cartData]);

  const adjustQty = useCallback((key: string, delta: number) => {
    setQuantities((prev) => {
      const next = Math.max(1, (prev[key] ?? 1) + delta);
      return { ...prev, [key]: next };
    });
  }, []);

  // Derived total based on quantity overrides (excludes removed items).
  const computedTotal = cartData?.cart
    ? cartData.cart.reduce((sum: number, item: any, idx: number) => {
        const key = String(item.sku ?? idx);
        if (removedKeys.has(key)) return sum;
        const qty = quantities[key] ?? item.quantity_units;
        return sum + item.price_per_unit_inr * qty;
      }, 0)
    : 0;

  const onSubmit = async (
    override?: string | { text: string },
    overrideType?: any
  ) => {
    if (phase === "thinking") return;

    let inputText = "";
    if (typeof override === "string") {
      inputText = override;
    } else if (override && typeof override === "object" && "text" in override) {
      inputText = override.text;
    } else {
      inputText = text;
    }

    inputText = inputText.trim();
    if (!inputText) return;

    // Auto-detect URL input: if it looks like a URL, set input_type to "url"
    const detectedType = (() => {
      try {
        const url = new URL(inputText);
        if (["http:", "https:"].includes(url.protocol)) return "url" as const;
      } catch { /* not a URL */ }
      return undefined;
    })();
    const currentInputType = detectedType || (typeof overrideType === "string" ? overrideType : null) || inputType;
    setMessages((m) => [...m, { role: "user", text: inputText }]);
    setPhase("thinking");
    setText("");
    setInputType("text");
    setErrorMsg(null);

    // Budget: prefer explicit field, fall back to parsing text.
    const budgetFromField = budgetInput ? parseInt(budgetInput, 10) : undefined;
    const budgetFromText = extractBudgetFromText(inputText);
    const budget = budgetFromField && budgetFromField >= 50 ? budgetFromField : budgetFromText;

    try {
      const prefs = loadPreferences();
      const body: any = { content: inputText, input_type: currentInputType };
      if (budget) body.budget_inr = budget;
      if (prefs.dietary !== "any") body.dietary_pref = prefs.dietary;
      if (prefs.preferredBrands.length) body.preferred_brands = prefs.preferredBrands;
      if (prefs.budgetStyle !== "balanced") body.budget_style = prefs.budgetStyle;
      if (prefillOccasion) body.occasion = prefillOccasion;

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
      setIntentGroups(data.intents ?? []);

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
    // History stores flattened cart — no intent groups available
    setIntentGroups([]);
    if (entry.budget_inr) setBudgetInput(String(entry.budget_inr));
    setMessages((m) => [
      ...m,
      { role: "assistant", text: `Restored cart: ${entry.context_summary || entry.intent_type} — ₹${entry.total_price_inr}` },
    ]);
    setPhase("cart");
  };

  return (
    <AppShell noFooter>
      <div className="relative grid h-full grid-cols-1 lg:grid-cols-[1fr_440px]">

        {/* Slide-in history panel */}
        <HistoryPanel
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          onRestore={restoreFromHistory}
        />

        {/* Left: conversation */}
        <div className="flex min-h-0 flex-col border-r border-border">
          <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <Sparkles className="h-6 w-6 text-brand" />
              <span className="font-display text-lg font-bold tracking-tight uppercase">CONTEXT-TO-CART</span>
              <span className="text-sm text-muted-foreground mt-2">· Describe it, paste it, drop it</span>
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
              <button className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-muted-foreground hover:border-foreground hover:text-foreground">
                <LinkIcon className="h-3.5 w-3.5" /> Paste URL
              </button>
              
              <button 
                onClick={() => imageInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-muted-foreground hover:border-foreground hover:text-foreground"
              >
                <ImageIcon className="h-3.5 w-3.5" /> Image
              </button>

              <button 
                onClick={() => pdfInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-muted-foreground hover:border-foreground hover:text-foreground"
              >
                <FileText className="h-3.5 w-3.5" /> PDF
              </button>

              <button 
                onClick={() => {
                  const whatsappText = prompt("Paste your WhatsApp message:");
                  if (whatsappText?.trim()) {
                    setText(whatsappText.trim());
                    setInputType("whatsapp");
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-muted-foreground hover:border-foreground hover:text-foreground"
              >
                <Paperclip className="h-3.5 w-3.5" /> WhatsApp
              </button>
              
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setPhase("thinking");
                  setMessages(m => [...m, { role: "user", text: `📷 Uploaded: ${file.name}` }]);

                  const prefs = loadPreferences();
                  const formData = new FormData();
                  formData.append("image", file);
                  if (budgetInput) formData.append("budget_inr", budgetInput);
                  if (prefs.dietary !== "any") formData.append("dietary_pref", prefs.dietary);
                  if (prefs.preferredBrands.length) formData.append("preferred_brands", JSON.stringify(prefs.preferredBrands));
                  if (prefs.budgetStyle !== "balanced") formData.append("budget_style", prefs.budgetStyle);

                  try {
                    const res = await fetch("/api/parse-image", { method: "POST", body: formData });
                    if (!res.ok) throw new Error("Image parsing failed");
                    const data = await res.json();
                    if (data.extracted_text) {
                      setText(data.extracted_text);
                      setInputType("text");
                      onSubmit(data.extracted_text, "text");
                    }
                  } catch (err: any) {
                    setErrorMsg(err.message);
                    setPhase("idle");
                  }
                }}
              />

              <input
                ref={pdfInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setPhase("thinking");
                  setMessages(m => [...m, { role: "user", text: `📄 Uploaded PDF: ${file.name}` }]);

                  const prefs = loadPreferences();
                  const formData = new FormData();
                  formData.append("pdf", file);
                  if (budgetInput) formData.append("budget_inr", budgetInput);
                  if (prefs.dietary !== "any") formData.append("dietary_pref", prefs.dietary);
                  if (prefs.preferredBrands.length) formData.append("preferred_brands", JSON.stringify(prefs.preferredBrands));
                  if (prefs.budgetStyle !== "balanced") formData.append("budget_style", prefs.budgetStyle);

                  try {
                    const res = await fetch("/api/parse-pdf", { method: "POST", body: formData });
                    if (!res.ok) throw new Error("PDF parsing failed");
                    const data = await res.json();
                    if (data.extracted_text) {
                      setText(data.extracted_text);
                      setInputType("text");
                      onSubmit(data.extracted_text, "text");
                    }
                  } catch (err: any) {
                    setErrorMsg(err.message);
                    setPhase("idle");
                  }
                }}
              />
            </div>

            <PromptInput onSubmit={onSubmit}>
              <PromptInputTextarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={
                  voice.status === "listening"
                    ? "Listening… speak now"
                    : voice.status === "processing"
                    ? "Transcribing…"
                    : "Describe what you're planning…"
                }
              />
              <div className="flex items-center justify-between p-2">
                {/* Voice input button */}
                <div className="flex items-center gap-2">
                  {voice.supported && (
                    <button
                      type="button"
                      onClick={voice.toggle}
                      disabled={voice.status === "processing"}
                      title={
                        voice.status === "listening"
                          ? "Stop recording"
                          : voice.status === "processing"
                          ? "Transcribing…"
                          : "Voice input"
                      }
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
                        voice.status === "listening"
                          ? "bg-destructive/10 text-destructive animate-pulse"
                          : voice.status === "processing"
                          ? "bg-brand/10 text-brand opacity-70 cursor-wait"
                          : "text-muted-foreground hover:bg-surface hover:text-foreground"
                      }`}
                    >
                      {voice.status === "listening" ? (
                        <MicOff className="h-4 w-4" />
                      ) : (
                        <Mic className="h-4 w-4" />
                      )}
                    </button>
                  )}
                  {voice.status === "listening" && (
                    <span className="text-xs text-destructive animate-pulse">Recording…</span>
                  )}
                  {voice.status === "processing" && (
                    <span className="text-xs text-brand">Transcribing…</span>
                  )}
                  {voice.errorMessage && voice.status !== "listening" && (
                    <span className="max-w-[200px] truncate text-xs text-destructive">{voice.errorMessage}</span>
                  )}
                </div>
                <PromptInputSubmit status={phase === "thinking" ? "submitted" : undefined} />
              </div>
            </PromptInput>
          </div>
        </div>

        {/* Right: live cart pane — Premium floating card */}
        <aside className="hidden min-h-0 flex-col p-4 lg:flex">
          <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-border/60 bg-background shadow-lg shadow-black/5 dark:shadow-black/20">
            {cartData ? (
              <>
                {/* Header */}
                <div className="border-b border-border/60 bg-gradient-to-b from-surface/80 to-surface/40 px-5 py-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand/10">
                      <ShoppingCart className="h-4 w-4 text-brand" />
                    </div>
                    <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Live Cart
                    </div>
                  </div>
                  <div className="mt-3 font-display text-xl font-semibold tracking-tight">{cartData.intent_type}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{cartData.context_summary}</div>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1">
                      <Wallet className="h-3.5 w-3.5 text-brand" /> ₹{computedTotal.toFixed(0)}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1">
                      <Users className="h-3.5 w-3.5" /> {(cartData.cart?.length ?? 0) - removedKeys.size} items
                    </span>
                    {budgetInput && Number(budgetInput) > 0 && (
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${
                          computedTotal > Number(budgetInput)
                            ? "bg-destructive/10 text-destructive"
                            : "bg-success/10 text-success"
                        }`}
                      >
                        {computedTotal > Number(budgetInput)
                          ? `₹${(computedTotal - Number(budgetInput)).toFixed(0)} over`
                          : `₹${(Number(budgetInput) - computedTotal).toFixed(0)} under`}
                      </span>
                    )}
                    {cartData.budget_exceeded && !budgetInput && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-destructive">
                        <AlertTriangle className="h-3.5 w-3.5" /> Over budget
                      </span>
                    )}
                  </div>
                </div>

                {/* Items list — grouped by intent if multiple, flat if single/restored */}
                <div className="flex-1 overflow-y-auto p-4">
                  {intentGroups.length > 1 ? (
                    /* Multi-intent: render each group as a labelled section */
                    <div className="space-y-5">
                      {intentGroups.map((group: any, gi: number) => {
                        const groupItems = (group.cart ?? []).filter((_: any, idx: number) => {
                          const key = String(_.sku ?? `${gi}-${idx}`);
                          return !removedKeys.has(key);
                        });
                        const groupSubtotal = groupItems.reduce((s: number, it: any, idx: number) => {
                          const key = String(it.sku ?? `${gi}-${idx}`);
                          const qty = quantities[key] ?? it.quantity_units;
                          return s + it.price_per_unit_inr * qty;
                        }, 0);

                        return (
                          <div key={gi}>
                            {/* Section header */}
                            <div className="mb-2 flex items-center justify-between">
                              <span className="text-xs font-semibold uppercase tracking-wider text-brand">
                                {group.intent_type}
                              </span>
                              <span className="text-xs text-muted-foreground">₹{groupSubtotal.toFixed(0)}</span>
                            </div>
                            {group.context_summary && (
                              <p className="mb-2 text-xs text-muted-foreground">{group.context_summary}</p>
                            )}
                            <div className="space-y-2">
                              {(group.cart ?? []).filter((_: any, idx: number) => !removedKeys.has(String(_.sku ?? `${gi}-${idx}`))).map((item: any, idx: number) => {
                                const key = String(item.sku ?? `${gi}-${idx}`);
                                const qty = quantities[key] ?? item.quantity_units;
                                return (
                                  <CartItemRow
                                    key={key}
                                    item={item}
                                    qty={qty}
                                    onDecrement={() => adjustQty(key, -1)}
                                    onIncrement={() => adjustQty(key, 1)}
                                    onRemove={() => setRemovedKeys((prev) => new Set([...prev, key]))}
                                  />
                                );
                              })}
                            </div>
                            {/* Per-group unavailable */}
                            {group.unavailable_items?.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {group.unavailable_items.map((it: any, idx: number) => (
                                  <div key={idx} className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs">
                                    <AlertTriangle className="h-3 w-3 shrink-0 text-destructive" />
                                    <span className="font-medium">{it.name}</span>
                                    <span className="text-muted-foreground">— {it.reason?.replace(/_/g, " ")}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {/* Divider between groups */}
                            {gi < intentGroups.length - 1 && (
                              <div className="mt-4 border-t border-border/50" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* Single intent (or restored from history): flat list */
                    <div className="space-y-2.5">
                      {cartData.cart?.filter((_: any, idx: number) => {
                        const key = String(_.sku ?? idx);
                        return !removedKeys.has(key);
                      }).map((item: any, idx: number) => {
                        const key = String(item.sku ?? idx);
                        const qty = quantities[key] ?? item.quantity_units;
                        return (
                          <CartItemRow
                            key={key}
                            item={item}
                            qty={qty}
                            onDecrement={() => adjustQty(key, -1)}
                            onIncrement={() => adjustQty(key, 1)}
                            onRemove={() => setRemovedKeys((prev) => new Set([...prev, key]))}
                          />
                        );
                      })}
                    </div>
                  )}

                  {/* Unavailable items (for flat/single-intent mode) */}
                  {intentGroups.length <= 1 && cartData.unavailable_items?.length > 0 && (
                    <div className="mt-5">
                      <div className="mb-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Unavailable
                      </div>
                      <div className="space-y-2">
                        {cartData.unavailable_items.map((it: any, idx: number) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-xs"
                          >
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />
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

                {/* Footer with total */}
                <div className="border-t border-border/60 bg-gradient-to-t from-surface/80 to-surface/40 p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total</span>
                    <span className="font-display text-3xl font-semibold tracking-tight">₹{computedTotal.toFixed(0)}</span>
                  </div>
                  {budgetInput && Number(budgetInput) > 0 && (
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface">
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
                    className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-foreground text-sm font-medium text-background shadow-md transition-all hover:bg-foreground/90 hover:shadow-lg"
                  >
                    Review cart
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface">
                  <ShoppingCart className="h-8 w-8 text-muted-foreground/30" />
                </div>
                <div className="space-y-1">
                  <p className="font-display text-base font-medium">Your cart is empty</p>
                  <p className="text-sm text-muted-foreground">Describe what you need and I'll build your cart</p>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
