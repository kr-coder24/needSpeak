import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { loadPreferences, savePreferences, type UserPreferences } from "@/lib/preferences";
import {
  Check, Plus, Save, Sparkles, X,
  ShieldBan, ThumbsUp,
  Banknote, Scale, Package, ShieldCheck
} from "lucide-react";

export const Route = createFileRoute("/preferences")({
  head: () => ({
    meta: [
      { title: "Preferences - NeedSpeak" },
      {
        name: "description",
        content: "Tune NeedSpeak with shopping behavior, brands, categories, budget, and quality preferences.",
      },
      { property: "og:title", content: "Preferences - NeedSpeak" },
      { property: "og:description", content: "Personalize NeedSpeak for ecommerce carts." },
    ],
  }),
  component: PreferencesPage,
});

// --- Constants remain the same ---
const dietaryOptions: { id: UserPreferences["dietary"]; label: string }[] = [
  { id: "any", label: "No restriction" },
  { id: "veg", label: "Vegetarian" },
  { id: "vegan", label: "Vegan" },
  { id: "jain", label: "Jain" },
];

const budgetOptions: { id: UserPreferences["budgetStyle"]; title: string; desc: string; icon: any }[] = [
  { id: "value", title: "Value First", desc: "Optimize for lowest price & bulk savings", icon: Banknote },
  { id: "balanced", title: "Balanced", desc: "Sweet spot between price and ratings", icon: Scale },
  { id: "premium", title: "Premium", desc: "Prioritize top brands & highest ratings", icon: Sparkles },
];

const qualityOptions: { id: UserPreferences["qualityPreference"]; title: string }[] = [
  { id: "value", title: "Value" },
  { id: "balanced", title: "Balanced" },
  { id: "quality", title: "Quality Focus" },
];

const packOptions: { id: UserPreferences["packSizePreference"]; title: string }[] = [
  { id: "small", title: "Small / Trial Packs" },
  { id: "balanced", title: "Standard Sizes" },
  { id: "bulk", title: "Bulk / Family Packs" },
];

const brandOptions = [
  "Amul", "Tata", "Britannia", "Haldiram's", "Nestle", "ITC", 
  "Mother Dairy", "Parle", "Fortune", "Classmate", "Samsung", "Puma",
];

const categoryOptions = [
  { id: "grains", label: "Grains & Rice" },
  { id: "dairy", label: "Dairy & Bakery" },
  { id: "snacks", label: "Snacks & Sweets" },
  { id: "beverages", label: "Beverages" },
  { id: "vegetables", label: "Fresh Produce" },
  { id: "cleaning", label: "Home Care" },
  { id: "stationery", label: "Stationery" },
  { id: "tools_hardware", label: "Tools" },
  { id: "medicines_otc", label: "Health & OTC" },
  { id: "meat_poultry", label: "Meat & Seafood" },
];

const allergyOptions = ["peanut", "gluten", "soy", "dairy", "egg", "shellfish"];

// --- Helpers remain the same ---
function getStoredUserId(): string | null {
  try {
    const raw = localStorage.getItem("needspeak-auth");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.user?.user_id || parsed?.user?.id || null;
  } catch {
    return null;
  }
}

