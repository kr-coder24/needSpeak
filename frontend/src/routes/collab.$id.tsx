import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Check,
  Copy,
  QrCode,
  UserPlus,
  X,
  Users,
  Sparkles,
  ArrowRight,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Info,
  Share2,
  Zap,
  ShieldCheck,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { AppShell } from "@/components/layout/AppShell";

export const Route = createFileRoute("/collab/$id")({
  head: () => ({
    meta: [
      { title: "SplitCart — Shared Collaborative Shopping" },
      {
        name: "description",
        content:
          "Collaborative shopping carts for parties, roommates, and groups. Auto-rebalance budgets in real-time.",
      },
      { property: "og:title", content: "SplitCart — Shop Together" },
      {
        property: "og:description",
        content: "AI-powered collaborative cart splits and budget guards.",
      },
    ],
  }),
  component: CollabPage,
});

interface Item {
  id: number;
  name: string;
  price: number;
  qty: string;
  addedBy: string;
  contributorColor: string;
}

interface Contributor {
  name: string;
  color: string;
  added: number;
  spent: number;
  you?: boolean;
}

const INITIAL_ITEMS: Item[] = [
  {
    id: 1,
    name: "Coca-Cola (6-Pack cans)",
    price: 240,
    qty: "2 packs",
    addedBy: "Tushar",
    contributorColor: "bg-brand",
  },
  {
    id: 2,
    name: "Lay's Magic Masala (Large)",
    price: 180,
    qty: "3 bags",
    addedBy: "Aman",
    contributorColor: "bg-chart-2",
  },
  {
    id: 3,
    name: "Paper Cups & Dinner Plates",
    price: 120,
    qty: "1 combo pack",
    addedBy: "Priya",
    contributorColor: "bg-chart-4",
  },
  {
    id: 4,
    name: "Cadbury Celebrations Assorted",
    price: 510,
    qty: "1 large pack",
    addedBy: "Tushar",
    contributorColor: "bg-brand",
  },
];

const INITIAL_CONTRIBUTORS: Contributor[] = [
  { name: "Tushar", color: "bg-brand", added: 2, spent: 750, you: true },
  { name: "Aman", color: "bg-chart-2", added: 1, spent: 180 },
  { name: "Priya", color: "bg-chart-4", added: 1, spent: 120 },
];

