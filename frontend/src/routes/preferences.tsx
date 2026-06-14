import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { loadPreferences, savePreferences, type UserPreferences } from "@/lib/preferences";
import { Check, Plus, Save, Sparkles, X } from "lucide-react";

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

const dietaryOptions: { id: UserPreferences["dietary"]; label: string }[] = [
  { id: "any", label: "No restriction" },
  { id: "veg", label: "Vegetarian" },
  { id: "vegan", label: "Vegan" },
  { id: "jain", label: "Jain" },
];

const budgetOptions: { id: UserPreferences["budgetStyle"]; title: string; desc: string }[] = [
  { id: "value", title: "Value", desc: "Prefer lower price when quality is acceptable" },
  { id: "balanced", title: "Balanced", desc: "Balance price, rating, and relevance" },
  { id: "premium", title: "Premium", desc: "Prefer trusted brands and higher rated items" },
];

const qualityOptions: { id: UserPreferences["qualityPreference"]; title: string }[] = [
  { id: "value", title: "Value" },
  { id: "balanced", title: "Balanced" },
  { id: "quality", title: "Quality" },
];

const packOptions: { id: UserPreferences["packSizePreference"]; title: string }[] = [
  { id: "small", title: "Small packs" },
  { id: "balanced", title: "Balanced" },
  { id: "bulk", title: "Bulk value" },
];

const brandOptions = [
  "Amul",
  "Tata",
  "Britannia",
  "Haldiram's",
  "Nestle",
  "ITC",
  "Mother Dairy",
  "Parle",
  "Fortune",
  "Classmate",
  "Samsung",
  "Puma",
];

const categoryOptions = [
  { id: "grains", label: "Grains" },
  { id: "dairy", label: "Dairy" },
  { id: "snacks", label: "Snacks" },
  { id: "beverages", label: "Beverages" },
  { id: "vegetables", label: "Vegetables" },
  { id: "cleaning", label: "Home care" },
  { id: "stationery", label: "Stationery" },
  { id: "tools_hardware", label: "Tools" },
  { id: "medicines_otc", label: "Health" },
  { id: "meat_poultry", label: "Meat" },
];

const allergyOptions = ["peanut", "gluten", "soy", "dairy", "egg", "shellfish"];

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

