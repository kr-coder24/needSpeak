import { useState, useEffect } from "react";
import { Sparkles } from "lucide-react";

export function SemanticSearchSkeleton() {
  const [step, setStep] = useState(0);
  const steps = [
    "Extracting entities via LLM...",
    "Generating 768-dimensional semantic vectors...",
    "Querying local vector space for Cosine Similarity...",
    "Applying dietary and budget weights...",
    "Ranking top candidates...",
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((s) => (s < steps.length - 1 ? s + 1 : s));
    }, 800); // cycle through steps every 800ms
    return () => clearInterval(interval);
  }, [steps.length]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm text-brand font-medium">
        <Sparkles className="h-4 w-4 animate-pulse" />
        <span>{steps[step]}</span>
      </div>
      <div className="flex flex-col gap-2 opacity-50">
        <div className="h-16 w-full animate-pulse rounded-xl bg-surface/80 border border-border"></div>
        <div className="h-16 w-[90%] animate-pulse rounded-xl bg-surface/60 border border-border"></div>
        <div className="h-16 w-[95%] animate-pulse rounded-xl bg-surface/40 border border-border"></div>
      </div>
    </div>
  );
}
