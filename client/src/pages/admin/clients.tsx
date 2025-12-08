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
  Pencil,
  Loader2,
  Search,
  Plus,
  Trash2,
  UserCheck,
  UserX,
} from "lucide-react";
import type { Client } from "@shared/schema";

interface ClientForm {
  name: string;
  email: string;
  phone: string;
  cpf: string;
  address: string;
}

const initialForm: ClientForm = {
  name: "",
  email: "",
  phone: "",
  cpf: "",
  address: "",
};

export default function AdminClients() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState<ClientForm>(initialForm);

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

  const { data: clients, isLoading } = useQuery<Client[]>({
    queryKey: ["/api/admin/clients"],
    enabled: isAuthenticated,
  });

  const createMutation = useMutation({
    mutationFn: async (data: ClientForm) => {
      const response = await apiRequest("POST", "/api/admin/clients", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/clients"] });
      toast({ title: "Cliente cadastrado com sucesso!" });
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
        title: "Erro ao cadastrar cliente",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string } & Partial<ClientForm>) => {
      return apiRequest("PATCH", `/api/admin/clients/${data.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/clients"] });
      toast({ title: "Cliente atualizado com sucesso!" });
      setEditingClient(null);
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
        title: "Erro ao atualizar cliente",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/clients/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/clients"] });
      toast({ title: "Cliente excluído com sucesso!" });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir cliente",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreate = () => {
    if (!form.name.trim() || !form.email.trim() || !form.cpf.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Nome, email e CPF são obrigatórios.",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(form);
  };

  const handleUpdate = () => {
    if (!editingClient) return;
    updateMutation.mutate({
      id: editingClient.id,
      name: editingClient.name,
      email: editingClient.email,
      phone: editingClient.phone || undefined,
      cpf: editingClient.cpf,
      address: editingClient.address || undefined,
    });
  };

  const filteredClients = clients?.filter((client) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      client.name.toLowerCase().includes(searchLower) ||
      client.email.toLowerCase().includes(searchLower) ||
      client.cpf.includes(searchLower)
    );
  });

  const formatCpf = (cpf: string) => {
    const cleaned = cpf.replace(/\D/g, "");
    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    return cpf;
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
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Gestão de Clientes</h1>
          <p className="text-muted-foreground">
            Cadastre e gerencie seus clientes
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle>Clientes</CardTitle>
                <CardDescription>
                  {clients?.length || 0} clientes cadastrados
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar clientes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-64"
                    data-testid="input-search-clients"
                  />
                </div>
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-new-client">
                      <Plus className="mr-2 h-4 w-4" />
                      Novo Cliente
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Novo Cliente</DialogTitle>
                      <DialogDescription>
                        Cadastre um novo cliente no sistema
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Nome *</Label>
                        <Input
                          id="name"
                          placeholder="Nome completo"
                          value={form.name}
                          onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                          data-testid="input-client-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email *</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="cliente@email.com"
                          value={form.email}
                          onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                          data-testid="input-client-email"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="cpf">CPF *</Label>
                          <Input
                            id="cpf"
                            placeholder="000.000.000-00"
                            value={form.cpf}
                            onChange={(e) => setForm(prev => ({ ...prev, cpf: e.target.value }))}
                            data-testid="input-client-cpf"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="phone">Telefone</Label>
                          <Input
                            id="phone"
                            placeholder="(00) 00000-0000"
                            value={form.phone}
                            onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))}
                            data-testid="input-client-phone"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="address">Endereço</Label>
                        <Textarea
                          id="address"
                          placeholder="Endereço completo"
                          value={form.address}
                          onChange={(e) => setForm(prev => ({ ...prev, address: e.target.value }))}
                          data-testid="input-client-address"
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
                        data-testid="button-save-client"
                      >
                        {createMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Salvando...
                          </>
                        ) : (
                          "Cadastrar"
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
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClients?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Nenhum cliente encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredClients?.map((client) => (
                        <TableRow key={client.id} data-testid={`row-client-${client.id}`}>
                          <TableCell className="font-medium" data-testid={`text-client-name-${client.id}`}>
                            {client.name}
                          </TableCell>
                          <TableCell data-testid={`text-client-email-${client.id}`}>
                            {client.email}
                          </TableCell>
                          <TableCell data-testid={`text-client-cpf-${client.id}`}>
                            {formatCpf(client.cpf)}
                          </TableCell>
                          <TableCell data-testid={`text-client-phone-${client.id}`}>
                            {client.phone || "-"}
                          </TableCell>
                          <TableCell>
                            {client.status === "ativo" ? (
                              <Badge className="bg-green-500/10 text-green-600 border-green-500/20" data-testid={`badge-client-status-${client.id}`}>
                                <UserCheck className="mr-1 h-3 w-3" />
                                Ativo
                              </Badge>
                            ) : (
                              <Badge variant="destructive" data-testid={`badge-client-status-${client.id}`}>
                                <UserX className="mr-1 h-3 w-3" />
                                Inadimplente
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Dialog open={editingClient?.id === client.id} onOpenChange={(open) => !open && setEditingClient(null)}>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setEditingClient(client)}
                                    data-testid={`button-edit-client-${client.id}`}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-md">
                                  <DialogHeader>
                                    <DialogTitle>Editar Cliente</DialogTitle>
                                    <DialogDescription>
                                      Atualize as informações do cliente
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                      <Label htmlFor="edit-name">Nome *</Label>
                                      <Input
                                        id="edit-name"
                                        value={editingClient?.name || ""}
                                        onChange={(e) =>
                                          setEditingClient((prev) =>
                                            prev ? { ...prev, name: e.target.value } : null
                                          )
                                        }
                                        data-testid="input-edit-client-name"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="edit-email">Email *</Label>
                                      <Input
                                        id="edit-email"
                                        type="email"
                                        value={editingClient?.email || ""}
                                        onChange={(e) =>
                                          setEditingClient((prev) =>
                                            prev ? { ...prev, email: e.target.value } : null
                                          )
                                        }
                                        data-testid="input-edit-client-email"
                                      />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                        <Label htmlFor="edit-cpf">CPF *</Label>
                                        <Input
                                          id="edit-cpf"
                                          value={editingClient?.cpf || ""}
                                          onChange={(e) =>
                                            setEditingClient((prev) =>
                                              prev ? { ...prev, cpf: e.target.value } : null
                                            )
                                          }
                                          data-testid="input-edit-client-cpf"
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label htmlFor="edit-phone">Telefone</Label>
                                        <Input
                                          id="edit-phone"
                                          value={editingClient?.phone || ""}
                                          onChange={(e) =>
                                            setEditingClient((prev) =>
                                              prev ? { ...prev, phone: e.target.value } : null
                                            )
                                          }
                                          data-testid="input-edit-client-phone"
                                        />
                                      </div>
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="edit-address">Endereço</Label>
                                      <Textarea
                                        id="edit-address"
                                        value={editingClient?.address || ""}
                                        onChange={(e) =>
                                          setEditingClient((prev) =>
                                            prev ? { ...prev, address: e.target.value } : null
                                          )
                                        }
                                        data-testid="input-edit-client-address"
                                      />
                                    </div>
                                  </div>
                                  <DialogFooter>
                                    <Button
                                      variant="outline"
                                      onClick={() => setEditingClient(null)}
                                      data-testid="button-cancel-edit"
                                    >
                                      Cancelar
                                    </Button>
                                    <Button
                                      onClick={handleUpdate}
                                      disabled={updateMutation.isPending}
                                      data-testid="button-save-edit"
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
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  if (confirm("Deseja realmente excluir este cliente?")) {
                                    deleteMutation.mutate(client.id);
                                  }
                                }}
                                data-testid={`button-delete-client-${client.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
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
