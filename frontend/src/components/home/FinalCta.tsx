import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

export function FinalCta() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-24 sm:px-6 lg:px-8">
      <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-border bg-foreground p-10 text-center text-background sm:p-14">
        <h3 className="font-display text-3xl font-semibold tracking-tight">
          Stop building lists. Start describing.
        </h3>
        <p className="mt-3 max-w-xl text-background/70">
          Describe the moment — NeedSpeak figures out what to buy, how much, and where to save.
        </p>
        <Link
          to="/chat"
          className="mt-8 inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-medium text-brand-foreground hover:bg-brand/90"
        >
          Open the chat
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
