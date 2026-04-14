import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { faqItems } from "@/lib/mockData";
import { HelpCircle, Search, Sparkles, Phone, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { AIChatWidget } from "@/components/chat/AIChatWidget";
import { useI18n } from "@/lib/i18n";

export default function FAQ() {
  const [showAIChat, setShowAIChat] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { t, language } = useI18n();

  const filteredFaqs = faqItems.filter(
    (faq) =>
      faq.question[language].toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer[language].toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        {/* Hero Section */}
        <section className="bg-gradient-kenya py-16 text-white">
          <div className="container text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20">
                <HelpCircle className="h-8 w-8" />
              </div>
            </div>
            <h1 className="text-4xl font-bold mb-4">{t("faq.title")}</h1>
            <p className="text-white/80 max-w-2xl mx-auto text-lg">
              {t("faq.page_subtitle")}
            </p>
          </div>
        </section>

        {/* Search Section */}
        <section className="py-8 bg-secondary/30">
          <div className="container">
            <div className="max-w-2xl mx-auto">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={t("faq.search_placeholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 h-14 text-lg border-2 focus:border-primary"
                />
              </div>
              {searchQuery && (
                <p className="text-sm text-muted-foreground mt-2 text-center">
                  {t("faq.found")} {filteredFaqs.length} {filteredFaqs.length !== 1 ? t("bursary.results") : t("bursary.result")} {t("faq.results_for")} "{searchQuery}"
                </p>
              )}
            </div>
          </div>
        </section>

        {/* FAQ List */}
        <section className="py-12 bg-background">
          <div className="container">
            <div className="max-w-3xl mx-auto">
              {filteredFaqs.length > 0 ? (
                <Accordion type="single" collapsible className="space-y-4">
                  {filteredFaqs.map((faq, index) => (
                    <AccordionItem
                      key={index}
                      value={`item-${index}`}
                      className="border border-border rounded-lg px-6 data-[state=open]:shadow-kenya transition-all duration-300 hover:border-primary/30"
                    >
                      <AccordionTrigger className="text-left font-semibold hover:no-underline py-5">
                        <span className="flex items-start gap-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">
                            {index + 1}
                          </span>
                          <span>{faq.question[language]}</span>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground leading-relaxed pb-5 pl-9">
                        {faq.answer[language]}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <div className="text-center py-12">
                  <HelpCircle className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-foreground mb-2">{t("faq.no_results")}</h3>
                  <p className="text-muted-foreground">
                    {t("faq.no_results_hint")}
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setSearchQuery("")}
                  >
                    {t("faq.clear_search")}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section className="py-16 bg-secondary/30">
          <div className="container">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-foreground mb-3">{t("faq.still_questions")}</h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                {t("faq.still_questions_desc")}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              <Card className="text-center hover:shadow-kenya transition-all duration-300 hover:-translate-y-1 border-primary/20">
                <CardHeader>
                  <div className="flex justify-center mb-2">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Sparkles className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                  <CardTitle className="text-lg">{t("faq.ai_assistant")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t("faq.ai_instant")}
                  </p>
                  <Button 
                    variant="default" 
                    size="sm" 
                    className="hover:scale-105 transition-transform"
                    onClick={() => setShowAIChat(true)}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    {t("faq.ask_ai")}
                  </Button>
                </CardContent>
              </Card>

              <Card className="text-center hover:shadow-kenya transition-all duration-300 hover:-translate-y-1">
                <CardHeader>
                  <div className="flex justify-center mb-2">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Phone className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                  <CardTitle className="text-lg">{t("faq.call_us")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t("faq.call_hours")}
                  </p>
                  <Button variant="outline" size="sm" className="hover:scale-105 transition-transform">
                    +254 800 123 456
                  </Button>
                </CardContent>
              </Card>

              <Card className="text-center hover:shadow-kenya transition-all duration-300 hover:-translate-y-1">
                <CardHeader>
                  <div className="flex justify-center mb-2">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Mail className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                  <CardTitle className="text-lg">{t("faq.email_us")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t("faq.email_response")}
                  </p>
                  <Button variant="outline" size="sm" className="hover:scale-105 transition-transform">
                    support@bursary.ke
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 bg-background">
          <div className="container text-center">
            <h2 className="text-2xl font-bold text-foreground mb-4">{t("faq.ready_apply")}</h2>
            <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
              {t("faq.ready_apply_desc")}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="hover:scale-105 transition-transform">
                <Link to="/apply/secondary">{t("faq.apply_secondary")}</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="hover:scale-105 transition-transform">
                <Link to="/apply/university">{t("faq.apply_university")}</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      
      {showAIChat && <AIChatWidget type="faq" title="Bursary AI Assistant" />}
    </div>
  );
}
