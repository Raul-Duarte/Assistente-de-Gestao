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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Pencil,
  Loader2,
  Search,
  UserCheck,
  UserX,
} from "lucide-react";
import type { User, Profile, Plan } from "@shared/schema";

interface UserWithRelations extends User {
  profile?: Profile;
  plan?: Plan;
}

export default function AdminUsers() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [editingUser, setEditingUser] = useState<UserWithRelations | null>(null);

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

  const { data: users, isLoading: usersLoading } = useQuery<UserWithRelations[]>({
    queryKey: ["/api/admin/users"],
    enabled: isAuthenticated,
  });

  const { data: profiles } = useQuery<Profile[]>({
    queryKey: ["/api/admin/profiles"],
    enabled: isAuthenticated,
  });

  const { data: plans } = useQuery<Plan[]>({
    queryKey: ["/api/admin/plans"],
    enabled: isAuthenticated,
  });

  const updateUserMutation = useMutation({
    mutationFn: async (data: { id: string; profileId?: string; planId?: string; isActive?: boolean }) => {
      return apiRequest("PATCH", `/api/admin/users/${data.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Usuário atualizado com sucesso!" });
      setEditingUser(null);
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
        title: "Erro ao atualizar usuário",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredUsers = users?.filter((user) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      user.email?.toLowerCase().includes(searchLower) ||
      user.firstName?.toLowerCase().includes(searchLower) ||
      user.lastName?.toLowerCase().includes(searchLower)
    );
  });

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.charAt(0) || "";
    const last = lastName?.charAt(0) || "";
    return (first + last).toUpperCase() || "U";
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
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Gerenciar Usuários</h1>
          <p className="text-muted-foreground">
            Visualize e edite os usuários do sistema
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle>Usuários</CardTitle>
                <CardDescription>
                  {users?.length || 0} usuários cadastrados
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar usuários..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-64"
                    data-testid="input-search-users"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {usersLoading ? (
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
                      <TableHead>Usuário</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Perfil</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Nenhum usuário encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers?.map((user) => (
                        <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={user.profileImageUrl || undefined} />
                                <AvatarFallback>
                                  {getInitials(user.firstName, user.lastName)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium" data-testid={`text-user-name-${user.id}`}>
                                {user.firstName} {user.lastName}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell data-testid={`text-user-email-${user.id}`}>{user.email}</TableCell>
                          <TableCell>
                            <Badge variant="outline" data-testid={`badge-user-profile-${user.id}`}>
                              {user.profile?.name || "Cliente"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" data-testid={`badge-user-plan-${user.id}`}>
                              {user.plan?.name || "Free"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {user.isActive ? (
                              <Badge className="bg-green-500/10 text-green-600 border-green-500/20" data-testid={`badge-user-status-${user.id}`}>
                                <UserCheck className="mr-1 h-3 w-3" />
                                Ativo
                              </Badge>
                            ) : (
                              <Badge variant="destructive" data-testid={`badge-user-status-${user.id}`}>
                                <UserX className="mr-1 h-3 w-3" />
                                Inativo
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Dialog open={editingUser?.id === user.id} onOpenChange={(open) => !open && setEditingUser(null)}>
                              <DialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setEditingUser(user)}
                                  data-testid={`button-edit-user-${user.id}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Editar Usuário</DialogTitle>
                                  <DialogDescription>
                                    Atualize o perfil e plano do usuário
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                  <div className="flex items-center gap-3 mb-4">
                                    <Avatar className="h-12 w-12">
                                      <AvatarImage src={editingUser?.profileImageUrl || undefined} />
                                      <AvatarFallback>
                                        {getInitials(editingUser?.firstName, editingUser?.lastName)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div>
                                      <p className="font-medium">
                                        {editingUser?.firstName} {editingUser?.lastName}
                                      </p>
                                      <p className="text-sm text-muted-foreground">
                                        {editingUser?.email}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Perfil</Label>
                                    <Select
                                      defaultValue={editingUser?.profileId || ""}
                                      onValueChange={(value) =>
                                        setEditingUser((prev) =>
                                          prev ? { ...prev, profileId: value } : null
                                        )
                                      }
                                    >
                                      <SelectTrigger data-testid="select-user-profile">
                                        <SelectValue placeholder="Selecione um perfil" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {profiles?.map((profile) => (
                                          <SelectItem key={profile.id} value={profile.id} data-testid={`option-profile-${profile.id}`}>
                                            {profile.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Plano</Label>
                                    <Select
                                      defaultValue={editingUser?.planId || ""}
                                      onValueChange={(value) =>
                                        setEditingUser((prev) =>
                                          prev ? { ...prev, planId: value } : null
                                        )
                                      }
                                    >
                                      <SelectTrigger data-testid="select-user-plan">
                                        <SelectValue placeholder="Selecione um plano" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {plans?.map((plan) => (
                                          <SelectItem key={plan.id} value={plan.id} data-testid={`option-plan-${plan.id}`}>
                                            {plan.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button
                                    variant="outline"
                                    onClick={() => setEditingUser(null)}
                                    data-testid="button-cancel-edit"
                                  >
                                    Cancelar
                                  </Button>
                                  <Button
                                    onClick={() =>
                                      editingUser &&
                                      updateUserMutation.mutate({
                                        id: editingUser.id,
                                        profileId: editingUser.profileId || undefined,
                                        planId: editingUser.planId || undefined,
                                      })
                                    }
                                    disabled={updateUserMutation.isPending}
                                    data-testid="button-save-user"
                                  >
                                    {updateUserMutation.isPending ? (
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
