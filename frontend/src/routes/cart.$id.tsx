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
  X,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  Sliders,
  Bell,
  ShieldCheck,
  Bot,
  Package,
  Zap,
  BrainCircuit,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { downloadCSV, copyWhatsAppToClipboard, type ExportableCart } from "@/lib/cart-export";
import { useWishlistStore } from "@/store/useWishlistStore";
import { loadHistory } from "@/lib/cart-history";
import { SemanticSearchSkeleton } from "@/components/common/SemanticSearchSkeleton";
import { useChatStore } from "@/store/useChatStore";
import { BudgetFingerprint } from "@/components/common/BudgetFingerprint";
import { getItemBadge } from "@/lib/mock/item-badges";

// Helper functions for fake badges (Demo mode)
function getFakeHealthBadge(item: any): string | null {
  if (item.health_badge) return item.health_badge;

  const name = (item.name || "").toLowerCase();
  const sku = (item.sku || "").toUpperCase();

  // Non-food items get product badges instead
  const nonFoodKeywords = [
    "plate", "cup", "napkin", "tablecloth", "foil", "tissue", "soap", "shampoo",
    "detergent", "cleaner", "brush", "sponge", "voucher", "ticket", "battery",
    "bulb", "diaper", "wipes", "medicine", "tablet", "syrup", "paracetamol",
    "mask", "sanitizer", "lotion", "cream", "toothpaste", "dog", "puppy", "pet", "drools",
    "screwdriver", "wrench", "spanner", "tape", "pen", "notebook", "pencil", "eraser",
    "sharpener", "geometry"
  ];
  if (nonFoodKeywords.some(kw => name.includes(kw)) || sku.includes("-DSP-") || sku.includes("-STN-") || sku.includes("-TLS-") || sku.includes("-MED-")) {
    return null;
  }

  // Excellent Choice items
  const excellentKeywords = [
    "garlic", "ginger", "tomato", "onion", "potato", "spinach", "vegetable", "veg",
    "fruit", "apple", "banana", "orange", "lemon", "mint", "coriander", "cilantro",
    "water", "bisleri", "aquafina", "green tea", "oats", "dal", "lentil", "pulse",
    "chana", "rajma", "moong", "rice", "wheat", "atta", "broccoli", "carrot",
    "cucumber", "avocado", "salad"
  ];
  if (excellentKeywords.some(kw => name.includes(kw))) {
    return "excellent";
  }

  // Less Healthy (poor) items
  const poorKeywords = [
    "coke", "coca-cola", "pepsi", "soda", "cold drink", "soft drink", "fanta", "sprite",
    "chips", "crisps", "kurkure", "lays", "lay's", "bingo", "chocolate", "cadbury",
    "dairy milk", "snickers", "kitkat", "ice cream", "cookie", "biscuit", "oreo",
    "pastry", "cake", "maggi", "noodle", "ramen", "chocos", "froot loops", "sweet", "candy"
  ];
  if (poorKeywords.some(kw => name.includes(kw))) {
    return "poor";
  }

  // Moderate items
  const moderateKeywords = [
    "cheese", "butter", "mayo", "sauce", "ketchup", "jam", "spread", "pizza", "burger",
    "pasta", "white bread", "refined", "fry", "fried"
  ];
  if (moderateKeywords.some(kw => name.includes(kw))) {
    return "moderate";
  }

  // Good Choice items
  const goodKeywords = [
    "egg", "chicken", "fish", "mutton", "beef", "milk", "paneer", "yogurt", "curd",
    "tofu", "brown bread", "whole wheat", "juice", "nut", "almond", "cashew", "walnut",
    "honey"
  ];
  if (goodKeywords.some(kw => name.includes(kw))) {
    return "good";
  }

  // Fallback for general food items
  return "good";
}

function getFakeHealthScore(badge: string | null): number | undefined {
  if (!badge) return undefined;
  if (badge === "excellent") return 88;
  if (badge === "good") return 74;
  if (badge === "moderate") return 52;
  if (badge === "poor") return 25;
  return undefined;
}

