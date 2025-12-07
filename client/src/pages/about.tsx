import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, Heart, Lightbulb, Users } from "lucide-react";

const values = [
  {
    icon: Target,
    title: "Foco no Cliente",
    description: "Cada funcionalidade é pensada para resolver problemas reais dos nossos usuários.",
  },
  {
    icon: Heart,
    title: "Qualidade",
    description: "Nos comprometemos em entregar produtos de alta qualidade em cada interação.",
  },
  {
    icon: Lightbulb,
    title: "Inovação",
    description: "Utilizamos as tecnologias mais avançadas para oferecer soluções únicas.",
  },
  {
    icon: Users,
    title: "Colaboração",
    description: "Acreditamos que o melhor trabalho acontece quando trabalhamos juntos.",
  },
];

const stats = [
  { value: "1.000+", label: "Empresas Ativas" },
  { value: "50.000+", label: "Artefatos Gerados" },
  { value: "99.9%", label: "Uptime" },
  { value: "4.9/5", label: "Avaliação Média" },
];

const team = [
  {
    name: "Carlos Oliveira",
    role: "CEO & Fundador",
    bio: "Mais de 15 anos de experiência em desenvolvimento de software e gestão de produtos.",
  },
  {
    name: "Marina Santos",
    role: "CTO",
    bio: "Especialista em IA e machine learning, liderou equipes em grandes empresas de tecnologia.",
  },
  {
    name: "Ricardo Lima",
    role: "Head de Produto",
    bio: "Focado em criar experiências de usuário excepcionais e produtos que as pessoas amam.",
  },
];

export default function About() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1">
        <section className="py-20 md:py-32">
          <div className="max-w-7xl mx-auto px-4 md:px-8">
            <div className="max-w-3xl mx-auto text-center mb-16">
              <Badge variant="outline" className="mb-4">Sobre Nós</Badge>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
                Transformando como equipes documentam decisões
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed">
                O ArtefatosPro nasceu da frustração de perder informações importantes em reuniões.
                Nossa missão é garantir que nenhuma decisão, ação ou insight seja perdido.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-20">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-3xl md:text-4xl font-bold text-primary mb-2">
                    {stat.value}
                  </div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 md:py-32 bg-muted/30">
          <div className="max-w-7xl mx-auto px-4 md:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-semibold mb-4">Nossos Valores</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Os princípios que guiam tudo o que fazemos
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {values.map((value) => (
                <Card key={value.title} className="border-0 shadow-sm text-center">
                  <CardContent className="pt-8 pb-6">
                    <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <value.icon className="h-7 w-7 text-primary" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">{value.title}</h3>
                    <p className="text-sm text-muted-foreground">{value.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 md:py-32">
          <div className="max-w-7xl mx-auto px-4 md:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-semibold mb-4">Nossa Equipe</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Pessoas apaixonadas por resolver problemas complexos
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              {team.map((member) => (
                <Card key={member.name} className="border-0 shadow-sm">
                  <CardContent className="pt-8 pb-6 text-center">
                    <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto mb-4">
                      <span className="text-2xl font-bold text-primary">
                        {member.name.split(" ").map(n => n[0]).join("")}
                      </span>
                    </div>
                    <h3 className="font-semibold text-lg">{member.name}</h3>
                    <p className="text-sm text-primary mb-3">{member.role}</p>
                    <p className="text-sm text-muted-foreground">{member.bio}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 md:py-32 bg-muted/30">
          <div className="max-w-4xl mx-auto px-4 md:px-8">
            <div className="text-center">
              <h2 className="text-3xl md:text-4xl font-semibold mb-6">Nossa História</h2>
              <div className="prose prose-lg dark:prose-invert mx-auto text-muted-foreground">
                <p className="mb-4">
                  O ArtefatosPro foi fundado em 2024 com uma visão clara: eliminar o problema da 
                  perda de informações em reuniões corporativas.
                </p>
                <p className="mb-4">
                  Após anos trabalhando em grandes empresas, percebemos que uma quantidade significativa 
                  de decisões importantes e insights valiosos eram perdidos por falta de documentação adequada.
                </p>
                <p>
                  Hoje, ajudamos milhares de equipes a capturar, organizar e agir sobre as informações 
                  discutidas em suas reuniões, aumentando a produtividade e garantindo que nada importante 
                  seja esquecido.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
