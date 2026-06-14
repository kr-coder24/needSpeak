import * as React from "react";
import { motion } from "framer-motion";
import { Users, Wallet, Sparkles, ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";

interface CreateCollabCardProps {
  onSubmit: (data: { name: string; hostName: string; budget: number }) => void;
  onCancel: () => void;
  className?: string;
  isCreating?: boolean;
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
  onCancel,
  className,
  isCreating = false,
}) => {
  const [name, setName] = React.useState("");
  const [hostName, setHostName] = React.useState("");
  const [budget, setBudget] = React.useState<number>(1000);

  const canSubmit = name.trim().length > 0 && hostName.trim().length > 0 && !isCreating;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({ name: name.trim(), hostName: hostName.trim(), budget });
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
      <form onSubmit={handleSubmit} className="flex flex-col gap-7 p-7 sm:p-9">
        <header>
          <span className="font-display text-[11px] uppercase tracking-[0.22em] text-muted-foreground md:hidden">
            New session
          </span>
          <h3 className="mt-1 font-display text-2xl font-medium tracking-tight text-foreground md:text-xl">
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
    </motion.div>
  );
};
