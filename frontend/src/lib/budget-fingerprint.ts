/**
 * Budget Fingerprint — analyzes cart items to derive a "spending personality"
 * profile. All computation is client-side, no API calls needed.
 */

export interface FingerprintTrait {
  label: string;
  emoji: string;
  description: string;
  confidence: number; // 0-1
}

export interface BudgetFingerprintResult {
  /** Primary spending archetype */
  archetype: string;
  /** Short human-readable label like "Value Seeker" */
  archetypeLabel: string;
  /** Emoji for the archetype */
  archetypeEmoji: string;
  /** All detected traits */
  traits: FingerprintTrait[];
  /** Average price per item */
  avgPricePerItem: number;
  /** Dominant brand (most frequent) */
  dominantBrand: string | null;
  /** Whether the cart has brand loyalty (>40% same brand) */
  brandLoyal: boolean;
  /** Dietary pattern detected */
  dietaryPattern: string | null;
  /** Pack size tendency */
  packSizeTendency: "bulk" | "single" | "mixed";
}

interface CartItem {
  sku?: string;
  name?: string;
  brand?: string;
  price_per_unit_inr?: number;
  total_price_inr?: number;
  quantity_units?: number;
  unit_quantity?: string;
  unit?: string;
  category?: string;
  dietary_tag?: string;
  substituted?: boolean;
  substitution_reason?: string;
  matched_from?: string[];
  alternatives?: any[];
  pending_substitution?: any;
}

// Price tier thresholds (INR per typical item)
const PRICE_TIERS = {
  budget: 80,
  mid: 200,
  premium: 400,
};

