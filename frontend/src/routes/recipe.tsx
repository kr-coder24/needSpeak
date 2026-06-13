import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Check, ChefHat, ListChecks, ShoppingCart, Loader2, AlertCircle } from "lucide-react";
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
  { icon: ChefHat, title: "Extract ingredients", desc: "Parsing recipe HTML" },
  { icon: ListChecks, title: "Compute quantities", desc: "Scaling for servings" },
  { icon: ShoppingCart, title: "Build cart", desc: "Matching products" },
];

const SUGGESTED_RECIPES = [
  {
    name: "Chicken Tikka Masala (AllRecipes)",
    url: "https://www.allrecipes.com/recipe/228293/curry-stand-chicken-tikka-masala/",
  },
  {
    name: "Easy Butter Chicken (BBC Good Food)",
    url: "https://www.bbcgoodfood.com/recipes/easy-butter-chicken",
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

    // Animate steps progression
    const timer1 = setTimeout(() => setActiveStep(1), 1000);
    const timer2 = setTimeout(() => setActiveStep(2), 2000);

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
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-semibold tracking-tight">RecipeCart</h1>
        <p className="mt-2 text-muted-foreground">
          Paste any recipe URL — get a cart with the right quantities.
        </p>

        {/* Suggestion Chips */}
        <div className="mt-4 flex flex-wrap gap-2 items-center">
          <span className="text-xs font-medium text-muted-foreground">Try these:</span>
          {SUGGESTED_RECIPES.map((recipe) => (
            <button
              key={recipe.name}
              onClick={() => {
                setUrl(recipe.url);
                handleExtract(recipe.url);
              }}
              className="rounded-full border border-border bg-surface hover:border-foreground hover:bg-card px-3 py-1 text-xs transition-colors"
            >
              {recipe.name}
            </button>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-card p-4 shadow-soft">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="h-11 flex-1 rounded-lg border border-border bg-background px-4 text-sm outline-none focus:border-foreground"
              placeholder="Paste recipe URL (AllRecipes or BBCGoodFood)..."
              disabled={loading}
            />
            <button
              onClick={() => handleExtract()}
              disabled={loading || !url.trim()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-foreground px-5 text-sm font-medium text-background hover:bg-foreground/90 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Extracting...
                </>
              ) : (
                <>
                  Extract ingredients
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>

          {/* Pipeline */}
          {activeStep !== null && (
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {steps.map((s, i) => {
                const done = i < (activeStep ?? 0);
                const current = i === activeStep;
                return (
                  <div
                    key={s.title}
                    className={`flex items-start gap-3 rounded-xl border p-4 transition-all duration-300 ${
                      current
                        ? "border-foreground bg-surface shadow-sm"
                        : done
                          ? "border-border bg-background opacity-80"
                          : "border-dashed border-border bg-background opacity-50"
                    }`}
                  >
                    <div
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors ${
                        done
                          ? "bg-brand text-brand-foreground"
                          : current
                            ? "bg-foreground text-background"
                            : "bg-surface text-muted-foreground"
                      }`}
                    >
                      {done ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{s.title}</div>
                      <div className="text-xs text-muted-foreground">{s.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mt-6 flex gap-3 rounded-xl border border-red-200 bg-red-50/50 p-4 text-sm text-red-800">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
            <div>
              <h3 className="font-semibold">Extraction failed</h3>
              <p className="mt-1 text-red-700/90">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Resulting cart */}
        {cartItems && (
          <div className="mt-8 rounded-2xl border border-border bg-card animate-fade-in">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <div className="text-sm text-muted-foreground">Recipe</div>
                <div className="text-lg font-semibold">{recipeTitle} · {servings} servings</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Estimated</div>
                <div className="text-lg font-semibold">
                  ₹{cartItems.reduce((s, i) => s + (i.total_price_inr || 0), 0).toFixed(0)}
                </div>
              </div>
            </div>
            <ul className="divide-y divide-border max-h-96 overflow-y-auto">
              {cartItems.map((it) => (
                <li
                  key={it.sku + it.name}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium capitalize">{it.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {it.quantity_units} {it.unit} • {it.brand}
                    </div>
                  </div>
                  <div className="text-sm font-semibold">₹{it.total_price_inr}</div>
                </li>
              ))}
            </ul>
            <div className="border-t border-border p-4">
              {sessionId && (
                <Link
                  to="/cart/$id"
                  params={{ id: sessionId }}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-foreground text-sm font-medium text-background hover:bg-foreground/90 transition-colors"
                >
                  Review cart
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

