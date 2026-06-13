import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Check, FileText, Image as ImageIcon, Link as LinkIcon, Paperclip, Sparkles, Users, Wallet } from "lucide-react";
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

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "Chat — NeedSpeak" },
      { name: "description", content: "Describe what you're planning. NeedSpeak extracts intent and builds a cart in real time." },
      { property: "og:title", content: "Chat — NeedSpeak" },
      { property: "og:description", content: "Context-to-Cart workspace with live intent extraction." },
    ],
  }),
  component: ChatPage,
});

type Phase = "idle" | "thinking" | "extracted" | "cart";

function ChatPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [text, setText] = useState(samplePrompts[0]);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([
    { role: "assistant", text: "Describe your occasion or paste a recipe, and I'll build a cart for you." },
  ]);
  const [cartData, setCartData] = useState<any>(null);
  const [budget, setBudget] = useState(1500);
  const [useBudget, setUseBudget] = useState(true);
  const [servings, setServings] = useState("");

  const updateItemQuantity = (intentIdx: number, sku: string, delta: number) => {
    if (!cartData) return;
    const newCartData = JSON.parse(JSON.stringify(cartData));
    const intentGroup = newCartData.intents[intentIdx];
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
    
    let newTotal = 0;
    newCartData.intents.forEach((group: any) => {
      group.cart.forEach((it: any) => {
        newTotal += it.total_price_inr;
      });
    });
    newCartData.total_price_inr = newTotal;
    
    setCartData(newCartData);
  };

  const onSubmit = async () => {
    if (!text.trim()) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setPhase("thinking");
    const inputText = text;
    setText("");
    
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          content: inputText, 
          input_type: "text", 
          ...(useBudget ? { budget_inr: budget } : {}),
          ...(servings ? { servings_override: parseInt(servings, 10) } : {})
        }),
      });
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      
      setCartData(data);
      setMessages((m) => [...m, { role: "assistant", text: data.summary, cartData: data }]);
      setPhase("cart");
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", text: "Failed to process your request." }]);
      setPhase("idle");
    }
  };

  return (
    <AppShell>
      <div className="mx-auto grid h-[calc(100vh-4rem)] max-w-7xl grid-cols-1 lg:grid-cols-[1fr_440px]">
        {/* Left: conversation */}
        <div className="flex min-h-0 flex-col border-r border-border">
          <div className="border-b border-border px-4 py-3 sm:px-6">
            <div className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-brand" />
              <span className="font-medium">Context-to-Cart</span>
              <span className="text-muted-foreground">· Describe it, paste it, drop it</span>
            </div>
          </div>

          <Conversation className="flex-1">
            <ConversationContent>
              {messages.map((m, i) => (
                <Message key={i} from={m.role}>
                  {m.role === "assistant" ? (
                    <MessageContent>
                      <MessageResponse>{m.text}</MessageResponse>
                      
                      {m.cartData && (
                        <div className="mt-4 space-y-3 border-t border-border/40 pt-3">
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Intent extracted</div>
                          <pre className="overflow-x-auto rounded-lg bg-surface p-2.5 text-[11px] leading-relaxed text-foreground border border-border/30">
{JSON.stringify(m.cartData.intents?.map((intent: any) => ({ intent: intent.intent_type, summary: intent.context_summary })), null, 2)}
                          </pre>
                          
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[10px] text-muted-foreground font-mono bg-surface px-1.5 py-0.5 rounded border border-border/20">
                              ID: {m.cartData.session_id.slice(0, 8)}
                            </span>
                            {cartData?.session_id === m.cartData.session_id ? (
                              <span className="inline-flex items-center gap-1 rounded bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand animate-pulse">
                                Active Cart
                              </span>
                            ) : (
                              <button
                                onClick={() => setCartData(m.cartData)}
                                className="rounded bg-muted px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-foreground hover:text-background transition-all hover:scale-[1.02]"
                              >
                                Show Cart
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </MessageContent>
                  ) : (
                    <MessageContent>{m.text}</MessageContent>
                  )}
                </Message>
              ))}

              {phase === "thinking" && (
                <Message from="assistant">
                  <MessageContent>
                    <Shimmer>Extracting intent…</Shimmer>
                  </MessageContent>
                </Message>
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          <div className="border-t border-border bg-background p-3 sm:p-4">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {[
                { i: LinkIcon, l: "Paste URL" },
                { i: ImageIcon, l: "Image" },
                { i: FileText, l: "PDF" },
                { i: Paperclip, l: "WhatsApp" },
              ].map((c) => (
                <button key={c.l} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-muted-foreground hover:border-foreground hover:text-foreground">
                  <c.i className="h-3.5 w-3.5" />
                  {c.l}
                </button>
              ))}
            </div>
            
            <div className="mb-3 flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <input 
                  id="useBudget" 
                  type="checkbox" 
                  checked={useBudget}
                  onChange={(e) => setUseBudget(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border accent-brand cursor-pointer"
                />
                <label htmlFor="budget" className="select-none cursor-pointer">Budget (₹):</label>
                <input 
                  id="budget" 
                  type="number" 
                  disabled={!useBudget}
                  className="w-20 rounded border border-border bg-surface px-2 py-1 text-foreground disabled:opacity-40 disabled:cursor-not-allowed" 
                  value={budget} 
                  onChange={e => setBudget(Number(e.target.value))} 
                />
              </div>
              <div className="flex items-center gap-1.5">
                <label htmlFor="servings">Servings:</label>
                <input 
                  id="servings" 
                  type="number" 
                  placeholder="Auto" 
                  className="w-16 rounded border border-border bg-surface px-2 py-1 text-foreground placeholder:text-muted-foreground/50" 
                  value={servings} 
                  onChange={e => setServings(e.target.value)} 
                />
              </div>
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

        {/* Right: cart pane */}
        <aside className="hidden min-h-0 flex-col bg-surface lg:flex">
          {cartData ? (
            <>
              <div className="border-b border-border px-5 py-3">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Live cart</div>
                <div className="mt-1 text-base font-semibold">
                  {cartData.intents?.length > 1 ? "Multi-Intent Cart" : cartData.intents?.[0]?.intent_type}
                </div>
                <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Wallet className="h-3.5 w-3.5" /> ₹{cartData.total_price_inr}</span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-6">
                  {cartData.intents?.map((intentGroup: any, idx: number) => (
                    <div key={idx} className="space-y-3">
                      <div className="text-sm font-semibold text-muted-foreground border-b border-border pb-1">
                        {intentGroup.intent_type.toUpperCase()}
                      </div>
                      {intentGroup.cart?.map((it: any) => (
                        <div key={it.id || it.sku} className="rounded-xl border border-border bg-background p-3 hover:border-border/80 transition-colors">
                          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium">{it.name}</div>
                              
                              <div className="mt-1.5 flex items-center gap-2">
                                <div className="flex items-center rounded-lg border border-border bg-surface text-xs font-semibold overflow-hidden">
                                  <button 
                                    onClick={() => updateItemQuantity(idx, it.sku, -1)}
                                    className="px-2 py-0.5 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground cursor-pointer select-none"
                                  >
                                    -
                                  </button>
                                  <span className="px-2 font-mono text-[11px] min-w-[12px] text-center select-none">{it.quantity_units}</span>
                                  <button 
                                    onClick={() => updateItemQuantity(idx, it.sku, 1)}
                                    className="px-2 py-0.5 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground cursor-pointer select-none"
                                  >
                                    +
                                  </button>
                                </div>
                                <span className="text-[10px] text-muted-foreground">· {it.brand}</span>
                              </div>
                              
                              <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-[10px] text-muted-foreground">
                                <Check className="h-3 w-3 text-brand" />
                                {it.substituted ? (it.substitution_reason || "Substituted") : (it.matched_from?.join(", ") || "Matched")}
                              </div>
                            </div>
                            <div className="shrink-0 text-sm font-semibold">₹{it.total_price_inr}</div>
                          </div>
                        </div>
                      ))}
                      {intentGroup.unavailable_items?.map((it: any, i: number) => (
                        <div key={i} className="rounded-xl border border-dashed border-destructive/35 bg-destructive/5 p-3 opacity-90">
                          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium line-through text-muted-foreground">{it.name}</div>
                              <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                                Unavailable: {it.reason?.replace('_', ' ')}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-border bg-background p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total</span>
                  <span className="text-lg font-semibold">₹{cartData.total_price_inr}</span>
                </div>
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
            <div className="flex flex-1 items-center justify-center p-4 text-sm text-muted-foreground">
              Your cart will appear here
            </div>
          )}
        </aside>
      </div>
    </AppShell>
  );
}
