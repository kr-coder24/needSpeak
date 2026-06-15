import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { loadPreferences, savePreferences, type UserPreferences } from "@/lib/preferences";
import { 
  Check, Plus, Save, Sparkles, X, 
  Settings2, Bot, ShieldBan, ThumbsUp, ThumbsDown, 
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
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Hackathon Pitch Banner */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-brand/20 bg-brand/5 p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-6 w-6 text-brand shrink-0 mt-0.5" />
            <div>
              <span className="text-sm font-bold text-foreground">Global Context Matrix</span>
              <p className="text-xs text-muted-foreground mt-0.5">These settings are injected into the LLM system prompt, instantly personalizing all generated carts.</p>
            </div>
          </div>
          <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand px-3 py-1 text-[10px] font-black text-white uppercase tracking-wider shadow-sm">
            <Bot className="h-3 w-3" /> Agentic Memory
          </div>
        </div>

        {/* Header */}
        <div className="flex flex-col gap-4 border-b border-border pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight flex items-center gap-3">
              <Settings2 className="h-8 w-8 text-brand" />
              AI Persona
            </h1>
            <p className="mt-2 text-base text-muted-foreground">
              Teach the AI how you shop. It learns your budget, brand loyalties, and dietary constraints.
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saveState === "saving"}
            className={`inline-flex h-12 items-center justify-center gap-2 rounded-xl px-8 text-sm font-bold text-white shadow-lg transition-all ${
              saveState === "saved" ? "bg-green-600 hover:bg-green-700" : "bg-brand hover:bg-brand/90 hover:scale-105"
            } disabled:opacity-60 disabled:hover:scale-100`}
          >
            {saveState === "saving" ? (
              <span className="flex items-center gap-2"><div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Syncing...</span>
            ) : saveState === "saved" ? (
              <span className="flex items-center gap-2"><Check className="h-5 w-5" /> Saved to Brain</span>
            ) : (
              <span className="flex items-center gap-2"><Save className="h-5 w-5" /> Update Persona</span>
            )}
          </button>
        </div>

        {/* --- Magic Extract Section (Highlight for Hackathon) --- */}
        <section className="py-10 border-b border-border">
          <div className="rounded-2xl bg-gradient-to-br from-brand/10 via-background to-background p-1 border border-brand/20 shadow-lg shadow-brand/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
              <Bot className="h-32 w-32" />
            </div>
            <div className="rounded-xl bg-card p-6 relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-5 w-5 text-brand" />
                <h2 className="text-lg font-bold text-foreground">Natural Language Setup</h2>
                <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 uppercase">Beta Feature</span>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Just tell the AI how you shop. It will extract and map your preferences automatically.
              </p>
              
              <div className="relative">
                <textarea
                  className="min-h-[120px] w-full resize-none rounded-xl border border-border bg-background p-4 text-base outline-none focus:border-brand focus:ring-1 focus:ring-brand shadow-inner transition-all placeholder:text-muted-foreground/50"
                  placeholder='e.g., "I prefer to buy bulk packs for cleaning supplies. We are a strict vegan household. I love Tata products but absolutely avoid Nestle. Keep things budget-friendly."'
                  value={magicText}
                  onChange={(event) => setMagicText(event.target.value)}
                  disabled={isExtracting}
                />
                <button
                  type="button"
                  onClick={handleMagicExtract}
                  disabled={isExtracting || !magicText.trim()}
                  className="absolute bottom-4 right-4 inline-flex h-10 items-center gap-2 rounded-lg bg-foreground px-5 text-sm font-bold text-background transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                >
                  {isExtracting ? (
                    <><div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" /> Parsing Intent...</>
                  ) : (
                    <><Bot className="h-4 w-4" /> Extract Magic</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* --- Decision Style --- */}
        <section className="grid gap-6 border-b border-border py-10 lg:grid-cols-[240px_1fr]">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Scale className="h-4 w-4" /> Strategy
            </h2>
            <p className="mt-2 text-xs text-muted-foreground pr-4">How should the AI evaluate alternatives and resolve cart ambiguities?</p>
          </div>
          <div className="grid gap-6">
            <div className="grid gap-4 sm:grid-cols-3">
              {budgetOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setBudgetStyle(option.id)}
                  className={`group relative overflow-hidden rounded-2xl border p-5 text-left transition-all hover:shadow-md ${
                    budgetStyle === option.id
                      ? "border-brand bg-brand/5 ring-1 ring-brand"
                      : "border-border bg-card hover:border-brand/50"
                  }`}
                >
                  <option.icon className={`mb-3 h-6 w-6 ${budgetStyle === option.id ? "text-brand" : "text-muted-foreground"}`} />
                  <div className={`font-bold ${budgetStyle === option.id ? "text-brand" : "text-foreground"}`}>{option.title}</div>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{option.desc}</p>
                </button>
              ))}
            </div>
            
            <div className="grid sm:grid-cols-2 gap-6 p-5 rounded-2xl border border-border bg-surface/30">
              <div>
                <p className="text-xs font-bold uppercase text-muted-foreground mb-3">Quality Bias</p>
                <div className="flex flex-wrap gap-2">
                  {qualityOptions.map((option) => (
                    <Pill key={option.id} label={option.title} active={qualityPreference === option.id} onClick={() => setQualityPreference(option.id)} />
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-muted-foreground mb-3">Pack Sizing</p>
                <div className="flex flex-wrap gap-2">
                  {packOptions.map((option) => (
                    <Pill key={option.id} label={option.title} active={packSizePreference === option.id} onClick={() => setPackSizePreference(option.id)} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* --- Brands --- */}
        <section className="grid gap-6 border-b border-border py-10 lg:grid-cols-[240px_1fr]">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4" /> Brands
            </h2>
            <p className="mt-2 text-xs text-muted-foreground pr-4">Direct the AI to prioritize or completely filter out specific manufacturers.</p>
          </div>
          <div className="grid gap-8">
            <div className="rounded-2xl border border-green-200 bg-green-50/30 p-5">
              <div className="mb-4 flex items-center gap-2 text-sm font-bold text-green-800">
                <ThumbsUp className="h-4 w-4" /> Always look for
              </div>
              <div className="flex flex-wrap gap-2">
                {brandOptions.map((brand) => (
                  <Pill key={brand} label={brand} active={preferredBrands.includes(brand)} onClick={() => setPreferredBrands((prev) => toggleValue(prev, brand))} />
                ))}
                {preferredBrands.filter((brand) => !brandOptions.includes(brand)).map((brand) => (
                  <Pill key={brand} label={brand} active onClick={() => setPreferredBrands((prev) => toggleValue(prev, brand))} />
                ))}
              </div>
              <div className="mt-4 flex max-w-sm gap-2">
                <input
                  value={customBrand}
                  onChange={(event) => setCustomBrand(event.target.value)}
                  placeholder="Type brand name..."
                  className="h-10 min-w-0 flex-1 rounded-xl border border-green-200 bg-white px-4 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
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
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-green-600 text-white hover:bg-green-700 transition-colors"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-red-200 bg-red-50/30 p-5">
              <div className="mb-4 flex items-center gap-2 text-sm font-bold text-red-800">
                <ShieldBan className="h-4 w-4" /> Strictly Avoid
              </div>
              <div className="flex flex-wrap gap-2">
                {brandOptions.map((brand) => (
                  <Pill key={brand} label={brand} active={avoidedBrands.includes(brand)} tone="negative" onClick={() => setAvoidedBrands((prev) => toggleValue(prev, brand))} />
                ))}
                {avoidedBrands.filter((brand) => !brandOptions.includes(brand)).map((brand) => (
                  <Pill key={brand} label={brand} active tone="negative" onClick={() => setAvoidedBrands((prev) => toggleValue(prev, brand))} />
                ))}
              </div>
              <div className="mt-4 flex max-w-sm gap-2">
                <input
                  value={customAvoidBrand}
                  onChange={(event) => setCustomAvoidBrand(event.target.value)}
                  placeholder="Type brand to ban..."
                  className="h-10 min-w-0 flex-1 rounded-xl border border-red-200 bg-white px-4 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
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
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* --- Constraints & Dietary --- */}
        <section className="grid gap-6 py-10 lg:grid-cols-[240px_1fr]">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Hard Constraints
            </h2>
            <p className="mt-2 text-xs text-muted-foreground pr-4">Items violating these rules will be aggressively filtered out of the results.</p>
          </div>
          <div className="grid gap-8 p-6 rounded-2xl border border-border bg-surface/30">
            <div>
              <div className="mb-3 text-sm font-bold text-foreground">Dietary Restrictions</div>
              <div className="flex flex-wrap gap-2">
                {dietaryOptions.map((option) => (
                  <Pill key={option.id} label={option.label} active={diet === option.id} onClick={() => setDiet(option.id)} />
                ))}
              </div>
            </div>
            <div>
              <div className="mb-3 text-sm font-bold text-foreground">Allergen Filters</div>
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
                      className="inline-flex h-9 items-center gap-2 rounded-xl border border-red-500 bg-red-50 px-3 text-sm font-bold text-red-700 hover:bg-red-100"
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