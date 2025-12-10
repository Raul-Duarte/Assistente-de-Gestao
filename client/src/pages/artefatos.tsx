import { useEffect, useState, useRef, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  FileText,
  Loader2,
  Download,
  Sparkles,
  Lock,
  FileArchive,
  X,
  ChevronLeft,
  ChevronRight,
  Search,
  ChevronsUpDown,
  Check,
  FileCheck,
} from "lucide-react";
import { type Plan, type Artifact, type Template, type ArtifactTypeRecord } from "@shared/schema";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

const FILE_TYPE_LABELS: Record<string, string> = {
  pdf: "PDF",
  docx: "DOCX",
  xlsx: "XLSX",
  csv: "CSV",
  txt: "TXT",
  md: "MD",
};

const ITEMS_PER_PAGE = 6;

export default function Artefatos() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [transcription, setTranscription] = useState("");
  const [generatedArtifacts, setGeneratedArtifacts] = useState<Artifact[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [actionEnabled, setActionEnabled] = useState(false);
  const [actionText, setActionText] = useState("");
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

  const filteredTypes = useMemo(() => {
    const activeTypes = artifactTypes.filter(t => t.isActive);
    if (!searchQuery.trim()) return activeTypes;
    return activeTypes.filter(t => 
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.slug.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [artifactTypes, searchQuery]);

  const totalPages = Math.ceil(filteredTypes.length / ITEMS_PER_PAGE);
  const paginatedTypes = filteredTypes.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const filteredTemplates = useMemo(() => {
    if (!templateSearch.trim()) return templates;
    return templates.filter(t =>
      t.description.toLowerCase().includes(templateSearch.toLowerCase())
    );
  }, [templates, templateSearch]);

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (selectedTypes.length > 1 && selectedTemplateId) {
      setSelectedTemplateId(null);
    }
  }, [selectedTypes.length, selectedTemplateId]);

  const generateMutation = useMutation({
    mutationFn: async (data: { types: string[]; transcription: string; templateId?: string; action?: string }) => {
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
      setShowSuccessDialog(true);
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
    mutationFn: async (artifact: Artifact) => {
      const response = await fetch(`/api/artifacts/${artifact.id}/download`, {
        credentials: 'include',
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Falha ao baixar arquivo");
      }
      const blob = await response.blob();
      return { blob, artifact };
    },
    onSuccess: ({ blob, artifact }) => {
      const fileType = artifact.fileType || "pdf";
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${artifact.title || "artefato"}.${fileType}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao baixar arquivo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getFileTypeLabel = (fileType: string | null | undefined) => {
    return (fileType?.toUpperCase() || "PDF");
  };

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
      action: actionEnabled ? actionText : undefined,
    });
  };

  const isTypeAvailable = (typeSlug: string): boolean => {
    if (!userPlan?.tools) return false;
    const tools = userPlan.tools as string[];
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
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar tipo de artefato..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-artifact-types"
              />
            </div>

            {planLoading || typesLoading ? (
              <div className="grid sm:grid-cols-2 gap-4">
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </div>
            ) : filteredTypes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                {searchQuery ? (
                  <p>Nenhum tipo encontrado para "{searchQuery}"</p>
                ) : (
                  <>
                    <p>Nenhum tipo de artefato disponível.</p>
                    <p className="text-sm">Contate o administrador.</p>
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="grid sm:grid-cols-2 gap-4">
                  {paginatedTypes.map((artifactType) => {
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
                          <div className="flex items-center gap-2 flex-wrap">
                            <FileText className="h-4 w-4 text-primary" />
                            <span className="font-medium" data-testid={`label-${artifactType.slug}`}>{artifactType.title}</span>
                            <Badge variant="secondary" className="text-xs">
                              {FILE_TYPE_LABELS[artifactType.fileType || "pdf"] || artifactType.fileType?.toUpperCase()}
                            </Badge>
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

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      data-testid="button-prev-page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Página {currentPage} de {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      data-testid="button-next-page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Cole a Transcrição</CardTitle>
            <CardDescription>
              Insira a transcrição completa da reunião. Use a barra de ferramentas para formatar o texto.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="transcription" className="sr-only">
                Transcrição da reunião
              </Label>
              <RichTextEditor
                value={transcription}
                onChange={setTranscription}
                placeholder="Cole aqui a transcrição da sua reunião..."
                data-testid="rte-transcription"
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
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <CardTitle>3. Ação (Opcional)</CardTitle>
                <CardDescription>
                  Adicione uma instrução específica para direcionar a geração do artefato
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="action-switch"
                  checked={actionEnabled}
                  onCheckedChange={setActionEnabled}
                  data-testid="switch-action"
                />
                <Label htmlFor="action-switch" className="text-sm">
                  {actionEnabled ? "Ativado" : "Desativado"}
                </Label>
              </div>
            </div>
          </CardHeader>
          {actionEnabled && (
            <CardContent>
              <Textarea
                placeholder="Para um melhor direcionamento inclua uma ação para melhorar a construção do artefato."
                value={actionText}
                onChange={(e) => setActionText(e.target.value)}
                className="min-h-[100px]"
                data-testid="textarea-action"
              />
            </CardContent>
          )}
        </Card>

        {templates.length > 0 && selectedTypes.length <= 1 && (
          <Card>
            <CardHeader>
              <CardTitle>4. Template (Opcional)</CardTitle>
              <CardDescription>
                Selecione um template para formatar o artefato gerado
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Popover open={templateOpen} onOpenChange={setTemplateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={templateOpen}
                    className="w-full sm:w-96 justify-between"
                    data-testid="select-template"
                  >
                    {selectedTemplate
                      ? selectedTemplate.description
                      : "Selecione um template..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full sm:w-96 p-0" align="start">
                  <Command>
                    <CommandInput 
                      placeholder="Buscar template..." 
                      value={templateSearch}
                      onValueChange={setTemplateSearch}
                      data-testid="input-search-template"
                    />
                    <CommandList>
                      <CommandEmpty>Nenhum template encontrado.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="none"
                          onSelect={() => {
                            setSelectedTemplateId(null);
                            setTemplateOpen(false);
                            setTemplateSearch("");
                          }}
                          data-testid="template-option-none"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              !selectedTemplateId ? "opacity-100" : "opacity-0"
                            )}
                          />
                          Nenhum template
                        </CommandItem>
                        {filteredTemplates.map((template) => (
                          <CommandItem
                            key={template.id}
                            value={template.description}
                            onSelect={() => {
                              setSelectedTemplateId(template.id);
                              setTemplateOpen(false);
                              setTemplateSearch("");
                            }}
                            data-testid={`template-option-${template.id}`}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedTemplateId === template.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {template.description}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
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
            <CardTitle>{templates.length > 0 && selectedTypes.length <= 1 ? "5" : "4"}. Gerar Artefatos</CardTitle>
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
                      onClick={() => downloadMutation.mutate(artifact)}
                      disabled={downloadMutation.isPending}
                      data-testid={`button-download-${artifact.id}`}
                    >
                      {downloadMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Download className="mr-2 h-4 w-4" />
                          Baixar {getFileTypeLabel(artifact.fileType)}
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-green-500" />
                Artefatos Gerados com Sucesso
              </DialogTitle>
              <DialogDescription>
                {generatedArtifacts.length} artefato(s) foram gerados e estão disponíveis em "Meus Artefatos".
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setShowSuccessDialog(false)} data-testid="button-close-success">
                Continuar aqui
              </Button>
              <Link href="/meus-artefatos">
                <Button data-testid="button-go-to-artifacts">
                  <FileText className="mr-2 h-4 w-4" />
                  Ver Meus Artefatos
                </Button>
              </Link>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
