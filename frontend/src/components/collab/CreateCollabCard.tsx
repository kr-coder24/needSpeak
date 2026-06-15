import * as React from "react";
import { motion } from "framer-motion";
import { Users, Wallet, Sparkles, ArrowRight, X, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { listCommunities, type CommunityGroup } from "@/lib/collab-api";

import { Button } from "@/components/ui/button";

interface CreateCollabCardProps {
  onSubmit: (data: {
    name: string;
    hostName: string;
    budget: number;
    communityCode: string;
    communityName: string;
  }) => void;
  onJoin?: (data: { code: string }) => void;
  onCancel: () => void;
  className?: string;
  isCreating?: boolean;
  isJoining?: boolean;
}

const BUDGET_PRESETS = [500, 1000, 2000, 5000];

const HIGHLIGHTS = [
  {
    icon: Users,
    title: "Everyone adds together",
    body: "Share a link. Friends drop in what they need — duplicates merge automatically.",
  },
  {
    icon: Wallet,
    title: "Stay on budget",
    body: "Set a soft cap. We'll quietly flag when the cart drifts past it.",
  },
  {
    icon: Sparkles,
    title: "Smarter as it grows",
    body: "Substitutions and pack-size suggestions surface as items get added.",
  },
];

export const CreateCollabCard: React.FC<CreateCollabCardProps> = ({
  onSubmit,
  onJoin,
  onCancel,
  className,
  isCreating = false,
  isJoining = false,
}) => {
  const [mode, setMode] = React.useState<"create" | "join">("create");
  const [name, setName] = React.useState("");
  const [hostName, setHostName] = React.useState("");
  const [budget, setBudget] = React.useState<number>(1000);
  const [communityCode, setCommunityCode] = React.useState("");
  const [communities, setCommunities] = React.useState<CommunityGroup[]>([]);
  const [joinCode, setJoinCode] = React.useState("");

  React.useEffect(() => {
    listCommunities()
      .then((payload) => setCommunities(payload.communities))
      .catch(() => setCommunities([]));
  }, []);

  const canSubmit = name.trim().length > 0 && hostName.trim().length > 0 && !isCreating;
  const canJoin = joinCode.trim().length >= 4 && !isJoining;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      name: name.trim(),
      hostName: hostName.trim(),
      budget,
      communityCode: communityCode.trim(),
      communityName: communityCode.trim(),
    });
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canJoin || !onJoin) return;
    onJoin({ code: joinCode.trim().toUpperCase() });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "relative grid w-full overflow-hidden rounded-3xl border border-border bg-card shadow-pop md:grid-cols-[1.05fr_1.2fr]",
        className,
      )}
    >
      {/* Close */}
      <button
        type="button"
        onClick={onCancel}
        aria-label="Close"
        disabled={isCreating}
        className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
      >
        <X className="h-4 w-4" />
      </button>

      {/* ── Left pane: editorial intro ───────────────────────────── */}
      <aside className="relative hidden flex-col justify-between gap-8 border-r border-border bg-surface/70 p-8 md:flex">
        <div>
          <span className="font-display text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            New session
          </span>
          <h2 className="mt-3 font-display text-3xl font-medium leading-tight tracking-tight text-foreground">
            A cart you build
            <br />
            with everyone.
          </h2>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
            Spin up a shared cart in seconds. No accounts required for the people you invite.
          </p>
        </div>

        <ul className="space-y-5">
          {HIGHLIGHTS.map((h) => (
            <li key={h.title} className="flex gap-3">
              <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground">
                <h.icon className="h-3.5 w-3.5" />
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">{h.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{h.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </aside>

      {/* ── Right pane: form ─────────────────────────────────────── */}
      <div className="flex flex-col gap-5 p-7 sm:p-9">
        {/* Mode toggle */}
        <div className="flex gap-1 rounded-xl border border-border bg-surface/50 p-1">
          <button
            type="button"
            onClick={() => setMode("create")}
            className={cn(
              "flex-1 rounded-lg py-2 text-sm font-medium transition-all",
              mode === "create"
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Create new
          </button>
          <button
            type="button"
            onClick={() => setMode("join")}
            className={cn(
              "flex-1 rounded-lg py-2 text-sm font-medium transition-all",
              mode === "join"
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Join with code
          </button>
        </div>

        {mode === "join" ? (
          /* ── JOIN FORM ── */
          <form onSubmit={handleJoinSubmit} className="flex flex-1 flex-col gap-6">
            <header>
              <h3 className="font-display text-2xl font-medium tracking-tight text-foreground md:text-xl">
                Join a group cart
              </h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Enter the 6-character code your friend shared with you.
              </p>
            </header>

            <div className="space-y-1.5">
              <label
                htmlFor="cc-join-code"
                className="block text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
              >
                Share code
              </label>
              <input
                id="cc-join-code"
                type="text"
                autoFocus
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                disabled={isJoining}
                maxLength={6}
                placeholder="e.g. Q9LHY8"
                className="w-full rounded-xl border border-border bg-background px-4 py-4 text-center font-mono text-2xl font-bold tracking-[0.4em] text-foreground placeholder:text-muted-foreground/40 placeholder:tracking-[0.3em] transition-colors focus:border-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
              <p className="text-xs text-muted-foreground">
                You'll pick your name on the next screen.
              </p>
            </div>

            <footer className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-5">
              <Button
                type="button"
                variant="ghost"
                onClick={onCancel}
                disabled={isJoining}
                className="text-muted-foreground hover:text-foreground"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!canJoin}
                className="group gap-2 rounded-full bg-foreground px-5 text-background hover:bg-foreground/90 disabled:opacity-50"
              >
                {isJoining ? "Joining…" : "Join cart"}
                {!isJoining && (
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                )}
              </Button>
            </footer>
          </form>
        ) : (
          /* ── CREATE FORM ── */
          <form onSubmit={handleSubmit} className="flex flex-col gap-7">
            <header>
              <h3 className="font-display text-2xl font-medium tracking-tight text-foreground md:text-xl">
                Set up your group cart
              </h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Three quick details. You can change everything later.
              </p>
            </header>

            <div className="space-y-5">
              {/* Session name */}
              <div className="space-y-1.5">
                <label
                  htmlFor="cc-name"
                  className="block text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
                >
                  What are you shopping for
                </label>
                <input
                  id="cc-name"
                  type="text"
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isCreating}
                  placeholder="Hackathon snacks, Goa trip, Diwali party…"
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base text-foreground placeholder:text-muted-foreground/70 transition-colors focus:border-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/20"
                />
              </div>

              {/* Host name */}
              <div className="space-y-1.5">
                <label
                  htmlFor="cc-host"
                  className="block text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
                >
                  Your name
                </label>
                <input
                  id="cc-host"
                  type="text"
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                  disabled={isCreating}
                  placeholder="How should the group see you?"
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-base text-foreground placeholder:text-muted-foreground/70 transition-colors focus:border-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/20"
                />
              </div>

              {/* Budget */}
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <label
                    htmlFor="cc-budget"
                    className="block text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
                  >
                    Soft budget
                  </label>
                  <span className="text-xs text-muted-foreground">optional</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {BUDGET_PRESETS.map((b) => {
                    const active = budget === b;
                    return (
                      <button
                        type="button"
                        key={b}
                        onClick={() => setBudget(b)}
                        disabled={isCreating}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs transition-all",
                          active
                            ? "border-foreground bg-foreground text-background"
                            : "border-border bg-background text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                        )}
                      >
                        ₹{b.toLocaleString("en-IN")}
                      </button>
                    );
                  })}
                </div>

                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    ₹
                  </span>
                  <input
                    id="cc-budget"
                    type="number"
                    min={0}
                    value={budget}
                    onChange={(e) => setBudget(parseInt(e.target.value, 10) || 0)}
                    disabled={isCreating}
                    className="w-full rounded-xl border border-border bg-background py-3 pl-8 pr-4 text-base text-foreground transition-colors focus:border-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/20"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="cc-community"
                  className="block text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
                >
                  Community or PIN code
                </label>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="cc-community"
                    type="text"
                    value={communityCode}
                    onChange={(e) => setCommunityCode(e.target.value)}
                    disabled={isCreating}
                    placeholder="e.g. 110016 or IITD-hostel"
                    list="cc-communities"
                    className="w-full rounded-xl border border-border bg-background py-3 pl-10 pr-4 text-base text-foreground placeholder:text-muted-foreground/70 transition-colors focus:border-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/20"
                  />
                  <datalist id="cc-communities">
                    {communities.map((community) => (
                      <option key={community.code} value={community.code}>
                        {community.name}
                      </option>
                    ))}
                  </datalist>
                </div>
                <p className="text-xs text-muted-foreground">
                  Optional. Same code unlocks neighbourhood bulk-buy deals.
                </p>
              </div>
            </div>

            <footer className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-5">
              <Button
                type="button"
                variant="ghost"
                onClick={onCancel}
                disabled={isCreating}
                className="text-muted-foreground hover:text-foreground"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!canSubmit}
                className="group gap-2 rounded-full bg-foreground px-5 text-background hover:bg-foreground/90 disabled:opacity-50"
              >
                {isCreating ? "Creating…" : "Open the cart"}
                {!isCreating && (
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                )}
              </Button>
            </footer>
          </form>
        )}
      </div>
    </motion.div>
  );
};
