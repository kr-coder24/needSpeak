import { Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles } from "lucide-react";

import * as React from "react";

export function Footer() {
  const [email, setEmail] = React.useState("");
  const [subscribed, setSubscribed] = React.useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
      setEmail("");
      setTimeout(() => setSubscribed(false), 5000);
    }
  };

  return (
    <footer className="relative z-10 shrink-0 border-t border-border/70 bg-card/30 backdrop-blur-sm">
      {/* Decorative top accent gradient line */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-brand/40 to-transparent" />

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 xl:gap-12">
          {/* Brand/Identity Section */}
          <div className="md:col-span-5 space-y-6">
            <Link to="/" className="flex items-center gap-2.5 group w-fit">
              <span className="font-display text-2xl font-bold tracking-tight uppercase transition-colors duration-200 group-hover:text-brand">
                NEEDSPEAK
              </span>
            </Link>
            <p className="max-w-md text-sm text-muted-foreground leading-relaxed">
              NeedSpeak leverages advanced AI semantic translation to turn natural human
              context—recipes, group details, budgets, and text instructions—into instant,
              optimized, checkout-ready shopping carts.
            </p>
            {/* Social Links with Micro-animations */}
            <div className="flex items-center gap-3 pt-2">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-surface/50 text-muted-foreground transition-all duration-250 hover:-translate-y-0.5 hover:border-brand/40 hover:bg-surface hover:text-foreground hover:shadow-sm"
                aria-label="GitHub"
              >
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fillRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    clipRule="evenodd"
                  />
                </svg>
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-surface/50 text-muted-foreground transition-all duration-250 hover:-translate-y-0.5 hover:border-brand/40 hover:bg-surface hover:text-foreground hover:shadow-sm"
                aria-label="Twitter"
              >
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-surface/50 text-muted-foreground transition-all duration-250 hover:-translate-y-0.5 hover:border-brand/40 hover:bg-surface hover:text-foreground hover:shadow-sm"
                aria-label="LinkedIn"
              >
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fillRule="evenodd"
                    d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"
                    clipRule="evenodd"
                  />
                </svg>
              </a>
            </div>
          </div>

          {/* Links Column 1: Workspace */}
          <div className="md:col-span-2 space-y-4">
            <h3 className="font-display text-base font-semibold tracking-wide text-foreground">
              Workspace
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link
                  to="/chat"
                  className="text-muted-foreground transition-colors duration-200 hover:text-foreground"
                >
                  AI Chat
                </Link>
              </li>
              <li>
                <Link
                  to="/occasions"
                  className="text-muted-foreground transition-colors duration-200 hover:text-foreground"
                >
                  Occasions
                </Link>
              </li>
              <li>
                <Link
                  to="/recipe"
                  className="text-muted-foreground transition-colors duration-200 hover:text-foreground"
                >
                  Recipe Importer
                </Link>
              </li>
              <li>
                <Link
                  to="/collab/$id"
                  params={{ id: "ipl-finals-10" }}
                  className="text-muted-foreground transition-colors duration-200 hover:text-foreground"
                >
                  Collaboration
                </Link>
              </li>
            </ul>
          </div>

          {/* Links Column 2: Settings & Status */}
          <div className="md:col-span-2 space-y-4">
            <h3 className="font-display text-base font-semibold tracking-wide text-foreground">
              Preferences
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link
                  to="/preferences"
                  className="text-muted-foreground transition-colors duration-200 hover:text-foreground"
                >
                  User Settings
                </Link>
              </li>
              <li>
                <Link
                  to="/login"
                  className="text-muted-foreground transition-colors duration-200 hover:text-foreground"
                >
                  Account
                </Link>
              </li>
              <li>
                <a
                  href="#docs"
                  className="text-muted-foreground transition-colors duration-200 hover:text-foreground"
                >
                  Developer API
                </a>
              </li>
              <li>
                <a
                  href="#status"
                  className="flex items-center gap-1.5 text-muted-foreground transition-colors duration-200 hover:text-foreground group"
                >
                  System Status
                  <span className="flex h-2 w-2 rounded-full bg-success animate-pulse" />
                </a>
              </li>
            </ul>
          </div>

          {/* Newsletter Column */}
          <div className="md:col-span-3 space-y-4">
            <h3 className="font-display text-base font-semibold tracking-wide text-foreground flex items-center gap-1.5">
              <span>Stay Updated</span>
              <Sparkles className="h-3.5 w-3.5 text-brand animate-pulse" />
            </h3>
            <p className="text-sm text-muted-foreground">
              Subscribe to get notified about new scaling strategies and smart features.
            </p>
            <form onSubmit={handleSubscribe} className="relative mt-2">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full h-10 rounded-lg border border-border/80 bg-surface/40 px-3 pr-10 text-sm placeholder:text-muted-foreground/60 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/40 transition-all duration-200"
              />
              <button
                type="submit"
                aria-label="Subscribe"
                className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-md bg-foreground text-background transition-colors duration-200 hover:bg-foreground/90 focus:outline-none cursor-pointer"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
            {subscribed && (
              <p className="text-xs text-brand font-medium animate-in fade-in slide-in-from-top-1 duration-300">
                Thank you! You've been subscribed.
              </p>
            )}
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 border-t border-border/50 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div>
            © {new Date().getFullYear()} NeedSpeak. Built for the hackathon. All rights reserved.
          </div>
          <div className="flex items-center gap-6">
            <a href="#terms" className="hover:text-foreground transition-colors duration-200">
              Terms of Service
            </a>
            <a href="#privacy" className="hover:text-foreground transition-colors duration-200">
              Privacy Policy
            </a>
            <a href="#security" className="hover:text-foreground transition-colors duration-200">
              Security
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