function toggleValue(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function addCustomValue(values: string[], value: string): string[] {
  const clean = value.trim();
  if (!clean) return values;
  return values.some((item) => item.toLowerCase() === clean.toLowerCase()) ? values : [...values, clean];
}

// --- Enhanced Pill Component ---
function Pill({
  label, active, onClick, tone = "positive",
}: {
  label: string; active: boolean; onClick: () => void; tone?: "positive" | "negative";
}) {
  const activeClass = tone === "negative"
    ? "border-red-500 bg-red-50 text-red-700 shadow-sm"
    : "border-brand bg-brand/10 text-brand font-bold shadow-sm";
    
  const inactiveClass = "border-border bg-surface text-muted-foreground hover:border-foreground/30 hover:bg-card";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-2 rounded-xl border px-3.5 text-sm transition-all duration-200 ${active ? activeClass : inactiveClass}`}
    >
      {active && <Check className="h-4 w-4" />}
      {label}
    </button>
  );
}

// --- Main Page ---
function PreferencesPage() {
  const [diet, setDiet] = useState<UserPreferences["dietary"]>("any");
  const [budgetStyle, setBudgetStyle] = useState<UserPreferences["budgetStyle"]>("balanced");
  const [qualityPreference, setQualityPreference] = useState<UserPreferences["qualityPreference"]>("balanced");
  const [packSizePreference, setPackSizePreference] = useState<UserPreferences["packSizePreference"]>("balanced");
  const [preferredBrands, setPreferredBrands] = useState<string[]>([]);
  const [avoidedBrands, setAvoidedBrands] = useState<string[]>([]);
  const [preferredCategories, setPreferredCategories] = useState<string[]>([]);
  const [avoidedCategories, setAvoidedCategories] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  
  const [customBrand, setCustomBrand] = useState("");
  const [customAvoidBrand, setCustomAvoidBrand] = useState("");
  const [magicText, setMagicText] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    const prefs = loadPreferences();
    setDiet(prefs.dietary);
    setBudgetStyle(prefs.budgetStyle);
    setQualityPreference(prefs.qualityPreference);
    setPackSizePreference(prefs.packSizePreference);
    setPreferredBrands(prefs.preferredBrands);
    setAvoidedBrands(prefs.avoidedBrands);
    setPreferredCategories(prefs.preferredCategories);
    setAvoidedCategories(prefs.avoidedCategories);
    setAllergies(prefs.allergies);

    const userId = getStoredUserId();
    if (!userId) return;

    fetch(`/api/preferences/${encodeURIComponent(userId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data || Object.keys(data).length === 0) return;
        const serverDiet = Array.isArray(data.dietary) ? data.dietary[0] : data.dietary;
        if (serverDiet) setDiet(serverDiet);
        if (data.budget_mode) setBudgetStyle(data.budget_mode);
        if (data.quality_preference) setQualityPreference(data.quality_preference);
        if (data.pack_size_preference) setPackSizePreference(data.pack_size_preference);
        if (Array.isArray(data.preferred_brands)) setPreferredBrands(data.preferred_brands);
        if (Array.isArray(data.avoided_brands)) setAvoidedBrands(data.avoided_brands);
        if (Array.isArray(data.preferred_categories)) setPreferredCategories(data.preferred_categories);
        if (Array.isArray(data.avoided_categories)) setAvoidedCategories(data.avoided_categories);
        if (Array.isArray(data.allergies)) setAllergies(data.allergies);
      })
      .catch(() => {});
  }, []);

  const currentPrefs: UserPreferences = {
    dietary: diet,
    budgetStyle,
    preferredBrands,
    avoidedBrands,
    preferredCategories,
    avoidedCategories,
    allergies,
    qualityPreference,
    packSizePreference,
  };

  const handleSave = async () => {
    setSaveState("saving");
    savePreferences(currentPrefs);

    const userId = getStoredUserId();
    if (!userId) {
      setTimeout(() => setSaveState("saved"), 600); // UI sugar
      return;
    }

    try {
      const res = await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          dietary: diet === "any" ? [] : [diet],
          preferred_brands: preferredBrands,
          avoided_brands: avoidedBrands,
          preferred_categories: preferredCategories,
          avoided_categories: avoidedCategories,
          allergies,
          budget_mode: budgetStyle,
          quality_preference: qualityPreference,
          pack_size_preference: packSizePreference,
        }),
      });
      if (!res.ok) throw new Error("Preference save failed");
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  };

  const handleMagicExtract = async () => {
    if (!magicText.trim()) return;
    setIsExtracting(true);
    try {
      const res = await fetch("/api/preferences/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: magicText }),
      });
      if (!res.ok) throw new Error("extract failed");
      const data = await res.json();
      
      // Update states
      if (data.dietary) setDiet(data.dietary);
      if (data.budget_mode) setBudgetStyle(data.budget_mode);
      if (data.quality_preference) setQualityPreference(data.quality_preference);
      if (data.pack_size_preference) setPackSizePreference(data.pack_size_preference);
      if (Array.isArray(data.preferred_brands)) setPreferredBrands((prev) => Array.from(new Set([...prev, ...data.preferred_brands])));
      if (Array.isArray(data.avoided_brands)) setAvoidedBrands((prev) => Array.from(new Set([...prev, ...data.avoided_brands])));
      if (Array.isArray(data.preferred_categories)) setPreferredCategories((prev) => Array.from(new Set([...prev, ...data.preferred_categories])));
      if (Array.isArray(data.avoided_categories)) setAvoidedCategories((prev) => Array.from(new Set([...prev, ...data.avoided_categories])));
      
      // Clear box and show success
      setMagicText("");
    } catch {
      setSaveState("error");
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">

        {/* Page header */}
        <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Preferences</p>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-foreground">AI Persona</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Teach the assistant how you shop. It learns your budget, brand loyalties, and dietary constraints.
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saveState === "saving"}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-foreground px-5 text-sm font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-60"
          >
            {saveState === "saving" ? (
              <span className="flex items-center gap-2"><div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" /> Saving</span>
            ) : saveState === "saved" ? (
              <span className="flex items-center gap-2"><Check className="h-4 w-4" /> Saved</span>
            ) : (
              <span className="flex items-center gap-2"><Save className="h-4 w-4" /> Update persona</span>
            )}
          </button>
        </div>

        <div className="mt-8 space-y-6">

          {/* Natural language setup */}
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Natural Language Setup</p>
              <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Beta</span>
            </div>
            <h2 className="text-lg font-semibold text-foreground">Describe how you shop</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The assistant extracts and maps your preferences automatically.
            </p>
            <div className="relative mt-4">
              <textarea
                className="min-h-[110px] w-full resize-none rounded-lg border border-border bg-background p-4 text-sm outline-none transition-colors focus:border-foreground/40 placeholder:text-muted-foreground/60"
                placeholder='e.g., "I prefer bulk packs for cleaning supplies. We are a strict vegan household. I love Tata products but avoid Nestle."'
                value={magicText}
                onChange={(event) => setMagicText(event.target.value)}
                disabled={isExtracting}
              />
              <button
                type="button"
                onClick={handleMagicExtract}
                disabled={isExtracting || !magicText.trim()}
                className="absolute bottom-3 right-3 inline-flex h-9 items-center gap-2 rounded-md bg-foreground px-4 text-xs font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
              >
                {isExtracting ? (
                  <><div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-background border-t-transparent" /> Parsing</>
                ) : (
                  <>Extract preferences</>
                )}
              </button>
            </div>
          </section>

          {/* STRATEGY */}
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-muted-foreground" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Strategy</p>
            </div>
            <h2 className="mt-1 text-lg font-semibold text-foreground">Decision style</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              How should the AI evaluate alternatives and resolve cart ambiguities?
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {budgetOptions.map((option) => {
                const active = budgetStyle === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setBudgetStyle(option.id)}
                    className={`group rounded-xl border p-4 text-left transition-colors ${
                      active
                        ? "border-foreground bg-muted/50 ring-1 ring-foreground"
                        : "border-border bg-background hover:border-foreground/40"
                    }`}
                  >
                    <option.icon className={`mb-2 h-5 w-5 ${active ? "text-foreground" : "text-muted-foreground"}`} />
                    <div className="text-base font-semibold text-foreground">{option.title}</div>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{option.desc}</p>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 grid gap-5 rounded-xl border border-border bg-muted/30 p-4 sm:grid-cols-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2">Quality Bias</p>
                <div className="flex flex-wrap gap-2">
                  {qualityOptions.map((option) => (
                    <Pill key={option.id} label={option.title} active={qualityPreference === option.id} onClick={() => setQualityPreference(option.id)} />
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2">Pack Sizing</p>
                <div className="flex flex-wrap gap-2">
                  {packOptions.map((option) => (
                    <Pill key={option.id} label={option.title} active={packSizePreference === option.id} onClick={() => setPackSizePreference(option.id)} />
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* BRANDS */}
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Brands</p>
            </div>
            <h2 className="mt-1 text-lg font-semibold text-foreground">Preferred & avoided manufacturers</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Direct the AI to prioritize or filter out specific brands.
            </p>

            <div className="mt-5 space-y-4">
              <div className="rounded-xl border border-border bg-background p-4">
                <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                  <ThumbsUp className="h-3.5 w-3.5" /> Always Look For
                </div>
                <div className="flex flex-wrap gap-2">
                  {brandOptions.map((brand) => (
                    <Pill key={brand} label={brand} active={preferredBrands.includes(brand)} onClick={() => setPreferredBrands((prev) => toggleValue(prev, brand))} />
                  ))}
                  {preferredBrands.filter((brand) => !brandOptions.includes(brand)).map((brand) => (
                    <Pill key={brand} label={brand} active onClick={() => setPreferredBrands((prev) => toggleValue(prev, brand))} />
                  ))}
                </div>
                <div className="mt-3 flex max-w-sm gap-2">
                  <input
                    value={customBrand}
                    onChange={(event) => setCustomBrand(event.target.value)}
                    placeholder="Type brand name..."
                    className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-foreground/40"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setPreferredBrands((prev) => addCustomValue(prev, customBrand));
                        setCustomBrand("");
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setPreferredBrands((prev) => addCustomValue(prev, customBrand));
                      setCustomBrand("");
                    }}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-background p-4">
                <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-700">
                  <ShieldBan className="h-3.5 w-3.5" /> Strictly Avoid
                </div>
                <div className="flex flex-wrap gap-2">
                  {brandOptions.map((brand) => (
                    <Pill key={brand} label={brand} active={avoidedBrands.includes(brand)} tone="negative" onClick={() => setAvoidedBrands((prev) => toggleValue(prev, brand))} />
                  ))}
                  {avoidedBrands.filter((brand) => !brandOptions.includes(brand)).map((brand) => (
                    <Pill key={brand} label={brand} active tone="negative" onClick={() => setAvoidedBrands((prev) => toggleValue(prev, brand))} />
                  ))}
                </div>
                <div className="mt-3 flex max-w-sm gap-2">
                  <input
                    value={customAvoidBrand}
                    onChange={(event) => setCustomAvoidBrand(event.target.value)}
                    placeholder="Type brand to ban..."
                    className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-foreground/40"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setAvoidedBrands((prev) => addCustomValue(prev, customAvoidBrand));
                        setCustomAvoidBrand("");
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setAvoidedBrands((prev) => addCustomValue(prev, customAvoidBrand));
                      setCustomAvoidBrand("");
                    }}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* CONSTRAINTS */}
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Hard Constraints</p>
            </div>
            <h2 className="mt-1 text-lg font-semibold text-foreground">Dietary & allergens</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Items violating these rules are filtered out of every result.
            </p>

            <div className="mt-5 space-y-5 rounded-xl border border-border bg-muted/30 p-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2">Dietary Restrictions</p>
                <div className="flex flex-wrap gap-2">
                  {dietaryOptions.map((option) => (
                    <Pill key={option.id} label={option.label} active={diet === option.id} onClick={() => setDiet(option.id)} />
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2">Allergen Filters</p>
                <div className="flex flex-wrap gap-2">
                  {allergyOptions.map((allergy) => (
                    <Pill
                      key={allergy}
                      label={allergy.charAt(0).toUpperCase() + allergy.slice(1)}
                      active={allergies.includes(allergy)}
                      tone="negative"
                      onClick={() => setAllergies((prev) => toggleValue(prev, allergy))}
                    />
                  ))}
                  {allergies.map((allergy) =>
                    allergyOptions.includes(allergy) ? null : (
                      <button
                        key={allergy}
                        type="button"
                        onClick={() => setAllergies((prev) => toggleValue(prev, allergy))}
                        className="inline-flex h-9 items-center gap-2 rounded-lg border border-rose-500 bg-rose-50 px-3 text-sm font-semibold text-rose-700 hover:bg-rose-100"
                      >
                        {allergy}
                        <X className="h-4 w-4" />
                      </button>
                    ),
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>


        {saveState === "error" && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 shadow-sm animate-in fade-in slide-in-from-bottom-4">
            <X className="h-5 w-5 shrink-0" />
            <span className="text-sm font-medium">Profile was saved locally, but cloud sync failed. Please check connection.</span>
          </div>
        )}
      </div>
    </AppShell>
  );
}