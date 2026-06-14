import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { HeroPrompt } from "@/components/home/HeroPrompt";
import { OccasionsStrip } from "@/components/home/OccasionsStrip";
import { HowItWorks } from "@/components/home/HowItWorks";
import { LiveExample } from "@/components/home/LiveExample";
import { FinalCta } from "@/components/home/FinalCta";
import { CursorGlow } from "@/components/effects/CursorGlow";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NeedSpeak — Turn any context into a shopping cart" },
      {
        name: "description",
        content:
          "NeedSpeak converts text, recipes, images, WhatsApp messages, and PDFs into ready-to-review shopping carts with smart quantities, budget control, and alternatives.",
      },
      { property: "og:title", content: "NeedSpeak — Context becomes cart" },
      {
        property: "og:description",
        content: "From 'IPL finals, 10 people, ₹1500' to a complete cart in seconds.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <AppShell>
      
      <div className="relative z-10">
        <HeroPrompt />
        <div className="bg-surface/50 border-t border-border">
          <OccasionsStrip />
        </div>
        <div className="bg-background border-t border-border">
          <HowItWorks />
        </div>
        <div className="bg-surface border-t border-border">
          <LiveExample />
        </div>
        <div className="bg-background border-t border-border">
          <FinalCta />
        </div>
      </div>
    </AppShell>
  );
}
