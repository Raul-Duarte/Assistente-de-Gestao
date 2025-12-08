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
import {
  Search,
  Plus,
  Loader2,
  CreditCard,
  Banknote,
  QrCode,
} from "lucide-react";
import type { Client, Invoice, Payment } from "@shared/schema";

interface PaymentWithRelations extends Payment {
  client?: Client;
  invoice?: Invoice;
}

interface InvoiceWithClient extends Invoice {
  client?: Client;
}

interface PaymentForm {
  invoiceId: string;
  amount: string;
  paymentMethod: string;
  notes: string;
}

const initialForm: PaymentForm = {
  invoiceId: "",
  amount: "",
  paymentMethod: "manual",
  notes: "",
};

export default function AdminPayments() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState<PaymentForm>(initialForm);

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

  const { data: payments, isLoading } = useQuery<PaymentWithRelations[]>({
    queryKey: ["/api/admin/payments"],
    enabled: isAuthenticated,
  });

  const { data: invoices } = useQuery<InvoiceWithClient[]>({
    queryKey: ["/api/admin/invoices"],
    enabled: isAuthenticated,
  });

  const pendingInvoices = invoices?.filter(inv => inv.status !== "paga") || [];

  const createMutation = useMutation({
    mutationFn: async (data: PaymentForm) => {
      const response = await apiRequest("POST", "/api/admin/payments", {
        invoiceId: data.invoiceId,
        amount: Math.round(parseFloat(data.amount) * 100),
        paymentMethod: data.paymentMethod,
        notes: data.notes || undefined,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/clients"] });
      toast({ title: "Pagamento registrado com sucesso!" });
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
        title: "Erro ao registrar pagamento",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreate = () => {
    if (!form.invoiceId || !form.amount) {
      toast({
        title: "Campos obrigatórios",
        description: "Selecione uma mensalidade e informe o valor.",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(form);
  };

  const handleSelectInvoice = (invoiceId: string) => {
    const invoice = invoices?.find(inv => inv.id === invoiceId);
    setForm(prev => ({
      ...prev,
      invoiceId,
      amount: invoice ? (invoice.amount / 100).toFixed(2) : "",
    }));
  };

  const filteredPayments = payments?.filter((payment) => {
    const searchLower = searchQuery.toLowerCase();
    return payment.client?.name.toLowerCase().includes(searchLower);
  });

  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("pt-BR");
  };

  const formatDateTime = (date: Date | string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleString("pt-BR");
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  const formatMonth = (month: string) => {
    const [year, m] = month.split("-");
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return `${months[parseInt(m) - 1]}/${year}`;
  };

  const getPaymentMethodIcon = (method: string | null) => {
    switch (method) {
      case "pix":
        return <QrCode className="h-4 w-4" />;
      case "cartao":
        return <CreditCard className="h-4 w-4" />;
      default:
        return <Banknote className="h-4 w-4" />;
    }
  };

  const getPaymentMethodLabel = (method: string | null) => {
    switch (method) {
      case "pix":
        return "PIX";
      case "cartao":
        return "Cartão";
      case "boleto":
        return "Boleto";
      case "manual":
        return "Manual";
      default:
        return method || "Manual";
    }
  };

  const totalReceived = payments?.reduce((sum, p) => sum + p.amount, 0) || 0;

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
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Pagamentos</h1>
          <p className="text-muted-foreground">
            Registre e acompanhe os pagamentos
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Recebido</CardDescription>
              <CardTitle className="text-2xl text-green-600" data-testid="text-total-received">
                {formatCurrency(totalReceived)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pagamentos Registrados</CardDescription>
              <CardTitle className="text-2xl" data-testid="text-total-payments">
                {payments?.length || 0}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle>Pagamentos</CardTitle>
                <CardDescription>
                  Histórico de pagamentos registrados
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar pagamentos..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-64"
                    data-testid="input-search-payments"
                  />
                </div>
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-new-payment">
                      <Plus className="mr-2 h-4 w-4" />
                      Registrar Pagamento
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Registrar Pagamento</DialogTitle>
                      <DialogDescription>
                        Registre um pagamento manualmente
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Mensalidade *</Label>
                        <Select
                          value={form.invoiceId}
                          onValueChange={handleSelectInvoice}
                        >
                          <SelectTrigger data-testid="select-payment-invoice">
                            <SelectValue placeholder="Selecione uma mensalidade" />
                          </SelectTrigger>
                          <SelectContent>
                            {pendingInvoices.length === 0 ? (
                              <SelectItem value="none" disabled>
                                Nenhuma mensalidade pendente
                              </SelectItem>
                            ) : (
                              pendingInvoices.map((invoice) => (
                                <SelectItem key={invoice.id} value={invoice.id}>
                                  {invoice.client?.name} - {formatMonth(invoice.referenceMonth)} - {formatCurrency(invoice.amount)}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="amount">Valor *</Label>
                          <Input
                            id="amount"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={form.amount}
                            onChange={(e) => setForm(prev => ({ ...prev, amount: e.target.value }))}
                            data-testid="input-payment-amount"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Forma de Pagamento</Label>
                          <Select
                            value={form.paymentMethod}
                            onValueChange={(value) => setForm(prev => ({ ...prev, paymentMethod: value }))}
                          >
                            <SelectTrigger data-testid="select-payment-method">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="manual">Manual</SelectItem>
                              <SelectItem value="pix">PIX</SelectItem>
                              <SelectItem value="cartao">Cartão</SelectItem>
                              <SelectItem value="boleto">Boleto</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="notes">Observações</Label>
                        <Textarea
                          id="notes"
                          placeholder="Notas sobre o pagamento..."
                          value={form.notes}
                          onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                          data-testid="input-payment-notes"
                        />
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
                        data-testid="button-save-payment"
                      >
                        {createMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Salvando...
                          </>
                        ) : (
                          "Registrar"
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
                      <TableHead>Referência</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Forma</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayments?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Nenhum pagamento encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredPayments?.map((payment) => (
                        <TableRow key={payment.id} data-testid={`row-payment-${payment.id}`}>
                          <TableCell className="font-medium" data-testid={`text-payment-client-${payment.id}`}>
                            {payment.client?.name || "-"}
                          </TableCell>
                          <TableCell data-testid={`text-payment-ref-${payment.id}`}>
                            {payment.invoice?.referenceMonth ? formatMonth(payment.invoice.referenceMonth) : "-"}
                          </TableCell>
                          <TableCell data-testid={`text-payment-amount-${payment.id}`}>
                            {formatCurrency(payment.amount)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getPaymentMethodIcon(payment.paymentMethod)}
                              <span data-testid={`text-payment-method-${payment.id}`}>
                                {getPaymentMethodLabel(payment.paymentMethod)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell data-testid={`text-payment-date-${payment.id}`}>
                            {formatDateTime(payment.paymentDate)}
                          </TableCell>
                          <TableCell data-testid={`badge-payment-status-${payment.id}`}>
                            <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                              Aprovado
                            </Badge>
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
