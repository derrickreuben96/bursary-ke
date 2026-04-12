import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { faqItems } from "@/lib/mockData";
import { HelpCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export function FAQSection() {
  const displayedFaqs = faqItems.slice(0, 5);
  const { t } = useI18n();

  return (
    <section className="py-16 bg-background">
      <div className="container">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <HelpCircle className="h-6 w-6 text-primary" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-foreground mb-3">
            {t("faq.title")}
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {t("faq.subtitle")}
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="space-y-3">
            {displayedFaqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="border border-border rounded-lg px-6 data-[state=open]:shadow-soft transition-shadow"
              >
                <AccordionTrigger className="text-left font-semibold hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <div className="text-center mt-8">
            <Button asChild variant="outline" size="lg">
              <Link to="/faq">{t("faq.view_all")}</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
