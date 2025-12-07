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
  Trash2,
  Loader2,
  Shield,
} from "lucide-react";
import type { Profile, InsertProfile } from "@shared/schema";

const allPermissions = [
  { id: "users.view", label: "Visualizar Usuários" },
  { id: "users.edit", label: "Editar Usuários" },
  { id: "users.delete", label: "Excluir Usuários" },
  { id: "profiles.view", label: "Visualizar Perfis" },
  { id: "profiles.edit", label: "Editar Perfis" },
  { id: "plans.view", label: "Visualizar Planos" },
  { id: "plans.edit", label: "Editar Planos" },
  { id: "artifacts.generate", label: "Gerar Artefatos" },
  { id: "artifacts.export", label: "Exportar Artefatos" },
];

export default function AdminProfiles() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [formData, setFormData] = useState<Partial<InsertProfile>>({
    name: "",
    description: "",
    permissions: [],
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

  const { data: profiles, isLoading: profilesLoading } = useQuery<Profile[]>({
    queryKey: ["/api/admin/profiles"],
    enabled: isAuthenticated,
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertProfile) => {
      return apiRequest("POST", "/api/admin/profiles", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/profiles"] });
      toast({ title: "Perfil criado com sucesso!" });
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
        title: "Erro ao criar perfil",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string } & Partial<InsertProfile>) => {
      return apiRequest("PATCH", `/api/admin/profiles/${data.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/profiles"] });
      toast({ title: "Perfil atualizado com sucesso!" });
      setEditingProfile(null);
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
        title: "Erro ao atualizar perfil",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/profiles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/profiles"] });
      toast({ title: "Perfil excluído com sucesso!" });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir perfil",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({ name: "", description: "", permissions: [] });
  };

  const openEditDialog = (profile: Profile) => {
    setEditingProfile(profile);
    setFormData({
      name: profile.name,
      description: profile.description || "",
      permissions: profile.permissions || [],
    });
  };

  const handlePermissionToggle = (permissionId: string) => {
    setFormData((prev) => {
      const permissions = prev.permissions || [];
      return {
        ...prev,
        permissions: permissions.includes(permissionId)
          ? permissions.filter((p) => p !== permissionId)
          : [...permissions, permissionId],
      };
    });
  };

  const handleSubmit = () => {
    if (!formData.name?.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Informe o nome do perfil.",
        variant: "destructive",
      });
      return;
    }

    if (editingProfile) {
      updateMutation.mutate({
        id: editingProfile.id,
        ...formData,
      } as { id: string } & InsertProfile);
    } else {
      createMutation.mutate(formData as InsertProfile);
    }
  };

  if (authLoading) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
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
            <h1 className="text-3xl font-bold" data-testid="text-page-title">Gerenciar Perfis</h1>
            <p className="text-muted-foreground">
              Crie e edite perfis de acesso
            </p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()} data-testid="button-create-profile">
                <Plus className="mr-2 h-4 w-4" />
                Novo Perfil
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Criar Novo Perfil</DialogTitle>
                <DialogDescription>
                  Defina o nome e as permissões do novo perfil
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={formData.name || ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Gerente"
                    data-testid="input-profile-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={formData.description || ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Descreva as responsabilidades deste perfil"
                    data-testid="input-profile-description"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Permissões</Label>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-md p-3">
                    {allPermissions.map((permission) => (
                      <div key={permission.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`perm-${permission.id}`}
                          checked={formData.permissions?.includes(permission.id)}
                          onCheckedChange={() => handlePermissionToggle(permission.id)}
                          data-testid={`checkbox-permission-${permission.id}`}
                        />
                        <Label htmlFor={`perm-${permission.id}`} className="text-sm cursor-pointer">
                          {permission.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)} data-testid="button-cancel-create">
                  Cancelar
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={createMutation.isPending}
                  data-testid="button-save-profile"
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    "Criar Perfil"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {profilesLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {profiles?.map((profile) => (
              <Card key={profile.id} data-testid={`card-profile-${profile.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Shield className="h-5 w-5 text-primary" />
                    </div>
                    {profile.isSystem && (
                      <Badge variant="secondary" data-testid={`badge-system-${profile.id}`}>Sistema</Badge>
                    )}
                  </div>
                  <CardTitle className="mt-4" data-testid={`text-profile-name-${profile.id}`}>{profile.name}</CardTitle>
                  <CardDescription>
                    {profile.description || "Sem descrição"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1 mb-4">
                    {(profile.permissions || []).slice(0, 3).map((perm) => (
                      <Badge key={perm} variant="outline" className="text-xs">
                        {allPermissions.find((p) => p.id === perm)?.label || perm}
                      </Badge>
                    ))}
                    {(profile.permissions || []).length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{(profile.permissions || []).length - 3}
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Dialog open={editingProfile?.id === profile.id} onOpenChange={(open) => !open && setEditingProfile(null)}>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => openEditDialog(profile)}
                          disabled={profile.isSystem}
                          data-testid={`button-edit-profile-${profile.id}`}
                        >
                          <Pencil className="mr-2 h-3 w-3" />
                          Editar
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Editar Perfil</DialogTitle>
                          <DialogDescription>
                            Atualize as informações do perfil
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="edit-name">Nome</Label>
                            <Input
                              id="edit-name"
                              value={formData.name || ""}
                              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                              data-testid="input-edit-profile-name"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="edit-description">Descrição</Label>
                            <Textarea
                              id="edit-description"
                              value={formData.description || ""}
                              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                              data-testid="input-edit-profile-description"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Permissões</Label>
                            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-md p-3">
                              {allPermissions.map((permission) => (
                                <div key={permission.id} className="flex items-center gap-2">
                                  <Checkbox
                                    id={`edit-perm-${permission.id}`}
                                    checked={formData.permissions?.includes(permission.id)}
                                    onCheckedChange={() => handlePermissionToggle(permission.id)}
                                    data-testid={`checkbox-edit-permission-${permission.id}`}
                                  />
                                  <Label htmlFor={`edit-perm-${permission.id}`} className="text-sm cursor-pointer">
                                    {permission.label}
                                  </Label>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setEditingProfile(null)} data-testid="button-cancel-edit">
                            Cancelar
                          </Button>
                          <Button
                            onClick={handleSubmit}
                            disabled={updateMutation.isPending}
                            data-testid="button-update-profile"
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
                      variant="outline"
                      size="sm"
                      onClick={() => deleteMutation.mutate(profile.id)}
                      disabled={profile.isSystem || deleteMutation.isPending}
                      data-testid={`button-delete-profile-${profile.id}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
