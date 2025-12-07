import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import {
  FileText,
  Users,
  Zap,
  CheckCircle2,
  ArrowRight,
  Star,
  Sparkles,
  Shield,
  Clock,
} from "lucide-react";

const features = [
  {
    icon: FileText,
    title: "Geração de Artefatos",
    description: "Transforme transcrições de reuniões em documentos estruturados automaticamente.",
  },
  {
    icon: Users,
    title: "Gestão de Equipes",
    description: "Controle de acesso e perfis personalizados para toda sua organização.",
  },
  {
    icon: Zap,
    title: "Integração com IA",
    description: "Processamento inteligente usando os modelos mais avançados de linguagem.",
  },
];

const testimonials = [
  {
    name: "Maria Silva",
    role: "Gerente de Projetos",
    company: "TechCorp",
    content: "O ArtefatosPro revolucionou como documentamos nossas reuniões. Economizamos horas toda semana.",
    rating: 5,
  },
  {
    name: "João Santos",
    role: "CTO",
    company: "StartupXYZ",
    content: "A qualidade dos documentos gerados é impressionante. Parece que foram escritos por um especialista.",
    rating: 5,
  },
  {
    name: "Ana Costa",
    role: "Analista de Negócios",
    company: "ConsultoriaPro",
    content: "Facilidade de uso incrível. Em minutos tenho todos os pontos críticos documentados.",
    rating: 5,
  },
];

const plans = [
  {
    name: "Free",
    price: "R$ 0",
    description: "Para experimentar",
    features: ["10 artefatos/mês", "1 usuário", "Suporte por email"],
    highlighted: false,
  },
  {
    name: "Plus",
    price: "R$ 49",
    description: "Para pequenas equipes",
    features: ["100 artefatos/mês", "5 usuários", "Suporte prioritário", "Exportação em PDF"],
    highlighted: true,
  },
  {
    name: "Premium",
    price: "R$ 149",
    description: "Para empresas",
    features: ["Artefatos ilimitados", "Usuários ilimitados", "Suporte 24/7", "API de integração", "Relatórios avançados"],
    highlighted: false,
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1">
        <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent opacity-50" />
          
          <div className="relative max-w-7xl mx-auto px-4 md:px-8 py-20 text-center">
            <Badge variant="secondary" className="mb-6">
              <Sparkles className="w-3 h-3 mr-1" />
              Novo: Integração com IA avançada
            </Badge>
            
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
              Transforme reuniões em{" "}
              <span className="text-primary">documentos</span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
              Gere automaticamente regras de negócio, pontos de ação, encaminhamentos e pontos críticos a partir de suas transcrições.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Button size="lg" asChild data-testid="button-cta-start">
                <a href="/api/login">
                  Começar Grátis
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/ferramentas">Ver Ferramentas</Link>
              </Button>
            </div>

            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4" />
              <span>Mais de 1.000 empresas confiam em nós</span>
            </div>
          </div>
        </section>

        <section className="py-20 md:py-32 bg-muted/30">
          <div className="max-w-7xl mx-auto px-4 md:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-semibold mb-4">
                Recursos poderosos para sua equipe
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Tudo que você precisa para documentar reuniões de forma eficiente
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {features.map((feature) => (
                <Card key={feature.title} className="border-0 shadow-sm">
                  <CardHeader>
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <feature.icon className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-base">{feature.description}</CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 md:py-32">
          <div className="max-w-7xl mx-auto px-4 md:px-8">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <Badge variant="outline" className="mb-4">Ferramenta Principal</Badge>
                <h2 className="text-3xl md:text-4xl font-semibold mb-6">
                  Módulo de Artefatos
                </h2>
                <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                  Cole sua transcrição, selecione os tipos de documento que deseja gerar e deixe a IA fazer o trabalho pesado.
                </p>
                
                <ul className="space-y-4 mb-8">
                  {[
                    "Regras de Negócio extraídas automaticamente",
                    "Pontos de Ação claros e atribuíveis",
                    "Encaminhamentos organizados por responsável",
                    "Pontos Críticos destacados para atenção",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <Button asChild>
                  <Link href="/ferramentas">
                    Ver Ferramenta
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>

              <div className="relative">
                <div className="aspect-video rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 border shadow-lg flex items-center justify-center">
                  <div className="text-center p-8">
                    <FileText className="h-16 w-16 text-primary mx-auto mb-4" />
                    <p className="text-muted-foreground">Interface intuitiva e poderosa</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="precos" className="py-20 md:py-32 bg-muted/30">
          <div className="max-w-7xl mx-auto px-4 md:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-semibold mb-4">
                Planos para cada necessidade
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Escolha o plano ideal para sua equipe
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {plans.map((plan) => (
                <Card
                  key={plan.name}
                  className={`relative ${plan.highlighted ? "border-primary shadow-lg scale-105" : ""}`}
                >
                  {plan.highlighted && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                      Mais Popular
                    </Badge>
                  )}
                  <CardHeader className="text-center pb-2">
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="text-center">
                    <div className="mb-6">
                      <span className="text-4xl font-bold">{plan.price}</span>
                      <span className="text-muted-foreground">/mês</span>
                    </div>
                    <ul className="space-y-3 mb-6 text-sm">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      className="w-full"
                      variant={plan.highlighted ? "default" : "outline"}
                      asChild
                    >
                      <a href="/api/login">Começar</a>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 md:py-32">
          <div className="max-w-7xl mx-auto px-4 md:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-semibold mb-4">
                O que nossos clientes dizem
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Empresas de todos os tamanhos confiam no ArtefatosPro
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {testimonials.map((testimonial) => (
                <Card key={testimonial.name} className="border-0 shadow-sm">
                  <CardContent className="pt-6">
                    <div className="flex gap-1 mb-4">
                      {Array.from({ length: testimonial.rating }).map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                      ))}
                    </div>
                    <p className="text-muted-foreground mb-4 italic">"{testimonial.content}"</p>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                          {testimonial.name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-sm">{testimonial.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {testimonial.role}, {testimonial.company}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 md:py-32 bg-primary text-primary-foreground">
          <div className="max-w-4xl mx-auto px-4 md:px-8 text-center">
            <h2 className="text-3xl md:text-4xl font-semibold mb-4">
              Pronto para começar?
            </h2>
            <p className="text-lg opacity-90 mb-8 max-w-2xl mx-auto">
              Junte-se a milhares de profissionais que já economizam tempo documentando reuniões.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" variant="secondary" asChild>
                <a href="/api/login">
                  Criar Conta Grátis
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
            <div className="flex items-center justify-center gap-2 mt-6 text-sm opacity-80">
              <Clock className="h-4 w-4" />
              <span>Sem necessidade de cartão de crédito</span>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
