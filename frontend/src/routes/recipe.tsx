import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  ChefHat,
  ListChecks,
  ShoppingCart,
  Loader2,
  AlertCircle,
  Sparkles,
  Utensils,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { saveToHistory } from "@/lib/cart-history";

export const Route = createFileRoute("/recipe")({
  head: () => ({
    meta: [
      { title: "RecipeCart — NeedSpeak" },
      {
        name: "description",
        content:
          "Paste a recipe URL and get an ingredient cart with quantities scaled to your servings.",
      },
      { property: "og:title", content: "RecipeCart" },
      { property: "og:description", content: "Recipe URL in. Cart out." },
    ],
  }),
  component: RecipePage,
});

const steps = [
  { icon: ChefHat, title: "Parsing Recipe", desc: "Extracting ingredients & steps" },
  { icon: ListChecks, title: "Smart Scaling", desc: "Calculating exact SKU quantities" },
  { icon: ShoppingCart, title: "Inventory Match", desc: "Finding in-stock items" },
];

const SUGGESTED_RECIPES = [
  {
    name: "Chicken Tikka Masala",
    source: "AllRecipes",
    url: "https://www.allrecipes.com/recipe/228293/curry-stand-chicken-tikka-masala/",
  },
  {
    name: "Easy Butter Chicken",
    source: "BBC Good Food",
    url: "https://www.bbcgoodfood.com/recipes/easy-butter-chicken",
  },
  {
    name: "Paneer Butter Masala",
    source: "Hebbars Kitchen",
    url: "https://hebbarskitchen.com/paneer-butter-masala-recipe/",
  },
  {
    name: "Dal Tadka",
    source: "Indian Healthy",
    url: "https://www.indianhealthyrecipes.com/dal-tadka-recipe/",
  },
];

