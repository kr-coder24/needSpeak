const stats = [
  { value: "12s", label: "Median time to a reviewed cart" },
  { value: "94%", label: "Items matched on first pass" },
  { value: "₹180", label: "Avg saved via smart alternatives" },
  { value: "5", label: "Input types in one flow" },
];

export function Stats() {
  return (
    <section className="border-y border-border bg-surface/60">
      <div className="mx-auto grid max-w-7xl grid-cols-2 px-4 py-12 sm:px-6 md:grid-cols-4 lg:px-8">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={`px-4 py-6 ${i > 0 ? "md:border-l border-border" : ""}`}
          >
            <div className="font-display text-3xl font-semibold tracking-tight">{s.value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}