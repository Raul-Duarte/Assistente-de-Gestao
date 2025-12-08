import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  FileText,
  Upload,
  Download,
  Trash2,
  Plus,
  FileSpreadsheet,
  File,
  Clock,
  Calendar,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
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
import type { Template } from "@shared/schema";

const ALLOWED_EXTENSIONS = ['.csv', '.pdf', '.doc', '.docx', '.xls', '.xlsx'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return <File className="h-4 w-4" />;
  if (mimeType.includes('spreadsheet') || mimeType.includes('csv') || mimeType.includes('excel')) {
    return <FileSpreadsheet className="h-4 w-4 text-green-600" />;
  }
  if (mimeType.includes('pdf')) {
    return <FileText className="h-4 w-4 text-red-600" />;
  }
  if (mimeType.includes('word') || mimeType.includes('document')) {
    return <FileText className="h-4 w-4 text-blue-600" />;
  }
  return <File className="h-4 w-4" />;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Templates() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [templateType, setTemplateType] = useState<'text' | 'file'>('text');
  const [description, setDescription] = useState('');
  const [textContent, setTextContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const { data: templates = [], isLoading } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
    enabled: isAuthenticated,
  });

  const createMutation = useMutation({
    mutationFn: async (data: {
      description: string;
      type: 'text' | 'file';
      content?: string;
      fileName?: string;
      fileData?: string;
      mimeType?: string;
      fileSize?: number;
    }) => {
      return apiRequest("POST", "/api/templates", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({ title: "Template criado com sucesso!" });
      resetForm();
      setIsCreateOpen(false);
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
        }, 1500);
        return;
      }
      toast({
        title: "Erro ao criar template",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({ title: "Template excluído com sucesso!" });
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
        }, 1500);
        return;
      }
      toast({
        title: "Erro ao excluir template",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setTemplateType('text');
    setDescription('');
    setTextContent('');
    setSelectedFile(null);
    setFileError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFileError(null);
    
    if (!file) {
      setSelectedFile(null);
      return;
    }

    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      setFileError(`Formato não permitido. Formatos aceitos: ${ALLOWED_EXTENSIONS.join(', ')}`);
      setSelectedFile(null);
      e.target.value = '';
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setFileError('Arquivo excede o limite de 10MB');
      setSelectedFile(null);
      e.target.value = '';
      return;
    }

    setSelectedFile(file);
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast({
        title: "Erro",
        description: "Descrição é obrigatória",
        variant: "destructive",
      });
      return;
    }

    if (templateType === 'text' && !textContent.trim()) {
      toast({
        title: "Erro",
        description: "Conteúdo do template é obrigatório",
        variant: "destructive",
      });
      return;
    }

    if (templateType === 'file' && !selectedFile) {
      toast({
        title: "Erro",
        description: "Arquivo é obrigatório",
        variant: "destructive",
      });
      return;
    }

    if (templateType === 'text') {
      createMutation.mutate({
        description,
        type: 'text',
        content: textContent,
      });
    } else if (selectedFile) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        createMutation.mutate({
          description,
          type: 'file',
          fileName: selectedFile.name,
          fileData: base64,
          mimeType: selectedFile.type,
          fileSize: selectedFile.size,
        });
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleDownload = (templateId: string, fileName: string) => {
    window.open(`/api/templates/${templateId}/download`, '_blank');
  };

  if (authLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  if (!isAuthenticated) {
    navigate("/");
    return null;
  }

  return (
    <AdminLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Templates</h1>
            <p className="text-muted-foreground">
              Gerencie seus templates para geração de artefatos
            </p>
          </div>
          
          <Dialog open={isCreateOpen} onOpenChange={(open) => {
            setIsCreateOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-template">
                <Plus className="mr-2 h-4 w-4" />
                Novo Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Criar Novo Template</DialogTitle>
                <DialogDescription>
                  Adicione um template para ser usado na geração de artefatos
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Input
                    id="description"
                    placeholder="Ex: Modelo de ata de reunião"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    data-testid="input-template-description"
                  />
                </div>

                <div className="space-y-3">
                  <Label>Tipo de Template</Label>
                  <RadioGroup
                    value={templateType}
                    onValueChange={(value: 'text' | 'file') => setTemplateType(value)}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="text" id="type-text" data-testid="radio-type-text" />
                      <Label htmlFor="type-text" className="cursor-pointer">Texto</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="file" id="type-file" data-testid="radio-type-file" />
                      <Label htmlFor="type-file" className="cursor-pointer">Arquivo</Label>
                    </div>
                  </RadioGroup>
                </div>

                {templateType === 'text' ? (
                  <div className="space-y-2">
                    <Label htmlFor="content">Conteúdo do Template</Label>
                    <RichTextEditor
                      value={textContent}
                      onChange={setTextContent}
                      placeholder="Digite o formato/estrutura do seu template aqui..."
                      data-testid="rte-template-content"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="file">Arquivo do Template</Label>
                    <div className="border-2 border-dashed rounded-lg p-6 text-center">
                      <input
                        id="file"
                        type="file"
                        accept={ALLOWED_EXTENSIONS.join(',')}
                        onChange={handleFileChange}
                        className="hidden"
                        data-testid="input-template-file"
                      />
                      <label
                        htmlFor="file"
                        className="cursor-pointer flex flex-col items-center gap-2"
                      >
                        <Upload className="h-8 w-8 text-muted-foreground" />
                        {selectedFile ? (
                          <div className="space-y-1">
                            <p className="font-medium">{selectedFile.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatFileSize(selectedFile.size)}
                            </p>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm text-muted-foreground">
                              Clique para selecionar ou arraste um arquivo
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Formatos: CSV, PDF, DOC, DOCX, XLS, XLSX (máx. 10MB)
                            </p>
                          </>
                        )}
                      </label>
                    </div>
                    {fileError && (
                      <p className="text-sm text-destructive">{fileError}</p>
                    )}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCreateOpen(false);
                    resetForm();
                  }}
                  data-testid="button-cancel-template"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={createMutation.isPending}
                  data-testid="button-save-template"
                >
                  {createMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Salvar Template
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : templates.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum template cadastrado</h3>
              <p className="text-muted-foreground text-center mb-4">
                Crie seu primeiro template para usar na geração de artefatos
              </p>
              <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-first-template">
                <Plus className="mr-2 h-4 w-4" />
                Criar Template
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {templates.map((template) => (
              <Card key={template.id} data-testid={`card-template-${template.id}`}>
                <CardContent className="flex items-center justify-between gap-4 py-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="flex-shrink-0 h-10 w-10 rounded-md bg-muted flex items-center justify-center">
                      {template.type === 'text' ? (
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        getFileIcon(template.mimeType)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate" data-testid={`text-template-description-${template.id}`}>
                        {template.description}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                        <span className="inline-flex items-center gap-1">
                          {template.type === 'text' ? 'Texto' : template.fileName || 'Arquivo'}
                        </span>
                        {template.createdAt && (
                          <>
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(template.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(template.createdAt), "HH:mm", { locale: ptBR })}
                            </span>
                          </>
                        )}
                        {template.type === 'file' && template.fileSize && (
                          <span>{formatFileSize(template.fileSize)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {template.type === 'file' && template.fileName && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(template.id, template.fileName!)}
                        data-testid={`button-download-template-${template.id}`}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Baixar
                      </Button>
                    )}
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          data-testid={`button-delete-template-${template.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir template?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. O template será permanentemente excluído.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate(template.id)}
                            className="bg-destructive text-destructive-foreground"
                            data-testid={`button-confirm-delete-template-${template.id}`}
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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
