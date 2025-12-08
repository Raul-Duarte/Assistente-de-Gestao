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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Trash2,
  Loader2,
  FileText,
} from "lucide-react";
import type { ArtifactTypeRecord, InsertArtifactType } from "@shared/schema";

export default function AdminArtifactTypes() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deletingType, setDeletingType] = useState<ArtifactTypeRecord | null>(null);
  const [formData, setFormData] = useState<Partial<InsertArtifactType>>({
    slug: "",
    title: "",
    description: "",
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

  const { data: artifactTypes, isLoading: typesLoading } = useQuery<ArtifactTypeRecord[]>({
    queryKey: ["/api/artifact-types"],
    enabled: isAuthenticated,
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertArtifactType) => {
      return apiRequest("POST", "/api/admin/artifact-types", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/artifact-types"] });
      toast({ title: "Tipo de artefato criado com sucesso!" });
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
        title: "Erro ao criar tipo de artefato",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/artifact-types/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/artifact-types"] });
      toast({ title: "Tipo de artefato excluído com sucesso!" });
      setDeletingType(null);
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
        title: "Erro ao excluir tipo de artefato",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      slug: "",
      title: "",
      description: "",
      isActive: true,
    });
  };

  const handleSubmit = () => {
    if (!formData.title?.trim()) {
      toast({
        title: "Título é obrigatório",
        variant: "destructive",
      });
      return;
    }

    if (!formData.slug?.trim()) {
      toast({
        title: "Slug é obrigatório",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate(formData as InsertArtifactType);
  };

  const handleDeleteType = () => {
    if (deletingType) {
      deleteMutation.mutate(deletingType.id);
    }
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  };

  const handleTitleChange = (title: string) => {
    setFormData({
      ...formData,
      title,
      slug: formData.slug || generateSlug(title),
    });
  };

  if (authLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Tipos de Artefatos</h1>
            <p className="text-muted-foreground">
              Gerencie os tipos de documentos que podem ser gerados
            </p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} data-testid="button-new-artifact-type">
                <Plus className="mr-2 h-4 w-4" />
                Novo Tipo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Novo Tipo de Artefato</DialogTitle>
                <DialogDescription>
                  Adicione um novo tipo de documento que pode ser gerado pela IA
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Título</Label>
                  <Input
                    id="title"
                    value={formData.title || ""}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="Ex: Regras de Negócio"
                    data-testid="input-type-title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug (identificador único)</Label>
                  <Input
                    id="slug"
                    value={formData.slug || ""}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    placeholder="Ex: business_rules"
                    data-testid="input-type-slug"
                  />
                  <p className="text-xs text-muted-foreground">
                    Apenas letras minúsculas, números e underscore
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={formData.description || ""}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descreva o que este tipo de artefato extrai da transcrição"
                    rows={3}
                    data-testid="input-type-description"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)} data-testid="button-cancel-create">
                  Cancelar
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={createMutation.isPending}
                  data-testid="button-save-type"
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    "Criar Tipo"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {typesLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-48" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : artifactTypes?.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum tipo de artefato cadastrado</h3>
              <p className="text-muted-foreground text-center mb-4">
                Crie tipos de artefatos para permitir a geração de documentos
              </p>
              <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-first-type">
                <Plus className="mr-2 h-4 w-4" />
                Criar Primeiro Tipo
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {artifactTypes?.map((type) => (
              <Card key={type.id} data-testid={`card-artifact-type-${type.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">{type.title}</CardTitle>
                    </div>
                    <Badge variant={type.isActive ? "default" : "secondary"}>
                      {type.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <CardDescription className="font-mono text-xs">
                    {type.slug}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {type.description && (
                    <p className="text-sm text-muted-foreground">
                      {type.description}
                    </p>
                  )}
                  <Dialog open={deletingType?.id === type.id} onOpenChange={(open) => !open && setDeletingType(null)}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full text-destructive"
                        onClick={() => setDeletingType(type)}
                        data-testid={`button-delete-type-${type.id}`}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Excluir Tipo
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Excluir Tipo de Artefato</DialogTitle>
                        <DialogDescription>
                          Tem certeza que deseja excluir o tipo "{type.title}"? Esta ação não pode ser desfeita.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setDeletingType(null)} data-testid="button-cancel-delete">
                          Cancelar
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={handleDeleteType}
                          disabled={deleteMutation.isPending}
                          data-testid="button-confirm-delete"
                        >
                          {deleteMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Excluindo...
                            </>
                          ) : (
                            "Excluir"
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