function RecipePage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [cartItems, setCartItems] = useState<any[] | null>(null);
  const [recipeTitle, setRecipeTitle] = useState<string>("");
  const [servings, setServings] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const handleExtract = async (targetUrl = url) => {
    const cleanUrl = targetUrl.trim();
    if (!cleanUrl) return;

    setLoading(true);
    setErrorMsg(null);
    setCartItems(null);
    setSessionId(null);
    setActiveStep(0);

    // Animate steps progression to show "AI processing" for the demo
    const timer1 = setTimeout(() => setActiveStep(1), 1200);
    const timer2 = setTimeout(() => setActiveStep(2), 2500);

    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: cleanUrl,
          input_type: "url",
        }),
      });

      if (!res.ok) {
        let errDetail = `Server error (${res.status})`;
        try {
          const errData = await res.json();
          errDetail = errData.message || errData.detail || errDetail;
        } catch {}
        throw new Error(errDetail);
      }

      const data = await res.json();

      clearTimeout(timer1);
      clearTimeout(timer2);
      setActiveStep(3); // All done!

      const intents = data.intents ?? [];
      const flatCart = intents.flatMap((g: any) => g.cart ?? []);
      const flatUnavailable = intents.flatMap((g: any) => g.unavailable_items ?? []);

      setCartItems(flatCart);
      setSessionId(data.session_id);

      const firstIntent = intents[0];
      setRecipeTitle(firstIntent?.context_summary || "Parsed Recipe");
      setServings(data.servings || firstIntent?.servings || 4);

      // Save to localStorage history
      saveToHistory({
        session_id: data.session_id,
        saved_at: new Date().toISOString(),
        intent_type: "recipe",
        context_summary: firstIntent?.context_summary || "Parsed Recipe",
        total_price_inr: data.total_price_inr,
        item_count: flatCart.length,
        cart: flatCart,
        unavailable_items: flatUnavailable,
        summary: data.summary || "",
      });
      window.dispatchEvent(new Event("cart-history-updated"));
    } catch (err: any) {
      clearTimeout(timer1);
      clearTimeout(timer2);
      setErrorMsg(err.message || "Failed to extract recipe.");
      setActiveStep(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Hackathon Pitch Banner */}
        <div className="mb-8 flex items-center justify-between rounded-xl border border-brand/20 bg-brand/5 px-4 py-3">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-brand" />
            <span className="text-sm font-medium text-foreground">Recipe-to-Cart AI Pipeline</span>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-[10px] font-black text-amber-800 uppercase tracking-wider">
            <Sparkles className="h-3 w-3" /> Pilot Feature
          </div>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            Smart Recipe Cart
          </h1>
          <p className="mt-3 text-lg text-muted-foreground max-w-2xl">
            Drop any recipe link below. Our AI extracts the ingredients, scales them to your servings, and maps them to exact Amazon SKUs instantly.
          </p>
        </div>

        {/* Input Area */}
        <div className="rounded-3xl border border-border bg-card p-2 shadow-lg shadow-brand/5 transition-all focus-within:ring-2 focus-within:ring-brand/50 focus-within:border-brand/50">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                <Utensils className="h-5 w-5 text-muted-foreground" />
              </div>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="h-14 w-full rounded-2xl bg-transparent pl-12 pr-4 text-base outline-none placeholder:text-muted-foreground/70"
                placeholder="Paste any recipe URL (e.g., AllRecipes, BBC Good Food)..."
                disabled={loading}
              />
            </div>
            <button
              onClick={() => handleExtract()}
              disabled={loading || !url.trim()}
              className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-foreground px-8 text-base font-bold text-background transition-all hover:bg-foreground/90 disabled:opacity-50 sm:w-auto"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Generate Cart
                  <Zap className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Suggestion Chips */}
        <div className="mt-6">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" /> Try a sample recipe
          </p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_RECIPES.map((recipe) => (
              <button
                key={recipe.name}
                onClick={() => {
                  setUrl(recipe.url);
                  handleExtract(recipe.url);
                }}
                className="group flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-sm transition-all hover:border-brand/50 hover:bg-brand/5 hover:shadow-sm"
              >
                <span className="font-semibold text-foreground group-hover:text-brand transition-colors">{recipe.name}</span>
                <span className="text-xs text-muted-foreground border-l border-border pl-2">{recipe.source}</span>
              </button>
            ))}
          </div>
        </div>

        {/* AI Pipeline Visualization */}
        {activeStep !== null && (
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {steps.map((s, i) => {
              const done = i < (activeStep ?? 0);
              const current = i === activeStep;
              return (
                <div
                  key={s.title}
                  className={`relative overflow-hidden flex items-start gap-4 rounded-2xl border p-5 transition-all duration-500 ${
                    current
                      ? "border-brand bg-brand/5 shadow-md scale-[1.02]"
                      : done
                        ? "border-border bg-surface opacity-100"
                        : "border-dashed border-border/60 bg-transparent opacity-40"
                  }`}
                >
                  {/* Background gradient for active step */}
                  {current && (
                    <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-brand/20 blur-xl animate-pulse" />
                  )}

                  <div
                    className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl transition-all duration-300 ${
                      done
                        ? "bg-brand text-white shadow-sm"
                        : current
                          ? "bg-foreground text-background shadow-lg animate-bounce-subtle"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {done ? <Check className="h-6 w-6" /> : <s.icon className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1 pt-1">
                    <div className={`text-base font-bold ${current ? "text-foreground" : done ? "text-foreground" : "text-muted-foreground"}`}>
                      {s.title}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{s.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div className="mt-8 flex gap-4 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700 shadow-sm animate-in fade-in slide-in-from-bottom-4">
            <AlertCircle className="h-6 w-6 shrink-0 text-red-600" />
            <div>
              <h3 className="font-bold text-lg">Extraction Failed</h3>
              <p className="mt-1 text-sm font-medium text-red-600/80">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Resulting Cart */}
        {cartItems && (
          <div className="mt-12 rounded-3xl border border-border bg-card shadow-xl shadow-brand/5 overflow-hidden animate-in fade-in zoom-in-95 duration-500">
            {/* Header section of the cart */}
            <div className="flex flex-col gap-4 border-b border-border bg-surface/50 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-bold text-brand mb-2">
                  <Check className="h-3 w-3" /> Recipe Processed Successfully
                </div>
                <h2 className="text-2xl font-black text-foreground">{recipeTitle}</h2>
                <p className="mt-1 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Utensils className="h-4 w-4" /> Scaled for <span className="text-foreground font-bold">{servings} servings</span>
                </p>
              </div>
              <div className="text-left sm:text-right">
                <div className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Est. Total Cost</div>
                <div className="text-4xl font-black text-brand">
                  ₹{cartItems.reduce((s, i) => s + (i.total_price_inr || 0), 0).toFixed(0)}
                </div>
              </div>
            </div>

            {/* List of matched items */}
            <div className="bg-background">
              <div className="px-6 py-3 border-b border-border bg-surface/30 flex items-center justify-between text-xs font-bold uppercase text-muted-foreground">
                <span>{cartItems.length} Smart Matches Found</span>
                <span>Price</span>
              </div>
              <ul className="divide-y divide-border max-h-[500px] overflow-y-auto">
                {cartItems.map((it, idx) => (
                  <li
                    key={it.sku + idx}
                    className="grid grid-cols-[1fr_auto] items-center gap-4 px-6 py-4 transition-colors hover:bg-surface/50"
                  >
                    <div className="flex items-start gap-4 min-w-0">
                      {/* Fake Image Placeholder matching Amazon style */}
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-border bg-surface/50 text-xl shadow-sm">
                        📦
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="truncate text-base font-bold text-foreground capitalize">{it.name}</h4>
                          <span className="inline-flex shrink-0 items-center rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-700">
                            <Zap className="mr-0.5 h-2.5 w-2.5" /> AI Matched
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                          <span className="font-semibold text-foreground bg-surface px-1.5 rounded">
                            {it.quantity_units} {it.unit}
                          </span>
                          <span>•</span>
                          <span className="truncate">{it.brand || "Generic"}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-lg font-black text-foreground text-right shrink-0">
                      ₹{it.total_price_inr}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Checkout / Review Action */}
            <div className="bg-surface/50 p-6 border-t border-border flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground hidden sm:block">
                All quantities automatically rounded up to nearest available SKU.
              </p>
              {sessionId && (
                <Link
                  to="/cart/$id"
                  params={{ id: sessionId }}
                  className="inline-flex h-12 w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-brand px-8 text-base font-bold text-white shadow-lg transition-all hover:scale-105 hover:bg-brand/90 hover:shadow-brand/25"
                >
                  Review & Checkout Cart
                  <ArrowRight className="h-5 w-5" />
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}