export interface UserPreferences {
  dietary: "any" | "veg" | "vegan" | "jain"
  preferredBrands: string[]
  avoidedBrands: string[]
  preferredCategories: string[]
  avoidedCategories: string[]
  allergies: string[]
  budgetStyle: "value" | "balanced" | "premium"
  qualityPreference: "value" | "balanced" | "quality"
  packSizePreference: "small" | "balanced" | "bulk"
}

const STORAGE_KEY = "needspeak-preferences"

const DEFAULTS: UserPreferences = {
  dietary: "any",
  preferredBrands: [],
  avoidedBrands: [],
  preferredCategories: [],
  avoidedCategories: [],
  allergies: [],
  budgetStyle: "balanced",
  qualityPreference: "balanced",
  packSizePreference: "balanced",
}

export function loadPreferences(): UserPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return DEFAULTS
  }
}

export function savePreferences(prefs: UserPreferences): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
}
