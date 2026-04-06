import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import ScrollReveal from "@/components/ScrollReveal";

const faqs = [
  {
    q: "What is the Elite Live Trading Room?",
    a: "The Elite Live Trading Room is a real-time trading environment where professional analysts share live market analysis, trading signals, and educational content across FX, commodities, indices, and crypto markets.",
  },
  {
    q: "Do I need trading experience to join?",
    a: "No. Our room caters to all levels — from beginners learning the fundamentals to experienced traders refining their strategies. Our mentors provide guidance tailored to your skill level.",
  },
  {
    q: "What markets are covered?",
    a: "We cover all major Forex pairs, commodities (gold, oil), global indices (S&P 500, DAX, FTSE), and select crypto assets. Our coverage spans the Sydney, Tokyo, London, and New York sessions.",
  },
  {
    q: "How do I access the trading room?",
    a: "Simply sign up for an account and log in to the Dashboard. The live chatroom, trading signals, economic calendar, and all tools are available immediately upon registration.",
  },
  {
    q: "Is there a free trial available?",
    a: "Yes, we offer a free tier that gives you access to the chatroom and basic market updates. Premium features like live signals, one-on-one mentoring, and advanced tools require a subscription.",
  },
  {
    q: "Can I use the platform on mobile?",
    a: "Absolutely. The platform is fully responsive and works on any device — desktop, tablet, or smartphone. Trade and follow the markets from anywhere.",
  },
];

const FAQSection = () => (
  <section id="faq" className="py-24">
    <div className="container">
      <ScrollReveal>
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-bold text-foreground md:text-4xl">
            Frequently Asked <span className="text-gradient">Questions</span>
          </h2>
          <p className="mt-4 text-muted-foreground">
            Everything you need to know about the Elite Live Trading Room.
          </p>
        </div>
      </ScrollReveal>
      <ScrollReveal delay={150}>
        <div className="mx-auto max-w-3xl">
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`item-${i}`}
                className="card-glass rounded-lg border-none px-6"
              >
                <AccordionTrigger className="text-sm font-semibold text-foreground hover:text-primary hover:no-underline">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </ScrollReveal>
    </div>
  </section>
);

export default FAQSection;