function CollabPage() {
  const { id: cartId } = Route.useParams();

  // Interactive Simulation States
  const [items, setItems] = useState<Item[]>(INITIAL_ITEMS);
  const [contributors, setContributors] = useState<Contributor[]>(INITIAL_CONTRIBUTORS);
  const [budget, setBudget] = useState<number>(1500);
  const [simState, setSimState] = useState<"idle" | "added" | "swapped">("idle");

  // Modal / Share States
  const [showQR, setShowQR] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newCartName, setNewCartName] = useState("");
  const [newCartBudget, setNewCartBudget] = useState("1000");

  const totalSpent = items.reduce((sum, item) => sum + item.price, 0);
  const budgetPercentage = Math.min(100, (totalSpent / budget) * 100);

  // Trigger copy URL
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/collab/${cartId}`
      : `/collab/${cartId}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = shareUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  // Run simulation sequence
  const runAddSimulation = () => {
    if (simState !== "idle") return;

    // Simulate Aman adding Belgian Truffles
    const truffleItem: Item = {
      id: 5,
      name: "Premium Belgian Cocoa Truffles",
      price: 480,
      qty: "1 box",
      addedBy: "Aman",
      contributorColor: "bg-chart-2",
    };

    setItems((prev) => [...prev, truffleItem]);
    setContributors((prev) =>
      prev.map((c) => (c.name === "Aman" ? { ...c, added: c.added + 1, spent: c.spent + 480 } : c)),
    );
    setSimState("added");
  };

  const runSwapSimulation = () => {
    if (simState !== "added") return;

    // Simulate swapping Truffles for Amul Dark Chocolate to save money
    setItems((prev) =>
      prev.map((item) =>
        item.id === 5
          ? { ...item, name: "Amul Dark Chocolate (AI Suggested swap)", price: 150, qty: "2 bars" }
          : item,
      ),
    );
    setContributors((prev) =>
      prev.map((c) => (c.name === "Aman" ? { ...c, spent: c.spent - 480 + 150 } : c)),
    );
    setSimState("swapped");
  };

  const resetSimulation = () => {
    setItems(INITIAL_ITEMS);
    setContributors(INITIAL_CONTRIBUTORS);
    setSimState("idle");
  };

  // Auto handle creation submit
  const handleCreateCartSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCartName) return;
    setCreateModalOpen(false);
    alert(
      `SplitCart "${newCartName}" created with budget ₹${newCartBudget}! Share the link to invite friends.`,
    );
  };

  return (
    <AppShell>
      <div className="relative overflow-hidden bg-background">
        {/* Ambient background glows */}
        <div className="absolute top-1/4 left-1/2 -z-10 h-96 w-96 -translate-x-1/2 rounded-full bg-brand/5 blur-3xl" />
        <div className="absolute top-10 right-10 -z-10 h-72 w-72 rounded-full bg-chart-2/5 blur-3xl" />

        {/* HERO SECTION */}
        <div className="mx-auto max-w-5xl px-4 pt-16 pb-12 sm:px-6 lg:px-8 text-center space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/5 px-3 py-1 text-xs font-semibold text-brand tracking-wide uppercase animate-pulse">
            <Users className="h-3 w-3" />
            <span>Introducing SplitCart Beta</span>
          </div>

          <h1 className="font-display text-4xl sm:text-6xl font-bold tracking-tight text-foreground leading-[1.1] max-w-4xl mx-auto">
            Shop together. Split seamlessly.{" "}
            <span className="italic text-brand">Stay on budget.</span>
          </h1>

          <p className="max-w-2xl mx-auto text-base sm:text-lg text-muted-foreground leading-relaxed">
            Create a shared cart, invite friends or roommates, and build your checkout list in
            real-time. Our built-in AI safeguards your budget limits and suggests alternative items
            automatically.
          </p>

          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <button
              onClick={() => setCreateModalOpen(true)}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-foreground px-6 text-sm font-semibold text-background transition-transform duration-200 hover:scale-[1.02] hover:bg-foreground/95 cursor-pointer shadow-md"
            >
              Start a SplitCart
              <ArrowRight className="h-4 w-4" />
            </button>
            <a
              href="#sandbox"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-border bg-card px-6 text-sm font-medium text-foreground transition-colors hover:bg-surface"
            >
              Try Interactive Demo
            </a>
          </div>
        </div>

        {/* INTERACTIVE DEMO VIEWPORT */}
        <div id="sandbox" className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-border bg-card shadow-lg overflow-hidden">
            {/* Header of Simulated App */}
            <div className="border-b border-border bg-surface/50 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-brand">
                  Live SplitCart Simulator
                </span>
                <h2 className="text-xl font-bold font-display text-foreground">
                  {simState === "idle" ? "IPL Finals Party Cart" : "IPL Party — Rebalanced"}
                </h2>
              </div>

              {/* Share Controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyLink}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border/80 bg-background px-3 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  {copySuccess ? (
                    <Check className="h-3.5 w-3.5 text-success" />
                  ) : (
                    <Share2 className="h-3.5 w-3.5" />
                  )}
                  <span>{copySuccess ? "Copied!" : "Invite link"}</span>
                </button>
                <button
                  onClick={() => setShowQR((o) => !o)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border/80 bg-background px-3 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <QrCode className="h-3.5 w-3.5" />
                  <span>QR</span>
                </button>
              </div>
            </div>

            {/* Simulated Live Action Controls */}
            <div className="bg-brand/5 px-6 py-4 border-b border-border flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-xs font-medium text-brand">
                  {simState === "idle" &&
                    "Simulate a live action to see how the shared cart behaves!"}
                  {simState === "added" && "⚠️ Aman added an item that exceeded the budget limit!"}
                  {simState === "swapped" &&
                    "✅ Budget Guard rebalanced the cart! AI swap completed."}
                </span>
              </div>

              <div className="flex gap-2">
                {simState === "idle" && (
                  <button
                    onClick={runAddSimulation}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md bg-brand px-3 text-xs font-semibold text-brand-foreground hover:bg-brand/95 cursor-pointer"
                  >
                    Simulate Aman adding Truffles (+₹480)
                  </button>
                )}
                {simState === "added" && (
                  <button
                    onClick={runSwapSimulation}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer"
                  >
                    Apply AI Budget Swap (-₹330)
                  </button>
                )}
                {simState !== "idle" && (
                  <button
                    onClick={resetSimulation}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-surface cursor-pointer"
                  >
                    Reset Demo
                  </button>
                )}
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Dynamic Budget Safeguard Meter */}
              <div className="space-y-2">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                    Shared Budget
                    {totalSpent > budget && (
                      <span className="inline-flex items-center gap-1 rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
                        <AlertTriangle className="h-3 w-3" /> Over Budget
                      </span>
                    )}
                  </span>
                  <div className="text-right">
                    <span
                      className={`text-lg font-bold ${totalSpent > budget ? "text-destructive" : "text-foreground"}`}
                    >
                      ₹{totalSpent}
                    </span>
                    <span className="text-muted-foreground"> / ₹{budget}</span>
                  </div>
                </div>

                {/* Progress bar with segments */}
                <div className="relative h-3 w-full overflow-hidden rounded-full bg-surface">
                  <div className="flex h-full w-full">
                    {contributors.map((c) => (
                      <div
                        key={c.name}
                        className={`${c.color} transition-all duration-500`}
                        style={{ width: `${(c.spent / budget) * 100}%` }}
                      />
                    ))}
                  </div>
                </div>

                {/* Contributor tags below meter */}
                <div className="flex flex-wrap gap-4 pt-1 text-xs">
                  {contributors.map((c) => (
                    <div key={c.name} className="flex items-center gap-1.5">
                      <span className={`h-2.5 w-2.5 rounded-full ${c.color}`} />
                      <span className="font-semibold text-foreground">
                        {c.name} {c.you ? "(You)" : ""}
                      </span>
                      <span className="text-muted-foreground">₹{c.spent} spent</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Assistant Warning Card */}
              {simState === "added" && (
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 space-y-3 animate-in fade-in duration-300">
                  <div className="flex gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">
                        AI Budget Guard triggered
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Aman's addition of "Premium Belgian Cocoa Truffles" has put the cart ₹30
                        over budget limit.
                      </p>
                    </div>
                  </div>
                  <div className="border-t border-destructive/10 pt-3 flex items-center justify-between flex-wrap gap-2 text-xs">
                    <span className="text-muted-foreground">
                      💡 Suggested swap: Swap for{" "}
                      <span className="font-semibold text-foreground">Amul Dark Chocolate</span>{" "}
                      (saves ₹330)
                    </span>
                    <button
                      onClick={runSwapSimulation}
                      className="text-brand font-semibold hover:underline inline-flex items-center gap-0.5"
                    >
                      Swap now <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}

              {simState === "swapped" && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-2 animate-in fade-in duration-300">
                  <div className="flex gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">
                        Cart Rebalanced Successfully
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Item replaced. Cart is now back within your ₹1,500 limit. Remaining
                        capacity: <span className="font-semibold">₹300</span>.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Interactive Shared Items list */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold tracking-wide text-foreground">
                  Items in Shared Cart
                </h3>
                <div className="rounded-2xl border border-border bg-background overflow-hidden">
                  <ul className="divide-y divide-border">
                    {items.map((item) => {
                      const c = contributors.find((contrib) => contrib.name === item.addedBy);
                      return (
                        <li
                          key={item.id}
                          className="flex items-center justify-between gap-4 p-4 hover:bg-surface/30 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              className={`h-7 w-7 rounded-full ${c?.color || "bg-brand"} grid place-items-center text-xs font-bold text-background shrink-0`}
                            >
                              {item.addedBy[0]}
                            </span>
                            <div className="min-w-0">
                              <h4 className="text-sm font-medium text-foreground truncate">
                                {item.name}
                              </h4>
                              <p className="text-xs text-muted-foreground">
                                {item.qty} · added by {item.addedBy}
                              </p>
                            </div>
                          </div>
                          <span className="text-sm font-semibold text-foreground shrink-0">
                            ₹{item.price}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FEATURE EXPLANATORY CARDS */}
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8 border-t border-border/60">
          <h3 className="font-display text-2xl sm:text-3xl font-bold text-center text-foreground mb-12">
            Why SplitCarts are game-changing
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="rounded-2xl border border-border/80 bg-card p-6 space-y-4">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <Users className="h-5 w-5" />
              </div>
              <h4 className="text-lg font-semibold font-display text-foreground">
                Zero Coordination
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Just send your party guests the link. They add what they want directly to the
                cart—no more group texts or screenshot sharing required.
              </p>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card p-6 space-y-4">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                <Zap className="h-5 w-5" />
              </div>
              <h4 className="text-lg font-semibold font-display text-foreground">
                AI Budget Safes
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Set budget caps and parameters. If an item exceeds limits, AI automatically warns
                participants and proposes wallet-friendly alternative swaps.
              </p>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card p-6 space-y-4">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h4 className="text-lg font-semibold font-display text-foreground">
                Instant Equal Splits
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Ready to checkout? Split equally, by item ownership, or custom ratios. One checkout
                link, completely configured and itemized.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CREATE CART MODAL SHOWCASE */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4 relative">
            <button
              onClick={() => setCreateModalOpen(false)}
              className="absolute right-4 top-4 h-6 w-6 rounded-full text-muted-foreground hover:text-foreground flex items-center justify-center border border-border bg-surface"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            <div className="space-y-1">
              <h3 className="text-lg font-bold font-display text-foreground">
                Start a Collaborative SplitCart
              </h3>
              <p className="text-xs text-muted-foreground">
                Setup parameters, configure limits, and invite contributors.
              </p>
            </div>

            <form onSubmit={handleCreateCartSubmit} className="space-y-4">
              <div className="space-y-1">
                <label htmlFor="cart-name" className="text-xs font-semibold text-foreground">
                  Cart / Occasion Name
                </label>
                <input
                  id="cart-name"
                  type="text"
                  required
                  placeholder="e.g. Roommates Grocery, Weekend BBQ"
                  value={newCartName}
                  onChange={(e) => setNewCartName(e.target.value)}
                  className="w-full h-10 rounded-lg border border-border bg-surface px-3 text-sm focus:border-brand focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="cart-budget" className="text-xs font-semibold text-foreground">
                  Budget Limit (₹)
                </label>
                <input
                  id="cart-budget"
                  type="number"
                  required
                  placeholder="e.g. 2000"
                  value={newCartBudget}
                  onChange={(e) => setNewCartBudget(e.target.value)}
                  className="w-full h-10 rounded-lg border border-border bg-surface px-3 text-sm focus:border-brand focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full h-10 rounded-lg bg-foreground text-background text-sm font-semibold transition-colors hover:bg-foreground/90"
              >
                Launch Cart
              </button>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
