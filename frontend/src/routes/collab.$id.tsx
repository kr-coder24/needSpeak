import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Check, Copy, QrCode, X, Trash2, Plus, AlertCircle, WifiOff } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { AppShell } from "@/components/layout/AppShell";
import { useCollabWebSocket } from "@/hooks/useCollabWebSocket";
import { getBudgetSplit, BudgetSplit } from "@/lib/collab-api";
import { motion, AnimatePresence } from "framer-motion";

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
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState(1);
  const [showQR, setShowQR] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    const savedId = localStorage.getItem(`collab_${cartId}_contributor`);
    if (savedId) setContributorId(savedId);
  }, [cartId]);

  const { session, isConnected, error, addItems, removeItem } = useCollabWebSocket(
    cartId,
    contributorId || undefined
  );

  useEffect(() => {
    if (session && session.session_id) {
      getBudgetSplit(session.session_id)
        .then((res) => setBudgetSplits(res.splits))
        .catch(console.error);
    }
  }, [session, session?.items]);

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
      alert("Failed to join session. The session might have expired or been wiped.");
    } finally {
      setIsJoining(false);
    }
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    addItems([
      {
        name: newItemName.trim(),
        quantity: newItemQty,
        estimated_price_inr: 0,
        unit: "piece",
        category: "general"
      }
    ]);
    setNewItemName("");
    setNewItemQty(1);
  };

  const FADE_UP = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  if (!contributorId) {
    return (
      <AppShell>
        <div className="flex min-h-[70vh] items-center justify-center p-4">
          <motion.div initial="hidden" animate="show" variants={FADE_UP} className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-2xl">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand/10">
                <span className="text-3xl text-brand">🛒</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight">Join SplitCart</h1>
              <p className="mt-2 text-muted-foreground">Enter your name to jump in and start collaborating.</p>
            </div>
            <form onSubmit={handleJoin} className="space-y-6">
              <div>
                <input
                  type="text"
                  required
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                  className="flex h-12 w-full rounded-xl border border-input bg-background/50 px-4 py-2 text-lg transition-all focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/50"
                  placeholder="e.g. Rahul"
                />
              </div>
              <button
                type="submit"
                disabled={isJoining || !joinName.trim()}
                className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-brand px-6 text-base font-semibold text-white transition-all hover:bg-brand/90 hover:shadow-lg hover:shadow-brand/20 disabled:opacity-50"
              >
                {isJoining ? "Joining..." : "Let's Go!"}
              </button>
            </form>
          </motion.div>
        </div>
      </AppShell>
    );
  }

  if (!session) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
            {error ? (
              <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-8 max-w-md">
                <WifiOff className="mx-auto mb-4 h-12 w-12 text-destructive" />
                <h3 className="text-xl font-bold text-destructive">Connection Lost</h3>
                <p className="mt-2 text-muted-foreground">We couldn't connect to this session. It may have expired or the server restarted.</p>
                <button onClick={() => navigate({ to: "/" })} className="mt-6 rounded-lg bg-background px-4 py-2 text-sm font-medium border border-border hover:bg-surface">
                  Go Home
                </button>
              </div>
            ) : (
              <div>
                <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-brand border-r-transparent shadow-lg shadow-brand/20"></div>
                <p className="mt-6 font-medium text-muted-foreground">Syncing session...</p>
              </div>
            )}
          </motion.div>
        </div>
      </AppShell>
    );
  }

  const shareUrl = typeof window !== "undefined"
    ? `http://${window.location.hostname}:8080/collab/join/${session.share_code}`
    : `/collab/join/${session.share_code}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {}
  };

  const totalSpent = session.items.reduce((s, it) => s + (it.estimated_price_inr * it.quantity), 0);
  const budgetPct = Math.min(100, (totalSpent / session.total_budget_inr) * 100);
  const isOverBudget = totalSpent > session.total_budget_inr;

  const colors = ["bg-blue-500", "bg-emerald-500", "bg-purple-500", "bg-amber-500", "bg-rose-500"];

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        
        <AnimatePresence>
          {!isConnected && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mb-6 overflow-hidden rounded-2xl bg-destructive/10 border border-destructive/20"
            >
              <div className="flex items-center gap-3 p-4">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                <div>
                  <p className="font-semibold text-destructive">Disconnected from Server</p>
                  <p className="text-sm text-destructive/80">Please refresh or wait to reconnect. Interactions are temporarily disabled.</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div initial="hidden" animate="show" variants={FADE_UP} className="mb-8 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-6">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-brand">
                <span className={`h-1.5 w-1.5 rounded-full ${isConnected ? "bg-brand animate-pulse" : "bg-destructive"}`} />
                {isConnected ? "Live Sync" : "Offline"}
              </span>
              <span className="text-sm font-medium text-muted-foreground">Host: {session.host_name}</span>
            </div>
            <h1 className="truncate text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground">{session.name}</h1>
          </div>
          
          <div className="relative flex shrink-0 gap-3">
            <button
              onClick={handleCopyLink}
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-surface px-4 font-medium transition-all hover:bg-surface/80 hover:scale-105"
            >
              {copySuccess ? <Check className="h-5 w-5 text-success" /> : <Copy className="h-5 w-5" />}
              <span className="hidden sm:inline">{copySuccess ? "Copied!" : "Share Link"}</span>
            </button>
            <button
              onClick={() => setShowQR((o) => !o)}
              className={`inline-flex h-12 w-12 items-center justify-center rounded-xl transition-all hover:scale-105 ${
                showQR ? "bg-foreground text-background shadow-xl shadow-foreground/20" : "bg-brand text-white shadow-lg shadow-brand/20"
              }`}
            >
              {showQR ? <X className="h-5 w-5" /> : <QrCode className="h-5 w-5" />}
            </button>

            <AnimatePresence>
              {showQR && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 top-16 z-30 w-64 rounded-3xl border border-border bg-background p-6 shadow-2xl"
                >
                  <div className="mb-4 text-center">
                    <h4 className="font-semibold">Scan to Join</h4>
                    <p className="text-xs text-muted-foreground">Open camera on your phone</p>
                  </div>
                  <div className="mx-auto w-fit overflow-hidden rounded-2xl bg-white p-3 shadow-inner">
                    <QRCodeSVG value={shareUrl} size={160} level="M" />
                  </div>
                  <div className="mt-4 rounded-xl bg-surface p-2 text-center">
                    <span className="font-mono text-sm font-bold tracking-widest uppercase">{session.share_code}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          
          <div className="lg:col-span-5 flex flex-col gap-6">
            
            <motion.div initial="hidden" animate="show" variants={FADE_UP} className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand/5 to-transparent p-6 shadow-sm border border-brand/10">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-bold">Add to Cart</h2>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/10 text-brand">
                  <Plus className="h-5 w-5" />
                </div>
              </div>
              
              <form onSubmit={handleAddItem} className="space-y-5">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Item Name</label>
                  <input
                    type="text"
                    required
                    disabled={!isConnected}
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    className="flex h-12 w-full rounded-xl border border-input bg-background/80 px-4 py-2 transition-all focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:opacity-50"
                    placeholder="e.g. Nachos"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Quantity</label>
                  <input
                    type="number"
                    required
                    min="1"
                    disabled={!isConnected}
                    value={newItemQty}
                    onChange={(e) => setNewItemQty(parseInt(e.target.value) || 1)}
                    className="flex h-12 w-full rounded-xl border border-input bg-background/80 px-4 py-2 transition-all focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:opacity-50"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!isConnected || !newItemName.trim()}
                  className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-foreground px-6 font-semibold text-background transition-all hover:bg-foreground/90 hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 mt-2"
                >
                  Confirm Addition
                </button>
              </form>
            </motion.div>

            <motion.div initial="hidden" animate="show" variants={FADE_UP} className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <h2 className="mb-6 text-xl font-bold flex items-center gap-2">💰 Financials</h2>
              
              <div className="mb-6">
                <div className="flex items-end justify-between mb-2">
                  <span className="text-sm font-medium text-muted-foreground">Shared Budget</span>
                  <div className="text-right">
                    <span className={`text-2xl font-black ${isOverBudget ? "text-destructive" : "text-foreground"}`}>
                      ₹{totalSpent.toFixed(0)}
                    </span>
                    <span className="text-sm font-medium text-muted-foreground"> / ₹{session.total_budget_inr}</span>
                  </div>
                </div>
                
                <div className="h-3 overflow-hidden rounded-full bg-surface">
                  <div className="flex h-full w-full">
                    {session.contributors.filter(c => c.status === "active").map((c, i) => {
                      const spent = session.items.filter(it => it.added_by === c.id).reduce((s, it) => s + (it.estimated_price_inr * it.quantity), 0);
                      const widthPct = Math.min(100, (spent / session.total_budget_inr) * 100);
                      if (widthPct === 0) return null;
                      return <motion.div initial={{ width: 0 }} animate={{ width: `${widthPct}%` }} key={c.id} className={colors[i % colors.length]} />;
                    })}
                  </div>
                </div>
              </div>

              {budgetSplits.length > 0 ? (
                <div className="rounded-2xl border border-border bg-surface/30 overflow-hidden">
                  <div className="max-h-[300px] overflow-y-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="sticky top-0 bg-surface text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 font-medium">Person</th>
                          <th className="px-4 py-3 font-medium text-right">Owes/Gets</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {budgetSplits.map((split, i) => (
                          <tr key={split.contributor_id} className={split.contributor_id === contributorId ? "bg-brand/5" : ""}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className={`h-2.5 w-2.5 rounded-full ${colors[i % colors.length]}`} />
                                <span className="font-semibold">{split.name}</span>
                                {split.contributor_id === contributorId && <span className="text-[10px] uppercase font-bold text-brand bg-brand/10 px-1.5 py-0.5 rounded">You</span>}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {split.owes > 0 ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-1 text-xs font-bold text-destructive">
                                  Owes ₹{split.owes.toFixed(0)}
                                </span>
                              ) : split.owes < 0 ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-xs font-bold text-success">
                                  Gets ₹{Math.abs(split.owes).toFixed(0)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground font-medium">Settled</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center text-sm text-muted-foreground py-4">No split data yet.</div>
              )}
            </motion.div>
            
          </div>

          <div className="lg:col-span-7">
            <motion.div initial="hidden" animate="show" variants={FADE_UP} className="flex h-full flex-col rounded-3xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="flex items-center justify-between border-b border-border bg-surface/30 px-6 py-5">
                <h2 className="text-xl font-bold">Live Cart Items</h2>
                <div className="flex items-center gap-2 rounded-full bg-surface px-3 py-1 text-sm font-medium">
                  <span>{session.items.length} items</span>
                </div>
              </div>
              
              <div className="flex-1 bg-background/50 p-6 min-h-[400px]">
                {session.items.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface">
                      <span className="text-2xl opacity-50">🛍️</span>
                    </div>
                    <p className="font-medium text-foreground">Your cart is empty</p>
                    <p className="text-sm">Start adding items from the left panel!</p>
                  </div>
                ) : (
                  <motion.ul 
                    className="grid gap-3"
                    variants={{ show: { transition: { staggerChildren: 0.1 } } }}
                    initial="hidden" animate="show"
                  >
                    <AnimatePresence>
                      {session.items.map((it) => {
                        const ownerIndex = session.contributors.findIndex(c => c.id === it.added_by);
                        const colorClass = ownerIndex >= 0 ? colors[ownerIndex % colors.length] : "bg-muted";
                        const isOwner = it.added_by === contributorId || session.host_id === contributorId;
                        const addedByYou = it.added_by === contributorId;
                        
                        return (
                          <motion.li
                            layout
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                            key={it.id}
                            className={`group relative flex items-center gap-4 rounded-2xl border p-4 transition-all hover:shadow-md ${
                              addedByYou ? "border-brand/30 bg-brand/5" : "border-border bg-card"
                            }`}
                          >
                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${colorClass} text-xs font-bold uppercase text-white shadow-sm`}>
                              {it.added_by_name.slice(0, 2)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline gap-2">
                                <h3 className="truncate font-bold text-foreground text-lg">{it.name}</h3>
                                <span className="rounded-md bg-surface px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">x{it.quantity}</span>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Added by <span className="font-medium text-foreground/80">{addedByYou ? "you" : it.added_by_name}</span>
                              </p>
                            </div>
                            <div className="flex items-center gap-4 pr-2">
                              <div className="text-right">
                                <div className="text-lg font-black text-foreground">₹{(it.estimated_price_inr * it.quantity).toFixed(0)}</div>
                              </div>
                              {isOwner && (
                                <button
                                  onClick={() => removeItem(it.id)}
                                  disabled={!isConnected}
                                  className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10 text-destructive opacity-0 transition-all hover:bg-destructive hover:text-white group-hover:opacity-100 disabled:opacity-0"
                                  title="Remove item"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </motion.li>
                        );
                      })}
                    </AnimatePresence>
                  </motion.ul>
                )}
              </div>
            </motion.div>
          </div>
          
        </div>
      </div>
    </AppShell>
  );
}
