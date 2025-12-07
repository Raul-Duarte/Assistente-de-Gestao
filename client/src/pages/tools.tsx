import { Link } from "wouter";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import {
  FileText,
  CheckSquare,
  ArrowUpRight,
  AlertTriangle,
  ArrowRight,
  Lock,
} from "lucide-react";

const tools = [
  {
    id: "business_rules",
    icon: FileText,
    title: "Regras de Negócio",
    description: "Extraia automaticamente regras de negócio discutidas em reuniões e documente de forma estruturada.",
    availableIn: ["free", "plus", "premium"],
    features: [
      "Identificação automática de regras",
      "Formatação padronizada",
      "Exportação em PDF",
    ],
  },
  {
    id: "action_points",
    icon: CheckSquare,
    title: "Pontos de Ação",
    description: "Identifique e organize todos os pontos de ação com responsáveis e prazos definidos.",
    availableIn: ["plus", "premium"],
    features: [
      "Lista de tarefas estruturada",
      "Atribuição de responsáveis",
      "Definição de prazos",
    ],
  },
  {
    id: "referrals",
    icon: ArrowUpRight,
    title: "Encaminhamentos",
    description: "Registre todos os encaminhamentos da reunião com detalhes sobre próximos passos.",
    availableIn: ["plus", "premium"],
    features: [
      "Organização por tema",
      "Próximos passos claros",
      "Acompanhamento facilitado",
    ],
  },
  {
    id: "critical_points",
    icon: AlertTriangle,
    title: "Pontos Críticos",
    description: "Destaque pontos que requerem atenção especial ou decisões urgentes.",
    availableIn: ["premium"],
    features: [
      "Priorização automática",
      "Alertas de urgência",
      "Ações recomendadas",
    ],
  },
];

const planLabels: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  free: { label: "Free", variant: "outline" },
  plus: { label: "Plus", variant: "secondary" },
  premium: { label: "Premium", variant: "default" },
};

export default function Tools() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1">
        <section className="py-20 md:py-32">
          <div className="max-w-7xl mx-auto px-4 md:px-8">
            <div className="max-w-3xl mx-auto text-center mb-16">
              <Badge variant="outline" className="mb-4">Ferramentas</Badge>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
                Ferramentas para extrair o máximo das suas reuniões
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Nosso módulo de Artefatos utiliza inteligência artificial para transformar 
                transcrições de reuniões em documentos profissionais e acionáveis.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 mb-16">
              {tools.map((tool) => {
                const lowestPlan = tool.availableIn[0];
                const planInfo = planLabels[lowestPlan];

                return (
                  <Card key={tool.id} className="relative overflow-hidden" data-testid={`card-tool-${tool.id}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <tool.icon className="h-6 w-6 text-primary" />
                        </div>
                        <Badge variant={planInfo.variant}>
                          {lowestPlan === "free" ? "Grátis" : `A partir do ${planInfo.label}`}
                        </Badge>
                      </div>
                      <CardTitle className="text-xl mt-4">{tool.title}</CardTitle>
                      <CardDescription className="text-base">{tool.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        {tool.features.map((feature) => (
                          <li key={feature} className="flex items-center gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="text-center">
              <Card className="inline-block p-8 max-w-xl">
                <div className="flex items-center gap-3 mb-4">
                  {isAuthenticated ? (
                    <FileText className="h-8 w-8 text-primary" />
                  ) : (
                    <Lock className="h-8 w-8 text-muted-foreground" />
                  )}
                  <h2 className="text-2xl font-semibold">
                    {isAuthenticated ? "Pronto para começar?" : "Acesse as ferramentas"}
                  </h2>
                </div>
                <p className="text-muted-foreground mb-6">
                  {isAuthenticated
                    ? "Vá para o módulo de Artefatos e comece a transformar suas transcrições."
                    : "Faça login para começar a gerar artefatos a partir das suas reuniões."}
                </p>
                <Button size="lg" asChild data-testid="button-access-tools">
                  {isAuthenticated ? (
                    <Link href="/artefatos">
                      Ir para Artefatos
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  ) : (
                    <a href="/api/login">
                      Fazer Login
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
                  )}
                </Button>
              </Card>
            </div>
          </div>
        </section>

        <section className="py-20 md:py-32 bg-muted/30">
          <div className="max-w-4xl mx-auto px-4 md:px-8 text-center">
            <h2 className="text-3xl md:text-4xl font-semibold mb-6">
              Como funciona
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  step: "1",
                  title: "Cole a Transcrição",
                  description: "Copie e cole a transcrição da sua reunião no campo de texto.",
                },
                {
                  step: "2",
                  title: "Selecione os Artefatos",
                  description: "Escolha quais tipos de documentos você deseja gerar.",
                },
                {
                  step: "3",
                  title: "Baixe os PDFs",
                  description: "Receba documentos profissionais prontos para compartilhar.",
                },
              ].map((item) => (
                <div key={item.step} className="text-center">
                  <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4 text-lg font-bold">
                    {item.step}
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
