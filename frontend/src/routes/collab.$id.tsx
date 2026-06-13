import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Check, Copy, QrCode, UserPlus, X, Trash2, Plus, Info } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { AppShell } from "@/components/layout/AppShell";
import { useCollabWebSocket } from "@/hooks/useCollabWebSocket";
import { getBudgetSplit, BudgetSplit } from "@/lib/collab-api";

export const Route = createFileRoute("/collab/$id")({
  component: CollabPage,
});

function CollabPage() {
  const { id: cartId } = Route.useParams();
  const navigate = useNavigate();

  const [contributorId, setContributorId] = useState<string | null>(null);
  const [joinName, setJoinName] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [budgetSplits, setBudgetSplits] = useState<BudgetSplit[]>([]);

  // Local state for add item form
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState(1);
  const [newItemPrice, setNewItemPrice] = useState("");

  // UI state
  const [showQR, setShowQR] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Load contributor ID from local storage on mount
  useEffect(() => {
    const savedId = localStorage.getItem(`collab_${cartId}_contributor`);
    if (savedId) {
      setContributorId(savedId);
    }
  }, [cartId]);

  const { session, isConnected, addItems, removeItem } = useCollabWebSocket(
    cartId,
    contributorId || undefined
  );

  useEffect(() => {
    if (session && session.session_id) {
      getBudgetSplit(session.session_id)
        .then((res) => setBudgetSplits(res.splits))
        .catch(console.error);
    }
  }, [session]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinName.trim()) return;
    setIsJoining(true);
    try {
      const { joinCollabSession } = await import("@/lib/collab-api");
      const res = await joinCollabSession(cartId, joinName.trim());
      setContributorId(res.contributor.id);
      localStorage.setItem(`collab_${cartId}_contributor`, res.contributor.id);
    } catch (err) {
      console.error(err);
      alert("Failed to join session.");
    } finally {
      setIsJoining(false);
    }
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !newItemPrice) return;
    addItems([
      {
        name: newItemName.trim(),
        quantity: newItemQty,
        estimated_price_inr: parseFloat(newItemPrice),
        unit: "piece",
        category: "general"
      }
    ]);
    setNewItemName("");
    setNewItemQty(1);
    setNewItemPrice("");
  };

  if (!contributorId) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h1 className="text-2xl font-semibold mb-2">Join Collaborative Cart</h1>
            <p className="text-muted-foreground text-sm mb-6">
              Enter your name to join the session and start adding items.
            </p>
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Your Name</label>
                <input
                  type="text"
                  required
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="e.g. Rahul"
                />
              </div>
              <button
                type="submit"
                disabled={isJoining || !joinName.trim()}
                className="inline-flex h-10 w-full items-center justify-center rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand/90 disabled:opacity-50"
              >
                {isJoining ? "Joining..." : "Join Cart"}
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
        <div className="flex min-h-[60vh] items-center justify-center p-4">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand border-r-transparent"></div>
            <p className="mt-4 text-sm text-muted-foreground">Loading session...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/collab/join/${session.share_code}`
    : `/collab/join/${session.share_code}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      // Fallback
    }
  };

  const totalSpent = session.items.reduce((s, it) => s + (it.estimated_price_inr * it.quantity), 0);
  const budgetPct = Math.min(100, (totalSpent / session.total_budget_inr) * 100);
  const isOverBudget = totalSpent > session.total_budget_inr;

  // Colors for contributors
  const colors = ["bg-brand", "bg-chart-2", "bg-chart-4", "bg-chart-3", "bg-chart-5"];

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <span>SplitCart</span>
              <span className={`h-2 w-2 rounded-full ${isConnected ? "bg-success" : "bg-destructive"}`} title={isConnected ? "Live" : "Disconnected"} />
            </div>
            <h1 className="mt-1 truncate text-3xl font-semibold tracking-tight">{session.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {session.contributors.filter(c => c.status === "active").length} contributors · Host: {session.host_name}
            </p>
          </div>
          <div className="relative flex shrink-0 gap-2">
            <button
              onClick={handleCopyLink}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm transition-colors hover:border-foreground"
            >
              {copySuccess ? (
                <Check className="h-4 w-4 text-success" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">{copySuccess ? "Copied!" : "Copy link"}</span>
            </button>
            <button
              onClick={() => setShowQR((o) => !o)}
              className={`inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors ${
                showQR
                  ? "bg-brand text-brand-foreground"
                  : "bg-foreground text-background hover:bg-foreground/90"
              }`}
            >
              <QrCode className="h-4 w-4" />
              QR
            </button>

            {/* QR Code Popover */}
            {showQR && (
              <div className="absolute right-0 top-12 z-20 rounded-2xl border border-border bg-background p-5 shadow-lg animate-in fade-in-0 zoom-in-95">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-muted-foreground">Scan to join</span>
                  <button
                    onClick={() => setShowQR(false)}
                    className="h-5 w-5 rounded-full text-muted-foreground hover:text-foreground inline-flex justify-center items-center"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="rounded-xl bg-white p-3">
                  <QRCodeSVG value={shareUrl} size={180} level="M" />
                </div>
                <div className="mt-3 text-center">
                  <div className="text-[10px] font-mono font-bold tracking-widest uppercase bg-surface py-1 rounded">
                    {session.share_code}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Copied toast */}
        {copySuccess && (
          <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-in fade-in-0 slide-in-from-bottom-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background shadow-lg">
              <Check className="h-4 w-4" />
              Link copied!
            </div>
          </div>
        )}

        {/* Budget bar */}
        <div className="mt-8 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">Shared budget</span>
            <span>
              <span className={`text-lg font-semibold ${isOverBudget ? "text-destructive" : ""}`}>₹{totalSpent.toFixed(0)}</span>{" "}
              <span className="text-muted-foreground">/ ₹{session.total_budget_inr}</span>
            </span>
          </div>
          <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-surface relative">
            {session.contributors.filter(c => c.status === "active").map((c, i) => {
              const spent = session.items.filter(it => it.added_by === c.id).reduce((s, it) => s + (it.estimated_price_inr * it.quantity), 0);
              const widthPct = Math.min(100, (spent / session.total_budget_inr) * 100);
              if (widthPct === 0) return null;
              return (
                <div
                  key={c.id}
                  className={colors[i % colors.length]}
                  style={{ width: `${widthPct}%` }}
                />
              );
            })}
            {budgetPct < 100 && (
              <div className="bg-transparent" style={{ width: `${100 - budgetPct}%` }} />
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs">
            {session.contributors.filter(c => c.status === "active").map((c, i) => {
              const spent = session.items.filter(it => it.added_by === c.id).reduce((s, it) => s + (it.estimated_price_inr * it.quantity), 0);
              return (
                <div key={c.id} className="inline-flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${colors[i % colors.length]}`} />
                  <span className="font-medium">
                    {c.name}
                    {c.id === contributorId ? " (you)" : ""}
                  </span>
                  <span className="text-muted-foreground">₹{spent.toFixed(0)}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Budget Split Panel (B.16) */}
        {budgetSplits.length > 0 && (
          <div className="mt-6 rounded-2xl border border-border bg-card overflow-hidden">
            <div className="border-b border-border bg-surface/50 px-5 py-3 text-sm font-medium flex items-center gap-2">
              <span>💰 Budget Split</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-surface/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-medium">Person</th>
                    <th className="px-5 py-3 font-medium text-right">Added</th>
                    <th className="px-5 py-3 font-medium text-right">Fair Share</th>
                    <th className="px-5 py-3 font-medium text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {budgetSplits.map((split) => (
                    <tr key={split.contributor_id} className={split.contributor_id === contributorId ? "bg-brand/5" : ""}>
                      <td className="px-5 py-3 font-medium">
                        {split.name} {split.contributor_id === contributorId && "(you)"}
                      </td>
                      <td className="px-5 py-3 text-right">₹{split.amount_spent.toFixed(0)}</td>
                      <td className="px-5 py-3 text-right">₹{split.fair_share.toFixed(0)}</td>
                      <td className="px-5 py-3 text-right">
                        {split.owes > 0 ? (
                          <span className="text-destructive font-medium">Owes ₹{split.owes.toFixed(0)}</span>
                        ) : split.owes < 0 ? (
                          <span className="text-success font-medium">Gets ₹{Math.abs(split.owes).toFixed(0)}</span>
                        ) : (
                          <span className="text-muted-foreground">Settled</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
          {/* Add Item Form */}
          <div>
            <div className="sticky top-6 rounded-2xl border border-border bg-card p-5">
              <h2 className="text-lg font-semibold mb-4">Add Item</h2>
              <form onSubmit={handleAddItem} className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Item Name</label>
                  <input
                    type="text"
                    required
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    placeholder="e.g. Chips"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Qty</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={newItemQty}
                      onChange={(e) => setNewItemQty(parseInt(e.target.value))}
                      className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Price (₹)</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="1"
                      value={newItemPrice}
                      onChange={(e) => setNewItemPrice(e.target.value)}
                      className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      placeholder="Price per unit"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={!isConnected || !newItemName.trim() || !newItemPrice}
                  className="w-full inline-flex h-9 items-center justify-center rounded-md bg-brand px-3 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand/90 disabled:opacity-50 mt-2"
                >
                  <Plus className="mr-2 h-4 w-4" /> Add to Cart
                </button>
              </form>
            </div>
          </div>

          {/* Items grouped */}
          <div className="rounded-2xl border border-border bg-card self-start">
            <div className="border-b border-border px-5 py-3 text-sm font-medium">
              Everyone's items ({session.items.length})
            </div>
            {session.items.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No items added yet. Start adding items!
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {session.items.map((it) => {
                  const ownerIndex = session.contributors.findIndex(c => c.id === it.added_by);
                  const color = ownerIndex >= 0 ? colors[ownerIndex % colors.length] : "bg-muted";
                  const isOwner = it.added_by === contributorId || session.host_id === contributorId;
                  
                  return (
                    <li
                      key={it.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-3 group"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className={`h-8 w-8 shrink-0 rounded-full ${color} grid place-items-center text-[10px] font-semibold text-background uppercase shadow-sm`}
                          title={it.added_by_name}
                        >
                          {it.added_by_name.slice(0, 2)}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">
                            {it.name} <span className="text-muted-foreground text-xs font-normal">x{it.quantity}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            added by {it.added_by === contributorId ? "you" : it.added_by_name}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="shrink-0 text-sm font-semibold">₹{(it.estimated_price_inr * it.quantity).toFixed(0)}</div>
                        {isOwner && (
                          <button
                            onClick={() => removeItem(it.id)}
                            className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Remove item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
