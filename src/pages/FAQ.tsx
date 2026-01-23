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
import { HelpCircle, Search, MessageCircle, Phone, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export default function FAQ() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredFaqs = faqItems.filter(
    (faq) =>
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
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
            <h1 className="text-4xl font-bold mb-4">Frequently Asked Questions</h1>
            <p className="text-white/80 max-w-2xl mx-auto text-lg">
              Find answers to common questions about the Bursary-KE application process, 
              eligibility, and fund distribution.
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
                  placeholder="Search questions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 h-14 text-lg border-2 focus:border-primary"
                />
              </div>
              {searchQuery && (
                <p className="text-sm text-muted-foreground mt-2 text-center">
                  Found {filteredFaqs.length} result{filteredFaqs.length !== 1 ? "s" : ""} for "{searchQuery}"
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
                          <span>{faq.question}</span>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground leading-relaxed pb-5 pl-9">
                        {faq.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <div className="text-center py-12">
                  <HelpCircle className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-foreground mb-2">No results found</h3>
                  <p className="text-muted-foreground">
                    Try adjusting your search terms or browse all questions below.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setSearchQuery("")}
                  >
                    Clear Search
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
              <h2 className="text-3xl font-bold text-foreground mb-3">Still Have Questions?</h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Can't find what you're looking for? Our support team is here to help.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              <Card className="text-center hover:shadow-kenya transition-all duration-300 hover:-translate-y-1">
                <CardHeader>
                  <div className="flex justify-center mb-2">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <MessageCircle className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                  <CardTitle className="text-lg">Live Chat</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Chat with our support team in real-time
                  </p>
                  <Button variant="outline" size="sm" className="hover:scale-105 transition-transform">
                    Start Chat
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
                  <CardTitle className="text-lg">Call Us</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Mon-Fri 8:00 AM - 5:00 PM EAT
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
                  <CardTitle className="text-lg">Email Us</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    We'll respond within 24 hours
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
            <h2 className="text-2xl font-bold text-foreground mb-4">Ready to Apply?</h2>
            <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
              Start your bursary application today and take the first step towards achieving your educational goals.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="hover:scale-105 transition-transform">
                <Link to="/apply/secondary">Apply for Secondary</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="hover:scale-105 transition-transform">
                <Link to="/apply/university">Apply for University</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
