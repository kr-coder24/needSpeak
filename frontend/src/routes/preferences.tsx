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

const dietaryOptions: { id: UserPreferences["dietary"], label: string }[] = [
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
    alert("Preferences saved!");
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-semibold tracking-tight">Preferences</h1>
        <p className="mt-2 text-muted-foreground">
          Set these once. NeedSpeak applies them to every cart it builds.
        </p>

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
          </div>
        </section>

        <div className="mt-10 flex justify-end">
          <button onClick={handleSave} className="h-10 rounded-lg bg-foreground px-5 text-sm font-medium text-background hover:bg-foreground/90">
            Save preferences
          </button>
        </div>
      </div>
    </AppShell>
  );
}
