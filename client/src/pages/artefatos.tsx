import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
  CheckSquare,
  ArrowUpRight,
  AlertTriangle,
  Loader2,
  Download,
  Sparkles,
  Lock,
} from "lucide-react";
import { ARTIFACT_TYPES, ARTIFACT_TYPE_LABELS, type ArtifactType, type Plan, type Artifact } from "@shared/schema";

const artifactOptions = [
  {
    id: ARTIFACT_TYPES.BUSINESS_RULES,
    icon: FileText,
    label: ARTIFACT_TYPE_LABELS[ARTIFACT_TYPES.BUSINESS_RULES],
    description: "Regras e diretrizes de negócio discutidas",
    availableIn: ["free", "plus", "premium"],
  },
  {
    id: ARTIFACT_TYPES.ACTION_POINTS,
    icon: CheckSquare,
    label: ARTIFACT_TYPE_LABELS[ARTIFACT_TYPES.ACTION_POINTS],
    description: "Tarefas e ações a serem executadas",
    availableIn: ["plus", "premium"],
  },
  {
    id: ARTIFACT_TYPES.REFERRALS,
    icon: ArrowUpRight,
    label: ARTIFACT_TYPE_LABELS[ARTIFACT_TYPES.REFERRALS],
    description: "Encaminhamentos e próximos passos",
    availableIn: ["plus", "premium"],
  },
  {
    id: ARTIFACT_TYPES.CRITICAL_POINTS,
    icon: AlertTriangle,
    label: ARTIFACT_TYPE_LABELS[ARTIFACT_TYPES.CRITICAL_POINTS],
    description: "Pontos que requerem atenção especial",
    availableIn: ["premium"],
  },
];

export default function Artefatos() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [selectedTypes, setSelectedTypes] = useState<ArtifactType[]>([]);
  const [transcription, setTranscription] = useState("");
  const [generatedArtifacts, setGeneratedArtifacts] = useState<Artifact[]>([]);

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
    mutationFn: async (data: { types: ArtifactType[]; transcription: string }) => {
      const response = await apiRequest("POST", "/api/artifacts/generate", data);
      const artifacts = await response.json();
      return artifacts as Artifact[];
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

  const handleTypeToggle = (type: ArtifactType) => {
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
    generateMutation.mutate({ types: selectedTypes, transcription });
  };

  const isTypeAvailable = (availableIn: string[]): boolean => {
    if (!userPlan) return availableIn.includes("free");
    return availableIn.includes(userPlan.slug);
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
            {planLoading ? (
              <div className="grid sm:grid-cols-2 gap-4">
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {artifactOptions.map((option) => {
                  const available = isTypeAvailable(option.availableIn);
                  const isSelected = selectedTypes.includes(option.id);

                  return (
                    <div
                      key={option.id}
                      className={`relative flex items-start gap-4 p-4 rounded-lg border transition-colors ${
                        available
                          ? isSelected
                            ? "border-primary bg-primary/5"
                            : "hover:border-primary/50 cursor-pointer"
                          : "opacity-60 cursor-not-allowed bg-muted/30"
                      }`}
                      onClick={() => available && handleTypeToggle(option.id)}
                      data-testid={`artifact-option-${option.id}`}
                    >
                      <Checkbox
                        checked={isSelected}
                        disabled={!available}
                        onCheckedChange={() => available && handleTypeToggle(option.id)}
                        className="mt-1"
                        data-testid={`checkbox-${option.id}`}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <option.icon className="h-4 w-4 text-primary" />
                          <span className="font-medium" data-testid={`label-${option.id}`}>{option.label}</span>
                          {!available && (
                            <Lock className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {option.description}
                        </p>
                        {!available && (
                          <Badge variant="outline" className="mt-2 text-xs" data-testid={`badge-upgrade-${option.id}`}>
                            Disponível no plano{" "}
                            {option.availableIn[0] === "plus" ? "Plus" : "Premium"}
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

        <Card>
          <CardHeader>
            <CardTitle>3. Gerar Artefatos</CardTitle>
            <CardDescription>
              Clique no botão abaixo para processar a transcrição
            </CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        {generatedArtifacts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Artefatos Gerados</CardTitle>
              <CardDescription>
                Baixe os documentos gerados em formato PDF
              </CardDescription>
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
                          {ARTIFACT_TYPE_LABELS[artifact.type as ArtifactType]}
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
