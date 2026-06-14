/**
 * Freshness / availability badges for cart items (demo polish)
 * Maps SKU prefixes to visual badges shown on cart item rows.
 */

const NEUTRAL = "text-muted-foreground bg-muted";
const WARNING = "text-destructive bg-destructive/10";

const BADGE_RULES: Record<string, { label: string; color: string }> = {
  VEG: { label: "🥬 Seasonal", color: NEUTRAL },
  CHKN: { label: "⚠️ Low Stock", color: WARNING },
  ICE: { label: "❄️ Frozen", color: NEUTRAL },
  FRUIT: { label: "🍎 Fresh", color: NEUTRAL },
  DAIRY: { label: "🥛 Perishable", color: NEUTRAL },
};

export function getItemBadge(sku: string): { label: string; color: string } | null {
  if (!sku) return null;
  for (const [prefix, badge] of Object.entries(BADGE_RULES)) {
    if (sku.toUpperCase().startsWith(prefix)) return badge;
  }
  return null;
}
