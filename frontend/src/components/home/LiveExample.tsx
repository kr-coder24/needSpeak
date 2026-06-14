import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { iplCart } from "@/lib/mock/needspeak";
import { SpotlightCard } from "@/components/effects/SpotlightCard";

export function LiveExample() {
  const total = iplCart.items.reduce((s, i) => s + i.price, 0);
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="grid items-start gap-8 lg:grid-cols-2">
        <div className="lg:sticky lg:top-24">
          <div className="text-xs uppercase tracking-widest text-black">A live example</div>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight">
            From one sentence to a full cart.
          </h2>
          <p className="mt-3 text-black">
            The prompt below produced this cart in seconds — quantities scaled to attendees,
            alternatives surfaced, every line explained.
          </p>
          <div className="mt-6 rounded-xl border border-border bg-surface p-4 text-sm">
            <div className="text-muted-foreground">Prompt</div>
            <div className="mt-1 font-medium">
              "IPL finals at my place. 10 people. Budget ₹1500."
            </div>
          </div>
          <Link
            to="/chat"
            className="mt-6 inline-flex h-10 items-center gap-2 rounded-lg bg-foreground px-4 text-sm font-medium text-background hover:bg-foreground/90"
          >
            Try it yourself <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <SpotlightCard className="rounded-2xl border border-border bg-card/80 p-2">
          <div className="flex items-center justify-between px-4 py-3 text-xs text-muted-foreground">
            <span>{iplCart.title}</span>
            <span>
              {iplCart.attendees} people · Budget ₹{iplCart.budget}
            </span>
          </div>
          <ul className="divide-y divide-border rounded-xl bg-background/60">
            {iplCart.items.slice(0, 5).map((it) => (
              <li key={it.id} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{it.name}</div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {it.qty} · {it.reason}
                  </div>
                </div>
                <div className="shrink-0 text-sm tabular-nums">₹{it.price}</div>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium tabular-nums">₹{total}</span>
          </div>
        </SpotlightCard>
      </div>
    </section>
  );
}
