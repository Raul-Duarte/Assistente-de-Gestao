import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Pencil,
  Loader2,
  Crown,
  CheckCircle2,
} from "lucide-react";
import type { Plan, InsertPlan } from "@shared/schema";
import { ARTIFACT_TYPE_LABELS, ARTIFACT_TYPES } from "@shared/schema";

const toolOptions = [
  { id: ARTIFACT_TYPES.BUSINESS_RULES, label: ARTIFACT_TYPE_LABELS[ARTIFACT_TYPES.BUSINESS_RULES] },
  { id: ARTIFACT_TYPES.ACTION_POINTS, label: ARTIFACT_TYPE_LABELS[ARTIFACT_TYPES.ACTION_POINTS] },
  { id: ARTIFACT_TYPES.REFERRALS, label: ARTIFACT_TYPE_LABELS[ARTIFACT_TYPES.REFERRALS] },
  { id: ARTIFACT_TYPES.CRITICAL_POINTS, label: ARTIFACT_TYPE_LABELS[ARTIFACT_TYPES.CRITICAL_POINTS] },
];

const featureOptions = [
  "Exportação PDF",
  "Suporte por Email",
  "Suporte Prioritário",
  "Suporte 24/7",
  "API de Integração",
  "Relatórios Avançados",
];

export default function AdminPlans() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [formData, setFormData] = useState<Partial<InsertPlan>>({
    name: "",
    slug: "",
    description: "",
    price: 0,
    maxArtifactsPerMonth: 10,
    tools: [],
    features: [],
    isActive: true,
  });

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

  const { data: plans, isLoading: plansLoading } = useQuery<Plan[]>({
    queryKey: ["/api/admin/plans"],
    enabled: isAuthenticated,
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertPlan) => {
      return apiRequest("POST", "/api/admin/plans", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/plans"] });
      toast({ title: "Plano criado com sucesso!" });
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Sessão expirada",
          description: "Fazendo login novamente...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Erro ao criar plano",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string } & Partial<InsertPlan>) => {
      return apiRequest("PATCH", `/api/admin/plans/${data.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/plans"] });
      toast({ title: "Plano atualizado com sucesso!" });
      setEditingPlan(null);
      resetForm();
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Sessão expirada",
          description: "Fazendo login novamente...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Erro ao atualizar plano",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      slug: "",
      description: "",
      price: 0,
      maxArtifactsPerMonth: 10,
      tools: [],
      features: [],
      isActive: true,
    });
  };

  const openEditDialog = (plan: Plan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      slug: plan.slug,
      description: plan.description || "",
      price: plan.price || 0,
      maxArtifactsPerMonth: plan.maxArtifactsPerMonth || 10,
      tools: plan.tools || [],
      features: plan.features || [],
      isActive: plan.isActive ?? true,
    });
  };

  const handleToolToggle = (toolId: string) => {
    setFormData((prev) => {
      const tools = prev.tools || [];
      return {
        ...prev,
        tools: tools.includes(toolId)
          ? tools.filter((t) => t !== toolId)
          : [...tools, toolId],
      };
    });
  };

  const handleFeatureToggle = (feature: string) => {
    setFormData((prev) => {
      const features = prev.features || [];
      return {
        ...prev,
        features: features.includes(feature)
          ? features.filter((f) => f !== feature)
          : [...features, feature],
      };
    });
  };

  const handleSubmit = () => {
    if (!formData.name?.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Informe o nome do plano.",
        variant: "destructive",
      });
      return;
    }
    if (!formData.slug?.trim()) {
      toast({
        title: "Slug obrigatório",
        description: "Informe o slug do plano.",
        variant: "destructive",
      });
      return;
    }

    if (editingPlan) {
      updateMutation.mutate({
        id: editingPlan.id,
        ...formData,
      } as { id: string } & InsertPlan);
    } else {
      createMutation.mutate(formData as InsertPlan);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price / 100);
  };

  const PlanForm = () => (
    <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nome</Label>
          <Input
            id="name"
            value={formData.name || ""}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Ex: Premium"
            data-testid="input-plan-name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug">Slug</Label>
          <Input
            id="slug"
            value={formData.slug || ""}
            onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value.toLowerCase() }))}
            placeholder="Ex: premium"
            data-testid="input-plan-slug"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Descrição</Label>
        <Textarea
          id="description"
          value={formData.description || ""}
          onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
          placeholder="Descreva os benefícios do plano"
          data-testid="input-plan-description"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="price">Preço (centavos)</Label>
          <Input
            id="price"
            type="number"
            value={formData.price || 0}
            onChange={(e) => setFormData((prev) => ({ ...prev, price: parseInt(e.target.value) || 0 }))}
            placeholder="Ex: 4900 para R$ 49,00"
            data-testid="input-plan-price"
          />
          <p className="text-xs text-muted-foreground">
            {formatPrice(formData.price || 0)}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="maxArtifacts">Artefatos/mês</Label>
          <Input
            id="maxArtifacts"
            type="number"
            value={formData.maxArtifactsPerMonth || 10}
            onChange={(e) => setFormData((prev) => ({ ...prev, maxArtifactsPerMonth: parseInt(e.target.value) || 10 }))}
            placeholder="Ex: 100"
            data-testid="input-plan-artifacts"
          />
          <p className="text-xs text-muted-foreground">
            Use 0 para ilimitado
          </p>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Ferramentas Disponíveis</Label>
        <div className="grid grid-cols-2 gap-2 border rounded-md p-3">
          {toolOptions.map((tool) => (
            <div key={tool.id} className="flex items-center gap-2">
              <Checkbox
                id={`tool-${tool.id}`}
                checked={formData.tools?.includes(tool.id)}
                onCheckedChange={() => handleToolToggle(tool.id)}
                data-testid={`checkbox-tool-${tool.id}`}
              />
              <Label htmlFor={`tool-${tool.id}`} className="text-sm cursor-pointer">
                {tool.label}
              </Label>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Recursos Adicionais</Label>
        <div className="grid grid-cols-2 gap-2 border rounded-md p-3">
          {featureOptions.map((feature) => (
            <div key={feature} className="flex items-center gap-2">
              <Checkbox
                id={`feature-${feature}`}
                checked={formData.features?.includes(feature)}
                onCheckedChange={() => handleFeatureToggle(feature)}
                data-testid={`checkbox-feature-${feature.replace(/\s+/g, "-").toLowerCase()}`}
              />
              <Label htmlFor={`feature-${feature}`} className="text-sm cursor-pointer">
                {feature}
              </Label>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>Plano Ativo</Label>
          <p className="text-xs text-muted-foreground">
            Planos inativos não são exibidos para novos usuários
          </p>
        </div>
        <Switch
          checked={formData.isActive ?? true}
          onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, isActive: checked }))}
          data-testid="switch-plan-active"
        />
      </div>
    </div>
  );

  if (authLoading) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid md:grid-cols-3 gap-6">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">Gerenciar Planos</h1>
            <p className="text-muted-foreground">
              Crie e edite planos de assinatura
            </p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()} data-testid="button-create-plan">
                <Plus className="mr-2 h-4 w-4" />
                Novo Plano
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Criar Novo Plano</DialogTitle>
                <DialogDescription>
                  Configure as opções do novo plano de assinatura
                </DialogDescription>
              </DialogHeader>
              <PlanForm />
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)} data-testid="button-cancel-create">
                  Cancelar
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={createMutation.isPending}
                  data-testid="button-save-plan"
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    "Criar Plano"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {plansLoading ? (
          <div className="grid md:grid-cols-3 gap-6">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {plans?.map((plan) => (
              <Card key={plan.id} className={!plan.isActive ? "opacity-60" : ""} data-testid={`card-plan-${plan.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Crown className="h-5 w-5 text-primary" />
                    </div>
                    {!plan.isActive && (
                      <Badge variant="secondary" data-testid={`badge-inactive-${plan.id}`}>Inativo</Badge>
                    )}
                  </div>
                  <CardTitle className="mt-4" data-testid={`text-plan-name-${plan.id}`}>{plan.name}</CardTitle>
                  <CardDescription>
                    {plan.description || plan.slug}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <span className="text-3xl font-bold" data-testid={`text-plan-price-${plan.id}`}>
                      {formatPrice(plan.price || 0)}
                    </span>
                    <span className="text-muted-foreground">/mês</span>
                  </div>
                  <div className="space-y-2 mb-4">
                    <p className="text-sm text-muted-foreground" data-testid={`text-plan-artifacts-${plan.id}`}>
                      {plan.maxArtifactsPerMonth === 0
                        ? "Artefatos ilimitados"
                        : `${plan.maxArtifactsPerMonth} artefatos/mês`}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {(plan.tools || []).map((tool) => (
                        <Badge key={tool} variant="outline" className="text-xs">
                          {toolOptions.find((t) => t.id === tool)?.label || tool}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <ul className="space-y-1 mb-4 text-sm">
                    {(plan.features || []).slice(0, 3).map((feature) => (
                      <li key={feature} className="flex items-center gap-2">
                        <CheckCircle2 className="h-3 w-3 text-primary" />
                        {feature}
                      </li>
                    ))}
                    {(plan.features || []).length > 3 && (
                      <li className="text-muted-foreground">
                        +{(plan.features || []).length - 3} mais
                      </li>
                    )}
                  </ul>
                  <Dialog open={editingPlan?.id === plan.id} onOpenChange={(open) => !open && setEditingPlan(null)}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => openEditDialog(plan)}
                        data-testid={`button-edit-plan-${plan.id}`}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar Plano
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Editar Plano</DialogTitle>
                        <DialogDescription>
                          Atualize as configurações do plano
                        </DialogDescription>
                      </DialogHeader>
                      <PlanForm />
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingPlan(null)} data-testid="button-cancel-edit">
                          Cancelar
                        </Button>
                        <Button
                          onClick={handleSubmit}
                          disabled={updateMutation.isPending}
                          data-testid="button-update-plan"
                        >
                          {updateMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Salvando...
                            </>
                          ) : (
                            "Salvar"
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