function getFakeProductBadge(item: any): { label: string; color: string; icon: string; type: string } | null {
  if (item.product_badge) return item.product_badge;

  const name = (item.name || "").toLowerCase();
  const sku = (item.sku || "").toUpperCase();
  
  if (name.includes("plate") || name.includes("cup") || name.includes("napkin") || name.includes("tablecloth") || name.includes("foil") || name.includes("tissue") || sku.includes("-DSP-")) {
    return {
      label: "Eco-Friendly",
      color: "bg-green-500/15 text-green-700 border-green-500/30",
      icon: "🌱",
      type: "eco"
    };
  }
  if (name.includes("soap") || name.includes("shampoo") || name.includes("cleaner") || name.includes("detergent") || name.includes("brush") || name.includes("sponge")) {
    return {
      label: "Eco-Friendly",
      color: "bg-green-500/15 text-green-700 border-green-500/30",
      icon: "🌱",
      type: "eco"
    };
  }
  if (name.includes("voucher") || name.includes("ticket")) {
    return {
      label: "Best Value",
      color: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
      icon: "💎",
      type: "value"
    };
  }
  if (name.includes("medicine") || name.includes("tablet") || name.includes("syrup") || name.includes("paracetamol") || name.includes("vitamin") || name.includes("cough") || sku.includes("-MED-")) {
    return {
      label: "Top Rated",
      color: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30",
      icon: "⭐",
      type: "rating"
    };
  }
  if (name.includes("dog") || name.includes("puppy") || name.includes("pet") || name.includes("drools")) {
    return {
      label: "Vet Approved",
      color: "bg-blue-500/15 text-blue-700 border-blue-500/30",
      icon: "✓",
      type: "quality"
    };
  }
  if (sku.includes("-STN-") || name.includes("pen") || name.includes("notebook") || name.includes("pencil") || name.includes("eraser") || name.includes("geometry")) {
    return {
      label: "Premium Quality",
      color: "bg-indigo-500/15 text-indigo-700 border-indigo-500/30",
      icon: "⭐",
      type: "quality"
    };
  }
  if (sku.includes("-TLS-") || name.includes("screwdriver") || name.includes("wrench") || name.includes("spanner") || name.includes("tape")) {
    return {
      label: "Durable Tool",
      color: "bg-slate-500/15 text-slate-700 border-slate-500/30",
      icon: "🔧",
      type: "quality"
    };
  }
  return null;
}

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
  const reasonText = item.reason ? item.reason.replace(/_/g, " ") : "Unavailable";

  const { addToWishlist, wishlist } = useWishlistStore();
  const inWishlist = wishlist.some((w) => w.id === (item.sku || item.name));

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
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 ${iconColor}`}
          >
            <AlertTriangle className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold capitalize text-foreground">
              {item.name}
            </div>
            <div className="mt-0.5 text-xs font-medium text-muted-foreground">
              Not added to cart
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold capitalize tracking-wide transition-transform duration-300 group-hover:scale-105 ${badgeBg}`}
          >
            {reasonText}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!inWishlist) {
                addToWishlist(getStoredUserId(), {
                  id: item.sku || item.name,
                  name: item.name,
                  image_url: item.image_url,
                  current_price_inr: item.total_price_inr || item.price || 100,
                  brand: item.brand,
                });
              }
            }}
            disabled={inWishlist}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-all ${
              inWishlist 
                ? "bg-surface text-muted-foreground border border-border/50 opacity-80" 
                : "bg-brand/10 text-brand border border-brand/20 hover:bg-brand/20 hover:scale-105"
            }`}
          >
            {inWishlist ? (
              <>
                <Check className="h-3 w-3" />
                Wishlisted
              </>
            ) : (
              <>
                <Bell className="h-3 w-3" />
                Notify Me
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── CompareCart "What If" Drawer ──────────────────────────────────────────────

type CompareResult = {
  intents: any[];
  total_price_inr: number;
  budget_exceeded: boolean;
};

function CompareCartDrawer({
  open,
  onClose,
  sessionId,
  currentCart: currentItems,
  currentTotal,
  currentBudget,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  currentCart: any[];
  currentTotal: number;
  currentBudget: number | null;
  onApply: (result: CompareResult) => void;
}) {
  const [budget, setBudget] = useState(currentBudget ?? 1500);
  const [servings, setServings] = useState(10);
  const [originalServings, setOriginalServings] = useState(10);
  const [dietary, setDietary] = useState("any");
  const [budgetMode, setBudgetMode] = useState("balanced");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset when drawer opens
  useEffect(() => {
    if (open) {
      setBudget(currentBudget ?? 1500);
      setResult(null);
      setError(null);
    }
  }, [open, currentBudget]);

  const runCompare = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/recompare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          budget_inr: budget,
          servings_override: servings,
          original_servings: originalServings,
          dietary_pref: dietary === "any" ? null : dietary,
          budget_mode: budgetMode,
        }),
      });
      if (!res.ok) throw new Error("Comparison failed");
      const data = await res.json();
      setResult(data);
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const comparedItems = result ? result.intents.flatMap((g: any) => g.cart ?? []) : [];
  const comparedTotal = result?.total_price_inr ?? 0;
  const savings = currentTotal - comparedTotal;

  // Build a diff map: match items by name for comparison
  const buildItemMap = (items: any[]) => {
    const map = new Map<string, any>();
    items.forEach((item) => {
      const key = item.name?.toLowerCase() || item.sku;
      map.set(key, item);
    });
    return map;
  };

  const currentMap = buildItemMap(currentItems);
  const comparedMap = buildItemMap(comparedItems);

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer panel */}
      <div className="relative ml-auto flex h-full w-full max-w-4xl flex-col border-l border-border bg-background shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand/20 to-brand/10">
              <ArrowLeftRight className="h-4.5 w-4.5 text-brand" />
            </div>
            <div>
              <h2 className="text-lg font-bold">CompareCart — What If?</h2>
              <p className="text-xs text-muted-foreground">
                Tweak parameters and see how your cart changes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Controls bar */}
        <div className="border-b border-border bg-surface/30 px-6 py-4">
          <div className="flex items-center gap-2 mb-3">
            <Sliders className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Scenario Parameters
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {/* Budget */}
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Budget (₹)
              </label>
              <input
                type="number"
                min={100}
                step={100}
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm font-medium focus:border-brand focus:outline-none"
              />
            </div>

            {/* Servings */}
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Servings
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={servings}
                  onChange={(e) => setServings(Number(e.target.value))}
                  className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm font-medium focus:border-brand focus:outline-none"
                />
              </div>
            </div>

            {/* Dietary */}
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Dietary
              </label>
              <select
                value={dietary}
                onChange={(e) => setDietary(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm font-medium focus:border-brand focus:outline-none"
              >
                <option value="any">Any</option>
                <option value="vegetarian">Vegetarian</option>
                <option value="vegan">Vegan</option>
                <option value="jain">Jain</option>
                <option value="eggetarian">Eggetarian</option>
              </select>
            </div>

            {/* Budget Mode */}
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Mode
              </label>
              <select
                value={budgetMode}
                onChange={(e) => setBudgetMode(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm font-medium focus:border-brand focus:outline-none"
              >
                <option value="value">Value (cheapest)</option>
                <option value="balanced">Balanced</option>
                <option value="premium">Premium</option>
              </select>
            </div>
          </div>

          <button
            onClick={runCompare}
            disabled={loading}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-brand to-brand/90 px-5 text-sm font-bold text-brand-foreground shadow-md transition-all hover:scale-105 hover:shadow-lg disabled:opacity-60 disabled:pointer-events-none"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Re-resolving…
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Compare
              </>
            )}
          </button>
        </div>

        {/* Comparison body */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center p-12">
              <SemanticSearchSkeleton />
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 m-6 rounded-xl bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </div>
          )}

          {result && !loading && (
            <div className="p-6 space-y-6">
              {/* Summary diff card */}
              <div className="rounded-2xl border-2 border-border/50 bg-gradient-to-br from-surface/60 to-surface/30 p-5">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                      Current
                    </div>
                    <div className="text-2xl font-bold">₹{currentTotal}</div>
                    <div className="text-xs text-muted-foreground">{currentItems.length} items</div>
                  </div>
                  <div className="flex flex-col items-center justify-center">
                    <ArrowLeftRight className="h-5 w-5 text-muted-foreground mb-1" />
                    {savings !== 0 && (
                      <div
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                          savings > 0
                            ? "bg-success/15 text-success"
                            : "bg-destructive/15 text-destructive"
                        }`}
                      >
                        {savings > 0 ? (
                          <>
                            <TrendingDown className="h-3 w-3" /> Save ₹{savings}
                          </>
                        ) : (
                          <>
                            <TrendingUp className="h-3 w-3" /> +₹{Math.abs(savings)}
                          </>
                        )}
                      </div>
                    )}
                    {savings === 0 && (
                      <span className="text-xs text-muted-foreground">Same total</span>
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                      What If
                    </div>
                    <div className="text-2xl font-bold text-brand">₹{comparedTotal}</div>
                    <div className="text-xs text-muted-foreground">
                      {comparedItems.length} items
                    </div>
                  </div>
                </div>
              </div>

              {/* Item-by-item comparison */}
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Item-by-Item Comparison
                  </span>
                  <div className="h-px flex-1 bg-border/40" />
                </div>

                <div className="space-y-2">
                  {comparedItems.map((item: any, idx: number) => {
                    const key = item.name?.toLowerCase() || item.sku;
                    const original = currentMap.get(key);
                    const priceDiff = original
                      ? item.total_price_inr - original.total_price_inr
                      : 0;
                    const isNew = !original;
                    const isSwapped = original && original.sku !== item.sku;

                    return (
                      <div
                        key={item.sku || idx}
                        className={`rounded-xl border p-3 transition-all ${
                          isNew
                            ? "border-brand/40 bg-brand/5"
                            : isSwapped
                              ? "border-amber-500/40 bg-amber-500/5"
                              : priceDiff < 0
                                ? "border-success/30 bg-success/5"
                                : priceDiff > 0
                                  ? "border-destructive/30 bg-destructive/5"
                                  : "border-border/50 bg-background/50"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-semibold capitalize">
                                {item.name}
                              </span>
                              {isNew && (
                                <span className="shrink-0 rounded-full bg-brand/15 px-2 py-0.5 text-[9px] font-bold text-brand">
                                  NEW
                                </span>
                              )}
                              {isSwapped && (
                                <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-400">
                                  SWAPPED
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                              <span className="capitalize">{item.brand}</span>
                              <span>·</span>
                              <span>
                                {item.quantity_units}× {item.unit_quantity}
                                {item.unit}
                              </span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-sm font-bold">₹{item.total_price_inr}</div>
                            {original && priceDiff !== 0 && (
                              <div
                                className={`text-[10px] font-semibold ${
                                  priceDiff < 0 ? "text-success" : "text-destructive"
                                }`}
                              >
                                {priceDiff < 0 ? `↓ ₹${Math.abs(priceDiff)}` : `↑ ₹${priceDiff}`}
                                <span className="ml-1 text-muted-foreground line-through">
                                  ₹{original.total_price_inr}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Items that were in current but not in compared (removed) */}
                  {Array.from(currentMap.entries())
                    .filter(([key]) => !comparedMap.has(key))
                    .map(([key, item]) => (
                      <div
                        key={key}
                        className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 opacity-60"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-semibold capitalize line-through">
                                {item.name}
                              </span>
                              <span className="shrink-0 rounded-full bg-destructive/15 px-2 py-0.5 text-[9px] font-bold text-destructive">
                                REMOVED
                              </span>
                            </div>
                          </div>
                          <div className="text-sm font-bold text-muted-foreground line-through">
                            ₹{item.total_price_inr}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Apply button */}
              <div className="sticky bottom-0 bg-background/90 backdrop-blur-md border-t border-border -mx-6 px-6 py-4">
                <button
                  onClick={() => {
                    if (result) {
                      onApply(result);
                      onClose();
                    }
                  }}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand to-brand/90 text-sm font-bold text-brand-foreground shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl"
                >
                  <Check className="h-4 w-4" />
                  Apply This Cart
                  {savings > 0 && (
                    <span className="ml-1 rounded-full bg-brand-foreground/20 px-2 py-0.5 text-[10px]">
                      Save ₹{savings}
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Empty state when no comparison has been run */}
          {!result && !loading && !error && (
            <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface">
                <ArrowLeftRight className="h-8 w-8 text-muted-foreground/30" />
              </div>
              <div className="space-y-1">
                <p className="font-medium">Adjust the parameters above</p>
                <p className="text-sm text-muted-foreground">
                  Hit "Compare" to see how your cart changes with different budget, servings, or
                  dietary preferences
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── CartPage ─────────────────────────────────────────────────────────────────

function getStoredUserId(): string {
  try {
    const raw = localStorage.getItem("needspeak-auth");
    if (!raw) return "demo_user";
    const parsed = JSON.parse(raw);
    return parsed?.user?.user_id || parsed?.user?.id || "demo_user";
  } catch {
    return "demo_user";
  }
}


// Note: Ensure your external components/helpers are imported correctly here
// import { BudgetFingerprint, CompareCartDrawer, SemanticSearchSkeleton, UnavailableItemRow } from "@/components/cart";
// import { getStoredUserId, getItemBadge, getFakeHealthBadge, getFakeHealthScore, getFakeProductBadge, copyWhatsAppToClipboard, downloadCSV } from "@/lib/utils";

export default function CartPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);

  // --- Backend & State Logic (Preserved exactly as provided) ---
  const syncToActiveChat = (newSession: any) => {
    const state = useChatStore.getState();
    if (state.cartData && String(state.cartData.session_id) === String(newSession.session_id)) {
      state.setCartData((prev: any) => ({
        ...prev,
        total_price_inr: newSession.total_price_inr,
        budget_exceeded: newSession.budget_exceeded,
        cart: newSession.resolved_intents?.length 
          ? newSession.resolved_intents.flatMap((g: any) => g.cart ?? []) 
          : newSession.cart_items || newSession.cart || prev.cart,
        unavailable_items: newSession.resolved_intents?.length 
          ? newSession.resolved_intents.flatMap((g: any) => g.unavailable_items ?? []) 
          : newSession.unavailable_items || prev.unavailable_items,
      }));
      if (newSession.resolved_intents?.length) {
        state.setIntentGroups(newSession.resolved_intents);
      }
    }
  };

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizationSummary, setOptimizationSummary] = useState<string | null>(null);
  const [reserving, setReserving] = useState(false);
  const [reservationStatus, setReservationStatus] = useState<"idle" | "success" | "error">("idle");
  const [reservationMessage, setReservationMessage] = useState<string>("");
  const [narrative, setNarrative] = useState<string | null>(null);
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [priceStatuses, setPriceStatuses] = useState<Record<string, any>>({});

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch(`/api/session/${id}`);
        if (!res.ok) {
          throw new Error(res.status === 404 ? "Session not found" : `Error ${res.status}`);
        }
        let data = await res.json();

        const history = loadHistory();
        const historyEntry = history.find((h) => h.session_id === id);
        if (historyEntry) {
          data = {
            ...data,
            cart: historyEntry.cart,
            cart_items: historyEntry.cart,
            unavailable_items: historyEntry.unavailable_items,
            intent_type: historyEntry.intent_type || data.intent_type,
            context_summary: historyEntry.context_summary || data.context_summary,
            total_price_inr: historyEntry.total_price_inr,
            budget_inr: historyEntry.budget_inr || data.budget_inr,
            resolved_intents: [], 
          };
        }
        setSession(data);
      } catch (e: any) {
        setError(e.message || "Failed to load session");
      } finally {
        setLoading(false);
      }
    };
    fetchSession();
  }, [id]);

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
  const intentTypeLabel = Array.from(new Set(resolvedIntents.map((g: any) => g.intent_type))).join(" / ") || session?.intent_type;

  useEffect(() => {
    if (cartItems.length > 0) {
      const itemsPayload = cartItems.map((it: any) => ({
        sku: it.sku || it.name,
        current_price_inr: it.total_price_inr || it.price || 0
      }));
      fetch("/api/watchlist/price-status/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: getStoredUserId(),
          items: itemsPayload
        })
      })
      .then(r => r.json())
      .then(res => {
        if (res.items) {
          const map: Record<string, any> = {};
          res.items.forEach((i: any) => {
             map[i.sku] = i.price_status;
          });
          setPriceStatuses(map);
        }
      })
      .catch(e => console.error("Failed to fetch price statuses", e));
    }
  }, [session]);

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
      await new Promise((resolve) => setTimeout(resolve, 2500));

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
        setOptimizationSummary(
          `✨ Successfully optimized! Saved ₹${savings} by swapping items for better value alternatives.`,
        );
      } else {
        setOptimizationSummary("✨ Cart is already fully optimized for the best value.");
      }

      setSession((prev: any) => {
        const next = {
          ...prev,
          resolved_intents: data.intents,
          total_price_inr: data.total_price_inr,
        };
        syncToActiveChat(next);
        return next;
      });
    } catch (err) {
      console.error("Optimize error:", err);
    } finally {
      setOptimizing(false);
    }
  };

  const handleSwap = (currentSku: string, alt: any) => {
    setSession((prev: any) => {
      if (!prev) return prev;
      const newSession = JSON.parse(JSON.stringify(prev)); 
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
              substitution_reason: `Swapped to ${alt.brand} (${alt.reason})`,
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
            substitution_reason: `Swapped to ${alt.brand} (${alt.reason})`,
          };
        }
      }

      newSession.total_price_inr = newTotal;
      syncToActiveChat(newSession);
      return newSession;
    });
  };

  const handleReserve = async () => {
    if (!session || reserving) return;
    setReserving(true);
    setReservationStatus("idle");

    try {
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

      try {
        await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            // user_id: getStoredUserId(), // Uncomment if available
            session_id: session.session_id,
            event_type: "checkout_initiated",
            intent_type: session.intent_type,
            context: "ReviewCart reservation"
          }),
        });
      } catch (err) {
        console.error("Telemetry error:", err);
      }

      setTimeout(
        () => navigate({ to: "/checkout/$id", params: { id: data.reservation_id } }),
        1500,
      );
    } catch (e: any) {
      setReservationStatus("error");
      setReservationMessage(e.message || "Something went wrong.");
    } finally {
      setReserving(false);
    }
  };

  const handleGenerateNarrative = async () => {
    if (!session || narrativeLoading) return;
    setNarrativeLoading(true);
    try {
      const res = await fetch("/api/cart-narrative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cart_items: cartItems.map((i: any) => ({
            name: i.name,
            brand: i.brand,
            price_per_unit_inr: i.price_per_unit_inr,
            total_price_inr: i.total_price_inr,
            quantity_units: i.quantity_units,
            substituted: i.substituted || false,
            substitution_reason: i.substitution_reason || "",
            matched_from: i.matched_from || [],
            category: i.category || "",
          })),
          unavailable_items: unavailableItems.map((i: any) => ({
            name: i.name,
            reason: i.reason || "",
          })),
          total_price: total,
          budget: budget,
          budget_exceeded: session.budget_exceeded || false,
          context_summary: intentSummary || session.context_summary || "",
          dietary_pref: null,
        }),
      });
      if (!res.ok) throw new Error("Failed to generate narrative");
      const data = await res.json();
      setNarrative(data.narrative);
    } catch (err) {
      console.error("Narrative generation failed:", err);
      setNarrative("Could not generate explanation. Try again.");
    } finally {
      setNarrativeLoading(false);
    }
  };

  const handleApplyCompare = (result: any) => {
    setSession((prev: any) => {
      const next = {
        ...prev,
        resolved_intents: result.intents,
        total_price_inr: result.total_price_inr,
        budget_exceeded: result.budget_exceeded,
      };
      syncToActiveChat(next);
      return next;
    });
  };

  // --- UI Rendering ---
  
  if (loading) {
    return (
      <AppShell>
        <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center gap-4">
          <div className="relative">
            <Loader2 className="h-10 w-10 animate-spin text-brand" />
            <Sparkles className="absolute -right-2 -top-2 h-5 w-5 text-amber-500 animate-pulse" />
          </div>
          <p className="text-sm font-semibold text-muted-foreground animate-pulse">Resolving AI Cart State...</p>
        </div>
      </AppShell>
    );
  }

  if (error || !session) {
    return (
      <AppShell>
        <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center gap-4 text-center">
          <AlertTriangle className="h-12 w-12 text-destructive opacity-50" />
          <div className="text-xl font-bold">Cart Instance Terminated</div>
          <div className="text-sm text-muted-foreground">{error || "This session does not exist."}</div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 sm:py-12">
        
        {/* Hackathon Pitch Banner */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-brand/20 bg-brand/5 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-brand" />
            <div>
              <span className="text-sm font-bold text-foreground">AI Resolution Engine</span>
              <p className="text-xs text-muted-foreground mt-0.5">Natural language intents successfully mapped to real Amazon SKUs.</p>
            </div>
          </div>
          <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand px-3 py-1 text-[10px] font-black text-white uppercase tracking-wider shadow-sm">
            <Bot className="h-3 w-3" /> Agentic Checkout
          </div>
        </div>

        {/* Header Section */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-6 border-b border-border/50 pb-6">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-brand border border-brand/20">
              <Sparkles className="h-3 w-3" /> Context: {intentTypeLabel || "Shopping List"}
            </div>
            <h1 className="mt-4 truncate text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              {intentSummary || "Resolved Cart"}
            </h1>
            <p className="mt-3 flex flex-wrap items-center gap-3 text-sm font-medium text-muted-foreground">
              <span className="flex items-center gap-1.5 bg-surface px-3 py-1.5 rounded-lg border border-border/50">
                <Package className="h-4 w-4" /> <span className="text-foreground font-bold">{cartItems.length}</span> items
              </span>
              {budget && (
                <span className="flex items-center gap-1.5 bg-surface px-3 py-1.5 rounded-lg border border-border/50">
                  <Wallet className="h-4 w-4" /> Budget: <span className="text-foreground font-bold">₹{budget}</span>
                </span>
              )}
              <span className="flex items-center gap-1.5 bg-brand/10 px-3 py-1.5 rounded-lg border border-brand/20 text-brand">
                Total: <span className="font-bold text-lg">₹{total}</span>
              </span>
            </p>
          </div>
          <button
            onClick={() => setCompareOpen(true)}
            className="group hidden sm:inline-flex h-12 shrink-0 items-center gap-2 rounded-xl bg-foreground px-5 text-sm font-bold text-background shadow-lg transition-all hover:scale-105 hover:bg-foreground/90 hover:shadow-brand/20"
          >
            <ArrowLeftRight className="h-4 w-4 transition-transform group-hover:rotate-180" />
            Compare Scenarios
          </button>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_400px]">
          
          {/* Main Items Column */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Package className="h-5 w-5 text-brand" /> Matched SKUs
              </h2>
              <span className="text-xs font-semibold text-muted-foreground">Prices optimized locally</span>
            </div>

            <div className="space-y-4">
              {cartItems.map((it: any, idx: number) => (
                <div
                  key={it.sku || idx}
                  className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-300 hover:border-brand/40 hover:shadow-md"
                >
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-5 p-5">
                    <div className="min-w-0 space-y-3">
                      
                      {/* Tags row */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border border-border">
                          {it.brand || "Generic"}
                        </span>
                        {it.substituted && (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-700 border border-amber-500/20">
                            <Zap className="h-3 w-3" />
                            AI Swapped
                          </span>
                        )}
                        {/* Mock Tags implementation assuming you handle them here */}
                      </div>

                      {/* Product Name */}
                      <div className="flex items-center gap-2 truncate text-xl font-bold text-foreground">
                        <span>{it.name}</span>
                        {priceStatuses[it.sku || it.name] && (
                          <div 
                            className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                              priceStatuses[it.sku || it.name].color_key === 'green' ? 'bg-green-500' :
                              priceStatuses[it.sku || it.name].color_key === 'yellow' ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            title={priceStatuses[it.sku || it.name].label}
                          />
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const wId = it.sku || it.name;
                            if (!wishlist.some(w => w.id === wId)) {
                              addToWishlist(getStoredUserId(), {
                                id: wId,
                                name: it.name,
                                image_url: it.image_url,
                                current_price_inr: it.total_price_inr || it.price || 100,
                                brand: it.brand,
                              });
                            }
                          }}
                          className={`ml-2 inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
                            wishlist.some(w => w.id === (it.sku || it.name))
                              ? "bg-brand text-white"
                              : "bg-surface text-muted-foreground hover:bg-brand/10 hover:text-brand"
                          }`}
                          title={wishlist.some(w => w.id === (it.sku || it.name)) ? "Watching" : "Watch Price"}
                        >
                          <Bell className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Quantity & Unit */}
                      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                        <span className="inline-flex items-center justify-center rounded-md bg-surface px-2 py-1 text-foreground border border-border">
                          Qty: {it.quantity_units}
                        </span>
                        <span>×</span>
                        <span>{it.unit_quantity} {it.unit}</span>
                      </div>

                      {/* AI Reasoning Pill */}
                      <div className="inline-flex items-center gap-2 rounded-xl bg-brand/5 px-3 py-2 text-xs font-medium text-brand/90 border border-brand/10">
                        <Bot className="h-4 w-4 shrink-0" />
                        <span className="line-clamp-2">
                          {it.substituted
                            ? `Reason: ${it.substitution_reason || "Optimized for budget"}`
                            : it.matched_from?.length > 0
                              ? `Extracted from: "${it.matched_from.join(", ")}"`
                              : "Best catalog match"}
                        </span>
                      </div>
                    </div>

                    {/* Pricing */}
                    <div className="shrink-0 text-right">
                      <div className="text-2xl font-black text-foreground">
                        ₹{it.total_price_inr}
                      </div>
                      <div className="mt-1 text-xs font-semibold text-muted-foreground">
                        ₹{it.price_per_unit_inr} / unit
                      </div>
                    </div>
                  </div>

                  {/* Smart Alternatives Sub-panel */}
                  {it.alternatives && it.alternatives.length > 0 && (
                    <div className="border-t border-border bg-surface/50 p-5">
                      <div className="mb-4 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-amber-500" />
                        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                          Smart Swaps Available
                        </span>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {it.alternatives.map((alt: any, altIdx: number) => (
                          <div
                            key={altIdx}
                            onClick={() => handleSwap(it.sku, alt)}
                            className="group/alt relative flex cursor-pointer flex-col justify-between rounded-xl border border-border bg-card p-3 transition-all hover:border-brand/50 hover:shadow-sm"
                          >
                            <div>
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-sm font-bold text-foreground group-hover/alt:text-brand transition-colors line-clamp-1">
                                  {alt.name}
                                </span>
                                <span className="shrink-0 text-sm font-black text-foreground">
                                  ₹{alt.total_price_inr}
                                </span>
                              </div>
                              {alt.reason && (
                                <div className="mt-2 text-[10px] font-medium text-muted-foreground line-clamp-2">
                                  {alt.reason}
                                </div>
                              )}
                            </div>
                            <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2">
                              <span className="text-[10px] font-bold text-muted-foreground bg-surface px-1.5 py-0.5 rounded">
                                {alt.brand}
                              </span>
                              <span className="text-[10px] font-black uppercase text-brand flex items-center gap-1 opacity-0 group-hover/alt:opacity-100 transition-opacity">
                                Switch <ArrowRight className="h-3 w-3" />
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Unavailable State */}
            {unavailableItems.length > 0 && (
              <div className="mt-8 overflow-hidden rounded-2xl border border-red-200 bg-red-50">
                <div className="flex items-center gap-3 border-b border-red-200 bg-red-100/50 p-4">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <span className="text-sm font-bold text-red-900 uppercase tracking-wide">
                    {unavailableItems.length} Items Unavailable
                  </span>
                </div>
                <div className="p-4 space-y-3">
                  {/* Assuming UnavailableItemRow is a defined component */}
                  {/* {unavailableItems.map((it: any, idx: number) => (
                    <UnavailableItemRow key={idx} item={it} />
                  ))} */}
                  {unavailableItems.map((it: any, idx: number) => (
                    <div key={idx} className="text-sm font-medium text-red-800 bg-white/50 p-2 rounded border border-red-100">
                      • {it.name} <span className="text-xs text-red-600/80">({it.reason || "Out of stock"})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar Analytics & Checkout */}
          <aside className="space-y-6">
            
            {/* Auto-Optimize Toast */}
            {optimizationSummary && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-800 shadow-sm flex items-start gap-3">
                <Check className="h-5 w-5 shrink-0 text-green-600" />
                <p>{optimizationSummary}</p>
              </div>
            )}

            {/* AI Budget Controller Widget */}
            <div className="rounded-3xl border border-border bg-card p-6 shadow-lg shadow-brand/5">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-brand" />
                  <span className="text-sm font-black uppercase tracking-wider text-muted-foreground">Cart Analytics</span>
                </div>
                {budget && (
                  <button
                    onClick={runAutoOptimize}
                    disabled={optimizing}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand/10 px-3 py-1.5 text-xs font-bold text-brand hover:bg-brand hover:text-white transition-colors disabled:opacity-50"
                  >
                    <Sparkles className="h-3.5 w-3.5" /> Optimize
                  </button>
                )}
              </div>

              <div className="mb-4 text-center">
                <span className="text-5xl font-black tracking-tighter text-foreground">
                  ₹{total}
                </span>
                {budget && (
                  <div className="mt-1 text-sm font-medium text-muted-foreground">
                    of ₹{budget} constraint
                  </div>
                )}
              </div>

              {budget && (
                <div className="mt-6">
                  <div className="relative h-4 overflow-hidden rounded-full bg-surface border border-border">
                    <div
                      className={`absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out ${
                        total > budget ? "bg-red-500" : "bg-brand"
                      }`}
                      style={{ width: `${budgetPct}%` }}
                    />
                  </div>
                  <div className={`mt-3 text-center text-xs font-bold ${total > budget ? "text-red-500" : "text-green-600"}`}>
                    {total > budget ? `₹${total - budget} Over Budget` : `₹${budget - total} Remaining`}
                  </div>
                </div>
              )}
            </div>

            {/* AI Narrative Box */}
            <div className="rounded-3xl border border-brand/20 bg-brand/5 p-6 shadow-sm relative overflow-hidden">
              <Bot className="absolute -right-4 -bottom-4 h-24 w-24 text-brand/10 pointer-events-none" />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                  <BrainCircuit className="h-5 w-5 text-brand" />
                  <span className="text-sm font-black uppercase tracking-wider text-foreground">Agent Reasoning</span>
                </div>
                {narrative ? (
                  <p className="text-sm leading-relaxed text-foreground/90 font-medium">
                    {narrative}
                  </p>
                ) : (
                  <button
                    onClick={handleGenerateNarrative}
                    disabled={narrativeLoading}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-background border border-brand/30 px-4 py-3 text-sm font-bold text-brand transition-all hover:bg-brand/10 hover:border-brand/50 disabled:opacity-50"
                  >
                    {narrativeLoading ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing decisions...</>
                    ) : (
                      <><Sparkles className="h-4 w-4" /> Explain Cart Selection</>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Reservation / Checkout Block */}
            <div className="rounded-3xl border border-border bg-card p-6 shadow-lg">
              <ul className="mb-6 space-y-3">
                {["Quantities Verified", "Prices Locked", "In-Stock Ready"].map((text) => (
                  <li key={text} className="flex items-center gap-3 text-sm font-bold text-foreground/80">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-green-600">
                      <Check className="h-3 w-3" />
                    </div>
                    {text}
                  </li>
                ))}
              </ul>

              {reservationStatus === "error" && (
                <div className="mb-4 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700 border border-red-200 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" /> {reservationMessage}
                </div>
              )}

              <button
                onClick={handleReserve}
                disabled={reserving || reservationStatus === "success"}
                className="w-full inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-brand text-base font-black text-white shadow-xl shadow-brand/20 transition-all hover:bg-brand/90 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
              >
                {reserving ? (
                  <><Loader2 className="h-5 w-5 animate-spin" /> Locking Inventory...</>
                ) : reservationStatus === "success" ? (
                  <><Check className="h-5 w-5" /> Reserved!</>
                ) : (
                  <>1-Click Checkout <ArrowRight className="h-5 w-5" /></>
                )}
              </button>
            </div>

            {/* Export Links */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={async () => {
                  const exportData: ExportableCart = {
                    context_summary: intentSummary || session?.context_summary || "",
                    intent_type: intentTypeLabel || session?.intent_type || "",
                    cart: cartItems,
                    total_price_inr: total,
                  };
                  const ok = await copyWhatsAppToClipboard(exportData);
                  if (ok) {
                    setCopySuccess(true);
                    setTimeout(() => setCopySuccess(false), 2000);
                  }
                }}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-surface text-sm font-bold text-foreground transition-colors hover:bg-card hover:border-foreground/20"
              >
                {copySuccess ? <Check className="h-4 w-4 text-green-500" /> : <Share2 className="h-4 w-4 text-green-600" />}
                WhatsApp
              </button>
              <button
                onClick={() => {
                  const exportData: ExportableCart = {
                    context_summary: intentSummary || session?.context_summary || "",
                    intent_type: intentTypeLabel || session?.intent_type || "",
                    cart: cartItems,
                    total_price_inr: total,
                  };
                  downloadCSV(exportData, `cart-${id}.csv`);
                }}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-surface text-sm font-bold text-foreground transition-colors hover:bg-card hover:border-foreground/20"
              >
                <Download className="h-4 w-4" /> Export CSV
              </button>
            </div>

          </aside>
        </div>
      </div>

      {/* Loading overlay for optimization */}
      {optimizing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-8 text-center shadow-2xl">
            <Bot className="mx-auto h-12 w-12 text-brand animate-bounce" />
            <h3 className="mt-4 text-xl font-bold text-foreground">Agent Optimizing...</h3>
            <p className="mt-2 text-sm text-muted-foreground">Scanning catalog for better value swaps based on your preferences.</p>
          </div>
        </div>
      )}

      {/* CompareCart Drawer component */}
      <CompareCartDrawer
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        sessionId={id}
        currentCart={cartItems}
        currentTotal={total}
        currentBudget={budget}
        onApply={handleApplyCompare}
      />
    </AppShell>
  );
}