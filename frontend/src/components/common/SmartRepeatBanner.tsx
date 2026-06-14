/**
 * SmartRepeatBanner — A dismissable nudge that suggests restocking items
 * likely running low based on purchase history and consumption estimates.
 */

import { useEffect, useState } from "react";
import { RefreshCw, X, ShoppingCart, Clock } from "lucide-react";
import {
  getSmartRepeatSuggestion,
  isDismissed,
  dismissSuggestion,
  type SmartRepeatSuggestion,
} from "@/lib/smart-repeat";

interface SmartRepeatBannerProps {
  /** Called when user accepts — passes the pre-built prompt text */
  onAccept: (prompt: string) => void;
  /** Whether there's already an active cart (changes copy slightly) */
  hasActiveCart?: boolean;
}

export function SmartRepeatBanner({ onAccept, hasActiveCart }: SmartRepeatBannerProps) {
  const [suggestion, setSuggestion] = useState<SmartRepeatSuggestion | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    // Check on mount
    if (isDismissed()) {
      setDismissed(true);
      return;
    }

    const result = getSmartRepeatSuggestion();
    if (result) {
      setSuggestion(result);
      setDismissed(false);
    }
  }, []);

  // Also listen for history updates (in case a new cart was just saved)
  useEffect(() => {
    const handler = () => {
      if (isDismissed()) return;
      const result = getSmartRepeatSuggestion();
      setSuggestion(result);
    };
    window.addEventListener("cart-history-updated", handler);
    return () => window.removeEventListener("cart-history-updated", handler);
  }, []);

  if (dismissed || !suggestion) return null;

  const handleDismiss = () => {
    dismissSuggestion();
    setDismissed(true);
  };

  const handleAccept = () => {
    onAccept(suggestion.prompt);
    dismissSuggestion();
    setDismissed(true);
  };

  const highUrgencyItems = suggestion.restockItems.filter((i) => i.urgency === "high");
  const displayItems = suggestion.restockItems.slice(0, 4);

  return (
    <div className="relative mx-auto w-full max-w-2xl animate-in slide-in-from-top-2 fade-in duration-500">
      <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/5 via-amber-500/10 to-orange-500/5 p-4 shadow-lg shadow-amber-500/5 backdrop-blur-sm">
        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
          aria-label="Dismiss suggestion"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        {/* Header */}
        <div className="flex items-start gap-3 pr-6">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/15 shadow-sm">
            <RefreshCw className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground leading-snug">
              {suggestion.nudgeText}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {displayItems.map((item) => (
                <span
                  key={item.sku}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                    item.urgency === "high"
                      ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                      : item.urgency === "medium"
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                        : "bg-surface text-muted-foreground border-border/50"
                  }`}
                >
                  {item.urgency === "high" && <Clock className="h-2.5 w-2.5" />}
                  {item.name.length > 18 ? item.name.slice(0, 16) + "…" : item.name}
                </span>
              ))}
              {suggestion.restockItems.length > 4 && (
                <span className="inline-flex items-center rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium text-muted-foreground border border-border/50">
                  +{suggestion.restockItems.length - 4} more
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-3 flex items-center gap-2 pl-12">
          <button
            onClick={handleAccept}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-3.5 text-xs font-semibold text-white shadow-sm transition-all hover:shadow-md hover:scale-[1.02] active:scale-100"
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            {hasActiveCart ? "Add restock items" : "Restock now"}
          </button>
          <button
            onClick={handleDismiss}
            className="inline-flex h-8 items-center px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
