import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "Does NeedSpeak actually place the order?",
    a: "You stay in control. NeedSpeak builds the cart and lets you export to your preferred store, share with friends, or copy to WhatsApp.",
  },
  {
    q: "Can it handle multiple goals in one prompt?",
    a: "Yes. Ask for groceries and a birthday party in one sentence — NeedSpeak splits them into separate carts automatically.",
  },
  {
    q: "What if my budget shrinks?",
    a: "Use CompareCart — say the budget is now ₹1000 and see the new cart side by side, with the exact items swapped or removed.",
  },
];

export function FaqTeaser() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
      <h2 className="font-display text-3xl font-semibold tracking-tight">Common questions</h2>
      <Accordion type="single" collapsible className="mt-8">
        {faqs.map((f) => (
          <AccordionItem key={f.q} value={f.q}>
            <AccordionTrigger className="text-left text-base">{f.q}</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">{f.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}