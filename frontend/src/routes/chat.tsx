import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  ArrowRight,
  Check,
  FileText,
  Image as ImageIcon,
  IndianRupee,
  Info,
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
  ChevronDown,
  ChevronUp,
  RefreshCw,
  TrendingDown,
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
import { SemanticSearchSkeleton } from "@/components/common/SemanticSearchSkeleton";
import { useChatStore } from "@/store/useChatStore";
import { useWishlistStore, type PriceStatus } from "@/store/useWishlistStore";
import { Bell } from "lucide-react";

import { SmartRepeatBanner } from "@/components/common/SmartRepeatBanner";
import { detectOccasion, type OccasionSuggestion } from "@/lib/occasion-detector";

export const Route = createFileRoute("/chat")({
  validateSearch: (search: Record<string, unknown>): { prompt?: string; occasion?: string } => ({
    prompt: typeof search.prompt === "string" ? search.prompt : undefined,
    occasion: typeof search.occasion === "string" ? search.occasion : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Chat — NeedSpeak" },
      {
        name: "description",
        content:
          "Describe what you're planning. NeedSpeak extracts intent and builds a cart in real time.",
      },
      { property: "og:title", content: "Chat — NeedSpeak" },
      {
        property: "og:description",
        content: "Context-to-Cart workspace with live intent extraction.",
      },
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

function appendPreferenceFormData(formData: FormData, prefs: ReturnType<typeof loadPreferences>, userId: string) {
  if (prefs.dietary !== "any") formData.append("dietary_pref", prefs.dietary);
  if (prefs.preferredBrands.length) formData.append("preferred_brands", JSON.stringify(prefs.preferredBrands));
  if (prefs.avoidedBrands.length) formData.append("avoided_brands", JSON.stringify(prefs.avoidedBrands));
  if (prefs.budgetStyle !== "balanced") formData.append("budget_mode", prefs.budgetStyle);
  if (prefs.preferredCategories.length) formData.append("preferred_categories", JSON.stringify(prefs.preferredCategories));
  if (prefs.avoidedCategories.length) formData.append("avoided_categories", JSON.stringify(prefs.avoidedCategories));
  if (prefs.qualityPreference !== "balanced") formData.append("quality_preference", prefs.qualityPreference);
  if (prefs.packSizePreference !== "balanced") formData.append("pack_size_preference", prefs.packSizePreference);
  formData.append("user_id", userId);
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

// Helper functions for fake badges (Demo mode)
function getFakeHealthBadge(item: any): string | null {
  if (item.health_badge) return item.health_badge;

  const name = (item.name || "").toLowerCase();
  const sku = (item.sku || "").toUpperCase();
  const brand = (item.brand || "").toLowerCase();
  const category = (item.category || "").toLowerCase();

  // Non-food items — no health badge, get product badge instead
  const nonFoodCategories = [
    "cleaning", "hygiene", "personal_care", "stationery", "party_supplies",
    "fashion_men", "fashion_women", "fashion_kids", "accessories", "footwear",
    "pet", "medicines_otc"
  ];
  if (nonFoodCategories.some(c => category === c)) return null;

  const nonFoodKeywords = [
    "plate", "napkin", "tablecloth", "foil", "tissue", "soap", "shampoo",
    "detergent", "cleaner", "brush", "sponge", "voucher", "ticket", "battery",
    "bulb", "diaper", "wipes", "medicine", "tablet", "syrup", "paracetamol",
    "mask", "sanitizer", "lotion", "cream", "toothpaste", "dog food", "puppy food", "pet food",
    "drools", "t-shirt", "jeans", "kurta", "slipper", "sandal",
    "pen", "notebook", "eraser", "pencil", "balloon", "candle"
  ];
  if (nonFoodKeywords.some(kw => name.includes(kw))) return null;

  // Excellent Choice — whole grains, vegetables, fruits, lentils, water
  const excellentKeywords = [
    "garlic", "ginger", "tomato", "onion", "potato", "spinach", "vegetable", "veg",
    "fruit", "apple", "banana", "orange", "lemon", "mint", "coriander", "cilantro",
    "water", "bisleri", "aquafina", "green tea", "oats", "dal", "lentil", "pulse",
    "chana", "rajma", "moong", "rice", "wheat", "atta", "broccoli", "carrot",
    "cucumber", "avocado", "salad", "poha", "sprout", "millet", "ragi",
    "quinoa", "flax", "chia", "mushroom", "beetroot", "pumpkin", "palak",
    "methi", "toor", "masoor", "urad"
  ];
  if (excellentKeywords.some(kw => name.includes(kw))) return "excellent";

  // Less Healthy (poor) — sodas, chips, candy, instant noodles
  const poorKeywords = [
    "coke", "coca-cola", "pepsi", "soda", "cold drink", "soft drink", "fanta", "sprite",
    "thums up", "mountain dew", "red bull", "energy drink",
    "chips", "crisps", "kurkure", "lays", "lay's", "bingo", "doritos", "uncle chips",
    "chocolate", "cadbury", "dairy milk", "snickers", "kitkat", "5star",
    "ice cream", "cookie", "biscuit", "oreo", "bourbon",
    "pastry", "cake", "maggi", "noodle", "ramen", "cup noodle",
    "chocos", "froot loops", "sweet", "candy", "lollipop", "toffee",
    "frooti", "maaza", "slice"
  ];
  if (poorKeywords.some(kw => name.includes(kw))) return "poor";

  // Moderate — processed foods, sauces, refined items
  const moderateKeywords = [
    "cheese", "butter", "mayo", "mayonnaise", "sauce", "ketchup", "jam", "spread",
    "pizza", "burger", "pasta", "white bread", "refined", "fry", "fried",
    "bhujia", "namkeen", "mixture", "haldiram", "farsan",
    "peanut butter", "nutella", "bread", "pav", "bun",
    "pickle", "papad", "instant", "ready to eat"
  ];
  if (moderateKeywords.some(kw => name.includes(kw))) return "moderate";

  // Good Choice — dairy, protein, natural items
  const goodKeywords = [
    "egg", "chicken", "fish", "mutton", "prawn", "paneer", "yogurt", "curd", "dahi",
    "tofu", "soya", "brown bread", "whole wheat", "multigrain",
    "juice", "nut", "almond", "cashew", "walnut", "peanut",
    "honey", "jaggery", "ghee", "milk", "lassi", "buttermilk",
    "muesli", "granola", "cornflakes", "idli", "dosa",
    "coconut", "olive oil", "mustard oil", "tea", "coffee"
  ];
  if (goodKeywords.some(kw => name.includes(kw))) return "good";

  // Fallback by category
  if (category.includes("snack")) return "moderate";
  if (category.includes("beverage")) return "moderate";
  if (category.includes("bakery")) return "moderate";
  if (category.includes("frozen")) return "moderate";
  if (category.includes("dairy")) return "good";
  if (category.includes("grain")) return "excellent";
  if (category.includes("spice")) return "excellent";
  if (category.includes("oil")) return "good";
  if (category.includes("vegetable") || category.includes("fruit")) return "excellent";
  if (category.includes("breakfast")) return "good";
  if (category.includes("instant")) return "moderate";
  if (category.includes("non_veg")) return "good";

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
  const brand = (item.brand || "").toLowerCase();
  const category = (item.category || "").toLowerCase();
  const rating = item.rating || 0;

  // ── Cleaning & Household ──
  if (category.includes("cleaning") || name.includes("cleaner") || name.includes("detergent") || name.includes("dishwash")) {
    if (name.includes("eco") || name.includes("green") || name.includes("natural") || name.includes("plant")) {
      return { label: "Eco-Friendly", color: "bg-green-500/15 text-green-700 border-green-500/30", icon: "🌱", type: "eco" };
    }
    if (name.includes("antibacterial") || name.includes("disinfectant") || name.includes("germ") || name.includes("99")) {
      return { label: "Germ Kill", color: "bg-blue-500/15 text-blue-700 border-blue-500/30", icon: "🛡", type: "safety" };
    }
    return { label: "Household", color: "bg-slate-500/15 text-slate-700 border-slate-500/30", icon: "🏠", type: "household" };
  }

  // ── Hygiene & Personal Care ──
  if (category.includes("hygiene") || category.includes("personal_care")) {
    if (name.includes("natural") || name.includes("herbal") || name.includes("ayurvedic") || name.includes("neem") ||
        brand.includes("himalaya") || brand.includes("patanjali")) {
      return { label: "Natural", color: "bg-green-500/15 text-green-700 border-green-500/30", icon: "🌿", type: "natural" };
    }
    if (name.includes("anti") || name.includes("clinical") || brand.includes("dettol") || brand.includes("lifebuoy")) {
      return { label: "Protection", color: "bg-blue-500/15 text-blue-700 border-blue-500/30", icon: "🛡", type: "safety" };
    }
    if (brand.includes("dove") || brand.includes("nivea") || name.includes("moistur")) {
      return { label: "Derma Care", color: "bg-purple-500/15 text-purple-700 border-purple-500/30", icon: "✨", type: "quality" };
    }
    return { label: "Daily Care", color: "bg-cyan-500/15 text-cyan-700 border-cyan-500/30", icon: "💧", type: "care" };
  }

  // ── Fashion ──
  if (category.includes("fashion") || category.includes("clothing")) {
    if (name.includes("cotton") || name.includes("organic") || name.includes("linen")) {
      return { label: "Pure Cotton", color: "bg-green-500/15 text-green-700 border-green-500/30", icon: "☁️", type: "comfort" };
    }
    if (name.includes("slim") || name.includes("fit") || name.includes("stretch")) {
      return { label: "Trendy Fit", color: "bg-pink-500/15 text-pink-700 border-pink-500/30", icon: "✂️", type: "style" };
    }
    if (brand.includes("levi") || brand.includes("nike") || brand.includes("adidas") || brand.includes("puma")) {
      return { label: "Premium Brand", color: "bg-indigo-500/15 text-indigo-700 border-indigo-500/30", icon: "👑", type: "premium" };
    }
    return { label: "Fashion", color: "bg-pink-500/15 text-pink-700 border-pink-500/30", icon: "👕", type: "fashion" };
  }

  // ── Footwear ──
  if (category.includes("footwear") || name.includes("shoe") || name.includes("slipper") || name.includes("sandal")) {
    if (name.includes("running") || name.includes("sports") || name.includes("gym")) {
      return { label: "Sports", color: "bg-orange-500/15 text-orange-700 border-orange-500/30", icon: "🏃", type: "sports" };
    }
    if (brand.includes("nike") || brand.includes("adidas") || brand.includes("asics") || brand.includes("puma")) {
      return { label: "Premium", color: "bg-indigo-500/15 text-indigo-700 border-indigo-500/30", icon: "👑", type: "premium" };
    }
    return { label: "Comfort Fit", color: "bg-blue-500/15 text-blue-700 border-blue-500/30", icon: "👟", type: "comfort" };
  }

  // ── Accessories ──
  if (category.includes("accessories") || category.includes("accessori")) {
    if (name.includes("watch") || name.includes("smart")) {
      return { label: "Smart Tech", color: "bg-violet-500/15 text-violet-700 border-violet-500/30", icon: "⌚", type: "tech" };
    }
    return { label: "Accessory", color: "bg-rose-500/15 text-rose-700 border-rose-500/30", icon: "💍", type: "accessory" };
  }

  // ── Baby ──
  if (category.includes("baby")) {
    if (name.includes("organic") || name.includes("natural")) {
      return { label: "Organic Baby", color: "bg-green-500/15 text-green-700 border-green-500/30", icon: "🌱", type: "organic" };
    }
    return { label: "Baby Safe", color: "bg-sky-500/15 text-sky-700 border-sky-500/30", icon: "👶", type: "baby" };
  }

  // ── Pet ──
  if (category.includes("pet") || name.includes("dog food") || name.includes("cat food") || name.includes("puppy food") || name.includes("drools") || name.includes("pedigree")) {
    return { label: "Vet Approved", color: "bg-teal-500/15 text-teal-700 border-teal-500/30", icon: "🐾", type: "pet" };
  }

  // ── Medicines ──
  if (category.includes("medicine") || name.includes("tablet") || name.includes("syrup") || name.includes("capsule")) {
    return { label: "Clinically Tested", color: "bg-red-500/15 text-red-700 border-red-500/30", icon: "💊", type: "medical" };
  }

  // ── Stationery ──
  if (category.includes("stationery") || name.includes("pen") || name.includes("notebook") || name.includes("pencil")) {
    return { label: "Study Essentials", color: "bg-indigo-500/15 text-indigo-700 border-indigo-500/30", icon: "📝", type: "study" };
  }

  // ── Party Supplies ──
  if (category.includes("party") || name.includes("balloon") || name.includes("decoration") || name.includes("candle")) {
    return { label: "Party Ready", color: "bg-fuchsia-500/15 text-fuchsia-700 border-fuchsia-500/30", icon: "🎉", type: "party" };
  }

  // ── Electronics / Headphones ──
  if (category.includes("headphone") || category.includes("smartphone") || category.includes("laptop")) {
    if (name.includes("pro") || name.includes("ultra") || name.includes("max") || name.includes("flagship")) {
      return { label: "Flagship", color: "bg-violet-500/15 text-violet-700 border-violet-500/30", icon: "🚀", type: "flagship" };
    }
    if (name.includes("budget") || name.includes("lite") || name.includes("slim")) {
      return { label: "Value Pick", color: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30", icon: "💎", type: "value" };
    }
    return { label: "Tech", color: "bg-blue-500/15 text-blue-700 border-blue-500/30", icon: "⚡", type: "tech" };
  }

  // ── Fallback: High rating badge ──
  if (rating >= 4.5) {
    return { label: "Top Rated", color: "bg-amber-500/15 text-amber-700 border-amber-500/30", icon: "⭐", type: "rating" };
  }

  // ── Eco-Friendly disposables ──
  if (name.includes("plate") || name.includes("cup") || name.includes("napkin") || name.includes("foil")) {
    return { label: "Eco-Friendly", color: "bg-green-500/15 text-green-700 border-green-500/30", icon: "🌱", type: "eco" };
  }

  return null;
}

// ─── Fake Price History for Demo ──────────────────────────────────────────────

function getFakePriceAdvice(item: any): { trend: "buy" | "wait" | "good"; label: string; detail: string; color: string } {
  const price = item.price_per_unit_inr || 0;
  const name = (item.name || "").toLowerCase();
  
  // Deterministic "random" based on SKU/name hash for consistent results
  const hash = (item.sku || item.name || "").split("").reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
  const variant = hash % 3;
  
  if (variant === 0) {
    const lowPrice = Math.round(price * 0.82);
    return {
      trend: "buy",
      label: "Buy Now",
      detail: `Lowest in 30 days! Was ₹${Math.round(price * 1.15)} last week. Current price is ${Math.round((1 - 0.82) * 100)}% below avg.`,
      color: "text-green-600"
    };
  }
  if (variant === 1) {
    return {
      trend: "good",
      label: "Fair Price",
      detail: `Price is stable. Avg ₹${Math.round(price * 1.03)} over last 90 days. No major sale expected soon.`,
      color: "text-blue-600"
    };
  }
  return {
    trend: "wait",
    label: "Wait if possible",
    detail: `Price rose 12% this week. Usually drops during month-end sales. Lowest was ₹${Math.round(price * 0.75)} last month.`,
    color: "text-amber-600"
  };
}

function PriceHistoryTooltip({ item }: { item: any }) {
  const [open, setOpen] = useState(false);
  const advice = getFakePriceAdvice(item);
  const trendIcon = advice.trend === "buy" ? "📉" : advice.trend === "wait" ? "📈" : "➡️";

  return (
    <div className="relative inline-flex">
      <button
        onClick={() => setOpen(!open)}
        className="flex h-5 w-5 items-center justify-center rounded-full bg-surface hover:bg-brand/10 text-muted-foreground hover:text-brand transition-colors"
        title="Price history & advice"
      >
        <Info className="h-3 w-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-7 z-50 w-56 rounded-xl border border-border bg-background p-3 shadow-lg shadow-black/10 animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-sm">{trendIcon}</span>
              <span className={`text-xs font-bold ${advice.color}`}>{advice.label}</span>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">{advice.detail}</p>
            <div className="mt-2 flex gap-1">
              {[65, 70, 82, 75, 90, 85, 100].map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                  <div
                    className={`w-full rounded-sm ${i === 6 ? "bg-brand" : "bg-muted-foreground/20"}`}
                    style={{ height: `${h * 0.2}px` }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[9px] text-muted-foreground">
              <span>30d ago</span>
              <span>Now</span>
            </div>
          </div>
        </>
      )}
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
  onSwap,
  preferredBrands,
  priceStatus,
}: {
  item: any;
  qty: number;
  onDecrement: () => void;
  onIncrement: () => void;
  onRemove: () => void;
  onSwap?: (altSku: string) => void;
  preferredBrands?: string[];
  priceStatus?: PriceStatus;
}) {
  const effectiveTotal = (item.price_per_unit_inr * qty).toFixed(0);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const alternatives = item.alternatives || [];

  // Check if this item's brand matches a user preference
  const isPreferred = preferredBrands?.some(
    (pb) =>
      item.brand?.toLowerCase().includes(pb.toLowerCase()) ||
      pb.toLowerCase().includes(item.brand?.toLowerCase() || ""),
  );

  // Get health badge display info
  const getHealthBadgeInfo = (badge: string) => {
    const badgeMap: Record<string, { label: string; color: string; icon: string }> = {
      excellent: {
        label: "Excellent Choice",
        color: "bg-green-500/15 text-green-700 border-green-500/30",
        icon: "✓",
      },
      good: {
        label: "Good Choice",
        color: "bg-blue-500/15 text-blue-700 border-blue-500/30",
        icon: "✓",
      },
      moderate: {
        label: "Moderate",
        color: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30",
        icon: "⚠",
      },
      poor: {
        label: "Less Healthy",
        color: "bg-orange-500/15 text-orange-700 border-orange-500/30",
        icon: "!",
      },
    };
    return badgeMap[badge] || null;
  };

  const effHealthBadge = getFakeHealthBadge(item);
  const healthInfo = effHealthBadge ? getHealthBadgeInfo(effHealthBadge) : null;
  const productBadge = getFakeProductBadge(item);
  const priceAdvice = getFakePriceAdvice(item);

  const { addToWishlist, wishlist } = useWishlistStore();
  const wId = item.sku || item.name;
  const inWishlist = wishlist.some((w) => w.id === wId);

  return (
    <div className={`rounded-xl border shadow-sm transition-all hover:shadow-md hover:bg-background ${
      effHealthBadge === "excellent" ? "border-green-200/60 bg-green-50/30" :
      effHealthBadge === "poor" ? "border-orange-200/60 bg-orange-50/20" :
      "border-border/50 bg-background/80"
    } hover:border-brand/20`}>
      <div className="group p-3.5">
        {/* Top row: Name + Price */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="truncate text-sm font-semibold capitalize leading-tight text-foreground">
                {item.name}
              </h4>
              {priceStatus && (
                <div 
                  className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                    priceStatus.color_key === 'green' ? 'bg-green-500' :
                    priceStatus.color_key === 'yellow' ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  title={priceStatus.label}
                />
              )}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!inWishlist) {
                      addToWishlist(getStoredUserId(), {
                        id: wId,
                        name: item.name,
                        image_url: item.image_url,
                        current_price_inr: item.price_per_unit_inr || item.total_price_inr || item.price || 100,
                        brand: item.brand,
                      });
                    }
                  }}
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full transition-colors ${
                    inWishlist
                      ? "bg-brand text-white"
                      : "bg-surface text-muted-foreground hover:bg-brand/10 hover:text-brand"
                  }`}
                  title={inWishlist ? "Watching" : "Watch Price"}
                >
                  <Bell className="h-3 w-3" />
                </button>
                <button
                  onClick={onRemove}
                  aria-label="Remove item"
                  className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground/50 opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              <span className="font-medium capitalize text-foreground/70">{item.brand}</span>
              <span className="text-border">•</span>
              <span>{item.unit_quantity}{item.unit}</span>
              {isPreferred && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-brand/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand">
                  ♥ Fav
                </span>
              )}
              {/* Social proof: X friends bought */}
              {(() => {
                const hash = (item.sku || item.name || "").split("").reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
                const friendCount = (hash % 5) + 2; // 2-6 friends
                if (friendCount >= 3) {
                  return (
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">
                      👥 {friendCount} friends bought last month
                    </span>
                  );
                }
                return null;
              })()}
            </div>
          </div>
          <div className="flex flex-col items-end shrink-0">
            <div className="flex items-center gap-1">
              <span className="text-base font-bold tabular-nums text-foreground">₹{effectiveTotal}</span>
              <PriceHistoryTooltip item={item} />
            </div>
            <span className="text-[10px] text-muted-foreground tabular-nums">₹{item.price_per_unit_inr} × {qty}</span>
            {/* Price trend micro-indicator */}
            <span className={`mt-0.5 text-[9px] font-semibold ${priceAdvice.color}`}>
              {priceAdvice.trend === "buy" ? "📉 Best price" : priceAdvice.trend === "wait" ? "📈 Wait" : "→ Stable"}
            </span>
          </div>
        </div>

        {/* Middle row: Badges — more expressive with larger size and icons */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {healthInfo && (
            <span
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold shadow-sm ${healthInfo.color}`}
              title={`Health Score: ${item.health_score || getFakeHealthScore(effHealthBadge) || 'N/A'}/100`}
            >
              <span className="text-sm">{effHealthBadge === "excellent" ? "🥗" : effHealthBadge === "good" ? "👍" : effHealthBadge === "moderate" ? "⚠️" : "🚫"}</span>
              {healthInfo.label}
            </span>
          )}
          {!healthInfo && productBadge && (
            <span
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold shadow-sm ${productBadge.color}`}
            >
              <span className="text-sm">{productBadge.icon}</span> {productBadge.label}
            </span>
          )}
          {typeof item.likely_rating === "number" && item.likely_rating > 0 && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-brand/10 border border-brand/20 px-2.5 py-1 text-[11px] font-semibold text-brand shadow-sm">
              <Sparkles className="h-3 w-3" /> {Math.round(item.likely_rating)}% match
            </span>
          )}
          {getItemBadge(item.sku) && (
            <span className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold shadow-sm ${getItemBadge(item.sku)!.color}`}>
              {getItemBadge(item.sku)!.label}
            </span>
          )}
        </div>

        {/* Bottom row: Quantity control + match info */}
        <div className="mt-3 flex items-center justify-between gap-2">
          <QuantityControl value={qty} onDecrement={onDecrement} onIncrement={onIncrement} />
          <div className="inline-flex items-center gap-1.5 rounded-lg bg-surface px-2.5 py-1 text-[10px] text-muted-foreground border border-border/30">
            <Check className="h-3 w-3 text-success" />
            <span className="truncate max-w-[140px]">
              {item.substituted
                ? item.substitution_reason || "Substituted"
                : item.matched_from?.length > 0
                  ? item.matched_from[0]
                  : "Matched"}
            </span>
          </div>
        </div>
      </div>

      {/* Alternatives toggle button */}
      {alternatives.length > 0 && (
        <>
          <button
            onClick={() => setShowAlternatives(!showAlternatives)}
            className="flex w-full items-center justify-center gap-1.5 border-t border-border/30 py-2 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-surface/50 hover:text-foreground"
          >
            <RefreshCw className="h-3 w-3" />
            {showAlternatives ? "Hide" : "Show"} {alternatives.length} alternative
            {alternatives.length !== 1 ? "s" : ""}
            {showAlternatives ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>

          {/* Alternatives list */}
          {showAlternatives && (
            <div className="border-t border-border/30 bg-surface/20 p-2.5 space-y-2">
              {alternatives.slice(0, 4).map((alt: any) => {
                const savings = item.total_price_inr - alt.total_price_inr;
                const savingsPercent = ((savings / item.total_price_inr) * 100).toFixed(0);
                
                // Healthier alternative detection: if an alternative is diet/zero/sugar-free
                // show it as a green "Healthier" badge regardless of base health badge
                const altName = (alt.name || "").toLowerCase();
                const isHealthierOption = altName.includes("diet") || altName.includes("zero") || 
                  altName.includes("sugar free") || altName.includes("sugar-free") ||
                  altName.includes("light") || altName.includes("lite") ||
                  altName.includes("green tea") || altName.includes("oats") ||
                  altName.includes("whole wheat") || altName.includes("multigrain");
                
                const effAltHealthBadge = isHealthierOption ? "excellent" : getFakeHealthBadge(alt);
                const altHealthInfo = effAltHealthBadge ? getHealthBadgeInfo(effAltHealthBadge) : null;
                const altProductBadge = getFakeProductBadge(alt);

                return (
                  <div
                    key={alt.sku}
                    className="group/alt flex items-center justify-between gap-2 rounded-lg border border-border/40 bg-background/80 p-2.5 transition-all hover:border-brand/30 hover:shadow-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-xs font-medium capitalize">{alt.name}</span>
                        {savings > 0 && (
                          <span className="shrink-0 inline-flex items-center gap-0.5 rounded-full bg-success/15 px-1.5 py-0.5 text-[9px] font-bold text-success">
                            <TrendingDown className="h-2.5 w-2.5" /> {savingsPercent}%
                          </span>
                        )}
                        {isHealthierOption && (
                          <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded-full font-semibold border bg-green-500/15 text-green-700 border-green-500/30">
                            🌿 Healthier
                          </span>
                        )}
                        {!isHealthierOption && altHealthInfo && (
                          <span className={`shrink-0 text-[8px] px-1 py-0.5 rounded-full font-medium border ${altHealthInfo.color}`}>
                            {altHealthInfo.icon}
                          </span>
                        )}
                        {!altHealthInfo && altProductBadge && (
                          <span className={`shrink-0 text-[8px] px-1 py-0.5 rounded-full font-medium border ${altProductBadge.color}`}>
                            {altProductBadge.icon}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <span className="capitalize">{alt.brand}</span>
                        <span className="text-border">•</span>
                        <span>{alt.unit_quantity}{alt.unit}</span>
                        {typeof alt.likely_rating === "number" && alt.likely_rating > 0 && (
                          <span className="text-brand">{Math.round(alt.likely_rating)}% fit</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="text-right">
                        <div className="text-xs font-bold tabular-nums">₹{alt.total_price_inr}</div>
                        <div className="text-[9px] text-muted-foreground tabular-nums">₹{alt.price_per_unit}/ea</div>
                      </div>
                      {onSwap && (
                        <button
                          onClick={() => onSwap(alt.sku)}
                          className="flex h-7 items-center gap-1 rounded-lg bg-brand/10 px-2.5 text-[10px] font-semibold text-brand opacity-0 transition-all hover:bg-brand hover:text-white group-hover/alt:opacity-100"
                        >
                          <RefreshCw className="h-2.5 w-2.5" />
                          Swap
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── UnavailableItemRow ───────────────────────────────────────────────────────

function UnavailableItemRow({ item }: { item: any }) {
  const reasonText = item.reason ? item.reason.replace(/_/g, " ") : "Unavailable";

  const isOutOfStock = item.reason === "out_of_stock";
  const badgeBg = isOutOfStock
    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
    : "bg-destructive/10 text-destructive border-destructive/20";
  const iconColor = isOutOfStock
    ? "bg-amber-500/10 text-amber-500"
    : "bg-destructive/10 text-destructive";

  return (
    <div className="group rounded-xl border border-border/60 bg-background/50 p-3 shadow-sm transition-all hover:shadow-md hover:border-destructive/30 hover:bg-background">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${iconColor}`}
          >
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium capitalize text-foreground/90">
              {item.name}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">Not added to cart</div>
          </div>
        </div>
        <div className="shrink-0">
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize tracking-wide ${badgeBg}`}
          >
            {reasonText}
          </span>
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
  onReorder,
}: {
  open: boolean;
  onClose: () => void;
  onRestore: (entry: CartHistoryEntry) => void;
  onReorder: (entry: CartHistoryEntry) => void;
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
              <div key={entry.session_id} className="px-4 py-3 transition-colors hover:bg-surface">
                <div className="flex items-center justify-between">
                  <span className="truncate text-sm font-medium">
                    {entry.context_summary || entry.intent_type}
                  </span>
                  <span className="ml-2 shrink-0 text-xs font-semibold text-brand">
                    ₹{entry.total_price_inr}
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {entry.item_count} items ·{" "}
                  {new Date(entry.saved_at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })}
                </div>
                {entry.budget_inr && (
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    Budget ₹{entry.budget_inr}
                  </div>
                )}
                {/* Action buttons */}
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={() => {
                      onRestore(entry);
                      onClose();
                    }}
                    className="inline-flex h-7 items-center gap-1 rounded-md bg-surface px-2.5 text-[10px] font-semibold text-foreground transition-colors hover:bg-brand/10 hover:text-brand"
                  >
                    <Plus className="h-3 w-3" />
                    Load in Chat
                  </button>
                  <button
                    onClick={() => {
                      onReorder(entry);
                      onClose();
                    }}
                    className="inline-flex h-7 items-center gap-1 rounded-md bg-brand/10 px-2.5 text-[10px] font-semibold text-brand transition-colors hover:bg-brand hover:text-white"
                  >
                    <ShoppingCart className="h-3 w-3" />
                    Reorder
                  </button>
                </div>
              </div>
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
  const navigate = useNavigate();
  const {
    phase,
    setPhase,
    text,
    setText,
    messages,
    setMessages,
    cartData,
    setCartData,
    errorMsg,
    setErrorMsg,
    budgetInput,
    setBudgetInput,
    quantities,
    setQuantities,
    removedKeys,
    setRemovedKeys,
    intentGroups,
    setIntentGroups,
    clearStore,
  } = useChatStore();

  // Pre-fill from occasion tile navigation
  useEffect(() => {
    if (prefillPrompt) {
      setText(prefillPrompt);
    }
  }, [prefillPrompt]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [inputType, setInputType] = useState<"text" | "whatsapp">("text");
  const [occasionSuggestion, setOccasionSuggestion] = useState<OccasionSuggestion | null>(null);
  const [occasionDismissed, setOccasionDismissed] = useState(false);

  // Load user preferred brands for display in cart items
  const [userPreferredBrands] = useState<string[]>(() => loadPreferences().preferredBrands);

  const [priceStatuses, setPriceStatuses] = useState<Record<string, PriceStatus>>({});

  useEffect(() => {
    if (cartData?.cart) {
      const items = cartData.cart.map((it: any) => ({
        sku: it.sku || it.name,
        current_price_inr: it.price_per_unit_inr || it.total_price_inr || it.price || 0,
      }));

      const extraItems = intentGroups.flatMap((g: any) =>
        (g.cart || []).map((it: any) => ({
          sku: it.sku || it.name,
          current_price_inr: it.price_per_unit_inr || it.total_price_inr || it.price || 0,
        }))
      );
      
      const allItems = [...items, ...extraItems];

      fetch("/api/watchlist/price-status/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: getStoredUserId(),
          items: allItems,
        }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.items) {
            const map: Record<string, PriceStatus> = {};
            data.items.forEach((it: any) => {
              if (it.price_status) {
                map[it.sku] = it.price_status;
              }
            });
            setPriceStatuses(map);
          }
        })
        .catch(console.error);
    }
  }, [cartData, intentGroups]);

  // Track pending clarification context so follow-up answers include original request
  const pendingClarificationRef = useRef<string | null>(null);

  // Voice input via MediaRecorder + backend transcription
  const voice = useVoiceInput({
    onResult: (transcript) => {
      setText((prev) => (prev ? prev + " " + transcript : transcript));
    },
  });

  // Proactive occasion detection — scan text as user types
  useEffect(() => {
    if (occasionDismissed || phase === "thinking") {
      setOccasionSuggestion(null);
      return;
    }
    const detected = detectOccasion(text);
    setOccasionSuggestion(detected);
  }, [text, occasionDismissed, phase]);

  // Reset occasion dismiss when text is fully cleared (new conversation)
  useEffect(() => {
    if (!text.trim()) {
      setOccasionDismissed(false);
    }
  }, [text]);

  // Auto-restore latest session if currently empty
  useEffect(() => {
    if (phase === "idle" && messages.length <= 1 && !cartData) {
      const history = loadHistory();
      if (history.length > 0) {
        const latest = history[0];
        setPhase("cart");
        setCartData(latest);
        setMessages([
          {
            role: "assistant",
            text: `Restored your last session: ${latest.intent_type || "Cart"} with ${latest.item_count} items.`,
          },
        ]);
      }
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, phase]);

  // When cartData changes, add new quantity overrides without resetting existing ones.
  useEffect(() => {
    if (!cartData?.cart) {
      setQuantities({});
      setRemovedKeys([]);
      return;
    }
    setQuantities((prev) => {
      const next = { ...prev };
      cartData.cart.forEach((item: any, idx: number) => {
        const key = String(item.sku ?? idx);
        if (next[key] === undefined) {
          next[key] = item.quantity_units;
        }
      });
      return next;
    });
    // Do not clear removedKeys so that previously removed items stay removed.
  }, [cartData]);

  const adjustQty = useCallback((key: string, delta: number) => {
    setQuantities((prev) => {
      const next = Math.max(1, (prev[key] ?? 1) + delta);
      return { ...prev, [key]: next };
    });
  }, []);

  // Swap item with an alternative
  const swapItem = useCallback(
    (originalSku: string, altSku: string) => {
      if (!cartData?.cart) return;

      setCartData((prev: any) => {
        if (!prev?.cart) return prev;

        const newCart = prev.cart.map((item: any) => {
          if (item.sku !== originalSku) return item;

          // Find the alternative
          const alt = item.alternatives?.find((a: any) => a.sku === altSku);
          if (!alt) return item;

          // Swap: the alternative becomes the main item, original goes to alternatives
          const originalAsAlt = {
            sku: item.sku,
            name: item.name,
            brand: item.brand,
            unit_quantity: item.unit_quantity,
            unit: item.unit,
            price_per_unit: item.price_per_unit_inr,
            total_price_inr: item.total_price_inr,
          };

          // Build new alternatives list: remove the chosen alt, add the original
          const newAlternatives = [
            originalAsAlt,
            ...item.alternatives.filter((a: any) => a.sku !== altSku),
          ].slice(0, 5);

          return {
            ...item,
            sku: alt.sku,
            name: alt.name,
            brand: alt.brand,
            unit_quantity: alt.unit_quantity,
            unit: alt.unit,
            price_per_unit_inr: alt.price_per_unit,
            total_price_inr: alt.total_price_inr,
            alternatives: newAlternatives,
            substituted: true,
            substitution_reason: "Swapped by user",
          };
        });

        // Recalculate total
        const newTotal = newCart.reduce(
          (sum: number, item: any) => sum + (item.total_price_inr || 0),
          0,
        );

        return {
          ...prev,
          cart: newCart,
          total_price_inr: newTotal,
        };
      });

      // Update quantities map with new SKU
      setQuantities((prev) => {
        const oldQty = prev[originalSku] ?? 1;
        const newQtys = { ...prev };
        delete newQtys[originalSku];
        newQtys[altSku] = oldQty;
        return newQtys;
      });

      // Update removed keys if needed
      setRemovedKeys((prev) => {
        if (!prev.includes(originalSku)) return prev;
        return prev.filter(k => k !== originalSku);
      });
    },
    [cartData],
  );

  // Derived total based on quantity overrides (excludes removed items).
  const computedTotal = cartData?.cart
    ? cartData.cart.reduce((sum: number, item: any, idx: number) => {
        const key = String(item.sku ?? idx);
        if (removedKeys.includes(key)) return sum;
        const qty = quantities[key] ?? item.quantity_units;
        return sum + item.price_per_unit_inr * qty;
      }, 0)
    : 0;

  const mergeUniqueStrings = useCallback((str1: string | undefined, str2: string | undefined, sep = " | "): string => {
    const parts = [
      ...(str1 ? str1.split(/ \| | · |, /) : []),
      ...(str2 ? str2.split(/ \| | · |, /) : [])
    ].map(s => s.trim()).filter(Boolean);
    return Array.from(new Set(parts)).join(sep);
  }, []);

  const applyCartResponse = useCallback((data: any, budget?: number) => {
    const intents: any[] = data.intents ?? [];
    const allCartItems = intents.flatMap((g: any) => g.cart ?? []);
    const allUnavailable = intents.flatMap((g: any) => g.unavailable_items ?? []);
    const intentType = intents.map((g: any) => g.intent_type).filter(Boolean).join(", ");
    const contextSummary = intents.map((g: any) => g.context_summary).filter(Boolean).join(" | ");

    if (data.confidence === "low" && data.clarification_question) {
      setMessages((m) => [...m, { role: "assistant", text: data.clarification_question }]);
      setPhase("idle");
      return;
    }

    const prev = useChatStore.getState().cartData;
    
    let mergedCart = allCartItems;
    let mergedUnavailable = allUnavailable;
    let mergedTotal = data.total_price_inr || 0;
    let mergedIntentType = intentType || "shopping";
    let mergedContextSummary = contextSummary;


    if (prev) {
      mergedCart = [...(prev.cart || []), ...allCartItems];
      mergedUnavailable = [...(prev.unavailable_items || []), ...allUnavailable];
      mergedTotal = (prev.total_price_inr || 0) + mergedTotal;
      mergedIntentType = mergeUniqueStrings(prev.intent_type, mergedIntentType, ", ");
      mergedContextSummary = mergeUniqueStrings(prev.context_summary, mergedContextSummary, " · ");
    }

    const normalized = {
      ...data,
      cart: mergedCart,
      unavailable_items: mergedUnavailable,
      intent_type: mergedIntentType,
      context_summary: mergedContextSummary,
      total_price_inr: mergedTotal,
    };

    setCartData(normalized);
    setIntentGroups((prevGroups: any[]) => [...(prevGroups || []), ...(data.intents ?? [])]);

    const entry: CartHistoryEntry = {
      session_id: data.session_id,
      saved_at: new Date().toISOString(),
      intent_type: mergedIntentType,
      context_summary: mergedContextSummary,
      total_price_inr: mergedTotal,
      item_count: mergedCart.length,
      cart: mergedCart,
      unavailable_items: mergedUnavailable,
      summary: data.summary || "",
      budget_inr: budget,
    };
    saveToHistory(entry);
    window.dispatchEvent(new Event("cart-history-updated"));

    const itemCount = allCartItems.length;
    const unavailCount = allUnavailable.length;
    let summaryText =
      data.summary ||
      `I found ${itemCount} items for your ${intentType || "shopping"} list, totaling Rs.${data.total_price_inr}.`;
    if (unavailCount > 0)
      summaryText += ` (${unavailCount} item${unavailCount > 1 ? "s" : ""} unavailable)`;

    setMessages((m) => [...m, { role: "assistant", text: summaryText }]);
    setPhase("cart");
  }, []);

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

    // If we're answering a clarification, combine with the original request for full context
    let contentForBackend = inputText;
    if (pendingClarificationRef.current) {
      contentForBackend = `${pendingClarificationRef.current}. Specifically: ${inputText}`;
      pendingClarificationRef.current = null; // consumed
    }

    // Auto-detect URL input: if it looks like a URL, set input_type to "url"
    const detectedType = (() => {
      try {
        const url = new URL(inputText);
        if (["http:", "https:"].includes(url.protocol)) return "url" as const;
      } catch {
        /* not a URL */
      }
      return undefined;
    })();
    const currentInputType =
      detectedType || (typeof overrideType === "string" ? overrideType : null) || inputType;
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
      const userId = getStoredUserId();
      const body: any = { content: contentForBackend, input_type: currentInputType };
      if (budget) body.budget_inr = budget;
      if (prefs.dietary !== "any") body.dietary_pref = prefs.dietary;
      if (prefs.preferredBrands.length) body.preferred_brands = prefs.preferredBrands;
      if (prefs.avoidedBrands.length) body.avoided_brands = prefs.avoidedBrands;
      if (prefs.budgetStyle !== "balanced") body.budget_mode = prefs.budgetStyle;
      if (prefs.preferredCategories.length) body.preferred_categories = prefs.preferredCategories;
      if (prefs.avoidedCategories.length) body.avoided_categories = prefs.avoidedCategories;
      if (prefs.qualityPreference !== "balanced") body.quality_preference = prefs.qualityPreference;
      if (prefs.packSizePreference !== "balanced") body.pack_size_preference = prefs.packSizePreference;
      body.user_id = userId;
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
        } catch {
          /* ignore */
        }
        throw new Error(errDetail);
      }

      const data = await res.json();
      applyCartResponse(data, budget);
      return;

      // Flatten multi-intent shape.
      const intents: any[] = data.intents ?? [];
      const allCartItems = intents.flatMap((g: any) => g.cart ?? []);
      const allUnavailable = intents.flatMap((g: any) => g.unavailable_items ?? []);
      const rawIntents = intents
        .map((g: any) => g.intent_type === "general" ? "Shopping List" : g.intent_type)
        .filter(Boolean);
      const uniqueIntents = Array.from(new Set(rawIntents));
      const intentType = uniqueIntents.join(", ");
      const contextSummary = intents
        .map((g: any) => g.context_summary)
        .filter(Boolean)
        .join(" · ");

      // Low-confidence → ask a clarifying question.
      if (data.confidence === "low" && data.clarification_question) {
        // Store the original request so the follow-up answer includes full context
        pendingClarificationRef.current = contentForBackend;
        setMessages((m) => [...m, { role: "assistant", text: data.clarification_question }]);
        setPhase("idle");
        return;
      }

      const newCartData = cartData
        ? {
            ...cartData,
            session_id: data.session_id, // Always use latest session_id so Review page finds the accumulated cart
            cart: [...(cartData.cart || []), ...allCartItems],
            unavailable_items: [...(cartData.unavailable_items || []), ...allUnavailable],
            intent_type: Array.from(new Set([
              ...(cartData.intent_type || "").split(", "),
              ...uniqueIntents
            ])).filter(Boolean).join(", "),
            context_summary:
              cartData.context_summary + (contextSummary ? " · " + contextSummary : ""),
            total_price_inr: (cartData.total_price_inr || 0) + data.total_price_inr,
          }
        : {
            ...data,
            cart: allCartItems,
            unavailable_items: allUnavailable,
            intent_type: intentType || "Shopping List",
            context_summary: contextSummary,
          };

      // We no longer reset quantities and removedKeys here, so custom quantities are kept.
      setCartData(newCartData);
      const newIntentGroups = [...intentGroups, ...(data.intents ?? [])];
      setIntentGroups(newIntentGroups);

      // Save to localStorage history.
      const entry: CartHistoryEntry = {
        session_id: data.session_id, // Use latest session ID
        saved_at: new Date().toISOString(),
        intent_type: newCartData.intent_type || "shopping",
        context_summary: newCartData.context_summary,
        total_price_inr: newCartData.total_price_inr,
        item_count: newCartData.cart.length,
        cart: newCartData.cart,
        unavailable_items: newCartData.unavailable_items,
        summary: data.summary || "",
        budget_inr: budget,
        intents: newIntentGroups,
      };
      saveToHistory(entry);
      window.dispatchEvent(new Event("cart-history-updated"));

      const itemCount = allCartItems.length;
      const unavailCount = allUnavailable.length;

      // Build a reliable summary from actual data (backend summary can be inaccurate)
      const itemNames = allCartItems
        .slice(0, 3)
        .map((it: any) => it.name)
        .join(", ");
      const moreText = itemCount > 3 ? ` and ${itemCount - 3} more` : "";
      let summaryText = cartData
        ? `Added ${itemCount} item${itemCount !== 1 ? "s" : ""} to your cart (${itemNames}${moreText}) — ₹${data.total_price_inr}. Cart total: ₹${newCartData.total_price_inr}`
        : `Found ${itemCount} item${itemCount !== 1 ? "s" : ""} (${itemNames}${moreText}) totaling ₹${data.total_price_inr}.`;
      if (unavailCount > 0)
        summaryText += ` ${unavailCount} item${unavailCount > 1 ? "s" : ""} unavailable.`;

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
    // "Load in Chat" — append history cart to existing live cart (or set as new base)
    const prev = useChatStore.getState().cartData;
    if (prev) {
      // Append to existing cart
      const merged = {
        ...prev,
        session_id: entry.session_id, // use history entry's session_id for review page
        cart: [...(prev.cart || []), ...(entry.cart || [])],
        unavailable_items: [
          ...(prev.unavailable_items || []),
          ...(entry.unavailable_items || []),
        ],
        intent_type: mergeUniqueStrings(prev.intent_type, entry.intent_type, ", "),
        context_summary: mergeUniqueStrings(prev.context_summary, entry.context_summary, " · "),
        total_price_inr: (prev.total_price_inr || 0) + (entry.total_price_inr || 0),
      };
      setCartData(merged);
      // Save merged cart to history
      const histEntry: CartHistoryEntry = {
        session_id: entry.session_id,
        saved_at: new Date().toISOString(),
        intent_type: merged.intent_type,
        context_summary: merged.context_summary,
        total_price_inr: merged.total_price_inr,
        item_count: merged.cart.length,
        cart: merged.cart,
        unavailable_items: merged.unavailable_items,
        summary: entry.summary || "",
        budget_inr: entry.budget_inr,
      };
      saveToHistory(histEntry);
      window.dispatchEvent(new Event("cart-history-updated"));
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: `Added ${entry.item_count} items from history. Cart now has ${merged.cart.length} items — ₹${merged.total_price_inr}`,
        },
      ]);
    } else {
      // No existing cart — set as base
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
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: `Loaded ${entry.item_count} item${entry.item_count !== 1 ? "s" : ""} from your previous cart — ₹${entry.total_price_inr}. Add more items or tap Review cart.`,
        },
      ]);
    }
    const restoredGroup = {
      intent_type: entry.intent_type,
      context_summary: entry.context_summary,
      cart: entry.cart,
      unavailable_items: entry.unavailable_items,
    };
    
    // Use saved groups, or fallback to a single group representing the old flat cart
    const restoredGroups = entry.intents?.length ? entry.intents : [restoredGroup];
    setIntentGroups((prevGroups) => (prev ? [...(prevGroups || []), ...restoredGroups] : restoredGroups));
    if (entry.budget_inr) setBudgetInput(String(entry.budget_inr));
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
          onReorder={(entry) => {
            // Navigate directly to the cart review page for reorder
            navigate({ to: "/cart/$id", params: { id: entry.session_id } });
          }}
        />

        {/* Left: conversation */}
        {/* Left: conversation */}
        <div className="relative flex min-h-0 flex-col border-r border-border">
          <div className="absolute right-4 top-4 z-10">
            <button
              onClick={() => setHistoryOpen((o) => !o)}
              title="Cart history"
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border/50 bg-background/80 px-3 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur-md transition-all hover:border-foreground hover:text-foreground"
            >
              <History className="h-3.5 w-3.5" />
              History
            </button>
          </div>

          <Conversation className="flex-1 pb-32">
            <ConversationContent className="mx-auto w-full max-w-3xl pt-14">
              {/* Smart Repeat suggestion banner */}
              {phase !== "thinking" && (
                <div className="mb-4">
                  <SmartRepeatBanner
                    onAccept={(prompt) => {
                      setText(prompt);
                      // Auto-submit the restock prompt
                      onSubmit(prompt);
                    }}
                    hasActiveCart={!!cartData}
                  />
                </div>
              )}

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
                    <SemanticSearchSkeleton />
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

          <div className="absolute bottom-6 left-0 right-0 z-20 mx-auto w-full max-w-3xl px-4 pointer-events-none">
            <div className="pointer-events-auto flex flex-col gap-2.5 rounded-[28px] border border-border/40 bg-background/98 p-4 shadow-xl shadow-black/8 backdrop-blur-2xl dark:bg-[#252422]/95 dark:shadow-black/30">
              {/* Budget + attachments row */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                <div className="flex items-center gap-2.5">
                  <label
                    htmlFor="budget-input"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/10">
                      <IndianRupee className="h-3 w-3 text-brand" />
                    </div>
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
                    className="h-8 w-28 rounded-xl border border-border/50 bg-surface/80 px-3 text-xs font-medium text-foreground placeholder:text-muted-foreground/60 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all"
                  />
                  {budgetInput && (
                    <span className="text-xs font-medium text-brand">
                      ₹{parseInt(budgetInput || "0", 10).toLocaleString("en-IN")}
                    </span>
                  )}
                </div>

                {/* Attachment chip strip */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button className="inline-flex h-7 items-center justify-center rounded-lg bg-surface/80 border border-border/30 px-2.5 text-[11px] font-medium text-muted-foreground transition-all hover:text-foreground hover:border-brand/30 hover:bg-brand/5">
                    <LinkIcon className="mr-1.5 h-3.5 w-3.5" /> URL
                  </button>

                  <button
                    onClick={() => imageInputRef.current?.click()}
                    className="inline-flex h-7 items-center justify-center rounded-lg bg-surface/80 border border-border/30 px-2.5 text-[11px] font-medium text-muted-foreground transition-all hover:text-foreground hover:border-brand/30 hover:bg-brand/5"
                  >
                    <ImageIcon className="mr-1.5 h-3.5 w-3.5" /> Image
                  </button>

                  <button
                    onClick={() => pdfInputRef.current?.click()}
                    className="inline-flex h-7 items-center justify-center rounded-lg bg-surface/80 border border-border/30 px-2.5 text-[11px] font-medium text-muted-foreground transition-all hover:text-foreground hover:border-brand/30 hover:bg-brand/5"
                  >
                    <FileText className="mr-1.5 h-3.5 w-3.5" /> PDF
                  </button>

                  <button
                    onClick={() => {
                      const whatsappText = prompt("Paste your WhatsApp message:");
                      if (whatsappText?.trim()) {
                        setText(whatsappText.trim());
                        setInputType("whatsapp");
                      }
                    }}
                    className="inline-flex h-7 items-center justify-center rounded-lg bg-surface/80 border border-border/30 px-2.5 text-[11px] font-medium text-muted-foreground transition-all hover:text-foreground hover:border-brand/30 hover:bg-brand/5"
                  >
                    <Paperclip className="mr-1.5 h-3.5 w-3.5" /> WhatsApp
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
                      setMessages((m) => [
                        ...m,
                        { role: "user", text: `📷 Uploaded: ${file.name}` },
                      ]);

                      const prefs = loadPreferences();
                      const userId = getStoredUserId();
                      const uploadBudget = budgetInput ? parseInt(budgetInput, 10) : undefined;
                      const formData = new FormData();
                      formData.append("image", file);
                      if (uploadBudget) formData.append("budget_inr", String(uploadBudget));
                      if (prefillOccasion) formData.append("occasion", prefillOccasion);
                      appendPreferenceFormData(formData, prefs, userId);

                      try {
                        const res = await fetch("/api/parse-image", { method: "POST", body: formData });
                        if (!res.ok) throw new Error("Image parsing failed");
                        const data = await res.json();
                        if (data.intents) {
                          applyCartResponse(data, uploadBudget);
                        } else if (data.extracted_text) {
                          setText(data.extracted_text);
                          setInputType("text");
                          onSubmit(data.extracted_text, "text");
                        } else {
                          throw new Error("Image parsing returned no cart or extracted text");
                        }
                      } catch (err: any) {
                        setErrorMsg(err.message);
                        setPhase("idle");
                      } finally {
                        e.target.value = "";
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
                      setMessages((m) => [
                        ...m,
                        { role: "user", text: `📄 Uploaded PDF: ${file.name}` },
                      ]);

                      const prefs = loadPreferences();
                      const userId = getStoredUserId();
                      const uploadBudget = budgetInput ? parseInt(budgetInput, 10) : undefined;
                      const formData = new FormData();
                      formData.append("pdf", file);
                      if (uploadBudget) formData.append("budget_inr", String(uploadBudget));
                      if (prefillOccasion) formData.append("occasion", prefillOccasion);
                      appendPreferenceFormData(formData, prefs, userId);

                      try {
                        const res = await fetch("/api/parse-pdf", { method: "POST", body: formData });
                        if (!res.ok) throw new Error("PDF parsing failed");
                        const data = await res.json();
                        if (data.intents) {
                          applyCartResponse(data, uploadBudget);
                        } else if (data.extracted_text) {
                          setText(data.extracted_text);
                          setInputType("text");
                          onSubmit(data.extracted_text, "text");
                        } else {
                          throw new Error("PDF parsing returned no cart or extracted text");
                        }
                      } catch (err: any) {
                        setErrorMsg(err.message);
                        setPhase("idle");
                      } finally {
                        e.target.value = "";
                      }
                    }}
                  />
                </div>
              </div>

              {/* Proactive Occasion Suggestion Bar */}
              {occasionSuggestion && !occasionDismissed && (
                <div className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand/5 via-brand/10 to-brand/5 border border-brand/20 px-3 py-2 animate-in slide-in-from-bottom-2 fade-in duration-300">
                  <span className="text-base">{occasionSuggestion.emoji}</span>
                  <p className="flex-1 text-xs font-medium text-foreground/80">
                    Looks like a{" "}
                    <span className="font-semibold text-foreground">
                      {occasionSuggestion.name.toLowerCase()}
                    </span>
                    ! Start with template?
                  </p>
                  <button
                    onClick={() => {
                      // Merge user text with template: user text takes priority, template adds context
                      const userText = text.trim();
                      const merged = userText
                        ? `${userText}. Also include items from ${occasionSuggestion!.name} template.`
                        : occasionSuggestion!.prompt;
                      setText(merged);
                      setOccasionDismissed(true);
                      // Submit with the occasion ID so backend merges blueprint items
                      navigate({ to: "/chat", search: { prompt: merged, occasion: occasionSuggestion!.id } });
                    }}
                    className="inline-flex h-7 items-center gap-1 rounded-lg bg-brand/10 px-2.5 text-[10px] font-semibold text-brand transition-colors hover:bg-brand hover:text-white"
                  >
                    Use template
                  </button>
                  <button
                    onClick={() => setOccasionDismissed(true)}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
                    aria-label="Dismiss"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}

              <PromptInput
                onSubmit={onSubmit}
                className="border-0 bg-transparent shadow-none ring-0"
              >
                <PromptInputTextarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={
                    voice.status === "listening"
                      ? "🎙️ Listening… speak now"
                      : voice.status === "processing"
                        ? "⏳ Transcribing…"
                        : "What do you need today? Describe your occasion, paste a recipe, or just list items…"
                  }
                />
                <div className="flex items-center justify-between px-2 py-1.5">
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
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
                          voice.status === "listening"
                            ? "bg-destructive/10 text-destructive animate-pulse shadow-sm shadow-destructive/20"
                            : voice.status === "processing"
                              ? "bg-brand/10 text-brand opacity-70 cursor-wait"
                              : "text-muted-foreground hover:bg-surface hover:text-foreground hover:shadow-sm"
                        }`}
                      >
                        {voice.status === "listening" ? (
                          <MicOff className="h-4.5 w-4.5" />
                        ) : (
                          <Mic className="h-4.5 w-4.5" />
                        )}
                      </button>
                    )}
                    {voice.status === "listening" && (
                      <span className="text-xs font-medium text-destructive animate-pulse">Recording…</span>
                    )}
                    {voice.status === "processing" && (
                      <span className="text-xs font-medium text-brand">Transcribing…</span>
                    )}
                    {voice.errorMessage && voice.status !== "listening" && (
                      <span className="max-w-[200px] truncate text-xs text-destructive">
                        {voice.errorMessage}
                      </span>
                    )}
                  </div>
                  <PromptInputSubmit status={phase === "thinking" ? "submitted" : undefined} />
                </div>
              </PromptInput>
            </div>
          </div>
        </div>

        {/* Right: live cart pane — Premium floating card */}
        <aside className="hidden min-h-0 flex-col p-4 lg:flex">
          <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-border/60 bg-background shadow-lg shadow-black/5 dark:shadow-black/20">
            {cartData ? (
              <>
                {/* Header */}
                <div className="border-b border-border/60 bg-gradient-to-b from-surface/80 to-surface/40 px-5 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand/10">
                        <ShoppingCart className="h-4 w-4 text-brand" />
                      </div>
                      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Live Cart
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        clearStore();
                      }}
                      className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                      Clear Cart
                    </button>
                  </div>
                  <div className="mt-3 font-display text-xl font-semibold tracking-tight capitalize">
                    {(cartData.intent_type || "").split(", ").map((t: string) => t.toLowerCase() === "general" ? "Shopping List" : t).filter((v: string, i: number, a: string[]) => a.indexOf(v) === i).join(", ")}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {cartData.context_summary}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1">
                      <Wallet className="h-3.5 w-3.5 text-brand" /> ₹{computedTotal.toFixed(0)}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1">
                      <Users className="h-3.5 w-3.5" />{" "}
                      {(cartData.cart?.length ?? 0) - removedKeys.length} items
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
                    <div className="space-y-6">
                      {intentGroups.map((group: any, gi: number) => {
                        const groupItems = (group.cart ?? []).filter((_: any, idx: number) => {
                          const key = String(_.sku ?? `${gi}-${idx}`);
                          return !removedKeys.includes(key);
                        });
                        const groupSubtotal = groupItems.reduce((s: number, it: any, idx: number) => {
                          const key = String(it.sku ?? `${gi}-${idx}`);
                          const qty = quantities[key] ?? it.quantity_units;
                          return s + it.price_per_unit_inr * qty;
                        }, 0);

                        return (
                          <div key={gi}>
                            {/* Section header */}
                            <div className="mb-3 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="h-5 w-1 rounded-full bg-brand" />
                                <span className="text-xs font-bold uppercase tracking-wider text-foreground/80">
                                  {group.intent_type === "general" ? "Shopping List" : group.intent_type}
                                </span>
                              </div>
                              <span className="text-xs font-semibold tabular-nums text-muted-foreground">₹{groupSubtotal.toFixed(0)}</span>
                            </div>
                            {group.context_summary && (
                              <p className="mb-3 text-xs text-muted-foreground leading-relaxed">{group.context_summary}</p>
                            )}
                            <div className="space-y-3">
                              {(group.cart ?? []).filter((_: any, idx: number) => !removedKeys.includes(String(_.sku ?? `${gi}-${idx}`))).map((item: any, idx: number) => {
                                const key = String(item.sku ?? `${gi}-${idx}`);
                                const qty = quantities[key] ?? item.quantity_units;
                                return (
                                  <CartItemRow
                                    key={key}
                                    item={item}
                                    qty={qty}
                                    onDecrement={() => adjustQty(key, -1)}
                                    onIncrement={() => adjustQty(key, 1)}
                                    onRemove={() => setRemovedKeys((prev) => [...prev, key])}
                                    onSwap={(altSku) => swapItem(item.sku, altSku)}
                                    preferredBrands={userPreferredBrands}
                                    priceStatus={priceStatuses[key]}
                                  />
                                );
                              })}
                            </div>
                            {/* Per-group unavailable */}
                            {group.unavailable_items?.length > 0 && (
                              <div className="mt-3 space-y-2">
                                {group.unavailable_items.map((it: any, idx: number) => (
                                  <UnavailableItemRow key={idx} item={it} />
                                ))}
                              </div>
                            )}
                            {/* Divider between groups */}
                            {gi < intentGroups.length - 1 && (
                              <div className="mt-5 border-t border-border/40" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* Single intent (or restored from history): flat list */
                    <div className="space-y-3">
                      {cartData.cart
                        ?.filter((_: any, idx: number) => {
                          const key = String(_.sku ?? idx);
                          return !removedKeys.includes(key);
                        })
                        .map((item: any, idx: number) => {
                          const key = String(item.sku ?? idx);
                          const qty = quantities[key] ?? item.quantity_units;
                          return (
                            <CartItemRow
                              key={key}
                              item={item}
                              qty={qty}
                              onDecrement={() => adjustQty(key, -1)}
                              onIncrement={() => adjustQty(key, 1)}
                              onRemove={() => setRemovedKeys((prev) => [...prev, key])}
                              onSwap={(altSku) => swapItem(item.sku, altSku)}
                              preferredBrands={userPreferredBrands}
                              priceStatus={priceStatuses[key]}
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
                          <UnavailableItemRow key={idx} item={it} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>



                {/* Footer with total */}
                <div className="border-t border-border/60 bg-gradient-to-t from-surface/80 to-surface/40 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs uppercase tracking-wider text-muted-foreground">Estimated Total</span>
                      <div className="font-display text-3xl font-bold tracking-tight">
                        ₹{computedTotal.toFixed(0)}
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      {(cartData.cart?.length ?? 0) - removedKeys.length} items
                    </div>
                  </div>
                  {budgetInput && Number(budgetInput) > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>Budget usage</span>
                        <span className={computedTotal > Number(budgetInput) ? "text-destructive font-medium" : "text-success font-medium"}>
                          {Math.min(100, Math.round((computedTotal / Number(budgetInput)) * 100))}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-surface">
                        <div
                          className={`h-full rounded-full transition-all ${
                            computedTotal > Number(budgetInput) ? "bg-destructive" : "bg-brand"
                          }`}
                          style={{
                            width: `${Math.min(100, (computedTotal / Number(budgetInput)) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                  <button
                    onClick={() => {
                      const updatedCart = (cartData.cart || []).map((item: any) => {
                        const sku = String(item.sku);
                        if (removedKeys.includes(sku)) return null;
                        const qty = quantities[sku] ?? item.quantity_units;
                        return {
                          ...item,
                          quantity_units: qty,
                          total_price_inr: qty * item.price_per_unit_inr,
                        };
                      }).filter(Boolean);
                      
                      const updatedCartData = {
                        ...cartData,
                        cart: updatedCart,
                        total_price_inr: computedTotal,
                      };
                      setCartData(updatedCartData);
                      
                      const histEntry = {
                        session_id: cartData.session_id,
                        saved_at: new Date().toISOString(),
                        intent_type: cartData.intent_type,
                        context_summary: cartData.context_summary,
                        total_price_inr: computedTotal,
                        item_count: updatedCart.length,
                        cart: updatedCart,
                        unavailable_items: cartData.unavailable_items || [],
                        summary: cartData.summary || "",
                        budget_inr: cartData.budget_inr,
                      };
                      saveToHistory(histEntry);
                      window.dispatchEvent(new Event("cart-history-updated"));
                      
                      navigate({ to: "/cart/$id", params: { id: cartData.session_id } });
                    }}
                    className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-foreground text-sm font-medium text-background shadow-md transition-all hover:bg-foreground/90 hover:shadow-lg"
                  >
                    Review cart
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface">
                  <ShoppingCart className="h-8 w-8 text-muted-foreground/30" />
                </div>
                <div className="space-y-1">
                  <p className="font-display text-base font-medium">Your cart is empty</p>
                  <p className="text-sm text-muted-foreground">
                    Describe what you need and I'll build your cart
                  </p>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
