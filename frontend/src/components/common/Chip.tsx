import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "neutral" | "success" | "warning" | "danger" | "info";

/**
 * Uniform glass chip used across cart, watchlist, preferences.
 * All chips share the same height, radius, padding, and typography —
 * variant only changes the low-saturation tint.
 */
export const Chip = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement> & {
    variant?: Variant;
    asButton?: boolean;
    icon?: React.ReactNode;
  }
>(({ variant = "neutral", className, children, icon, ...rest }, ref) => {
  const styleByVariant: Record<Variant, React.CSSProperties> = {
    neutral: {
      backgroundColor: "var(--chip-bg)",
      color: "var(--chip-fg)",
      borderColor: "var(--chip-border)",
    },
    success: {
      backgroundColor: "var(--chip-success-bg)",
      color: "var(--chip-success-fg)",
      borderColor: "var(--chip-success-border)",
    },
    warning: {
      backgroundColor: "var(--chip-warning-bg)",
      color: "var(--chip-warning-fg)",
      borderColor: "var(--chip-warning-border)",
    },
    danger: {
      backgroundColor: "var(--chip-danger-bg)",
      color: "var(--chip-danger-fg)",
      borderColor: "var(--chip-danger-border)",
    },
    info: {
      backgroundColor: "var(--chip-info-bg)",
      color: "var(--chip-info-fg)",
      borderColor: "var(--chip-info-border)",
    },
  };

  return (
    <span
      ref={ref}
      style={styleByVariant[variant]}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium leading-5 backdrop-blur-xl whitespace-nowrap",
        className,
      )}
      {...rest}
    >
      {icon ? <span className="-ml-0.5 inline-flex items-center">{icon}</span> : null}
      {children}
    </span>
  );
});
Chip.displayName = "Chip";