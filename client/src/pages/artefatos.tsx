import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  Loader2,
  Download,
  Sparkles,
  Lock,
  FileArchive,
  X,
} from "lucide-react";
import { type Plan, type Artifact, type Template, type ArtifactTypeRecord } from "@shared/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Artefatos() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [transcription, setTranscription] = useState("");
  const [generatedArtifacts, setGeneratedArtifacts] = useState<Artifact[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const { data: artifactTypes = [], isLoading: typesLoading } = useQuery<ArtifactTypeRecord[]>({
    queryKey: ["/api/artifact-types"],
    enabled: isAuthenticated,
  });

  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
    enabled: isAuthenticated,
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

  const { data: userPlan, isLoading: planLoading } = useQuery<Plan>({
    queryKey: ["/api/user/plan"],
    enabled: isAuthenticated,
  });

  const generateMutation = useMutation({
    mutationFn: async (data: { types: string[]; transcription: string; templateId?: string }) => {
      const controller = new AbortController();
      abortControllerRef.current = controller;
      try {
        const response = await fetch("/api/artifacts/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
          credentials: "include",
          signal: controller.signal,
        });
        if (!response.ok) {
          if (response.status === 401) {
            throw new Error("401: Unauthorized");
          }
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `${response.status}: ${response.statusText}`);
        }
        const artifacts = await response.json();
        return artifacts as Artifact[];
      } finally {
        abortControllerRef.current = null;
      }
    },
    onSuccess: (data) => {
      setGeneratedArtifacts(data);
      queryClient.invalidateQueries({ queryKey: ["/api/artifacts"] });
      toast({
        title: "Artefatos gerados!",
        description: `${data.length} documento(s) gerado(s) com sucesso.`,
      });
    },
    onError: (error: Error) => {
      if (error.name === "AbortError") {
        toast({
          title: "Geração cancelada",
          description: "A geração de artefatos foi interrompida.",
        });
        return;
      }
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
        title: "Erro ao gerar artefatos",
        description: error.message || "Tente novamente mais tarde.",
        variant: "destructive",
      });
    },
  });

  const handleCancelGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const downloadMutation = useMutation({
    mutationFn: async (artifactId: string) => {
      const response = await fetch(`/api/artifacts/${artifactId}/pdf`, {
        credentials: 'include',
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Falha ao baixar PDF");
      }
      const blob = await response.blob();
      return { blob, artifactId };
    },
    onSuccess: ({ blob, artifactId }) => {
      const artifact = generatedArtifacts.find((a) => a.id === artifactId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${artifact?.title || "artefato"}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao baixar PDF",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const downloadAllMutation = useMutation({
    mutationFn: async (artifactIds: string[]) => {
      const response = await fetch("/api/artifacts/download-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artifactIds }),
        credentials: 'include',
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Falha ao baixar PDFs");
      }
      const blob = await response.blob();
      return blob;
    },
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `artefatos_${new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({
        title: "Download concluído",
        description: "Todos os artefatos foram baixados com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao baixar PDFs",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDownloadAll = () => {
    const artifactIds = generatedArtifacts.map(a => a.id);
    downloadAllMutation.mutate(artifactIds);
  };

  const handleTypeToggle = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleGenerate = () => {
    if (selectedTypes.length === 0) {
      toast({
        title: "Selecione pelo menos um tipo",
        description: "Escolha os tipos de artefatos que deseja gerar.",
        variant: "destructive",
      });
      return;
    }
    if (!transcription.trim()) {
      toast({
        title: "Transcrição vazia",
        description: "Cole a transcrição da reunião para continuar.",
        variant: "destructive",
      });
      return;
    }
    generateMutation.mutate({ 
      types: selectedTypes, 
      transcription,
      templateId: selectedTemplateId || undefined,
    });
  };

  const isTypeAvailable = (typeSlug: string): boolean => {
    if (!userPlan?.tools) return false;
    const tools = userPlan.tools as string[];
    // If plan has all 4 legacy types, grant access to all active types (Premium behavior)
    const legacyTypes = ['business_rules', 'action_points', 'referrals', 'critical_points'];
    const hasAllLegacyTypes = legacyTypes.every(t => tools.includes(t));
    if (hasAllLegacyTypes) return true;
    return tools.includes(typeSlug);
  };

  if (authLoading) {
    return (
      <AdminLayout>
        <div className="max-w-4xl mx-auto space-y-6">
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
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <Badge variant="outline" className="mb-4">
            <Sparkles className="w-3 h-3 mr-1" />
            Ferramenta de IA
          </Badge>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Gerar Artefatos</h1>
          <p className="text-muted-foreground">
            Cole a transcrição da sua reunião e selecione os tipos de documentos que deseja gerar.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>1. Selecione os Tipos de Artefato</CardTitle>
            <CardDescription>
              Escolha quais documentos deseja gerar a partir da transcrição
            </CardDescription>
          </CardHeader>
          <CardContent>
            {planLoading || typesLoading ? (
              <div className="grid sm:grid-cols-2 gap-4">
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </div>
            ) : artifactTypes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum tipo de artefato disponível.</p>
                <p className="text-sm">Contate o administrador.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {artifactTypes.filter(t => t.isActive).map((artifactType) => {
                  const available = isTypeAvailable(artifactType.slug);
                  const isSelected = selectedTypes.includes(artifactType.slug);

                  return (
                    <div
                      key={artifactType.id}
                      className={`relative flex items-start gap-4 p-4 rounded-lg border transition-colors ${
                        available
                          ? isSelected
                            ? "border-primary bg-primary/5"
                            : "hover:border-primary/50 cursor-pointer"
                          : "opacity-60 cursor-not-allowed bg-muted/30"
                      }`}
                      onClick={() => available && handleTypeToggle(artifactType.slug)}
                      data-testid={`artifact-option-${artifactType.slug}`}
                    >
                      <Checkbox
                        checked={isSelected}
                        disabled={!available}
                        onCheckedChange={() => available && handleTypeToggle(artifactType.slug)}
                        className="mt-1"
                        data-testid={`checkbox-${artifactType.slug}`}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary" />
                          <span className="font-medium" data-testid={`label-${artifactType.slug}`}>{artifactType.title}</span>
                          {!available && (
                            <Lock className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                        {artifactType.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {artifactType.description}
                          </p>
                        )}
                        {!available && (
                          <Badge variant="outline" className="mt-2 text-xs" data-testid={`badge-upgrade-${artifactType.slug}`}>
                            Não disponível no seu plano
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Cole a Transcrição</CardTitle>
            <CardDescription>
              Insira a transcrição completa da reunião
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="transcription" className="sr-only">
                Transcrição da reunião
              </Label>
              <Textarea
                id="transcription"
                placeholder="Cole aqui a transcrição da sua reunião...&#10;&#10;Exemplo:&#10;João: Precisamos definir as regras para o novo processo de aprovação.&#10;Maria: Concordo. Sugiro que todo pedido acima de R$ 5.000 precise de aprovação do gerente.&#10;João: Ótimo. E os pedidos menores podem ser aprovados automaticamente.&#10;Maria: Certo. Vou encaminhar isso para o TI implementar no sistema."
                className="min-h-64 resize-y"
                value={transcription}
                onChange={(e) => setTranscription(e.target.value)}
                data-testid="textarea-transcription"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span data-testid="text-char-count">{transcription.length} caracteres</span>
                <span>Mínimo recomendado: 100 caracteres</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {templates.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>3. Template (Opcional)</CardTitle>
              <CardDescription>
                Selecione um template para formatar o artefato gerado
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                value={selectedTemplateId || "none"}
                onValueChange={(value) => setSelectedTemplateId(value === "none" ? null : value)}
              >
                <SelectTrigger className="w-full sm:w-80" data-testid="select-template">
                  <SelectValue placeholder="Selecione um template..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum template</SelectItem>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id} data-testid={`template-option-${template.id}`}>
                      {template.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTemplateId && (
                <p className="text-sm text-muted-foreground mt-2">
                  O template selecionado será usado como referência para formatar o artefato.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{templates.length > 0 ? "4" : "3"}. Gerar Artefatos</CardTitle>
            <CardDescription>
              Clique no botão abaixo para processar a transcrição
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button
                size="lg"
                onClick={handleGenerate}
                disabled={
                  generateMutation.isPending ||
                  selectedTypes.length === 0 ||
                  !transcription.trim()
                }
                className="w-full sm:w-auto"
                data-testid="button-generate"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Gerar {selectedTypes.length} Artefato(s)
                  </>
                )}
              </Button>
              {generateMutation.isPending && (
                <Button
                  size="lg"
                  variant="destructive"
                  onClick={handleCancelGeneration}
                  className="w-full sm:w-auto"
                  data-testid="button-cancel-generate"
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancelar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {generatedArtifacts.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle>Artefatos Gerados</CardTitle>
                  <CardDescription>
                    Baixe os documentos gerados em formato PDF
                  </CardDescription>
                </div>
                {generatedArtifacts.length > 1 && (
                  <Button
                    variant="default"
                    onClick={handleDownloadAll}
                    disabled={downloadAllMutation.isPending}
                    data-testid="button-download-all"
                  >
                    {downloadAllMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Baixando...
                      </>
                    ) : (
                      <>
                        <FileArchive className="mr-2 h-4 w-4" />
                        Baixar Todos ({generatedArtifacts.length})
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {generatedArtifacts.map((artifact) => (
                  <div
                    key={artifact.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-muted/30"
                    data-testid={`generated-artifact-${artifact.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium" data-testid={`artifact-title-${artifact.id}`}>{artifact.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {artifact.type}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadMutation.mutate(artifact.id)}
                      disabled={downloadMutation.isPending}
                      data-testid={`button-download-${artifact.id}`}
                    >
                      {downloadMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Download className="mr-2 h-4 w-4" />
                          Baixar PDF
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