function Pill({
  label,
  active,
  onClick,
  tone = "positive",
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  tone?: "positive" | "negative";
}) {
  const activeClass =
    tone === "negative"
      ? "border-destructive/50 bg-destructive/10 text-destructive"
      : "border-brand bg-brand/15 text-foreground";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors ${
        active
          ? activeClass
          : "border-border bg-card text-muted-foreground hover:border-foreground/50 hover:text-foreground"
      }`}
    >
      {active && <Check className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}

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
      setSaveState("saved");
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
      if (data.dietary) setDiet(data.dietary);
      if (data.budget_mode) setBudgetStyle(data.budget_mode);
      if (data.quality_preference) setQualityPreference(data.quality_preference);
      if (data.pack_size_preference) setPackSizePreference(data.pack_size_preference);
      if (Array.isArray(data.preferred_brands)) {
        setPreferredBrands((prev) => Array.from(new Set([...prev, ...data.preferred_brands])));
      }
      if (Array.isArray(data.avoided_brands)) {
        setAvoidedBrands((prev) => Array.from(new Set([...prev, ...data.avoided_brands])));
      }
      if (Array.isArray(data.preferred_categories)) {
        setPreferredCategories((prev) => Array.from(new Set([...prev, ...data.preferred_categories])));
      }
      if (Array.isArray(data.avoided_categories)) {
        setAvoidedCategories((prev) => Array.from(new Set([...prev, ...data.avoided_categories])));
      }
    } catch {
      setSaveState("error");
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Shopping profile</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              These signals shape retrieval, ranking, alternatives, and purchase likelihood.
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saveState === "saving"}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-foreground px-4 text-sm font-medium text-background hover:bg-foreground/90 disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saveState === "saving" ? "Saving" : saveState === "saved" ? "Saved" : "Save profile"}
          </button>
        </div>

        <section className="grid gap-4 border-b border-border py-8 lg:grid-cols-[240px_1fr]">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Smart setup</h2>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <textarea
              className="min-h-24 w-full resize-none rounded-md border border-border bg-background p-3 text-sm outline-none focus:border-brand"
              placeholder="I buy value packs for household items, prefer Amul dairy, avoid meat, and pick higher rated electronics."
              value={magicText}
              onChange={(event) => setMagicText(event.target.value)}
            />
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={handleMagicExtract}
                disabled={isExtracting || !magicText.trim()}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-brand px-4 text-sm font-medium text-brand-foreground hover:bg-brand/90 disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                {isExtracting ? "Extracting" : "Extract"}
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 border-b border-border py-8 lg:grid-cols-[240px_1fr]">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Decision style</h2>
          </div>
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {budgetOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setBudgetStyle(option.id)}
                  className={`rounded-lg border p-4 text-left transition-colors ${
                    budgetStyle === option.id
                      ? "border-foreground bg-surface"
                      : "border-border bg-card hover:border-foreground/50"
                  }`}
                >
                  <div className="font-medium">{option.title}</div>
                  <p className="mt-2 text-xs text-muted-foreground">{option.desc}</p>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {qualityOptions.map((option) => (
                <Pill
                  key={option.id}
                  label={`Quality: ${option.title}`}
                  active={qualityPreference === option.id}
                  onClick={() => setQualityPreference(option.id)}
                />
              ))}
              {packOptions.map((option) => (
                <Pill
                  key={option.id}
                  label={option.title}
                  active={packSizePreference === option.id}
                  onClick={() => setPackSizePreference(option.id)}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 border-b border-border py-8 lg:grid-cols-[240px_1fr]">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Brands</h2>
          </div>
          <div className="grid gap-5">
            <div>
              <div className="mb-3 text-sm font-medium">Preferred</div>
              <div className="flex flex-wrap gap-2">
                {brandOptions.map((brand) => (
                  <Pill
                    key={brand}
                    label={brand}
                    active={preferredBrands.includes(brand)}
                    onClick={() => setPreferredBrands((prev) => toggleValue(prev, brand))}
                  />
                ))}
                {preferredBrands.filter((brand) => !brandOptions.includes(brand)).map((brand) => (
                  <Pill key={brand} label={brand} active onClick={() => setPreferredBrands((prev) => toggleValue(prev, brand))} />
                ))}
              </div>
              <div className="mt-3 flex max-w-sm gap-2">
                <input
                  value={customBrand}
                  onChange={(event) => setCustomBrand(event.target.value)}
                  placeholder="Add brand"
                  className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-brand"
                />
                <button
                  type="button"
                  onClick={() => {
                    setPreferredBrands((prev) => addCustomValue(prev, customBrand));
                    setCustomBrand("");
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card hover:bg-surface"
                  aria-label="Add preferred brand"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div>
              <div className="mb-3 text-sm font-medium">Avoid</div>
              <div className="flex flex-wrap gap-2">
                {brandOptions.map((brand) => (
                  <Pill
                    key={brand}
                    label={brand}
                    active={avoidedBrands.includes(brand)}
                    tone="negative"
                    onClick={() => setAvoidedBrands((prev) => toggleValue(prev, brand))}
                  />
                ))}
                {avoidedBrands.filter((brand) => !brandOptions.includes(brand)).map((brand) => (
                  <Pill
                    key={brand}
                    label={brand}
                    active
                    tone="negative"
                    onClick={() => setAvoidedBrands((prev) => toggleValue(prev, brand))}
                  />
                ))}
              </div>
              <div className="mt-3 flex max-w-sm gap-2">
                <input
                  value={customAvoidBrand}
                  onChange={(event) => setCustomAvoidBrand(event.target.value)}
                  placeholder="Avoid brand"
                  className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-brand"
                />
                <button
                  type="button"
                  onClick={() => {
                    setAvoidedBrands((prev) => addCustomValue(prev, customAvoidBrand));
                    setCustomAvoidBrand("");
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card hover:bg-surface"
                  aria-label="Add avoided brand"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 border-b border-border py-8 lg:grid-cols-[240px_1fr]">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Categories</h2>
          </div>
          <div className="grid gap-5">
            <div>
              <div className="mb-3 text-sm font-medium">Prefer</div>
              <div className="flex flex-wrap gap-2">
                {categoryOptions.map((category) => (
                  <Pill
                    key={category.id}
                    label={category.label}
                    active={preferredCategories.includes(category.id)}
                    onClick={() => setPreferredCategories((prev) => toggleValue(prev, category.id))}
                  />
                ))}
              </div>
            </div>
            <div>
              <div className="mb-3 text-sm font-medium">Avoid</div>
              <div className="flex flex-wrap gap-2">
                {categoryOptions.map((category) => (
                  <Pill
                    key={category.id}
                    label={category.label}
                    active={avoidedCategories.includes(category.id)}
                    tone="negative"
                    onClick={() => setAvoidedCategories((prev) => toggleValue(prev, category.id))}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 py-8 lg:grid-cols-[240px_1fr]">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Constraints</h2>
          </div>
          <div className="grid gap-5">
            <div>
              <div className="mb-3 text-sm font-medium">Dietary</div>
              <div className="flex flex-wrap gap-2">
                {dietaryOptions.map((option) => (
                  <Pill key={option.id} label={option.label} active={diet === option.id} onClick={() => setDiet(option.id)} />
                ))}
              </div>
            </div>
            <div>
              <div className="mb-3 text-sm font-medium">Allergies</div>
              <div className="flex flex-wrap gap-2">
                {allergyOptions.map((allergy) => (
                  <Pill
                    key={allergy}
                    label={allergy}
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
                      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-destructive/50 bg-destructive/10 px-3 text-sm text-destructive"
                    >
                      {allergy}
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ),
                )}
              </div>
            </div>
          </div>
        </section>

        {saveState === "error" && (
          <div className="mb-8 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Profile was saved locally, but the server sync failed.
          </div>
        )}
      </div>
    </AppShell>
  );
}
