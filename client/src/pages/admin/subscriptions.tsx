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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Loader2,
  Search,
  Plus,
  Play,
  XCircle,
  Filter,
} from "lucide-react";
import type { Client, Plan, Subscription } from "@shared/schema";

interface SubscriptionWithRelations extends Subscription {
  client?: Client;
  plan?: Plan;
}

interface SubscriptionForm {
  clientId: string;
  planId: string;
  startDate: string;
  billingDay: number;
}

const initialForm: SubscriptionForm = {
  clientId: "",
  planId: "",
  startDate: new Date().toISOString().split("T")[0],
  billingDay: 1,
};

export default function AdminSubscriptions() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState<SubscriptionForm>(initialForm);
  const [selectedPlanFilters, setSelectedPlanFilters] = useState<string[]>([]);

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

  // Initialize plan filters with all plans selected by default
  useEffect(() => {
    if (plans && plans.length > 0 && selectedPlanFilters.length === 0) {
      setSelectedPlanFilters(plans.map(p => p.id));
    }
  }, [plans, selectedPlanFilters.length]);

  const { data: subscriptions, isLoading } = useQuery<SubscriptionWithRelations[]>({
    queryKey: ["/api/admin/subscriptions"],
    enabled: isAuthenticated,
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/admin/clients"],
    enabled: isAuthenticated,
  });

  const { data: plans } = useQuery<Plan[]>({
    queryKey: ["/api/admin/plans"],
    enabled: isAuthenticated,
  });

  const createMutation = useMutation({
    mutationFn: async (data: SubscriptionForm) => {
      const response = await apiRequest("POST", "/api/admin/subscriptions", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invoices"] });
      toast({ title: "Assinatura criada com sucesso!" });
      setIsCreateOpen(false);
      setForm(initialForm);
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
        title: "Erro ao criar assinatura",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/admin/subscriptions/${id}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscriptions"] });
      toast({ title: "Assinatura cancelada com sucesso!" });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao cancelar assinatura",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const activateMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/admin/subscriptions/${id}/activate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscriptions"] });
      toast({ title: "Assinatura ativada com sucesso!" });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao ativar assinatura",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreate = () => {
    if (!form.clientId || !form.planId || !form.startDate) {
      toast({
        title: "Campos obrigatórios",
        description: "Cliente, plano e data de início são obrigatórios.",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(form);
  };

  const togglePlanFilter = (planId: string) => {
    setSelectedPlanFilters(prev =>
      prev.includes(planId)
        ? prev.filter(id => id !== planId)
        : [...prev, planId]
    );
  };

  const selectAllPlans = () => {
    if (plans) {
      setSelectedPlanFilters(plans.map(p => p.id));
    }
  };

  const clearAllPlans = () => {
    setSelectedPlanFilters([]);
  };

  const filteredSubscriptions = subscriptions?.filter((sub) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = (
      sub.client?.name.toLowerCase().includes(searchLower) ||
      sub.plan?.name.toLowerCase().includes(searchLower)
    );
    const matchesPlanFilter = selectedPlanFilters.length === 0 || 
      (sub.planId && selectedPlanFilters.includes(sub.planId));
    return matchesSearch && matchesPlanFilter;
  });

  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("pt-BR");
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ativa":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Ativa</Badge>;
      case "cancelada":
        return <Badge variant="destructive">Cancelada</Badge>;
      case "suspensa":
        return <Badge variant="secondary">Suspensa</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (authLoading) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-96" />
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
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Assinaturas</h1>
          <p className="text-muted-foreground">
            Gerencie as assinaturas dos clientes
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle>Assinaturas</CardTitle>
                <CardDescription>
                  {subscriptions?.length || 0} assinaturas cadastradas
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar assinaturas..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-64"
                    data-testid="input-search-subscriptions"
                  />
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" data-testid="button-plan-filter">
                      <Filter className="mr-2 h-4 w-4" />
                      Filtrar Planos
                      {selectedPlanFilters.length > 0 && plans && selectedPlanFilters.length < plans.length && (
                        <Badge variant="secondary" className="ml-2">
                          {selectedPlanFilters.length}
                        </Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56" align="start">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">Planos</span>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={selectAllPlans}
                            data-testid="button-select-all-plans"
                          >
                            Todos
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={clearAllPlans}
                            data-testid="button-clear-plans"
                          >
                            Limpar
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {plans?.map((plan) => (
                          <div key={plan.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`plan-filter-${plan.id}`}
                              checked={selectedPlanFilters.includes(plan.id)}
                              onCheckedChange={() => togglePlanFilter(plan.id)}
                              data-testid={`checkbox-plan-${plan.slug}`}
                            />
                            <label
                              htmlFor={`plan-filter-${plan.id}`}
                              className="text-sm cursor-pointer flex-1"
                            >
                              {plan.name}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-new-subscription">
                      <Plus className="mr-2 h-4 w-4" />
                      Nova Assinatura
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Nova Assinatura</DialogTitle>
                      <DialogDescription>
                        Vincule um cliente a um plano
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Cliente *</Label>
                        <Select
                          value={form.clientId}
                          onValueChange={(value) => setForm(prev => ({ ...prev, clientId: value }))}
                        >
                          <SelectTrigger data-testid="select-subscription-client">
                            <SelectValue placeholder="Selecione um cliente" />
                          </SelectTrigger>
                          <SelectContent>
                            {clients?.map((client) => (
                              <SelectItem key={client.id} value={client.id}>
                                {client.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Plano *</Label>
                        <Select
                          value={form.planId}
                          onValueChange={(value) => setForm(prev => ({ ...prev, planId: value }))}
                        >
                          <SelectTrigger data-testid="select-subscription-plan">
                            <SelectValue placeholder="Selecione um plano" />
                          </SelectTrigger>
                          <SelectContent>
                            {plans?.map((plan) => (
                              <SelectItem key={plan.id} value={plan.id}>
                                {plan.name} - {formatCurrency(plan.price || 0)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="startDate">Data de Início *</Label>
                          <Input
                            id="startDate"
                            type="date"
                            value={form.startDate}
                            onChange={(e) => setForm(prev => ({ ...prev, startDate: e.target.value }))}
                            data-testid="input-subscription-start-date"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="billingDay">Dia do Vencimento</Label>
                          <Input
                            id="billingDay"
                            type="number"
                            min={1}
                            max={28}
                            value={form.billingDay}
                            onChange={(e) => setForm(prev => ({ ...prev, billingDay: parseInt(e.target.value) || 1 }))}
                            data-testid="input-subscription-billing-day"
                          />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsCreateOpen(false);
                          setForm(initialForm);
                        }}
                        data-testid="button-cancel-create"
                      >
                        Cancelar
                      </Button>
                      <Button
                        onClick={handleCreate}
                        disabled={createMutation.isPending}
                        data-testid="button-save-subscription"
                      >
                        {createMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Salvando...
                          </>
                        ) : (
                          "Criar Assinatura"
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Início</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSubscriptions?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Nenhuma assinatura encontrada
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredSubscriptions?.map((sub) => (
                        <TableRow key={sub.id} data-testid={`row-subscription-${sub.id}`}>
                          <TableCell className="font-medium" data-testid={`text-subscription-client-${sub.id}`}>
                            {sub.client?.name || "-"}
                          </TableCell>
                          <TableCell data-testid={`text-subscription-plan-${sub.id}`}>
                            {sub.plan?.name || "-"}
                          </TableCell>
                          <TableCell data-testid={`text-subscription-price-${sub.id}`}>
                            {formatCurrency(sub.plan?.price || 0)}
                          </TableCell>
                          <TableCell data-testid={`text-subscription-start-${sub.id}`}>
                            {formatDate(sub.startDate)}
                          </TableCell>
                          <TableCell data-testid={`text-subscription-billing-${sub.id}`}>
                            Dia {sub.billingDay}
                          </TableCell>
                          <TableCell data-testid={`badge-subscription-status-${sub.id}`}>
                            {getStatusBadge(sub.status)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {sub.status === "cancelada" ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => activateMutation.mutate(sub.id)}
                                  disabled={activateMutation.isPending}
                                  data-testid={`button-activate-subscription-${sub.id}`}
                                >
                                  <Play className="h-4 w-4 text-green-600" />
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    if (confirm("Deseja realmente cancelar esta assinatura?")) {
                                      cancelMutation.mutate(sub.id);
                                    }
                                  }}
                                  disabled={cancelMutation.isPending}
                                  data-testid={`button-cancel-subscription-${sub.id}`}
                                >
                                  <XCircle className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
