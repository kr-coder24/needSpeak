import { ShieldCheck } from "lucide-react";
import type { PriceStatus } from "@/lib/watchlist-api";

const dotClasses = {
  green: "bg-emerald-500 shadow-emerald-500/40",
  yellow: "bg-amber-400 shadow-amber-400/40",
  red: "bg-red-500 shadow-red-500/40",
};

const textClasses = {
  green: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  yellow: "border-amber-400/30 bg-amber-400/10 text-amber-700 dark:text-amber-300",
  red: "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300",
};

export function DealStatusDots({ status, className = "" }: { status?: PriceStatus | null; className?: string }) {
  const color = status?.deal_color || status?.color_key || "yellow";
  return (
    <span
      title={status?.explanation || "Price Guardian is checking this product."}
      aria-label={status?.deal_label || status?.label || "Price status"}
      className={`inline-flex items-center gap-1.5 ${className}`}
    >
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className={`h-2 w-2 rounded-full shadow-sm ${dotClasses[color]}`}
          style={{ opacity: index === 0 ? 1 : index === 1 ? 0.72 : 0.45 }}
        />
      ))}
    </span>
  );
}

export function DealStatusPill({ status, compact = false }: { status?: PriceStatus | null; compact?: boolean }) {
  const color = status?.deal_color || status?.color_key || "yellow";
  const label = status?.deal_label || status?.label || "Checking price";
  return (
    <span
      title={status?.explanation || label}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${textClasses[color]}`}
    >
      <DealStatusDots status={status} />
      {!compact && <span>{label}</span>}
      {status?.confidence ? (
        <span className="normal-case tracking-normal opacity-75">{status.confidence}%</span>
      ) : (
        <ShieldCheck className="h-3 w-3 opacity-75" />
      )}
    </span>
  );
}
