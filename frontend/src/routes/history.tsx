import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { loadHistory, type CartHistoryEntry } from "@/lib/cart-history";
import { useChatStore } from "@/store/useChatStore";
import { useEffect, useState } from "react";
import { ShoppingCart, Clock, ArrowRight, Package, RefreshCw, Calendar, ChevronDown } from "lucide-react";

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
    // Set cart data in global store
    setCartData(entry);
    setPhase("cart");
    
    // Add a quick message to chat context
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        text: `Restored your past order with ${entry.item_count} items. You can modify it or proceed to checkout.`,
      },
    ]);

    // Navigate to chat where the cart will be visible
    navigate({ to: "/chat" });
  };

  const handleDirectReorder = (entry: CartHistoryEntry) => {
    setCartData(entry);
    setPhase("cart");
    navigate({ to: "/cart/$id", params: { id: entry.session_id } });
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Past Orders</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Review and reorder from your saved carts and previous sessions.
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
            <ShoppingCart className="h-6 w-6" />
          </div>
        </div>

        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/60 bg-surface/30 py-24 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface/50">
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">No past orders yet</h3>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Your saved carts and previous checkout sessions will appear here. Start chatting to build your first cart!
            </p>
            <button
              onClick={() => navigate({ to: "/chat" })}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground shadow-lg shadow-brand/20 transition-all hover:scale-105 hover:bg-brand/90 active:scale-95"
            >
              Start New Order
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
                  className={`group relative flex flex-col overflow-hidden rounded-3xl border border-border/40 bg-gradient-to-b from-card to-card/60 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand/40 hover:shadow-xl hover:shadow-brand/5 ${entry.cart && entry.cart.length > 3 ? "cursor-pointer" : ""}`}
                >
                  {/* Subtle Top Ambient Border Accent on Hover */}
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand/20 via-brand/40 to-brand/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                  <div className="flex-1 p-6 flex flex-col justify-between">
                    <div>
                      {/* Top Header - Removed the intent category tag completely ("write nothing there") */}
                      <div className="mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand/80 bg-brand/5 px-2.5 py-1 rounded-lg">
                          <Clock className="h-3.5 w-3.5" />
                          <span>Session #{entry.session_id.slice(-4)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-surface/50 px-2.5 py-1 rounded-lg border border-border/20">
                          <Calendar className="h-3.5 w-3.5 text-brand/60" />
                          <span>{formattedDate}</span>
                        </div>
                      </div>

                      {/* Title with display serif typography */}
                      <h3 className="mb-3 line-clamp-2 text-xl font-bold tracking-tight text-foreground group-hover:text-brand transition-colors duration-300 font-serif leading-snug">
                        {entry.context_summary || "Saved Cart Session"}
                      </h3>

                      {/* Stats with custom pill layout */}
                      <div className="mb-6 flex items-center gap-2">
                        <div className="flex items-center gap-1.5 rounded-xl bg-surface/60 border border-border/30 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                          <Package className="h-3.5 w-3.5 text-brand/60" />
                          <span>{entry.item_count} items</span>
                        </div>
                        <div className="flex items-center gap-1 rounded-xl bg-brand/5 border border-brand/10 px-3 py-1.5 text-xs font-bold text-brand">
                          <span>₹{entry.total_price_inr?.toLocaleString("en-IN") || 0}</span>
                        </div>
                      </div>

                      {/* Items Preview with detailed spacing and micro-hover effect */}
                      {entry.cart && entry.cart.length > 0 && (
                        <div 
                          className="space-y-2 rounded-2xl border border-border/30 bg-surface/20 p-2.5 transition-all duration-300 hover:bg-surface/30"
                        >
                          {/* First 3 Items */}
                          {entry.cart.slice(0, 3).map((item: any, i: number) => (
                            <div key={i} className="group/item flex items-center gap-3 rounded-xl bg-card/60 border border-border/20 p-2 transition-all duration-200 hover:bg-card hover:border-brand/20">
                              {item.image_url ? (
                                <img src={item.image_url} alt="" className="h-9 w-9 rounded-lg object-cover border border-border/40 shadow-sm" />
                              ) : (
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface border border-border/40 shadow-sm">
                                  <Package className="h-4.5 w-4.5 text-muted-foreground/60" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="truncate text-xs font-semibold text-foreground/80 group-hover/item:text-foreground transition-colors">
                                  {item.name || item.sku}
                                </div>
                                {item.price_inr && (
                                  <div className="text-[10px] text-muted-foreground font-medium">
                                    ₹{item.price_inr} each
                                  </div>
                                )}
                              </div>
                              <div className="flex-shrink-0">
                                <span className="inline-flex h-5 items-center justify-center rounded-md bg-brand/10 border border-brand/20 px-2 text-[10px] font-bold text-brand">
                                  {item.quantity}x
                                </span>
                              </div>
                            </div>
                          ))}

                          {/* Extra items inside an animated grid row height container */}
                          {entry.cart.length > 3 && (
                            <div 
                              className={`grid transition-all duration-300 ease-in-out ${
                                isExpanded ? "grid-rows-[1fr] opacity-100 mt-2" : "grid-rows-[0fr] opacity-0 overflow-hidden"
                              }`}
                            >
                              <div className="overflow-hidden space-y-2">
                                {entry.cart.slice(3).map((item: any, i: number) => (
                                  <div key={i + 3} className="group/item flex items-center gap-3 rounded-xl bg-card/60 border border-border/20 p-2 transition-all duration-200 hover:bg-card hover:border-brand/20">
                                    {item.image_url ? (
                                      <img src={item.image_url} alt="" className="h-9 w-9 rounded-lg object-cover border border-border/40 shadow-sm" />
                                    ) : (
                                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface border border-border/40 shadow-sm">
                                        <Package className="h-4.5 w-4.5 text-muted-foreground/60" />
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <div className="truncate text-xs font-semibold text-foreground/80 group-hover/item:text-foreground transition-colors">
                                        {item.name || item.sku}
                                      </div>
                                      {item.price_inr && (
                                        <div className="text-[10px] text-muted-foreground font-medium">
                                          ₹{item.price_inr} each
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex-shrink-0">
                                      <span className="inline-flex h-5 items-center justify-center rounded-md bg-brand/10 border border-brand/20 px-2 text-[10px] font-bold text-brand">
                                        {item.quantity}x
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {entry.cart.length > 3 && (
                            <div className="pt-1 text-center text-xs font-bold text-brand hover:text-brand/80 transition-colors flex items-center justify-center gap-1 select-none">
                              <span>{isExpanded ? "Show Less" : `+${entry.cart.length - 3} more items`}</span>
                              <ChevronDown className={`h-3 w-3 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`} />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    className="border-t border-border/45 bg-surface/25 p-4 flex gap-3"
                  >
                    <button
                      onClick={() => handleLoadInChat(entry)}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-card hover:bg-surface border border-border/60 px-4 py-2.5 text-xs font-bold text-foreground transition-all duration-200 active:scale-[0.98] shadow-sm hover:shadow"
                    >
                      <RefreshCw className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-500 group-hover:rotate-180" />
                      Load in Chat
                    </button>
                    <button
                      onClick={() => handleDirectReorder(entry)}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand hover:bg-brand/95 px-4 py-2.5 text-xs font-bold text-brand-foreground transition-all duration-200 active:scale-[0.98] shadow-md shadow-brand/10 hover:shadow-brand/20"
                    >
                      <ShoppingCart className="h-3.5 w-3.5 text-brand-foreground" />
                      Reorder
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
