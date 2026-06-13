import { type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = HTMLAttributes<HTMLDivElement> & {
  as?: "div";
  children: ReactNode;
  intensity?: number; // 0..1 — alpha of the hover tint
};

/**
 * Passthrough wrapper — local card spotlight effect removed per design.
 * Kept as a component so existing call-sites don't need to change.
 */
export function SpotlightCard({ children, className, intensity: _intensity, ...rest }: Props) {
  return (
    <div className={cn("relative", className)} {...rest}>
      {children}
    </div>
  );
}