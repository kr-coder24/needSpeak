import { Link } from "@tanstack/react-router";
import { occasions } from "@/lib/mock/needspeak";

// Editorial photography per occasion (Unsplash, content-licensed).
const imageFor: Record<string, string> = {
  ipl: "https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&w=900&q=70",
  birthday:
    "https://images.unsplash.com/photo-1558636508-e0db3814bd1d?auto=format&fit=crop&w=900&q=70",
  weekly:
    "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=70",
  hostel:
    "https://images.unsplash.com/photo-1606787366850-de6330128bfc?auto=format&fit=crop&w=900&q=70",
  travel:
    "https://images.unsplash.com/photo-1503220317375-aaad61436b1b?auto=format&fit=crop&w=900&q=70",
  festival:
    "https://images.unsplash.com/photo-1604423043492-41e2aafc6e7d?auto=format&fit=crop&w=900&q=70",
  picnic:
    "https://images.unsplash.com/photo-1526401485004-46910ecc8e51?auto=format&fit=crop&w=900&q=70",
};

const tagFor: Record<string, string> = {
  ipl: "Game day",
  birthday: "Celebration",
  weekly: "Groceries",
  hostel: "Restock",
  travel: "On the go",
  festival: "Hosting",
  picnic: "Outdoors",
};

export function OccasionsStrip() {
  const featured = occasions.slice(0, 4);
  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mb-10 text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Featured occasions
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((o) => (
            <Link key={o.id} to="/chat" className="group block">
              <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-surface">
                <img
                  src={imageFor[o.id]}
                  alt={o.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                />
                <span className="absolute right-3 top-3 rounded-full border border-border/60 bg-background/85 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-foreground backdrop-blur">
                  {tagFor[o.id] ?? "Cart"}
                </span>
              </div>
              <div className="mt-4 flex items-baseline justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    {o.items} items · adjustable
                  </div>
                  <h3 className="mt-1 font-display text-2xl tracking-tight">{o.name}</h3>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-14 flex justify-center">
          <Link
            to="/occasions"
            className="inline-flex items-center gap-2 rounded-full border border-foreground/80 px-6 py-3 text-sm font-medium tracking-wide text-foreground transition-colors hover:bg-foreground hover:text-background"
          >
            View all occasions
          </Link>
        </div>
      </div>
    </section>
  );
}
