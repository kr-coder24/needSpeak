import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useTheme } from "@/hooks/use-theme";

/**
 * Global subtle ambient light that follows the cursor.
 * Writes --cursor-x / --cursor-y on <body> and renders a fixed
 * radial gradient behind the app. Colors stay inside the warm
 * beige/ink palette — nothing bright.
 */
export function CursorGlow() {
  const { theme } = useTheme();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (reduce || coarse) return;

    let x = window.innerWidth / 2;
    let y = window.innerHeight / 3;
    let raf = 0;
    let pending = false;

    const apply = () => {
      pending = false;
      document.body.style.setProperty("--cursor-x", `${x}px`);
      document.body.style.setProperty("--cursor-y", `${y}px`);
    };
    const onMove = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (!pending) {
        pending = true;
        raf = requestAnimationFrame(apply);
      }
    };
    apply();
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  let o1, o2, o3;
  if (theme === "dark") {
    // Way more subtle for dark mode
    o1 = 0.05;
    o2 = 0.02;
    o3 = 0.005;
  } else {
    // Light mode values
    o1 = 0.20;
    o2 = 0.08;
    o3 = 0.02;
  }

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 transition-opacity"
      style={{
        background:
          `radial-gradient(640px circle at var(--cursor-x, 50%) var(--cursor-y, 30%), oklch(from var(--glow) l c h / ${o1}), oklch(from var(--glow) l c h / ${o2}) 30%, oklch(from var(--glow) l c h / ${o3}) 55%, transparent 72%)`,
      }}
    />
  );
}