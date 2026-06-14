import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { occasions } from "@/lib/mock/needspeak";

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
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-semibold tracking-tight">OccasionCart</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Predefined templates that get smarter with your preferences and budget. Tap one to start a
          chat with the context pre-filled.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {occasions.map((o) => (
            <Link
              key={o.id}
              to="/chat"
              search={{ prompt: o.prompt, occasion: o.id }}
              className="group rounded-2xl border border-border bg-card p-6 transition-all hover:border-foreground hover:shadow-soft"
            >
              <div className="text-4xl">{o.emoji}</div>
              <div className="mt-5 text-xl font-semibold">{o.name}</div>
              <p className="mt-2 text-sm text-muted-foreground">{o.desc}</p>
              <div className="mt-4 rounded-lg bg-surface px-3 py-2">
                <p className="text-xs text-muted-foreground italic line-clamp-2">"{o.prompt}"</p>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                <span className="text-xs text-muted-foreground">{o.items} items · adjustable</span>
                <span className="text-sm font-medium text-foreground group-hover:text-brand">
                  Start →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
