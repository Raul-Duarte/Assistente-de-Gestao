import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Filter,
} from "lucide-react";
import type { Client, Plan } from "@shared/schema";

interface FinancialReport {
  byMonth: Record<string, {
    invoiced: number;
    paid: number;
    pending: number;
    overdue: number;
  }>;
  totals: {
    totalInvoiced: number;
    totalPaid: number;
    totalPending: number;
    totalOverdue: number;
  };
}

interface ClientReport {
  clients: Client[];
  total: number;
}

export default function AdminReports() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [selectedPlanFilters, setSelectedPlanFilters] = useState<string[]>([]);
  const hasInitializedFiltersRef = useRef(false);

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

  const { data: plans } = useQuery<Plan[]>({
    queryKey: ["/api/admin/plans"],
    enabled: isAuthenticated,
  });

  // Initialize plan filters with all plans selected by default (only once)
  useEffect(() => {
    if (plans && plans.length > 0 && !hasInitializedFiltersRef.current) {
      setSelectedPlanFilters(plans.map(p => p.id));
      hasInitializedFiltersRef.current = true;
    }
  }, [plans]);

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

  const { data: activeClients, isLoading: loadingActive } = useQuery<ClientReport>({
    queryKey: ["/api/admin/reports/active-clients"],
    enabled: isAuthenticated,
  });

  const { data: overdueClients, isLoading: loadingOverdue } = useQuery<ClientReport>({
    queryKey: ["/api/admin/reports/overdue-clients"],
    enabled: isAuthenticated,
  });

  const { data: financial, isLoading: loadingFinancial } = useQuery<FinancialReport>({
    queryKey: ["/api/admin/reports/financial"],
    enabled: isAuthenticated,
  });

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  const formatMonth = (month: string) => {
    const [year, m] = month.split("-");
    const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    return `${months[parseInt(m) - 1]} ${year}`;
  };

  const formatCpf = (cpf: string) => {
    const cleaned = cpf.replace(/\D/g, "");
    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    return cpf;
  };

  const sortedMonths = financial ? Object.keys(financial.byMonth).sort().reverse() : [];

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
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Relatórios</h1>
          <p className="text-muted-foreground">
            Visualize os relatórios do sistema
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardDescription>Clientes Ativos</CardDescription>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="text-active-clients">
                {loadingActive ? <Skeleton className="h-8 w-16" /> : activeClients?.total || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardDescription>Inadimplentes</CardDescription>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive" data-testid="text-overdue-clients">
                {loadingOverdue ? <Skeleton className="h-8 w-16" /> : overdueClients?.total || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardDescription>Total Faturado</CardDescription>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-invoiced">
                {loadingFinancial ? <Skeleton className="h-8 w-24" /> : formatCurrency(financial?.totals.totalInvoiced || 0)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardDescription>Total Recebido</CardDescription>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="text-total-received">
                {loadingFinancial ? <Skeleton className="h-8 w-24" /> : formatCurrency(financial?.totals.totalPaid || 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="financial" className="space-y-4">
          <TabsList>
            <TabsTrigger value="financial" data-testid="tab-financial">Financeiro</TabsTrigger>
            <TabsTrigger value="active" data-testid="tab-active">Clientes Ativos</TabsTrigger>
            <TabsTrigger value="overdue" data-testid="tab-overdue">Inadimplentes</TabsTrigger>
          </TabsList>

          <TabsContent value="financial">
            <Card>
              <CardHeader>
                <CardTitle>Relatório Financeiro por Mês</CardTitle>
                <CardDescription>
                  Resumo das mensalidades agrupadas por mês de competência
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingFinancial ? (
                  <div className="space-y-3">
                    <Skeleton className="h-16" />
                    <Skeleton className="h-16" />
                    <Skeleton className="h-16" />
                  </div>
                ) : sortedMonths.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">
                    Nenhum dado financeiro disponível
                  </p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Mês</TableHead>
                          <TableHead className="text-right">Faturado</TableHead>
                          <TableHead className="text-right">Pago</TableHead>
                          <TableHead className="text-right">Pendente</TableHead>
                          <TableHead className="text-right">Atrasado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedMonths.map((month) => {
                          const data = financial!.byMonth[month];
                          return (
                            <TableRow key={month} data-testid={`row-month-${month}`}>
                              <TableCell className="font-medium">
                                {formatMonth(month)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(data.invoiced)}
                              </TableCell>
                              <TableCell className="text-right text-green-600">
                                {formatCurrency(data.paid)}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {formatCurrency(data.pending)}
                              </TableCell>
                              <TableCell className="text-right text-destructive">
                                {formatCurrency(data.overdue)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        <TableRow className="bg-muted/50 font-medium">
                          <TableCell>Total</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(financial?.totals.totalInvoiced || 0)}
                          </TableCell>
                          <TableCell className="text-right text-green-600">
                            {formatCurrency(financial?.totals.totalPaid || 0)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatCurrency(financial?.totals.totalPending || 0)}
                          </TableCell>
                          <TableCell className="text-right text-destructive">
                            {formatCurrency(financial?.totals.totalOverdue || 0)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="active">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle>Clientes Ativos</CardTitle>
                  <CardDescription>
                    Lista de clientes com status ativo no sistema
                  </CardDescription>
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" data-testid="button-plan-filter-active">
                      <Filter className="mr-2 h-4 w-4" />
                      Filtrar Planos
                      {selectedPlanFilters.length > 0 && plans && selectedPlanFilters.length < plans.length && (
                        <Badge variant="secondary" className="ml-2">
                          {selectedPlanFilters.length}
                        </Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56" align="end">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">Planos</span>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={selectAllPlans}
                            data-testid="button-select-all-plans-active"
                          >
                            Todos
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={clearAllPlans}
                            data-testid="button-clear-plans-active"
                          >
                            Limpar
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {plans?.map((plan) => (
                          <div key={plan.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`plan-filter-active-${plan.id}`}
                              checked={selectedPlanFilters.includes(plan.id)}
                              onCheckedChange={() => togglePlanFilter(plan.id)}
                              data-testid={`checkbox-plan-active-${plan.slug}`}
                            />
                            <label
                              htmlFor={`plan-filter-active-${plan.id}`}
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
              </CardHeader>
              <CardContent>
                {loadingActive ? (
                  <div className="space-y-3">
                    <Skeleton className="h-16" />
                    <Skeleton className="h-16" />
                    <Skeleton className="h-16" />
                  </div>
                ) : !activeClients?.clients.length ? (
                  <p className="text-center py-8 text-muted-foreground">
                    Nenhum cliente ativo encontrado
                  </p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>CPF</TableHead>
                          <TableHead>Telefone</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activeClients.clients.map((client) => (
                          <TableRow key={client.id} data-testid={`row-active-client-${client.id}`}>
                            <TableCell className="font-medium">{client.name}</TableCell>
                            <TableCell>{client.email}</TableCell>
                            <TableCell>{formatCpf(client.cpf)}</TableCell>
                            <TableCell>{client.phone || "-"}</TableCell>
                            <TableCell>
                              <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                                Ativo
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="overdue">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle>Clientes Inadimplentes</CardTitle>
                  <CardDescription>
                    Lista de clientes com mensalidades em atraso
                  </CardDescription>
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" data-testid="button-plan-filter-overdue">
                      <Filter className="mr-2 h-4 w-4" />
                      Filtrar Planos
                      {selectedPlanFilters.length > 0 && plans && selectedPlanFilters.length < plans.length && (
                        <Badge variant="secondary" className="ml-2">
                          {selectedPlanFilters.length}
                        </Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56" align="end">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">Planos</span>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={selectAllPlans}
                            data-testid="button-select-all-plans-overdue"
                          >
                            Todos
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={clearAllPlans}
                            data-testid="button-clear-plans-overdue"
                          >
                            Limpar
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {plans?.map((plan) => (
                          <div key={plan.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`plan-filter-overdue-${plan.id}`}
                              checked={selectedPlanFilters.includes(plan.id)}
                              onCheckedChange={() => togglePlanFilter(plan.id)}
                              data-testid={`checkbox-plan-overdue-${plan.slug}`}
                            />
                            <label
                              htmlFor={`plan-filter-overdue-${plan.id}`}
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
              </CardHeader>
              <CardContent>
                {loadingOverdue ? (
                  <div className="space-y-3">
                    <Skeleton className="h-16" />
                    <Skeleton className="h-16" />
                    <Skeleton className="h-16" />
                  </div>
                ) : !overdueClients?.clients.length ? (
                  <p className="text-center py-8 text-muted-foreground">
                    Nenhum cliente inadimplente encontrado
                  </p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>CPF</TableHead>
                          <TableHead>Telefone</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {overdueClients.clients.map((client) => (
                          <TableRow key={client.id} data-testid={`row-overdue-client-${client.id}`}>
                            <TableCell className="font-medium">{client.name}</TableCell>
                            <TableCell>{client.email}</TableCell>
                            <TableCell>{formatCpf(client.cpf)}</TableCell>
                            <TableCell>{client.phone || "-"}</TableCell>
                            <TableCell>
                              <Badge variant="destructive">
                                Inadimplente
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
