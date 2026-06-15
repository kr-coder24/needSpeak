import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Check,
  Copy,
  GitMerge,
  Minus,
  PackageCheck,
  Plus,
  QrCode,
  ShoppingBasket,
  Sparkles,
  Trash2,
  Users,
  Wifi,
  WifiOff,
  X,
  Mail,
  Phone,
  Send,
  Leaf,
  Handshake,
  RefreshCw,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { useCollabLocal } from "@/hooks/useCollabLocal";
import { useCollabStore } from "@/store/useCollabStore";
import {
  acceptCommunityDeal,
  getCommunityDeals,
  type BulkDealMatch,
} from "@/lib/collab-api";

export const Route = createFileRoute("/collab/$id")({
  component: CollabPage,
});

const contributorColors = [
  "bg-foreground/80",
  "bg-foreground/60",
  "bg-brand",
  "bg-muted-foreground",
  "bg-foreground/45",
];

const units = ["piece", "pack", "g", "kg", "ml", "l"];

const UNIT_PRESETS: Array<{ tokens: string[]; units: string[]; defaultUnit: string }> = [
  {
    tokens: ["milk", "doodh", "water", "juice", "oil", "ghee", "cream", "coke", "cola", "drink"],
    units: ["ml", "l"],
    defaultUnit: "ml",
  },
  {
    tokens: ["rice", "atta", "flour", "sugar", "salt", "paneer", "butter", "chicken", "chips"],
    units: ["g", "kg"],
    defaultUnit: "g",
  },
  {
    tokens: ["bun", "buns", "bread", "notebook", "pen", "pencil", "eraser", "sharpener"],
    units: ["piece", "pack"],
    defaultUnit: "piece",
  },
];
const DEFAULT_UNIT_PRESET = { units, defaultUnit: "piece" };

function getAllowedUnits(productName: string) {
  const normalized = productName.toLowerCase();
  const preset = UNIT_PRESETS.find((entry) =>
    entry.tokens.some((token) => normalized.includes(token)),
  );
  return preset || DEFAULT_UNIT_PRESET;
}

function quantityStep(unit: string) {
  if (unit === "g" || unit === "ml") return 100;
  if (unit === "kg" || unit === "l") return 0.5;
  return 1;
}

function formatQuantity(value: number) {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
}

