import { Link, useRouterState } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";
import { ShoppingCart, Sliders, Sun, Moon } from "lucide-react";
import logo from "@/assets/needspeak-logo.png";
import { useTheme } from "@/hooks/use-theme";
import { loadHistory } from "@/lib/cart-history";

const nav = [
  { to: "/chat", label: "Chat" },
  { to: "/occasions", label: "Occasions" },
  { to: "/recipe", label: "Recipe" },
  { to: "/collab/ipl-finals-10", label: "Collab" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { theme, toggle } = useTheme();
  const [historyCount, setHistoryCount] = useState(0);

  // Refresh cart badge count whenever the component mounts or window focuses
  useEffect(() => {
    const refresh = () => setHistoryCount(loadHistory().length);
    refresh();
    window.addEventListener("focus", refresh);
    // Custom event dispatched by chat.tsx when a cart is saved
    window.addEventListener("cart-history-updated", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("cart-history-updated", refresh);
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src={logo} alt="NeedSpeak" className="h-8 w-8" />
            <span className="text-lg font-semibold tracking-tight">NeedSpeak</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {nav.map((n) => {
              const active = pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                    active
                      ? "bg-surface text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-surface/60"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link
              to="/preferences"
              className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm text-muted-foreground hover:bg-surface hover:text-foreground"
            >
              <Sliders className="h-4 w-4" />
              <span className="hidden sm:inline">Preferences</span>
            </Link>

            {/* Dark / Light toggle */}
            <button
              onClick={toggle}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* Cart — count from localStorage history */}
            <Link
              to="/chat"
              className="inline-flex h-9 items-center gap-2 rounded-md bg-foreground px-3 text-sm font-medium text-background hover:bg-foreground/90"
            >
              <ShoppingCart className="h-4 w-4" />
              Cart
              {historyCount > 0 && (
                <span className="rounded bg-brand px-1.5 text-xs text-brand-foreground">
                  {historyCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border/70 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 text-sm text-muted-foreground sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <img src={logo} alt="" className="h-5 w-5 opacity-70" />
            <span>NeedSpeak — context becomes cart.</span>
          </div>
          <span>Built for the hackathon</span>
        </div>
      </footer>
    </div>
  );
}
