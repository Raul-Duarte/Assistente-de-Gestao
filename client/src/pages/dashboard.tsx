import { useEffect } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  ArrowRight,
  Users,
  Settings,
  Crown,
  Sparkles,
} from "lucide-react";
import type { Artifact, Plan, Profile } from "@shared/schema";

export default function Dashboard() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Acesso negado",
        description: "Você precisa fazer login para acessar esta página.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, authLoading, toast]);

  const { data: artifacts, isLoading: artifactsLoading } = useQuery<Artifact[]>({
    queryKey: ["/api/artifacts"],
    enabled: isAuthenticated,
  });

  const { data: userPlan } = useQuery<Plan>({
    queryKey: ["/api/user/plan"],
    enabled: isAuthenticated,
  });

  const { data: userProfile } = useQuery<Profile>({
    queryKey: ["/api/user/profile"],
    enabled: isAuthenticated,
  });

  if (authLoading) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid md:grid-cols-3 gap-6">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const isAdmin = userProfile?.name === "Administrador";
  const recentArtifacts = artifacts?.slice(0, 5) || [];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-welcome">
              Olá, {user?.firstName || "Usuário"}!
            </h1>
            <p className="text-muted-foreground">
              Bem-vindo ao seu painel de controle
            </p>
          </div>
          <div className="flex items-center gap-3">
            {userPlan && (
              <Badge variant="outline" className="gap-1" data-testid="badge-user-plan">
                <Crown className="h-3 w-3" />
                Plano {userPlan.name}
              </Badge>
            )}
            <Button asChild data-testid="button-new-artifact">
              <Link href="/artefatos">
                <Sparkles className="mr-2 h-4 w-4" />
                Novo Artefato
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">Artefatos Gerados</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" data-testid="text-artifact-count">
                {artifactsLoading ? <Skeleton className="h-9 w-16" /> : artifacts?.length || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Total de artefatos criados
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">Seu Plano</CardTitle>
              <Crown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" data-testid="text-plan-name">
                {userPlan?.name || "Free"}
              </div>
              <p className="text-xs text-muted-foreground">
                {userPlan?.maxArtifactsPerMonth === 0
                  ? "Artefatos ilimitados"
                  : `${userPlan?.maxArtifactsPerMonth || 10} artefatos/mês`}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">Perfil</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" data-testid="text-profile-name">
                {userProfile?.name || "Cliente"}
              </div>
              <p className="text-xs text-muted-foreground">
                Nível de acesso
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Artefatos Recentes</CardTitle>
              <CardDescription>Seus últimos documentos gerados</CardDescription>
            </CardHeader>
            <CardContent>
              {artifactsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                </div>
              ) : recentArtifacts.length > 0 ? (
                <div className="space-y-3">
                  {recentArtifacts.map((artifact) => (
                    <div
                      key={artifact.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      data-testid={`artifact-item-${artifact.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium" data-testid={`artifact-title-${artifact.id}`}>
                            {artifact.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(artifact.createdAt!).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  <Button variant="ghost" className="w-full" asChild data-testid="button-view-all-artifacts">
                    <Link href="/artefatos">
                      Ver todos
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">
                    Você ainda não gerou nenhum artefato
                  </p>
                  <Button asChild data-testid="button-create-first-artifact">
                    <Link href="/artefatos">Criar Primeiro Artefato</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ações Rápidas</CardTitle>
              <CardDescription>Acesse as principais funcionalidades</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start" asChild data-testid="button-quick-artefatos">
                <Link href="/artefatos">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Gerar Novos Artefatos
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild data-testid="button-quick-precos">
                <Link href="/precos">
                  <Crown className="mr-2 h-4 w-4" />
                  Ver Planos
                </Link>
              </Button>
              {isAdmin && (
                <>
                  <div className="border-t pt-3 mt-3">
                    <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wide">
                      Administração
                    </p>
                  </div>
                  <Button variant="outline" className="w-full justify-start" asChild data-testid="button-quick-usuarios">
                    <Link href="/admin/usuarios">
                      <Users className="mr-2 h-4 w-4" />
                      Gerenciar Usuários
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full justify-start" asChild data-testid="button-quick-perfis">
                    <Link href="/admin/perfis">
                      <Settings className="mr-2 h-4 w-4" />
                      Gerenciar Perfis
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full justify-start" asChild data-testid="button-quick-planos">
                    <Link href="/admin/planos">
                      <Crown className="mr-2 h-4 w-4" />
                      Gerenciar Planos
                    </Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
