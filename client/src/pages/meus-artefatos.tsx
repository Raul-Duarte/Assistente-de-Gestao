import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { FileText, Download, Calendar, Filter, Loader2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Artifact } from "@shared/schema";
import { ARTIFACT_TYPES, ARTIFACT_TYPE_LABELS, type ArtifactType } from "@shared/schema";

export default function MeusArtefatosPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const { data: artifacts = [], isLoading } = useQuery<Artifact[]>({
    queryKey: ["/api/artifacts"],
    enabled: isAuthenticated,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/artifacts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/artifacts"] });
      toast({
        title: "Artefato excluído",
        description: "O artefato foi excluído com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível excluir o artefato.",
        variant: "destructive",
      });
    },
  });

  const filteredArtifacts = useMemo(() => {
    return artifacts.filter((artifact) => {
      if (typeFilter !== "all" && artifact.type !== typeFilter) {
        return false;
      }

      if (startDate && artifact.createdAt) {
        const artifactDate = new Date(artifact.createdAt);
        const filterStart = new Date(startDate);
        filterStart.setHours(0, 0, 0, 0);
        if (artifactDate < filterStart) {
          return false;
        }
      }

      if (endDate && artifact.createdAt) {
        const artifactDate = new Date(artifact.createdAt);
        const filterEnd = new Date(endDate);
        filterEnd.setHours(23, 59, 59, 999);
        if (artifactDate > filterEnd) {
          return false;
        }
      }

      return true;
    });
  }, [artifacts, typeFilter, startDate, endDate]);

  const handleDownload = async (artifactId: string) => {
    const response = await fetch(`/api/artifacts/${artifactId}/pdf`, {
      credentials: "include",
    });
    if (response.ok) {
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `artefato-${artifactId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case ARTIFACT_TYPES.BUSINESS_RULES:
        return "default";
      case ARTIFACT_TYPES.ACTION_POINTS:
        return "secondary";
      case ARTIFACT_TYPES.REFERRALS:
        return "outline";
      case ARTIFACT_TYPES.CRITICAL_POINTS:
        return "destructive";
      default:
        return "default";
    }
  };

  const clearFilters = () => {
    setTypeFilter("all");
    setStartDate("");
    setEndDate("");
  };

  if (authLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-8">
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
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">
            Meus Artefatos
          </h1>
          <p className="text-muted-foreground">
            Visualize e baixe seus artefatos gerados
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type-filter">Tipo de Artefato</Label>
                <Select
                  value={typeFilter}
                  onValueChange={setTypeFilter}
                >
                  <SelectTrigger id="type-filter" data-testid="select-type-filter">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value={ARTIFACT_TYPES.BUSINESS_RULES}>
                      {ARTIFACT_TYPE_LABELS[ARTIFACT_TYPES.BUSINESS_RULES]}
                    </SelectItem>
                    <SelectItem value={ARTIFACT_TYPES.ACTION_POINTS}>
                      {ARTIFACT_TYPE_LABELS[ARTIFACT_TYPES.ACTION_POINTS]}
                    </SelectItem>
                    <SelectItem value={ARTIFACT_TYPES.REFERRALS}>
                      {ARTIFACT_TYPE_LABELS[ARTIFACT_TYPES.REFERRALS]}
                    </SelectItem>
                    <SelectItem value={ARTIFACT_TYPES.CRITICAL_POINTS}>
                      {ARTIFACT_TYPE_LABELS[ARTIFACT_TYPES.CRITICAL_POINTS]}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="start-date">Data Início</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  data-testid="input-start-date"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="end-date">Data Fim</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  data-testid="input-end-date"
                />
              </div>

              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={clearFilters}
                  data-testid="button-clear-filters"
                >
                  Limpar Filtros
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Artefatos ({filteredArtifacts.length})
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredArtifacts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum artefato encontrado</p>
                <p className="text-sm mt-2">
                  Gere seu primeiro artefato em <a href="/artefatos" className="text-primary underline">Artefatos</a>
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Título</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredArtifacts.map((artifact) => (
                      <TableRow key={artifact.id} data-testid={`row-artifact-${artifact.id}`}>
                        <TableCell className="font-medium max-w-[250px] truncate">
                          {artifact.title}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getTypeBadgeVariant(artifact.type)}>
                            {ARTIFACT_TYPE_LABELS[artifact.type as ArtifactType] || artifact.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {artifact.createdAt
                              ? format(new Date(artifact.createdAt), "dd/MM/yyyy HH:mm", {
                                  locale: ptBR,
                                })
                              : "-"}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDownload(artifact.id)}
                              data-testid={`button-download-${artifact.id}`}
                            >
                              <Download className="h-4 w-4 mr-1" />
                              Baixar PDF
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-destructive"
                                  data-testid={`button-delete-${artifact.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir artefato?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta ação não pode ser desfeita. O artefato será permanentemente excluído.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteMutation.mutate(artifact.id)}
                                    className="bg-destructive text-destructive-foreground"
                                    data-testid={`button-confirm-delete-${artifact.id}`}
                                  >
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
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
