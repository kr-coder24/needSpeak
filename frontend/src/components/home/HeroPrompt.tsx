import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  FileText,
  Image as ImageIcon,
  Link as LinkIcon,
  MessageSquare,
  Sparkles,
  Type,
} from "lucide-react";
import { samplePrompts } from "@/lib/mock/needspeak";
import { HeroBlob } from "@/components/effects/HeroBlob";

const inputTypes = [
  { icon: Type, label: "Natural language" },
  { icon: LinkIcon, label: "Recipe URLs" },
  { icon: ImageIcon, label: "Shopping list image" },
  { icon: MessageSquare, label: "WhatsApp message" },
  { icon: FileText, label: "PDF / document" },
];

export function HeroPrompt() {
  return (
    <section className="relative overflow-hidden">
      {/* Aurora — two slow, very subtle warm blobs in the existing palette */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-surface to-background" />
      <HeroBlob />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 motion-reduce:hidden"
        style={{
          background:
            "radial-gradient(40rem 24rem at 15% 10%, oklch(0.55 0.1 40 / 0.08), transparent 60%), radial-gradient(36rem 22rem at 90% 30%, oklch(0.45 0.04 220 / 0.06), transparent 65%)",
          animation: "ns-aurora 28s ease-in-out infinite alternate",
        }}
      />

      <div className="relative z-10 mx-auto max-w-5xl px-4 pt-20 pb-16 sm:px-6 sm:pt-28 lg:px-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-brand" />
          New · Context-to-Cart engine
        </div>
        <h1 className="mt-6 text-balance font-display text-4xl font-semibold tracking-tight sm:text-6xl">
          Turn any context <br className="hidden sm:block" />
          into a <span className="italic text-brand">shopping cart.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-pretty text-lg text-muted-foreground">
          Tell NeedSpeak what you're planning — a watch party, a recipe, a trip — and get a
          ready-to-review cart with smart quantities, budget control, and alternatives.
        </p>

        <Link
          to="/chat"
          className="group mt-10 block rounded-2xl border border-border bg-card/80 p-3 shadow-soft backdrop-blur transition-shadow hover:shadow-pop"
        >
          <div className="flex items-start gap-3 rounded-xl bg-surface px-4 py-4">
            <Sparkles className="mt-1 h-5 w-5 shrink-0 text-brand" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted-foreground">Try a prompt</p>
              <p className="mt-1 truncate text-base font-medium">
                "IPL finals at my place. 10 people. Budget ₹1500."
              </p>
            </div>
            <div className="ml-auto inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-foreground px-4 text-sm font-medium text-background transition-transform group-hover:translate-x-0.5">
              Build cart
              <ArrowRight className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 px-2 pb-1">
            {inputTypes.map((t) => (
              <span
                key={t.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground"
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </span>
            ))}
          </div>
        </Link>

        <div className="mt-6 flex flex-wrap gap-2">
          {samplePrompts.map((p) => (
            <Link
              key={p}
              to="/chat"
              className="rounded-full border border-border bg-background/70 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur transition-colors hover:border-foreground hover:text-foreground"
            >
              {p}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}