export function computeBudgetFingerprint(
  cartItems: CartItem[],
  budget?: number | null,
  totalSpent?: number,
): BudgetFingerprintResult {
  if (!cartItems || cartItems.length === 0) {
    return {
      archetype: "empty",
      archetypeLabel: "Getting Started",
      archetypeEmoji: "🛒",
      traits: [],
      avgPricePerItem: 0,
      dominantBrand: null,
      brandLoyal: false,
      dietaryPattern: null,
      packSizeTendency: "mixed",
    };
  }

  const traits: FingerprintTrait[] = [];

  // --- Price analysis ---
  const prices = cartItems
    .map((i) => i.price_per_unit_inr || i.total_price_inr || 0)
    .filter((p) => p > 0);
  const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;

  const budgetItems = prices.filter((p) => p <= PRICE_TIERS.budget).length;
  const premiumItems = prices.filter((p) => p >= PRICE_TIERS.premium).length;
  const budgetRatio = prices.length > 0 ? budgetItems / prices.length : 0;
  const premiumRatio = prices.length > 0 ? premiumItems / prices.length : 0;

  if (budgetRatio >= 0.5) {
    traits.push({
      label: "Value Seeker",
      emoji: "💰",
      description: "Prefers affordable options",
      confidence: Math.min(1, budgetRatio + 0.2),
    });
  } else if (premiumRatio >= 0.4) {
    traits.push({
      label: "Premium Buyer",
      emoji: "✨",
      description: "Chooses quality over price",
      confidence: Math.min(1, premiumRatio + 0.2),
    });
  } else {
    traits.push({
      label: "Balanced Spender",
      emoji: "⚖️",
      description: "Mix of value and quality",
      confidence: 0.7,
    });
  }

  // --- Brand analysis ---
  const brands = cartItems.map((i) => (i.brand || "").toLowerCase()).filter(Boolean);
  const brandCounts: Record<string, number> = {};
  for (const b of brands) {
    brandCounts[b] = (brandCounts[b] || 0) + 1;
  }
  const sortedBrands = Object.entries(brandCounts).sort(([, a], [, b]) => b - a);
  const topBrand = sortedBrands[0]?.[0] || null;
  const topBrandCount = sortedBrands[0]?.[1] || 0;
  const brandLoyaltyRatio = brands.length > 0 ? topBrandCount / brands.length : 0;
  const brandLoyal = brandLoyaltyRatio >= 0.35 && topBrandCount >= 2;

  if (brandLoyal && topBrand) {
    traits.push({
      label: `${capitalize(topBrand)} Fan`,
      emoji: "❤️",
      description: `${Math.round(brandLoyaltyRatio * 100)}% of items from ${capitalize(topBrand)}`,
      confidence: brandLoyaltyRatio,
    });
  } else if (sortedBrands.length >= 4) {
    traits.push({
      label: "Brand Explorer",
      emoji: "🔍",
      description: "Tries different brands",
      confidence: 0.6,
    });
  }

  // --- Dietary analysis ---
  const dietaryTags = cartItems
    .map((i) => (i.dietary_tag || "").toLowerCase())
    .filter(Boolean);
  const dietaryCounts: Record<string, number> = {};
  for (const d of dietaryTags) {
    dietaryCounts[d] = (dietaryCounts[d] || 0) + 1;
  }

  // Also check names/categories for veg indicators
  const vegKeywords = ["paneer", "dal", "dahi", "curd", "ghee", "milk", "butter", "cheese"];
  const nonVegKeywords = ["chicken", "mutton", "fish", "egg", "prawn", "meat"];
  const itemNames = cartItems.map((i) => (i.name || "").toLowerCase());
  
  const hasNonVeg = itemNames.some((n) => nonVegKeywords.some((kw) => n.includes(kw)));
  const vegCount = dietaryCounts["veg"] || 0;
  const veganCount = dietaryCounts["vegan"] || 0;
  const jainCount = dietaryCounts["jain"] || 0;

  let dietaryPattern: string | null = null;
  if (jainCount > 0 && jainCount >= cartItems.length * 0.3) {
    dietaryPattern = "jain";
    traits.push({
      label: "Jain Friendly",
      emoji: "🙏",
      description: "Avoids root vegetables and non-veg",
      confidence: 0.8,
    });
  } else if (veganCount > 0 && veganCount >= cartItems.length * 0.4) {
    dietaryPattern = "vegan";
    traits.push({
      label: "Plant-Based",
      emoji: "🌱",
      description: "No animal products",
      confidence: 0.8,
    });
  } else if (!hasNonVeg && (vegCount >= cartItems.length * 0.3 || itemNames.some((n) => vegKeywords.some((kw) => n.includes(kw))))) {
    dietaryPattern = "veg";
    traits.push({
      label: "Vegetarian",
      emoji: "🥬",
      description: "Plant-forward choices",
      confidence: 0.7,
    });
  } else if (hasNonVeg) {
    dietaryPattern = "non-veg";
    traits.push({
      label: "Non-Veg",
      emoji: "🍗",
      description: "Includes meat/egg items",
      confidence: 0.7,
    });
  }

  // --- Quantity / bulk analysis ---
  const quantities = cartItems.map((i) => i.quantity_units || 1);
  const avgQty = quantities.reduce((a, b) => a + b, 0) / quantities.length;
  const bulkItems = quantities.filter((q) => q >= 3).length;
  const bulkRatio = bulkItems / quantities.length;

  let packSizeTendency: "bulk" | "single" | "mixed" = "mixed";
  if (bulkRatio >= 0.4) {
    packSizeTendency = "bulk";
    traits.push({
      label: "Bulk Buyer",
      emoji: "📦",
      description: "Stocks up in larger quantities",
      confidence: Math.min(1, bulkRatio + 0.2),
    });
  } else if (avgQty <= 1.2) {
    packSizeTendency = "single";
    traits.push({
      label: "Light Shopper",
      emoji: "🎒",
      description: "Single-unit purchases",
      confidence: 0.6,
    });
  }

  // --- Budget discipline ---
  if (budget && totalSpent) {
    const utilizationRatio = totalSpent / budget;
    if (utilizationRatio <= 0.7) {
      traits.push({
        label: "Under-Budget Pro",
        emoji: "🎯",
        description: `Used only ${Math.round(utilizationRatio * 100)}% of budget`,
        confidence: 0.8,
      });
    } else if (utilizationRatio > 1.0) {
      traits.push({
        label: "Budget Stretcher",
        emoji: "📈",
        description: "Exceeds budget for quality",
        confidence: 0.7,
      });
    }
  }

  // --- Substitution acceptance ---
  const substitutedCount = cartItems.filter((i) => i.substituted).length;
  if (substitutedCount >= 2) {
    traits.push({
      label: "Flexible Swapper",
      emoji: "🔄",
      description: `Accepted ${substitutedCount} substitutions`,
      confidence: 0.7,
    });
  }

  // --- Determine archetype ---
  let archetype = "balanced";
  let archetypeLabel = "Smart Shopper";
  let archetypeEmoji = "🧠";

  if (budgetRatio >= 0.5 && brandLoyal) {
    archetype = "loyal_saver";
    archetypeLabel = "Loyal Saver";
    archetypeEmoji = "💎";
  } else if (budgetRatio >= 0.6) {
    archetype = "value_seeker";
    archetypeLabel = "Value Seeker";
    archetypeEmoji = "💰";
  } else if (premiumRatio >= 0.4) {
    archetype = "premium_buyer";
    archetypeLabel = "Premium Buyer";
    archetypeEmoji = "✨";
  } else if (brandLoyal) {
    archetype = "brand_loyalist";
    archetypeLabel = "Brand Loyalist";
    archetypeEmoji = "❤️";
  } else if (bulkRatio >= 0.4) {
    archetype = "bulk_planner";
    archetypeLabel = "Bulk Planner";
    archetypeEmoji = "📦";
  }

  return {
    archetype,
    archetypeLabel,
    archetypeEmoji,
    traits: traits.slice(0, 5), // max 5 traits
    avgPricePerItem: Math.round(avgPrice),
    dominantBrand: topBrand ? capitalize(topBrand) : null,
    brandLoyal,
    dietaryPattern,
    packSizeTendency,
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}


