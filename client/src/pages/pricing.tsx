import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CheckCircle2, X } from "lucide-react";

const plans = [
  {
    name: "Free",
    slug: "free",
    price: "R$ 0",
    description: "Ideal para experimentar a plataforma",
    features: [
      { name: "10 artefatos por mês", included: true },
      { name: "1 usuário", included: true },
      { name: "Suporte por email", included: true },
      { name: "Regras de Negócio", included: true },
      { name: "Pontos de Ação", included: false },
      { name: "Encaminhamentos", included: false },
      { name: "Pontos Críticos", included: false },
      { name: "Exportação PDF", included: false },
      { name: "API de integração", included: false },
    ],
    highlighted: false,
  },
  {
    name: "Plus",
    slug: "plus",
    price: "R$ 49",
    description: "Perfeito para pequenas equipes",
    features: [
      { name: "100 artefatos por mês", included: true },
      { name: "5 usuários", included: true },
      { name: "Suporte prioritário", included: true },
      { name: "Regras de Negócio", included: true },
      { name: "Pontos de Ação", included: true },
      { name: "Encaminhamentos", included: true },
      { name: "Pontos Críticos", included: false },
      { name: "Exportação PDF", included: true },
      { name: "API de integração", included: false },
    ],
    highlighted: true,
  },
  {
    name: "Premium",
    slug: "premium",
    price: "R$ 149",
    description: "Para empresas que precisam de tudo",
    features: [
      { name: "Artefatos ilimitados", included: true },
      { name: "Usuários ilimitados", included: true },
      { name: "Suporte 24/7", included: true },
      { name: "Regras de Negócio", included: true },
      { name: "Pontos de Ação", included: true },
      { name: "Encaminhamentos", included: true },
      { name: "Pontos Críticos", included: true },
      { name: "Exportação PDF", included: true },
      { name: "API de integração", included: true },
    ],
    highlighted: false,
  },
];

const faqs = [
  {
    question: "Como funciona o período de teste?",
    answer:
      "O plano Free permite que você experimente a plataforma sem compromisso. Você pode fazer upgrade a qualquer momento para desbloquear mais recursos.",
  },
  {
    question: "Posso mudar de plano a qualquer momento?",
    answer:
      "Sim! Você pode fazer upgrade ou downgrade do seu plano a qualquer momento. As mudanças são aplicadas imediatamente.",
  },
  {
    question: "O que acontece se eu atingir o limite de artefatos?",
    answer:
      "Você será notificado quando estiver próximo do limite. Ao atingir o limite, poderá fazer upgrade do plano ou aguardar o próximo ciclo de faturamento.",
  },
  {
    question: "Como funciona o suporte?",
    answer:
      "Todos os planos incluem suporte por email. Planos Plus e Premium têm suporte prioritário, e o Premium inclui suporte 24/7.",
  },
  {
    question: "Posso cancelar minha assinatura?",
    answer:
      "Sim, você pode cancelar sua assinatura a qualquer momento. Você continuará tendo acesso até o final do período pago.",
  },
];

export default function Pricing() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1">
        <section className="py-20 md:py-32">
          <div className="max-w-7xl mx-auto px-4 md:px-8">
            <div className="text-center mb-16">
              <Badge variant="outline" className="mb-4">Preços</Badge>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
                Planos simples e transparentes
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Escolha o plano que melhor se adapta às necessidades da sua equipe
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-20">
              {plans.map((plan) => (
                <Card
                  key={plan.name}
                  className={`relative ${plan.highlighted ? "border-primary shadow-lg scale-105" : ""}`}
                  data-testid={`card-plan-${plan.slug}`}
                >
                  {plan.highlighted && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                      Mais Popular
                    </Badge>
                  )}
                  <CardHeader className="text-center pb-2">
                    <CardTitle className="text-2xl">{plan.name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="text-center">
                    <div className="mb-6">
                      <span className="text-5xl font-bold">{plan.price}</span>
                      <span className="text-muted-foreground">/mês</span>
                    </div>
                    <ul className="space-y-3 mb-8 text-sm text-left">
                      {plan.features.map((feature) => (
                        <li key={feature.name} className="flex items-center gap-3">
                          {feature.included ? (
                            <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                          ) : (
                            <X className="h-5 w-5 text-muted-foreground shrink-0" />
                          )}
                          <span className={!feature.included ? "text-muted-foreground" : ""}>
                            {feature.name}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      className="w-full"
                      size="lg"
                      variant={plan.highlighted ? "default" : "outline"}
                      asChild
                      data-testid={`button-select-${plan.slug}`}
                    >
                      <a href="/api/login">Começar com {plan.name}</a>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="max-w-3xl mx-auto">
              <h2 className="text-2xl md:text-3xl font-semibold text-center mb-8">
                Perguntas Frequentes
              </h2>
              <Accordion type="single" collapsible className="w-full">
                {faqs.map((faq, index) => (
                  <AccordionItem key={index} value={`item-${index}`}>
                    <AccordionTrigger className="text-left">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