function CollabPage() {
  const { id: sessionId } = Route.useParams();
  const navigate = useNavigate();
  const [contributorId, setContributorId] = useState<string | null>(null);
  const [joinName, setJoinName] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [productName, setProductName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState("piece");
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState("");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviting, setInviting] = useState(false);
  const [showCommunityDeals, setShowCommunityDeals] = useState(false);
  const [communityDeals, setCommunityDeals] = useState<BulkDealMatch[]>([]);
  const [isLoadingDeals, setIsLoadingDeals] = useState(false);

  useEffect(() => {
    setContributorId(localStorage.getItem(`collab_${sessionId}_contributor`));
  }, [sessionId]);

  const {
    session,
    splits,
    suggestions,
    notice,
    isConnected,
    error,
    addItems,
    addSuggestion,
    dismissSuggestions,
    removeItem,
    updateBudget,
    updateQuantity,
    acceptSubstitution,
    rejectSubstitution,
  } = useCollabLocal(sessionId, contributorId || undefined);

  const joinSessionLocal = useCollabStore((s) => s.joinSession);

  useEffect(() => {
    if (session) setBudgetDraft(String(session.total_budget_inr));
  }, [session]);

  const unitPreset = useMemo(() => getAllowedUnits(productName), [productName]);

  useEffect(() => {
    if (productName.trim() && !unitPreset.units.includes(unit)) {
      setUnit(unitPreset.defaultUnit);
    }
  }, [productName, unit, unitPreset.defaultUnit, unitPreset.units]);

  const handleJoin = async (event: FormEvent) => {
    event.preventDefault();
    if (!joinName.trim()) return;
    setIsJoining(true);
    try {
      const contributor = joinSessionLocal(sessionId, joinName.trim());
      if (!contributor) {
        alert("This group cart was not found on this device.");
        return;
      }
      localStorage.setItem(`collab_${sessionId}_contributor`, contributor.id);
      setContributorId(contributor.id);
    } catch (joinError) {
      alert(joinError instanceof Error ? joinError.message : "Could not join this cart.");
    } finally {
      setIsJoining(false);
    }
  };

  const submitDemand = (event: FormEvent) => {
    event.preventDefault();
    if (!productName.trim() || quantity <= 0) return;
    addItems([{ name: productName.trim(), quantity, unit }]);
    setProductName("");
    setQuantity(1);
  };

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() && !invitePhone.trim()) return;

    setInviting(true);
    try {
      const recipients = [];
      if (inviteEmail.trim()) recipients.push({ type: "email", value: inviteEmail.trim() });
      if (invitePhone.trim()) recipients.push({ type: "sms", value: invitePhone.trim() });

      const res = await fetch(`/api/collab/${sessionId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipients, contributor_id: contributorId }),
      });

      if (!res.ok) throw new Error("Failed to send invites");

      const data = await res.json();
      const successCount = data.results.filter((r: any) => r.success).length;
      toast.success(`Sent ${successCount} invite${successCount !== 1 ? "s" : ""}!`);
      setInviteEmail("");
      setInvitePhone("");
      setShowInviteModal(false);
    } catch (err) {
      toast.error("Could not send invites. Try again.");
    } finally {
      setInviting(false);
    }
  };

  if (!contributorId) {
    return (
      <AppShell>
        <div className="flex min-h-[72vh] items-center justify-center px-4 py-10">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-xl">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand">
              <Users className="h-7 w-7" />
            </div>
            <h1 className="text-center text-3xl font-bold">Join SplitCart</h1>
            <p className="mt-2 text-center text-muted-foreground">
              Add your demand. NeedSpeak will resolve, merge, and split it live.
            </p>
            <form onSubmit={handleJoin} className="mt-7 space-y-4">
              <label className="block text-sm font-semibold" htmlFor="join-name">
                Your name
              </label>
              <input
                id="join-name"
                value={joinName}
                onChange={(event) => setJoinName(event.target.value)}
                className="h-12 w-full rounded-xl border border-input bg-background px-4 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                placeholder="e.g. Rahul"
                autoFocus
                required
              />
              <button
                type="submit"
                disabled={isJoining || !joinName.trim()}
                className="h-12 w-full cursor-pointer rounded-xl bg-foreground px-5 font-semibold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isJoining ? "Joining..." : "Join live cart"}
              </button>
            </form>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!session) {
    return (
      <AppShell>
        <div className="flex min-h-[65vh] items-center justify-center px-4">
          {error ? (
            <div className="max-w-md rounded-3xl border border-destructive/20 bg-destructive/5 p-8 text-center">
              <WifiOff className="mx-auto h-10 w-10 text-destructive" />
              <h1 className="mt-4 text-2xl font-bold">Could not sync this cart</h1>
              <p className="mt-2 text-muted-foreground">{error}</p>
              <div className="mt-6 flex justify-center gap-3">
                <button
                  onClick={() => {
                    localStorage.removeItem(`collab_${sessionId}_contributor`);
                    setContributorId(null);
                  }}
                  className="cursor-pointer rounded-xl border border-border px-4 py-2 font-medium hover:bg-surface"
                >
                  Join again
                </button>
                <button
                  onClick={() => navigate({ to: "/" })}
                  className="cursor-pointer rounded-xl bg-foreground px-4 py-2 font-medium text-background"
                >
                  Go home
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <div className="mx-auto h-11 w-11 animate-spin rounded-full border-4 border-brand border-r-transparent" />
              <p className="mt-4 font-medium text-muted-foreground">Opening the live cart...</p>
            </div>
          )}
        </div>
      </AppShell>
    );
  }

  const shareUrl =
    typeof window === "undefined"
      ? `/collab/join/${session.share_code}`
      : `${window.location.origin}/collab/join/${session.share_code}`;
  const totalCost = session.items.reduce(
    (sum, item) => sum + item.estimated_price_inr * item.quantity,
    0,
  );
  const totalRequests = session.items.reduce((sum, item) => sum + item.demands.length, 0);
  const mergeSavings = session.items.reduce((sum, item) => sum + item.merge_savings_inr, 0);
  const budgetPercent =
    session.total_budget_inr > 0 ? Math.min(100, (totalCost / session.total_budget_inr) * 100) : 0;
  const isHost = session.host_id === contributorId;
  const activeContributors = session.contributors.filter(
    (contributor) => contributor.status === "active",
  );
  const hasCommunity = Boolean(session.community_code);

  const loadCommunityDeals = async () => {
    if (!session.community_code) return;
    setIsLoadingDeals(true);
    try {
      const payload = await getCommunityDeals(session.community_code, session.session_id);
      setCommunityDeals(payload.deals);
    } catch {
      toast.error("Could not load community deals.");
    } finally {
      setIsLoadingDeals(false);
    }
  };

  const acceptDeal = async (category: string) => {
    if (!session.community_code) return;
    try {
      const payload = await acceptCommunityDeal(
        session.session_id,
        session.community_code,
        category,
      );
      setCommunityDeals(payload.deals);
      toast.success("Community deal accepted for this cart.");
    } catch {
      toast.error("Could not accept this deal.");
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                  isConnected ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                }`}
              >
                {isConnected ? (
                  <Wifi className="h-3.5 w-3.5" />
                ) : (
                  <WifiOff className="h-3.5 w-3.5" />
                )}
                {isConnected ? "Live sync" : "Reconnecting"}
              </span>
              <span className="text-sm text-muted-foreground">Hosted by {session.host_name}</span>
              {/* Demo: add a simulated friend so multi-user merging shows on one screen */}
              <button
                onClick={() => {
                  const presets = ["Rahul", "Priya", "Karan", "Sneha", "Arjun"];
                  const existing = new Set(session.contributors.map((c) => c.name));
                  const name = presets.find((n) => !existing.has(n)) || `Friend ${session.contributors.length}`;
                  const friend = joinSessionLocal(sessionId, name);
                  if (friend) {
                    localStorage.setItem(`collab_${sessionId}_contributor`, friend.id);
                    setContributorId(friend.id);
                    toast.success(`${name} joined the cart`);
                  }
                }}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold text-muted-foreground transition hover:border-brand/40 hover:text-brand"
              >
                <Plus className="h-3 w-3" />
                Simulate friend
              </button>
              {/* Demo: switch acting contributor to simulate multiple users */}
              {session.contributors.filter((c) => c.status === "active").length > 1 && (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/5 px-2 py-1">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-brand">Acting as</span>
                  <select
                    value={contributorId || ""}
                    onChange={(e) => {
                      const newId = e.target.value;
                      localStorage.setItem(`collab_${sessionId}_contributor`, newId);
                      setContributorId(newId);
                    }}
                    className="cursor-pointer rounded-md bg-transparent text-xs font-semibold text-foreground outline-none"
                  >
                    {session.contributors
                      .filter((c) => c.status === "active")
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}{c.id === session.host_id ? " (host)" : ""}
                        </option>
                      ))}
                  </select>
                </div>
              )}
              {hasCommunity && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-success/20 bg-success/10 px-3 py-1 text-xs font-bold text-success">
                  <Leaf className="h-3.5 w-3.5" />
                  {session.community_name || session.community_code}
                </span>
              )}
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
              {session.name}
            </h1>
            <p className="mt-1 text-muted-foreground">
              Everyone asks naturally. One optimized cart appears.
            </p>
          </div>

          <div className="relative flex gap-2">
            {hasCommunity && (
              <button
                onClick={() => {
                  setShowCommunityDeals(true);
                  void loadCommunityDeals();
                }}
                className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-success/20 bg-success/10 px-4 text-sm font-semibold text-success transition hover:bg-success/15"
              >
                <Handshake className="h-4 w-4" />
                Community deals
              </button>
            )}
            <button
              onClick={() => setShowInviteModal(true)}
              className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold transition hover:bg-surface"
            >
              <Send className="h-4 w-4" />
              Invite
            </button>
            <button
              onClick={copyLink}
              className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold transition hover:bg-surface"
            >
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Share link"}
            </button>
            <button
              onClick={() => setShowQr((value) => !value)}
              aria-label="Show QR code"
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl bg-foreground text-background transition hover:opacity-90"
            >
              {showQr ? <X className="h-4 w-4" /> : <QrCode className="h-4 w-4" />}
            </button>
            <AnimatePresence>
              {showQr && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="absolute right-0 top-14 z-30 w-64 rounded-3xl border border-border bg-card p-5 shadow-2xl"
                >
                  <QRCodeSVG
                    value={shareUrl}
                    size={180}
                    className="mx-auto rounded-xl bg-white p-2"
                  />
                  <p className="mt-3 text-center font-mono text-sm font-bold tracking-[0.22em]">
                    {session.share_code}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </header>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            icon={<Users className="h-5 w-5" />}
            label="Individual requests"
            value={String(totalRequests)}
            detail={`${activeContributors.length} contributors`}
          />
          <Metric
            icon={<GitMerge className="h-5 w-5" />}
            label="Merged products"
            value={String(session.items.length)}
            detail="Deduplicated by SKU"
          />
          <Metric
            icon={<Sparkles className="h-5 w-5" />}
            label="Merge savings"
            value={`Rs ${mergeSavings.toFixed(0)}`}
            detail="Fewer packs to buy"
          />
          <Metric
            icon={<Leaf className="h-5 w-5" />}
            label="Carbon footprint"
            value={`${session.carbon_score_kg.toFixed(2)} kg`}
            detail="CO2e transport"
          />
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-12">
          <aside className="space-y-6 lg:col-span-5">
            <section className="rounded-3xl border border-brand/15 bg-card p-5 shadow-sm sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Add your demand</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Product name, needed amount, and unit.
                  </p>
                </div>
                <ShoppingBasket className="h-6 w-6 text-brand" />
              </div>

              <form onSubmit={submitDemand} className="mt-5 space-y-4">
                <div>
                  <label htmlFor="product-name" className="mb-1.5 block text-sm font-semibold">
                    Product
                  </label>
                  <input
                    id="product-name"
                    value={productName}
                    onChange={(event) => setProductName(event.target.value)}
                    placeholder="Try milk, burger buns, or notebok"
                    className="h-11 w-full rounded-xl border border-input bg-background px-3 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                    disabled={!isConnected}
                    required
                  />
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-3">
                  <div>
                    <label
                      htmlFor="product-quantity"
                      className="mb-1.5 block text-sm font-semibold"
                    >
                      Needed quantity
                    </label>
                    <input
                      id="product-quantity"
                      type="number"
                      min="0.1"
                      step="any"
                      value={quantity}
                      onChange={(event) => setQuantity(Number(event.target.value) || 1)}
                      className="h-11 w-full rounded-xl border border-input bg-background px-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                      disabled={!isConnected}
                    />
                  </div>
                  <div>
                    <label htmlFor="product-unit" className="mb-1.5 block text-sm font-semibold">
                      Unit
                    </label>
                    <select
                      id="product-unit"
                      value={unit}
                      onChange={(event) => setUnit(event.target.value)}
                      className="h-11 w-full cursor-pointer rounded-xl border border-input bg-background px-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                      disabled={!isConnected}
                    >
                      {unitPreset.units.map((entry) => (
                        <option key={entry} value={entry}>
                          {entry}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={!isConnected || !productName.trim()}
                  className="inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-foreground px-4 font-semibold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  Resolve and merge
                </button>
              </form>

              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  ["milk", 600, "ml"],
                  ["burger buns", 2, "pack"],
                  ["notebok", 2, "piece"],
                  ["asdfghjkl", 1, "piece"],
                ].map(([name, amount, sampleUnit]) => (
                  <button
                    key={String(name)}
                    type="button"
                    onClick={() => {
                      setProductName(String(name));
                      setQuantity(Number(amount));
                      setUnit(String(sampleUnit));
                    }}
                    className="cursor-pointer rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition hover:border-brand/40 hover:bg-brand/5 hover:text-foreground"
                  >
                    {String(name)} {String(amount)} {String(sampleUnit)}
                  </button>
                ))}
              </div>

              {notice && (
                <div
                  className={`mt-4 flex gap-3 rounded-2xl border p-3 text-sm ${
                    notice.kind === "success"
                      ? "border-success/20 bg-success/5 text-success"
                      : notice.kind === "warning"
                        ? "border-border bg-muted text-foreground"
                        : "border-destructive/20 bg-destructive/5 text-destructive"
                  }`}
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{notice.message}</p>
                </div>
              )}
            </section>

            <AnimatePresence>
              {suggestions.length > 0 && (
                <motion.section
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="rounded-3xl border border-border bg-muted p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-bold">Did you mean?</h2>
                      <p className="text-sm text-muted-foreground">
                        The exact product was missing, but these are close.
                      </p>
                    </div>
                    <button
                      onClick={dismissSuggestions}
                      aria-label="Dismiss suggestions"
                      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full hover:bg-background/70"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-4 space-y-3">
                    {suggestions.flatMap((request) =>
                      request.suggestions.map((suggestion) => (
                        <button
                          key={suggestion.sku}
                          onClick={() => addSuggestion(request.request, suggestion)}
                          className="flex w-full cursor-pointer items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 text-left transition hover:border-brand/40 hover:shadow-sm"
                        >
                          <div>
                            <p className="font-bold">{suggestion.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {suggestion.reason} · {Math.round(suggestion.confidence * 100)}% match
                            </p>
                          </div>
                          <span className="shrink-0 text-sm font-bold">
                            Rs {suggestion.price_per_unit_inr.toFixed(0)}
                          </span>
                        </button>
                      )),
                    )}
                  </div>
                </motion.section>
              )}
            </AnimatePresence>

            <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold">Who owes what</h2>
                  <p className="text-sm text-muted-foreground">
                    Proportional to each person&apos;s requested demand.
                  </p>
                </div>
                <span className="text-xl font-black">Rs {totalCost.toFixed(0)}</span>
              </div>

              <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-surface">
                <div
                  className={`h-full rounded-full transition-all ${
                    totalCost > session.total_budget_inr && session.total_budget_inr > 0
                      ? "bg-destructive"
                      : "bg-brand"
                  }`}
                  style={{ width: `${budgetPercent}%` }}
                />
              </div>

              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>Shared budget</span>
                <span>
                  {session.total_budget_inr > 0
                    ? `Rs ${session.total_budget_inr.toFixed(0)}`
                    : "No limit"}
                </span>
              </div>

              {isHost && (
                <form
                  className="mt-4 flex gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    updateBudget(Math.max(0, Number(budgetDraft) || 0));
                  }}
                >
                  <input
                    aria-label="Shared budget"
                    type="number"
                    min="0"
                    value={budgetDraft}
                    onChange={(event) => setBudgetDraft(event.target.value)}
                    className="h-10 min-w-0 flex-1 rounded-xl border border-input bg-background px-3 outline-none focus:border-brand"
                  />
                  <button className="cursor-pointer rounded-xl border border-border px-4 text-sm font-semibold hover:bg-surface">
                    Update
                  </button>
                </form>
              )}

              <div className="mt-5 space-y-2">
                {splits.map((split, index) => (
                  <div
                    key={split.contributor_id}
                    className="flex items-center gap-3 rounded-2xl bg-surface/50 p-3"
                  >
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white ${contributorColors[index % contributorColors.length]}`}
                    >
                      {split.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">
                        {split.name}
                        {split.contributor_id === contributorId ? " (you)" : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {split.percent_of_total.toFixed(0)}% of cart
                        {split.merge_savings_inr > 0
                          ? ` · saved Rs ${split.merge_savings_inr.toFixed(0)}`
                          : ""}
                      </p>
                    </div>
                    <span className="font-black">Rs {split.amount_owed.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </section>
          </aside>

          <main className="lg:col-span-7">
            <section className="min-h-[640px] overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between border-b border-border bg-surface/35 px-5 py-4">
                <div>
                  <h2 className="text-xl font-bold">Merged live cart</h2>
                  <p className="text-sm text-muted-foreground">
                    Requests become purchasable package quantities.
                  </p>
                </div>
                <span className="rounded-full bg-background px-3 py-1 text-xs font-bold">
                  {session.items.length} SKUs
                </span>
              </div>

              {session.items.length === 0 ? (
                <div className="flex min-h-[540px] flex-col items-center justify-center px-8 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-surface text-muted-foreground">
                    <ShoppingBasket className="h-7 w-7" />
                  </div>
                  <h3 className="mt-5 text-xl font-bold">Waiting for demand</h3>
                  <p className="mt-2 max-w-sm text-muted-foreground">
                    Ask two people to add the same product in different amounts and watch NeedSpeak
                    merge the package count live.
                  </p>
                </div>
              ) : (
                <ul className="space-y-4 p-4 sm:p-5">
                  <AnimatePresence initial={false}>
                    {session.items.map((item) => {
                      const myDemand = item.demands.find(
                        (demand) => demand.contributor_id === contributorId,
                      );
                      const canRemove = Boolean(myDemand) || isHost;
                      return (
                        <motion.li
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          key={item.id}
                          className="rounded-3xl border border-border bg-background/55 p-4 sm:p-5"
                        >
                          <div className="flex items-start gap-4">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand/10 text-brand">
                              <PackageCheck className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-lg font-extrabold capitalize">{item.name}</h3>
                                {item.demands.length > 1 && (
                                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                                    {item.demands.length} demands merged
                                  </span>
                                )}
                                {item.merge_savings_inr > 0 && (
                                  <span className="rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-bold text-success">
                                    Saved Rs {item.merge_savings_inr.toFixed(0)}
                                  </span>
                                )}
                                {item.carbon_co2_kg > 0 && (
                                  <span className="rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-bold text-success">
                                    {item.carbon_co2_kg.toFixed(2)} kg CO2e
                                  </span>
                                )}
                              </div>
                              <p className="mt-0.5 text-sm text-muted-foreground">
                                {item.brand} · Buy {item.quantity} x{" "}
                                {formatQuantity(item.unit_quantity)} {item.unit}
                                {item.carbon_origin ? ` Â· Origin: ${item.carbon_origin}` : ""}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-lg font-black">
                                Rs {(item.estimated_price_inr * item.quantity).toFixed(0)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Rs {item.estimated_price_inr.toFixed(0)} each
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            {item.demands.map((demand, index) => (
                              <span
                                key={`${demand.contributor_id}-${demand.requested_unit}`}
                                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs"
                              >
                                <span
                                  className={`h-2 w-2 rounded-full ${contributorColors[index % contributorColors.length]}`}
                                />
                                <strong>{demand.contributor_name}</strong>
                                {formatQuantity(demand.requested_quantity)} {demand.requested_unit}
                              </span>
                            ))}
                          </div>

                          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
                            {myDemand ? (
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-muted-foreground">
                                  Your demand
                                </span>
                                <button
                                  onClick={() =>
                                    updateQuantity(
                                      item.id,
                                      Math.max(
                                        quantityStep(myDemand.requested_unit),
                                        myDemand.requested_quantity -
                                          quantityStep(myDemand.requested_unit),
                                      ),
                                    )
                                  }
                                  disabled={!isConnected}
                                  aria-label="Decrease your demand"
                                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-border hover:bg-surface disabled:opacity-40"
                                >
                                  <Minus className="h-3.5 w-3.5" />
                                </button>
                                <strong className="min-w-16 text-center text-sm">
                                  {formatQuantity(myDemand.requested_quantity)}{" "}
                                  {myDemand.requested_unit}
                                </strong>
                                <button
                                  onClick={() =>
                                    updateQuantity(
                                      item.id,
                                      myDemand.requested_quantity +
                                        quantityStep(myDemand.requested_unit),
                                    )
                                  }
                                  disabled={!isConnected}
                                  aria-label="Increase your demand"
                                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-border hover:bg-surface disabled:opacity-40"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                Added by other contributors
                              </span>
                            )}
                            {canRemove && (
                              <button
                                onClick={() => removeItem(item.id)}
                                disabled={!isConnected}
                                className="inline-flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-destructive transition hover:bg-destructive/10 disabled:opacity-40"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                {myDemand ? "Remove my demand" : "Remove product"}
                              </button>
                            )}
                          </div>

                          {item.pending_substitution && (
                            <div className="mt-4 rounded-2xl border border-border bg-muted p-4">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <p className="text-sm font-bold">
                                    Better deal:{" "}
                                    <span className="capitalize">
                                      {item.pending_substitution.name}
                                    </span>
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {item.pending_substitution.reason}
                                  </p>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => rejectSubstitution(item.id)}
                                    className="cursor-pointer rounded-xl px-3 py-2 text-xs font-bold hover:bg-background/70"
                                  >
                                    Dismiss
                                  </button>
                                  {isHost && (
                                    <button
                                      onClick={() => acceptSubstitution(item.id)}
                                      className="cursor-pointer rounded-xl bg-foreground px-3 py-2 text-xs font-bold text-background"
                                    >
                                      Use deal
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {item.local_carbon_alternative && (
                            <div className="mt-4 rounded-2xl border border-success/20 bg-success/5 p-4">
                              <p className="text-sm font-bold text-success">
                                Local carbon swap: {item.local_carbon_alternative.local_alt_name}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Could save {item.local_carbon_alternative.savings_km.toFixed(0)} km
                                transport and{" "}
                                {item.local_carbon_alternative.savings_co2_kg.toFixed(2)} kg CO2e.
                              </p>
                            </div>
                          )}
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>
              )}
            </section>

            {session.items.length > 0 && (
              <section className="mt-6 rounded-3xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold">Carbon breakdown</h2>
                    <p className="text-sm text-muted-foreground">
                      Per-item transport footprint from catalog origin metadata.
                    </p>
                  </div>
                  <Leaf className="h-5 w-5 text-success" />
                </div>
                <div className="mt-4 space-y-3">
                  {session.items.map((item) => {
                    const max = Math.max(...session.items.map((entry) => entry.carbon_co2_kg), 0.1);
                    const width = Math.max(6, (item.carbon_co2_kg / max) * 100);
                    return (
                      <div key={item.id} className="rounded-2xl bg-surface/60 p-3">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="font-semibold capitalize">{item.name}</span>
                          <span className="text-muted-foreground">
                            {item.carbon_origin || "Unknown"} Â· {item.carbon_co2_kg.toFixed(2)} kg
                          </span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-background">
                          <div
                            className="h-full rounded-full bg-success"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </main>
        </div>
      </div>

      {showInviteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowInviteModal(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold">Invite Contributors</h2>
            <p className="mt-2 text-sm text-muted-foreground">Send invite links via email or SMS</p>

            <form onSubmit={handleInvite} className="mt-6 space-y-4">
              <div>
                <label htmlFor="invite-email" className="mb-1.5 block text-sm font-semibold">
                  <Mail className="inline h-4 w-4 mr-1" />
                  Email (optional)
                </label>
                <input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="friend@example.com"
                  className="h-11 w-full rounded-xl border border-input bg-background px-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              </div>

              <div>
                <label htmlFor="invite-phone" className="mb-1.5 block text-sm font-semibold">
                  <Phone className="inline h-4 w-4 mr-1" />
                  Phone (optional)
                </label>
                <input
                  id="invite-phone"
                  type="tel"
                  value={invitePhone}
                  onChange={(e) => setInvitePhone(e.target.value)}
                  placeholder="+1234567890"
                  className="h-11 w-full rounded-xl border border-input bg-background px-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="h-11 flex-1 cursor-pointer rounded-xl border border-border px-4 font-semibold transition hover:bg-surface"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting || (!inviteEmail.trim() && !invitePhone.trim())}
                  className="h-11 flex-1 cursor-pointer rounded-xl bg-foreground px-4 font-semibold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {inviting ? "Sending..." : "Send Invites"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCommunityDeals && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
          onClick={() => setShowCommunityDeals(false)}
        >
          <div
            className="max-h-[82vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-border bg-card p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-success">
                  {session.community_name || session.community_code}
                </p>
                <h2 className="mt-1 text-2xl font-bold">Community bulk-buy deals</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Matches are computed from live carts in the same community code.
                </p>
              </div>
              <button
                onClick={() => setShowCommunityDeals(false)}
                aria-label="Close community deals"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full hover:bg-surface"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <button
              onClick={loadCommunityDeals}
              disabled={isLoadingDeals}
              className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-semibold hover:bg-surface disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isLoadingDeals ? "animate-spin" : ""}`} />
              Refresh live matches
            </button>

            <div className="mt-5 space-y-3">
              {communityDeals.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-6 text-center">
                  <p className="font-semibold">No matching community deals yet.</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Create another cart with this code and add overlapping categories like dairy or
                    grains.
                  </p>
                </div>
              ) : (
                communityDeals.map((deal) => {
                  const accepted = deal.accepted_session_ids.includes(session.session_id);
                  return (
                    <div
                      key={deal.category}
                      className="rounded-2xl border border-border bg-background/60 p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="text-lg font-extrabold capitalize">
                            {deal.matching_sessions.length} carts buying {deal.category}
                          </h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Combine {deal.total_quantity.toFixed(0)} packs for {deal.discount_pct}%
                            off.
                          </p>
                          <p className="mt-1 text-sm font-bold text-success">
                            Estimated community savings Rs {deal.estimated_savings_inr.toFixed(0)}
                          </p>
                        </div>
                        <button
                          onClick={() => acceptDeal(deal.category)}
                          disabled={accepted}
                          className="cursor-pointer rounded-xl bg-foreground px-4 py-2 text-sm font-bold text-background disabled:cursor-default disabled:opacity-50"
                        >
                          {accepted ? "Accepted" : "Accept deal"}
                        </button>
                      </div>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {deal.matching_sessions.map((dealSession) => (
                          <div
                            key={dealSession.session_id}
                            className="rounded-xl bg-surface/70 p-3"
                          >
                            <p className="font-bold">{dealSession.session_name}</p>
                            <p className="text-xs text-muted-foreground">
                              Rs {dealSession.subtotal_inr.toFixed(0)} becomes Rs{" "}
                              {dealSession.discounted_total_inr.toFixed(0)}
                            </p>
                            <p className="mt-1 text-xs font-semibold text-success">
                              Saves Rs {dealSession.estimated_savings_inr.toFixed(0)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Metric({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface text-brand">
        {icon}
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className="flex items-baseline gap-2">
          <strong className="text-xl">{value}</strong>
          <span className="text-xs text-muted-foreground">{detail}</span>
        </div>
      </div>
    </div>
  );
}
