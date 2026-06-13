import { FileText, Image as ImageIcon, Link as LinkIcon, MessageSquare, Type } from "lucide-react";
import { SpotlightCard } from "@/components/effects/SpotlightCard";

const types = [
  { icon: Type, title: "Natural language", example: '"Diwali dinner for 8, mostly vegetarian, ₹2500"' },
  { icon: LinkIcon, title: "Recipe URL", example: "Paste any recipe — ingredients become a cart with quantities scaled." },
  { icon: ImageIcon, title: "Shopping list image", example: "Snap a handwritten list, get a structured cart back." },
  { icon: MessageSquare, title: "WhatsApp message", example: "Forward the family group order — NeedSpeak parses every line." },
  { icon: FileText, title: "PDF / document", example: "Drop a school supply list or event plan PDF." },
];

export function InputTypesGrid() {
  return (
    <section className="border-y border-border bg-surface/40">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div>
          <h2 className="font-display text-3xl font-semibold tracking-tight">
            Speak however you think
          </h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Five ways to start. One cart at the end.
          </p>
        </div>
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {types.map((t) => (
            <SpotlightCard
              key={t.title}
              className="rounded-2xl border border-border bg-card p-6 transition-colors hover:border-foreground/40"
            >
              <t.icon className="h-5 w-5 text-brand" />
              <h3 className="mt-4 text-base font-semibold">{t.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t.example}</p>
            </SpotlightCard>
          ))}
        </div>
      </div>
    </section>
  );
}