/**
 * Freshness / availability badges for cart items (demo polish)
 * Maps SKU prefixes to visual badges shown on cart item rows.
 */

const BADGE_RULES: Record<string, { label: string; color: string }> = {
  VEG: { label: "🥬 Seasonal", color: "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950" },
  CHKN: { label: "⚠️ Low Stock", color: "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950" },
  ICE: { label: "❄️ Frozen", color: "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950" },
  FRUIT: { label: "🍎 Fresh", color: "text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950" },
  DAIRY: { label: "🥛 Perishable", color: "text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-950" },
};

export function getItemBadge(sku: string): { label: string; color: string } | null {
  if (!sku) return null;
  for (const [prefix, badge] of Object.entries(BADGE_RULES)) {
    if (sku.toUpperCase().startsWith(prefix)) return badge;
  }
  return null;
}
