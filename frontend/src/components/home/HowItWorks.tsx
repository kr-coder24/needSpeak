const steps = [
  {
    n: "01",
    title: "Describe the moment",
    body: "Type, paste a recipe, drop a screenshot or a WhatsApp message. Plain language is enough.",
  },
  {
    n: "02",
    title: "Review the cart",
    body: "NeedSpeak proposes items, quantities and alternatives — each with the reasoning shown.",
  },
  {
    n: "03",
    title: "Send to checkout",
    body: "Adjust, share with friends to split, then export to your store of choice.",
  },
];

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="mb-10 text-xs uppercase tracking-[0.18em] text-muted-foreground">
        How it works
      </div>
      <h2 className="max-w-3xl font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        Three quiet steps between a thought and a ready cart.
      </h2>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {steps.map((s) => (
          <div
            key={s.n}
            className="group rounded-2xl border border-border bg-card/70 p-6 transition-colors duration-300 hover:border-foreground/30 hover:bg-accent"
          >
            <div className="font-display text-sm text-muted-foreground">{s.n}</div>
            <h3 className="mt-4 font-display text-xl font-medium tracking-tight">{s.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}