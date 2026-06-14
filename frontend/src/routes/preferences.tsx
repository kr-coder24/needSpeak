import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { loadPreferences, savePreferences, type UserPreferences } from "@/lib/preferences";
import { Check } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";

export const Route = createFileRoute("/preferences")({
  head: () => ({
    meta: [
      { title: "Preferences — NeedSpeak" },
      {
        name: "description",
        content:
          "Set dietary preferences, budget style, and preferred brands once. NeedSpeak applies them to every cart.",
      },
      { property: "og:title", content: "Preferences — NeedSpeak" },
      { property: "og:description", content: "Personalize NeedSpeak: dietary, budget, brands." },
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
const budgetStyle = [
  { id: "value", title: "Value", desc: "Cheapest acceptable across the cart" },
  { id: "balanced", title: "Balanced", desc: "Quality and price weighed equally" },
  { id: "premium", title: "Premium", desc: "Best quality, brand-loyal" },
];
const brands = [
  "Amul",
  "Tata",
  "Britannia",
  "Haldiram's",
  "Nestlé",
  "ITC",
  "Mother Dairy",
  "Parle",
];

function PreferencesPage() {
  const [diet, setDiet] = useState<UserPreferences["dietary"]>("any");
  const [style, setStyle] = useState<UserPreferences["budgetStyle"]>("balanced");
  const [picked, setPicked] = useState<string[]>([]);
  const [magicText, setMagicText] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved">("idle");

  useEffect(() => {
    const prefs = loadPreferences();
    setDiet(prefs.dietary);
    setStyle(prefs.budgetStyle);
    setPicked(prefs.preferredBrands);
  }, []);

  const toggle = (b: string) =>
    setPicked((p) => (p.includes(b) ? p.filter((x) => x !== b) : [...p, b]));

  const handleSave = () => {
    savePreferences({
      dietary: diet,
      budgetStyle: style,
      preferredBrands: picked,
    });
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus("idle"), 2000);
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
      if (res.ok) {
        const data = await res.json();

        // Normalize dietary value from LLM response
        if (data.dietary) {
          const dietMap: Record<string, UserPreferences["dietary"]> = {
            any: "any",
            none: "any",
            "no restriction": "any",
            veg: "veg",
            vegetarian: "veg",
            vegan: "vegan",
            jain: "jain",
          };
          const normalized = dietMap[data.dietary.toLowerCase()] || "any";
          setDiet(normalized);
        }

        // Normalize budget mode
        if (data.budget_mode) {
          const modeMap: Record<string, UserPreferences["budgetStyle"]> = {
            value: "value",
            cheap: "value",
            budget: "value",
            balanced: "balanced",
            moderate: "balanced",
            premium: "premium",
            expensive: "premium",
            quality: "premium",
          };
          const normalized = modeMap[data.budget_mode.toLowerCase()] || "balanced";
          setStyle(normalized);
        }

        // Add extracted brands (merge with existing picks)
        if (data.preferred_brands && Array.isArray(data.preferred_brands)) {
          const extractedBrands = data.preferred_brands.map(
            (b: string) => b.charAt(0).toUpperCase() + b.slice(1),
          );
          setPicked((prev) => Array.from(new Set([...prev, ...extractedBrands])));
        }

        // Auto-save after extraction so preferences are immediately active
        const dietMap2: Record<string, UserPreferences["dietary"]> = {
          any: "any",
          none: "any",
          "no restriction": "any",
          veg: "veg",
          vegetarian: "veg",
          vegan: "vegan",
          jain: "jain",
        };
        const modeMap2: Record<string, UserPreferences["budgetStyle"]> = {
          value: "value",
          cheap: "value",
          budget: "value",
          balanced: "balanced",
          moderate: "balanced",
          premium: "premium",
          expensive: "premium",
          quality: "premium",
        };
        const finalDiet: UserPreferences["dietary"] = data.dietary
          ? dietMap2[String(data.dietary).toLowerCase()] || "any"
          : diet;
        const finalStyle: UserPreferences["budgetStyle"] = data.budget_mode
          ? modeMap2[String(data.budget_mode).toLowerCase()] || "balanced"
          : style;
        const finalBrands = data.preferred_brands?.length
          ? Array.from(
              new Set([
                ...picked,
                ...data.preferred_brands.map((b: string) => b.charAt(0).toUpperCase() + b.slice(1)),
              ]),
            )
          : picked;

        savePreferences({
          dietary: finalDiet,
          budgetStyle: finalStyle,
          preferredBrands: finalBrands,
        });
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 3000);
        setMagicText("");
      } else {
        alert("Failed to extract preferences. Try rephrasing.");
      }
    } catch (e) {
      console.error(e);
      alert("Failed to extract preferences. Check your connection.");
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-semibold tracking-tight">Preferences</h1>
        <p className="mt-2 text-muted-foreground">
          Set these once. NeedSpeak applies them to every cart it builds.
        </p>

        {/* Magic Setup */}
        <section className="mt-8 rounded-2xl border border-brand/30 bg-gradient-to-br from-brand/5 to-transparent p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-xl">✨</span>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Magic Setup</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Tell us how you shop in your own words, and we'll configure everything for you.
          </p>
          <div className="mt-4">
            <textarea
              className="w-full rounded-xl border border-border bg-card p-4 text-sm outline-none transition-colors focus:border-brand focus:ring-1 focus:ring-brand"
              rows={3}
              placeholder="e.g., I'm a strict vegan on a tight budget, and I really like Amul products."
              value={magicText}
              onChange={(e) => setMagicText(e.target.value)}
            />
            <div className="mt-3 flex items-center justify-end gap-3">
              {saveStatus === "saved" && (
                <span className="text-xs font-medium text-success">✓ Preferences applied</span>
              )}
              <button
                onClick={handleMagicExtract}
                disabled={isExtracting || !magicText.trim()}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-brand px-5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand/90 disabled:opacity-50"
              >
                {isExtracting ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-[2.5px] border-current border-t-transparent" />
                    Extracting...
                  </>
                ) : (
                  "Generate"
                )}
              </button>
            </div>
          </div>
        </section>

        {/* Dietary */}
        <section className="mt-10">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Dietary
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {dietaryOptions.map((d) => {
              const active = d.id === diet;
              return (
                <button
                  key={d.id}
                  onClick={() => setDiet(d.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ${
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-card text-foreground hover:border-foreground"
                  }`}
                >
                  {active && <Check className="h-3.5 w-3.5" />}
                  {d.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Budget style */}
        <section className="mt-10">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Budget style
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {budgetStyle.map((b) => {
              const active = b.id === style;
              return (
                <button
                  key={b.id}
                  onClick={() => setStyle(b.id as UserPreferences["budgetStyle"])}
                  className={`rounded-2xl border p-4 text-left transition-colors ${
                    active
                      ? "border-foreground bg-surface"
                      : "border-border bg-card hover:border-foreground"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{b.title}</div>
                    {active && (
                      <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold text-brand-foreground">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{b.desc}</p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Preferred brands */}
        <section className="mt-10">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Preferred brands
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Tap to prefer. NeedSpeak will pick these when available.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {brands.map((b) => {
              const active = picked.includes(b);
              return (
                <button
                  key={b}
                  onClick={() => toggle(b)}
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    active
                      ? "border-brand bg-brand/15 text-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-foreground hover:text-foreground"
                  }`}
                >
                  {b}
                </button>
              );
            })}
            {/* Show extracted brands that aren't in the predefined list */}
            {picked
              .filter((p) => !brands.includes(p))
              .map((b) => (
                <button
                  key={b}
                  onClick={() => toggle(b)}
                  className="rounded-full border border-brand bg-brand/15 px-3 py-1.5 text-sm text-foreground relative"
                >
                  {b}
                  <span className="ml-1.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-brand text-[9px] font-bold text-brand-foreground">
                    ✓
                  </span>
                </button>
              ))}
          </div>
        </section>

        <div className="mt-10 flex justify-end">
          <button
            onClick={handleSave}
            className={`inline-flex h-10 items-center gap-2 rounded-lg px-5 text-sm font-medium transition-colors ${
              saveStatus === "saved"
                ? "bg-success text-white"
                : "bg-foreground text-background hover:bg-foreground/90"
            }`}
          >
            {saveStatus === "saved" ? (
              <>
                <Check className="h-4 w-4" />
                Saved!
              </>
            ) : (
              "Save preferences"
            )}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
