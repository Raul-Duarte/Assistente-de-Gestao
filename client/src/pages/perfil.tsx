import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { User, Mail, Calendar, Shield, Crown } from "lucide-react";
import type { Profile, Plan } from "@shared/schema";

export default function Perfil() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const { data: userProfile, isLoading: profileLoading } = useQuery<Profile>({
    queryKey: ["/api/user/profile"],
    enabled: isAuthenticated,
  });

  const { data: userPlan, isLoading: planLoading } = useQuery<Plan>({
    queryKey: ["/api/user/plan"],
    enabled: isAuthenticated,
  });

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.charAt(0) || "";
    const last = lastName?.charAt(0) || "";
    return (first + last).toUpperCase() || "U";
  };

  const formatDate = (dateString?: string | Date | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  if (authLoading || profileLoading || planLoading) {
    return (
      <AdminLayout>
        <div className="max-w-2xl mx-auto space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64" />
          <Skeleton className="h-40" />
        </div>
      </AdminLayout>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <AdminLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Meu Perfil</h1>
          <p className="text-muted-foreground">
            Visualize suas informações de conta
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Informações Pessoais
            </CardTitle>
            <CardDescription>
              Seus dados de conta no ArtefatosPro
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={user?.profileImageUrl || undefined} />
                <AvatarFallback className="text-2xl">
                  {getInitials(user?.firstName, user?.lastName)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-xl font-semibold" data-testid="text-user-name">
                  {user?.firstName} {user?.lastName}
                </h2>
                <p className="text-muted-foreground flex items-center gap-1" data-testid="text-user-email">
                  <Mail className="h-4 w-4" />
                  {user?.email}
                </p>
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Membro desde
                </p>
                <p className="font-medium" data-testid="text-member-since">
                  {formatDate(user?.createdAt)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant={user?.isActive ? "default" : "secondary"} data-testid="badge-status">
                  {user?.isActive ? "Ativo" : "Inativo"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Perfil de Acesso
            </CardTitle>
            <CardDescription>
              Seu nível de permissões no sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            {userProfile ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" data-testid="badge-profile-name">
                    {userProfile.name}
                  </Badge>
                  {userProfile.isSystem && (
                    <Badge variant="secondary" className="text-xs">Sistema</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground" data-testid="text-profile-description">
                  {userProfile.description}
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground">Nenhum perfil atribuído</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5" />
              Plano de Assinatura
            </CardTitle>
            <CardDescription>
              Seu plano atual e recursos disponíveis
            </CardDescription>
          </CardHeader>
          <CardContent>
            {userPlan ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold" data-testid="text-plan-name">
                      {userPlan.name}
                    </h3>
                    <p className="text-sm text-muted-foreground" data-testid="text-plan-description">
                      {userPlan.description}
                    </p>
                  </div>
                  <Badge variant="default" className="text-lg px-3 py-1" data-testid="badge-plan-price">
                    {userPlan.price === 0 ? "Grátis" : `R$ ${userPlan.price}/mês`}
                  </Badge>
                </div>

                <Separator />

                <div>
                  <p className="text-sm font-medium mb-2">Recursos inclusos:</p>
                  <div className="flex flex-wrap gap-2">
                    {userPlan.features?.map((feature, index) => (
                      <Badge key={index} variant="outline" data-testid={`badge-feature-${index}`}>
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">
                    Limite mensal: {userPlan.maxArtifactsPerMonth} artefatos
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">Nenhum plano atribuído</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
