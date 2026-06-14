import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";
import { ShoppingCart, Sliders, Sun, Moon, Bell, Sparkles } from "lucide-react";
import logo from "@/assets/needspeak-logo.png";
import { useWishlistStore } from "@/store/useWishlistStore";
import { useTheme } from "@/hooks/use-theme";
import { loadHistory } from "@/lib/cart-history";
import { getStoredAuth } from "@/routes/login";
import { Footer } from "./Footer";

const nav = [
  { to: "/chat", label: "Chat" },
  { to: "/occasions", label: "Occasions" },
  { to: "/recipe", label: "Recipe" },
  { to: "/collab/ipl-finals-10", label: "Collab" },
];

export function AppShell({
  children,
  noFooter = false,
}: {
  children: ReactNode;
  noFooter?: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const [historyCount, setHistoryCount] = useState(0);
  const [auth, setAuth] = useState<{ token: string; user: any } | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const { notifications, wishlist, simulateRestock, markAsRead } = useWishlistStore();
  const unreadCount = notifications.filter((n) => !n.read).length;

  const isChat = pathname.startsWith("/chat");
  const isAppLayout = isChat || noFooter;

  // Load auth from localStorage on client mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem("needspeak-auth");
      if (raw) {
        setAuth(JSON.parse(raw));
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (!getStoredAuth() && pathname !== "/login") {
      navigate({ to: "/login" });
    }
  }, [pathname, navigate]);

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
    <div
      className={`flex flex-col bg-background relative z-0 ${isAppLayout ? "h-screen overflow-hidden" : "min-h-screen"}`}
    >
      <header className="sticky top-0 z-40 shrink-0 border-b border-border/70 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src={logo} alt="NeedSpeak" className="h-8 w-8" />
            <span className="font-display text-2xl font-bold tracking-tight uppercase">
              NEEDSPEAK
            </span>
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

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  if (!showNotifications && unreadCount > 0) markAsRead();
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface hover:text-foreground relative"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-brand" />
                )}
              </button>
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-72 rounded-xl border border-border/70 bg-card p-4 shadow-xl z-50">
                  <h4 className="font-bold text-sm mb-3">Notifications</h4>
                  {notifications.length === 0 ? (
                    <div className="text-xs text-muted-foreground mb-4">No new notifications</div>
                  ) : (
                    <div className="space-y-2 mb-4 max-h-[60vh] overflow-auto">
                      {notifications.map((n) => (
                        <div key={n.id} className="p-2.5 rounded-lg bg-surface/50 text-xs">
                          {n.message}
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Demo Simulation Button */}
                  <button
                    onClick={() => {
                      simulateRestock();
                    }}
                    disabled={wishlist.length === 0}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-brand/10 text-brand py-2 text-xs font-semibold hover:bg-brand/20 disabled:opacity-50"
                  >
                    <Sparkles className="h-3 w-3" />
                    Simulate Restock ({wishlist.length} pending)
                  </button>
                </div>
              )}
            </div>

            {/* Cart — count from localStorage history */}
            <Link
              to="/history"
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

            {/* User Auth */}
            {auth && auth.user ? (
              <div className="flex items-center gap-3 ml-2 border-l border-border pl-4">
                <div className="flex items-center gap-2">
                  {auth.user.avatar_url ? (
                    <img
                      src={auth.user.avatar_url}
                      alt=""
                      className="w-7 h-7 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-xs font-medium text-brand-foreground">
                      {auth.user.name?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-sm font-medium hidden md:inline-block">
                    {auth.user.name}
                  </span>
                </div>
                <button
                  onClick={() => {
                    localStorage.removeItem("needspeak-auth");
                    setAuth(null);
                    window.location.reload();
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="ml-2 border-l border-border pl-4">
                <Link
                  to="/login"
                  className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-card px-4 text-sm font-medium transition-colors hover:bg-surface"
                >
                  Sign in
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className={isAppLayout ? "min-h-0 flex-1 overflow-auto" : "flex-1"}>{children}</main>

      {!noFooter && !pathname.startsWith("/chat") && <Footer />}
    </div>
  );
}
