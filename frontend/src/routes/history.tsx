import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { loadHistory, type CartHistoryEntry } from "@/lib/cart-history";
import { useChatStore } from "@/store/useChatStore";
import { useEffect, useState } from "react";
import { 
  ShoppingCart, Clock, ArrowRight, Package, RefreshCw, 
  Calendar, ChevronDown, Sparkles, Bot, BrainCircuit, 
  ShoppingBag, Zap 
} from "lucide-react";

export const Route = createFileRoute("/history")({
  component: HistoryPage,
});

function HistoryPage() {
  const [history, setHistory] = useState<CartHistoryEntry[]>([]);
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({});
  const navigate = useNavigate();

  const toggleSession = (sessionId: string) => {
    setExpandedSessions((prev) => ({
      ...prev,
      [sessionId]: !prev[sessionId],
    }));
  };
  
  const setCartData = useChatStore((s) => s.setCartData);
  const setMessages = useChatStore((s) => s.setMessages);
  const setPhase = useChatStore((s) => s.setPhase);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const handleLoadInChat = (entry: CartHistoryEntry) => {
    setCartData(entry);
    setPhase("cart");
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        text: `Restored your past order context. I've loaded ${entry.item_count} items into your cart. How would you like to modify this?`,
      },
    ]);
    navigate({ to: "/chat" });
  };

  const handleDirectReorder = (entry: CartHistoryEntry) => {
    setCartData(entry);
    setPhase("cart");
    navigate({ to: "/cart/$id", params: { id: entry.session_id } });
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Hackathon Pitch Banner */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-brand/20 bg-brand/5 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <BrainCircuit className="h-6 w-6 text-brand" />
            <div>
              <span className="text-sm font-bold text-foreground">Agentic Memory Engine</span>
              <p className="text-xs text-muted-foreground mt-0.5">Past conversational contexts and generated carts are saved for instantaneous retrieval.</p>
            </div>
          </div>
          <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand px-3 py-1 text-[10px] font-black text-white uppercase tracking-wider shadow-sm">
            <Bot className="h-3 w-3" /> State Preserved
          </div>
        </div>

        {/* Header */}
        <div className="mb-10 flex items-end justify-between">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
              Cart Memory
            </h1>
            <p className="mt-3 text-lg text-muted-foreground max-w-2xl">
              Your previous AI-generated carts. Resume a past conversation or reorder instantly with one tap.
            </p>
          </div>
          <div className="hidden sm:flex h-14 w-14 items-center justify-center rounded-2xl bg-surface border border-border shadow-sm text-foreground">
            <ShoppingBag className="h-6 w-6" />
          </div>
        </div>

        {history.length === 0 ? (
          <div className="relative overflow-hidden flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-surface/30 py-32 text-center transition-all hover:bg-surface/50">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-brand/5 via-transparent to-transparent opacity-50 pointer-events-none" />
            
            <div className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-background border border-border shadow-xl shadow-brand/5">
              <Sparkles className="absolute -top-2 -right-2 h-6 w-6 text-amber-400 animate-pulse" />
              <Package className="h-10 w-10 text-brand" />
            </div>
            
            <h3 className="text-2xl font-bold text-foreground">No memory state found</h3>
            <p className="mt-3 max-w-md text-sm text-muted-foreground">
              As you interact with the NeedSpeak AI, your generated carts and conversational context will be securely saved here.
            </p>
            
            <button
              onClick={() => navigate({ to: "/chat" })}
              className="relative mt-8 inline-flex items-center gap-2 rounded-xl bg-foreground px-8 py-4 text-sm font-bold text-background shadow-xl transition-all hover:scale-105 hover:bg-foreground/90 hover:shadow-brand/20 active:scale-95"
            >
              Initialize New Session
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {history.map((entry) => {
              const dateObj = entry.saved_at ? new Date(entry.saved_at) : new Date();
              const formattedDate = new Intl.DateTimeFormat("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              }).format(dateObj);

              const isExpanded = !!expandedSessions[entry.session_id];

              return (
                <div
                  key={entry.session_id}
                  onClick={() => {
                    if (entry.cart && entry.cart.length > 3) {
                      toggleSession(entry.session_id);
                    }
                  }}
                  className={`group relative flex flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand/50 hover:shadow-xl hover:shadow-brand/10 ${entry.cart && entry.cart.length > 3 ? "cursor-pointer" : ""}`}
                >
                  {/* Subtle Background Glow on Hover */}
                  <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-brand/10 blur-3xl transition-opacity duration-500 opacity-0 group-hover:opacity-100" />

                  <div className="relative flex-1 p-6 flex flex-col justify-between z-10">
                    <div>
                      {/* Top Badges */}
                      <div className="mb-5 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 rounded-lg bg-surface px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border border-border/50">
                          <Clock className="h-3 w-3" />
                          #{entry.session_id.slice(-5)}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                          <Calendar className="h-3.5 w-3.5 text-brand" />
                          {formattedDate}
                        </div>
                      </div>

                      {/* AI Context Title */}
                      <div className="mb-5">
                        <h3 className="line-clamp-2 text-xl font-bold tracking-tight text-foreground group-hover:text-brand transition-colors duration-300">
                          {entry.context_summary || "AI Generated Cart"}
                        </h3>
                        <p className="mt-1.5 text-xs text-muted-foreground font-medium flex items-center gap-1">
                          <Zap className="h-3 w-3 text-amber-500" />
                          Generated via AI prompt
                        </p>
                      </div>

                      {/* Metrics */}
                      <div className="mb-6 grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-surface/50 border border-border/50 p-3">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Items</p>
                          <p className="text-lg font-black text-foreground">{entry.item_count}</p>
                        </div>
                        <div className="rounded-xl bg-brand/5 border border-brand/10 p-3">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-brand/70 mb-1">Total</p>
                          <p className="text-lg font-black text-brand">₹{entry.total_price_inr?.toLocaleString("en-IN") || 0}</p>
                        </div>
                      </div>

                      {/* Items Receipt Preview */}
                      {entry.cart && entry.cart.length > 0 && (
                        <div className="rounded-2xl border border-border/60 bg-background/50 p-2 shadow-inner transition-colors duration-300 group-hover:bg-background">
                          {/* First 3 Items */}
                          <div className="space-y-1">
                            {entry.cart.slice(0, 3).map((item: any, i: number) => (
                              <div key={i} className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-surface/80">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-surface text-lg">
                                  {item.image_url ? (
                                    <img src={item.image_url} alt="" className="h-full w-full rounded-lg object-cover" />
                                  ) : "📦"}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="truncate text-xs font-bold text-foreground">
                                    {item.name || item.sku}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground font-medium mt-0.5">
                                    {item.quantity} × ₹{item.price_inr}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Expandable Items */}
                          {entry.cart.length > 3 && (
                            <div 
                              className={`grid transition-all duration-300 ease-in-out ${
                                isExpanded ? "grid-rows-[1fr] opacity-100 mt-1" : "grid-rows-[0fr] opacity-0"
                              }`}
                            >
                              <div className="overflow-hidden space-y-1">
                                {entry.cart.slice(3).map((item: any, i: number) => (
                                  <div key={i + 3} className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-surface/80">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-surface text-lg">
                                      {item.image_url ? (
                                        <img src={item.image_url} alt="" className="h-full w-full rounded-lg object-cover" />
                                      ) : "📦"}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="truncate text-xs font-bold text-foreground">
                                        {item.name || item.sku}
                                      </div>
                                      <div className="text-[10px] text-muted-foreground font-medium mt-0.5">
                                        {item.quantity} × ₹{item.price_inr}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Expansion Toggle */}
                          {entry.cart.length > 3 && (
                            <div className="mt-2 py-1.5 text-center text-[10px] font-black uppercase tracking-wider text-brand hover:text-brand/80 transition-colors flex items-center justify-center gap-1 select-none border-t border-border/50">
                              <span>{isExpanded ? "Hide Details" : `View ${entry.cart.length - 3} More Items`}</span>
                              <ChevronDown className={`h-3 w-3 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`} />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    className="relative z-10 border-t border-border/60 bg-surface/40 p-4 flex gap-3 backdrop-blur-md"
                  >
                    <button
                      onClick={() => handleLoadInChat(entry)}
                      className="group/btn flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-background border border-border px-4 py-3 text-xs font-bold text-foreground transition-all hover:bg-surface hover:border-foreground/20 hover:shadow-sm active:scale-[0.98]"
                    >
                      <RefreshCw className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-500 group-hover/btn:rotate-180" />
                      Open Chat
                    </button>
                    <button
                      onClick={() => handleDirectReorder(entry)}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-xs font-bold text-white transition-all hover:bg-brand/90 hover:shadow-lg hover:shadow-brand/20 active:scale-[0.98]"
                    >
                      <ShoppingCart className="h-3.5 w-3.5" />
                      1-Tap Buy
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}