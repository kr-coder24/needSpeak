/**
 * BudgetFingerprint — "Shopper DNA" card
 */

import { useEffect, useMemo, useRef } from "react";
import {
  Fingerprint, Gem, Wallet, BarChart3, Heart, Drumstick,
  Sparkles, Scale, Search, HandHeart, Leaf, Salad,
  Package, Backpack, Target, TrendingUp, Repeat, ShoppingCart,
} from "lucide-react";
import { computeBudgetFingerprint, type BudgetFingerprintResult } from "@/lib/budget-fingerprint";
import { useShopperDnaStore } from "@/store/useShopperDnaStore";

interface BudgetFingerprintProps {
  cartItems: any[];
  budget?: number | null;
  totalSpent?: number;
  userId?: string;
}

// Map legacy emoji to a Lucide icon component
const emojiIcon: Record<string, any> = {
  "💎": Gem,
  "💰": Wallet,
  "✨": Sparkles,
  "⚖️": Scale,
  "❤️": Heart,
  "🔍": Search,
  "🙏": HandHeart,
  "🌱": Leaf,
  "🥬": Salad,
  "🍗": Drumstick,
  "📦": Package,
  "🎒": Backpack,
  "🎯": Target,
  "📈": TrendingUp,
  "🔄": Repeat,
  "📊": BarChart3,
  "🛒": ShoppingCart,
};

function iconFor(emoji: string) {
  return emojiIcon[emoji] || BarChart3;
}

export function BudgetFingerprint({ cartItems, budget, totalSpent, userId }: BudgetFingerprintProps) {
  const updateFingerprint = useShopperDnaStore((s) => s.updateFingerprint);
  const hydrateFromBackend = useShopperDnaStore((s) => s.hydrateFromBackend);
  const totalSessions = useShopperDnaStore((s) => s.totalSessions);
  const topTraits = useShopperDnaStore((s) => s.topTraits);
  const persistedRef = useRef(false);
  const hydratedRef = useRef(false);

  const fingerprint: BudgetFingerprintResult = useMemo(
    () => computeBudgetFingerprint(cartItems, budget, totalSpent),
    [cartItems, budget, totalSpent],
  );

  useEffect(() => {
    if (userId && !hydratedRef.current) {
      hydratedRef.current = true;
      hydrateFromBackend(userId);
    }
  }, [userId, hydrateFromBackend]);

  useEffect(() => {
    if (fingerprint.traits.length > 0 && !persistedRef.current) {
      updateFingerprint(fingerprint, userId);
      persistedRef.current = true;
    }
  }, [fingerprint, updateFingerprint, userId]);

  useEffect(() => {
    persistedRef.current = false;
  }, [cartItems.length]);

  if (!cartItems || cartItems.length === 0) return null;

  const displayTraits = topTraits.length > 0 && totalSessions > 1 ? topTraits : fingerprint.traits;
  const ArchetypeIcon = iconFor(fingerprint.archetypeEmoji);

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Fingerprint className="h-4 w-4 text-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Shopper DNA
          </p>
          <p className="text-sm font-semibold text-foreground truncate">
            {totalSessions > 1
              ? `Profile built from ${totalSessions} carts`
              : "Your spending profile"}
          </p>
        </div>
      </div>

      {/* Archetype */}
      <div className="mb-4 flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background border border-border">
          <ArchetypeIcon className="h-5 w-5 text-foreground" />
        </div>
        <div className="min-w-0">
          <div className="text-base font-semibold text-foreground truncate">{fingerprint.archetypeLabel}</div>
          <div className="text-xs text-muted-foreground">
            Avg ₹{fingerprint.avgPricePerItem}/item · {cartItems.length} items
          </div>
        </div>
      </div>

      {/* Traits */}
      <div className="space-y-2">
        {displayTraits.map((trait) => {
          const Icon = iconFor(trait.emoji);
          const dotColor =
            trait.confidence >= 0.7
              ? "bg-emerald-500"
              : trait.confidence >= 0.5
                ? "bg-amber-500"
                : "bg-rose-500";
          return (
            <div
              key={trait.label}
              className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Icon className="h-4 w-4 text-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-foreground truncate">{trait.label}</div>
                <div className="text-xs text-muted-foreground truncate">{trait.description}</div>
              </div>
              <span className={`h-2 w-2 shrink-0 rounded-full ${dotColor}`} aria-hidden />
            </div>
          );
        })}
      </div>

      {fingerprint.dominantBrand && fingerprint.brandLoyal && (
        <div className="mt-4 pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground">
            <span className="text-foreground font-semibold">{fingerprint.dominantBrand}</span> is
            your go-to brand in this cart
          </p>
        </div>
      )}
    </div>
  );
}
