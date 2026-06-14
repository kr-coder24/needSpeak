/**
 * BudgetFingerprint — Visual "spending personality" card
 * Derived from cart item analysis (brands, prices, dietary tags, quantities).
 * 
 * Persistence:
 *   - Always: Zustand + persist middleware (localStorage)
 *   - When logged in: Also syncs to backend (DynamoDB in AWS mode, in-memory in mock)
 */

import { useEffect, useMemo, useRef } from "react";
import { Fingerprint } from "lucide-react";
import { computeBudgetFingerprint, type BudgetFingerprintResult } from "@/lib/budget-fingerprint";
import { useShopperDnaStore } from "@/store/useShopperDnaStore";

interface BudgetFingerprintProps {
  cartItems: any[];
  budget?: number | null;
  totalSpent?: number;
  /** Pass the logged-in user ID to enable backend sync */
  userId?: string;
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

  // Hydrate from backend on first mount if user is logged in
  useEffect(() => {
    if (userId && !hydratedRef.current) {
      hydratedRef.current = true;
      hydrateFromBackend(userId);
    }
  }, [userId, hydrateFromBackend]);

  // Persist to Zustand store (+ backend if userId provided) once per cart render
  useEffect(() => {
    if (fingerprint.traits.length > 0 && !persistedRef.current) {
      updateFingerprint(fingerprint, userId);
      persistedRef.current = true;
    }
  }, [fingerprint, updateFingerprint, userId]);

  // Reset ref when cart items change significantly
  useEffect(() => {
    persistedRef.current = false;
  }, [cartItems.length]);

  if (!cartItems || cartItems.length === 0) return null;

  // Use accumulated top traits if available, otherwise use current session traits
  const displayTraits = topTraits.length > 0 && totalSessions > 1 ? topTraits : fingerprint.traits;

  return (
    <div className="rounded-2xl border-2 border-border/50 bg-gradient-to-br from-background/90 via-background/70 to-background/50 p-6 shadow-xl backdrop-blur-md overflow-hidden relative">
      {/* Subtle background decoration */}
      <div className="absolute -top-8 -right-8 h-24 w-24 rounded-full bg-brand/5 blur-2xl" />
      <div className="absolute -bottom-6 -left-6 h-20 w-20 rounded-full bg-success/5 blur-2xl" />

      {/* Header */}
      <div className="relative flex items-center gap-2.5 mb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand/20 to-brand/10 shadow-sm shadow-brand/10">
          <Fingerprint className="h-4.5 w-4.5 text-brand" />
        </div>
        <div>
          <span className="text-sm font-bold text-foreground">Shopper DNA</span>
          <p className="text-[10px] text-muted-foreground font-medium">
            {totalSessions > 1
              ? `Profile built from ${totalSessions} carts`
              : "Your spending personality"}
          </p>
        </div>
      </div>

      {/* Archetype badge */}
      <div className="relative mb-4 flex items-center gap-3 rounded-xl bg-gradient-to-r from-brand/10 via-brand/5 to-transparent px-4 py-3 border border-brand/20">
        <span className="text-2xl">{fingerprint.archetypeEmoji}</span>
        <div>
          <div className="text-sm font-bold text-foreground">{fingerprint.archetypeLabel}</div>
          <div className="text-[10px] text-muted-foreground font-medium">
            Avg ₹{fingerprint.avgPricePerItem}/item · {cartItems.length} items
          </div>
        </div>
      </div>

      {/* Traits */}
      <div className="relative space-y-2">
        {displayTraits.map((trait, idx) => (
          <div
            key={trait.label}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 bg-surface/40 border border-border/30 transition-all duration-300 hover:bg-surface/60 hover:border-brand/20"
            style={{ animationDelay: `${idx * 80}ms` }}
          >
            <span className="text-base flex-shrink-0">{trait.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-foreground truncate">{trait.label}</div>
              <div className="text-[10px] text-muted-foreground truncate">{trait.description}</div>
            </div>
            {/* Confidence dot */}
            <div
              className="h-2 w-2 rounded-full flex-shrink-0"
              style={{
                backgroundColor:
                  trait.confidence >= 0.7
                    ? "var(--color-success)"
                    : trait.confidence >= 0.5
                      ? "var(--color-brand)"
                      : "var(--color-muted-foreground)",
                opacity: trait.confidence,
              }}
            />
          </div>
        ))}
      </div>

      {/* Footer insight */}
      {fingerprint.dominantBrand && fingerprint.brandLoyal && (
        <div className="relative mt-4 pt-3 border-t border-border/30">
          <p className="text-[10px] text-muted-foreground font-medium">
            <span className="text-foreground font-semibold">{fingerprint.dominantBrand}</span> is
            your go-to brand in this cart
          </p>
        </div>
      )}
    </div>
  );
}
