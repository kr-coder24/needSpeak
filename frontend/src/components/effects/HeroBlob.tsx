import { useEffect, useRef } from "react";

/**
 * Big, soft, cursor-following warm blob — Slow Down Creative style.
 * Smoothed with rAF lerp so it trails the cursor gently.
 * Scoped to its parent (position: absolute) — pair with `relative overflow-hidden`.
 */
export function HeroBlob() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const el = ref.current;
    if (!el || reduce || coarse) return;

    const parent = el.parentElement;
    if (!parent) return;

    let tx = parent.clientWidth * 0.5;
    let ty = parent.clientHeight * 0.45;
    let x = tx;
    let y = ty;
    let raf = 0;

    const tick = () => {
      x += (tx - x) * 0.08;
      y += (ty - y) * 0.08;
      el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
      raf = requestAnimationFrame(tick);
    };
    const onMove = (e: PointerEvent) => {
      const r = parent.getBoundingClientRect();
      tx = e.clientX - r.left;
      ty = e.clientY - r.top;
    };
    tick();
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute left-0 top-0 -z-0 h-[640px] w-[640px] rounded-full opacity-70 dark:opacity-10 blur-3xl motion-reduce:hidden"
      style={{
        background:
          "radial-gradient(circle, oklch(from var(--glow) l c h / 0.55) 0%, oklch(from var(--glow) l c h / 0.18) 45%, transparent 70%)",
      }}
    />
  );
}
