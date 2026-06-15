import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";
import { ChevronDown, History, LogOut, ShoppingCart, Sliders, Sun, Moon, User, Users, Bell, Sparkles } from "lucide-react";

import { useWishlistStore } from "@/store/useWishlistStore";
import { useTheme } from "@/hooks/use-theme";
import { loadHistory } from "@/lib/cart-history";
import { getStoredAuth } from "@/routes/login";
import { createCollabSession } from "@/lib/collab-api";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreateCollabCard } from "@/components/collab/CreateCollabCard";
import { CursorGlow } from "@/components/effects/CursorGlow";
import { Footer } from "./Footer";

const nav = [
  { to: "/chat", label: "Chat" },
  { to: "/occasions", label: "Occasions" },
  { to: "/recipe", label: "Recipe" },
  { to: "/watchlist", label: "Watchlist" },
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
  const { notifications, wishlist, simulateRestock, markAsRead, fetchWishlist } = useWishlistStore();
  const unreadCount = notifications.filter((n) => !n.read).length;

  const isChat = pathname.startsWith("/chat");
  const isAppLayout = isChat || noFooter;

  useEffect(() => {
    try {
      const raw = localStorage.getItem("needspeak-auth");
      if (raw) {
        const parsed = JSON.parse(raw);
        setAuth(parsed);
        if (parsed?.user?.id || parsed?.user?.email) {
          fetchWishlist(parsed.user.id || parsed.user.email);
        } else {
          fetchWishlist("demo_user");
        }
      } else {
        fetchWishlist("demo_user");
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

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreatingCollab, setIsCreatingCollab] = useState(false);

  const handleCreateCollab = async (data: {
    name: string;
    hostName: string;
    budget: number;
    communityCode: string;
    communityName: string;
  }) => {
    setIsCreatingCollab(true);
    try {
      const { session, contributor } = await createCollabSession(
        data.name,
        data.hostName,
        data.budget,
        data.communityCode,
        data.communityName,
      );
      localStorage.setItem(`collab_${session.session_id}_contributor`, contributor.id);
      setIsDialogOpen(false);
      navigate({ to: `/collab/${session.session_id}` });
    } catch (err) {
      console.error(err);
      alert("Failed to create collab session");
    } finally {
      setIsCreatingCollab(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("needspeak-auth");
    setAuth(null);
    navigate({ to: "/login" });
  };

  return (
    <div className={`flex flex-col bg-background relative z-0 ${isAppLayout ? "h-screen overflow-hidden" : "min-h-screen"}`}>
      <CursorGlow />
      <header className="sticky top-0 z-40 shrink-0 border-b border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center px-6 sm:px-10 lg:px-14">
          <Link to="/" className="flex items-center gap-3 shrink-0">
            <span className="font-display text-xl font-bold tracking-tight uppercase">NEEDSPEAK</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 ml-12">
            {nav.map((n) => {
              const active = pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`relative py-1 text-sm transition-colors ${
                    active
                      ? "text-foreground after:absolute after:-bottom-1 after:left-0 after:right-0 after:h-px after:bg-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <button className="ml-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-sm text-foreground transition-all hover:border-foreground/40 hover:bg-surface">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  Group Cart
                </button>
              </DialogTrigger>
              <DialogContent className="p-0 bg-transparent border-none shadow-none w-[calc(100vw-2rem)] max-w-2xl sm:max-w-2xl outline-none [&>button]:hidden">
                <CreateCollabCard
                  onSubmit={handleCreateCollab}
                  onCancel={() => setIsDialogOpen(false)}
                  isCreating={isCreatingCollab}
                />
              </DialogContent>
            </Dialog>
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <Link
              to="/preferences"
              className="hidden sm:inline-flex h-9 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <Sliders className="h-4 w-4" />
              <span>Preferences</span>
            </Link>

            <span aria-hidden className="hidden md:block h-5 w-px bg-border/70" />

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
                          {n.source === "price_guardian" && (
                            <div className="mb-1 font-bold uppercase tracking-wide text-brand">Price Guardian</div>
                          )}
                          {n.message}
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Demo Simulation Button */}
                  <button
                    onClick={() => {
                      const userId = auth?.user?.id || auth?.user?.email || "demo_user";
                      simulateRestock(userId);
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="ml-2 inline-flex h-9 max-w-[210px] items-center gap-2 rounded-full border border-border bg-card px-2.5 text-sm transition-colors hover:bg-surface">
                    {auth.user.avatar_url ? (
                      <img src={auth.user.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-medium text-brand-foreground">
                        {(auth.user.name || auth.user.email || "U").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="hidden min-w-0 truncate font-medium md:inline">
                      {auth.user.name || auth.user.email || "Account"}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>
                    <div className="flex min-w-0 items-center gap-3">
                      {auth.user.avatar_url ? (
                        <img src={auth.user.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-foreground">
                          {(auth.user.name || auth.user.email || "U").charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{auth.user.name || "NeedSpeak user"}</div>
                        <div className="truncate text-xs font-normal text-muted-foreground">{auth.user.email || "Signed in"}</div>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/preferences">
                      <User className="h-4 w-4" />
                      Profile preferences
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/history">
                      <History className="h-4 w-4" />
                      Cart history
                      {historyCount > 0 && (
                        <span className="ml-auto rounded bg-brand px-1.5 text-xs text-brand-foreground">{historyCount}</span>
                      )}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={handleLogout} className="text-destructive focus:text-destructive">
                    <LogOut className="h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
