import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { occasions } from "@/lib/mock/needspeak";
import { Sparkles, MessageSquare, ArrowRight, Zap, PartyPopper, Bot } from "lucide-react";

export const Route = createFileRoute("/occasions")({
  head: () => ({
    meta: [
      { title: "OccasionCart — NeedSpeak" },
      {
        name: "description",
        content:
          "Predefined shopping templates for IPL nights, birthdays, festivals, weekly groceries and more.",
      },
      { property: "og:title", content: "OccasionCart" },
      { property: "og:description", content: "Pick an occasion, get a starter cart instantly." },
    ],
  }),
  component: OccasionsPage,
});

function OccasionsPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Hackathon Pitch Banner */}
        <div className="mb-8 flex items-center justify-between rounded-xl border border-brand/20 bg-brand/5 px-4 py-3">
          <div className="flex items-center gap-3">
            <Zap className="h-5 w-5 text-brand" />
            <span className="text-sm font-medium text-foreground">Zero-Shot Cart Generation Pilot</span>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1 text-[10px] font-black text-white uppercase tracking-wider shadow-sm">
            <Bot className="h-3 w-3" /> Agentic Templates
          </div>
        </div>

        {/* Header Area */}
        <div className="mb-12">
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            OccasionCart
            <PartyPopper className="h-8 w-8 text-amber-500" />
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            Instantly initialize the NeedSpeak AI with complex scenarios. These templates merge with your 
            <span className="font-semibold text-foreground"> Global Context Matrix </span> 
            (preferences, budget, allergies) to build the perfect situational cart in seconds.
          </p>
        </div>

        {/* Occasions Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {occasions.map((o) => (
            <Link
              key={o.id}
              to="/chat"
              search={{ prompt: o.prompt, occasion: o.id }}
              className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-brand/40 hover:shadow-xl hover:shadow-brand/5"
            >
              {/* Decorative background glow */}
              <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-brand/5 blur-3xl transition-colors duration-500 group-hover:bg-brand/10" />

              <div>
                <div className="flex items-start justify-between">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border/50 bg-surface text-3xl shadow-sm transition-transform duration-300 group-hover:scale-110 group-hover:shadow-md">
                    {o.emoji}
                  </div>
                  <div className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground ring-1 ring-inset ring-border/50">
                    {o.items} items est.
                  </div>
                </div>

                <h3 className="mt-6 text-2xl font-bold text-foreground group-hover:text-brand transition-colors">
                  {o.name}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                  {o.desc}
                </p>

                {/* Simulated AI Prompt Box */}
                <div className="mt-5 rounded-xl border border-brand/10 bg-brand/5 p-3 relative overflow-hidden">
                  <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase text-brand/70">
                    <MessageSquare className="h-3 w-3" /> System Prompt
                  </div>
                  <p className="text-xs font-medium text-foreground/80 italic line-clamp-2 pl-2 border-l-2 border-brand/30">
                    "{o.prompt}"
                  </p>
                </div>
              </div>

              {/* Action Footer */}
              <div className="mt-6 flex items-center justify-between border-t border-border/60 pt-5">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5" /> Auto-adjustable
                </span>
                <span className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-foreground px-4 text-xs font-bold text-background transition-all group-hover:bg-brand group-hover:shadow-md">
                  Generate Cart
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          ))}
        </div>

      </div>
    </AppShell>
  );
}