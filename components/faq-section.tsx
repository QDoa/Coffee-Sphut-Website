"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface FAQItem {
  question: string;
  answer: string;
}
interface FaqSectionProps {
  userFAQs: FAQItem[];
  vendorFAQs: FAQItem[];
}

export function FaqSection({ userFAQs, vendorFAQs }: FaqSectionProps) {
  return (
    <Tabs defaultValue="coffee-lovers" className="gap-6">
      <TabsList
        aria-label="Frequently asked questions by audience"
        className="grid w-full max-w-sm grid-cols-2 gap-1 bg-secondary p-1 group-data-[orientation=horizontal]/tabs:h-auto"
      >
        <TabsTrigger value="coffee-lovers" className="h-auto min-h-11 px-3">
          Coffee lovers
        </TabsTrigger>
        <TabsTrigger value="cafe-owners" className="h-auto min-h-11 px-3">
          Café owners
        </TabsTrigger>
      </TabsList>
      {[
        { id: "coffee-lovers", items: userFAQs },
        { id: "cafe-owners", items: vendorFAQs },
      ].map(({ id, items }) => (
        <TabsContent key={id} value={id}>
          <Accordion type="single" collapsible>
            {items.map((faq, index) => (
              <AccordionItem
                key={faq.question}
                value={`${id}-${index}`}
                className="border-border"
              >
                <AccordionTrigger className="rounded-md py-5 text-base font-medium hover:text-primary hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="h-auto pb-5 text-sm leading-relaxed text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </TabsContent>
      ))}
    </Tabs>
  );
}
