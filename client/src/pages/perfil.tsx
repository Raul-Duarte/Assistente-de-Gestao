import { useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { User, Mail, Calendar, Shield, Crown, Camera, Loader2, MapPin, Save, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Profile, Plan, Client } from "@shared/schema";

const myDataSchema = z.object({
  name: z.string().min(3, "Nome completo deve ter pelo menos 3 caracteres"),
  email: z.string().email("Email inválido"),
  phone: z.string().optional(),
  cpf: z.string()
    .min(11, "CPF deve ter 11 dígitos")
    .max(14, "CPF inválido")
    .transform(val => val.replace(/\D/g, ""))
    .refine(val => val.length === 11, "CPF deve ter 11 dígitos"),
  cep: z.string()
    .min(8, "CEP deve ter 8 dígitos")
    .max(9, "CEP inválido")
    .transform(val => val.replace(/\D/g, ""))
    .refine(val => val.length === 8, "CEP deve ter 8 dígitos"),
  street: z.string().min(3, "Rua é obrigatória"),
  number: z.string().min(1, "Número é obrigatório"),
  complement: z.string().optional(),
  neighborhood: z.string().min(2, "Bairro é obrigatório"),
  city: z.string().min(2, "Cidade é obrigatória"),
  state: z.string().length(2, "Estado deve ter 2 letras"),
});

type MyDataForm = z.infer<typeof myDataSchema>;

export default function Perfil() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: userProfile, isLoading: profileLoading } = useQuery<Profile>({
    queryKey: ["/api/user/profile"],
    enabled: isAuthenticated,
  });

  const { data: userPlan, isLoading: planLoading } = useQuery<Plan>({
    queryKey: ["/api/user/plan"],
    enabled: isAuthenticated,
  });

  const { data: clientData, isLoading: clientLoading } = useQuery<Client>({
    queryKey: ["/api/client/me"],
    enabled: isAuthenticated && (user as any)?.isClient,
  });

  const isClient = (user as any)?.isClient;
  const client = clientData as Client | undefined;

  const form = useForm<MyDataForm>({
    resolver: zodResolver(myDataSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      cpf: "",
      cep: "",
      street: "",
      number: "",
      complement: "",
      neighborhood: "",
      city: "",
      state: "",
    },
  });

  // Load client data into form when available
  if (client && !form.formState.isDirty && isEditing) {
    form.reset({
      name: client.name || "",
      email: client.email || "",
      phone: client.phone || "",
      cpf: client.cpf ? formatCpf(client.cpf) : "",
      cep: client.cep ? formatCep(client.cep) : "",
      street: client.street || "",
      number: client.number || "",
      complement: client.complement || "",
      neighborhood: client.neighborhood || "",
      city: client.city || "",
      state: client.state || "",
    });
  }

  const updateMutation = useMutation({
    mutationFn: async (data: MyDataForm) => {
      const originalEmail = client?.email;
      const emailChanged = data.email !== originalEmail;
      
      const response = await apiRequest("PUT", "/api/client/update-profile", {
        ...data,
        emailChanged,
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/client/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setIsEditing(false);
      
      if (data.emailPending) {
        toast({
          title: "Dados atualizados!",
          description: "Um email de confirmação foi enviado para o novo endereço. Confirme para efetivar a troca.",
        });
      } else {
        toast({
          title: "Dados atualizados!",
          description: "Suas informações foram salvas com sucesso.",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao salvar",
        description: error.message || "Ocorreu um erro ao salvar seus dados.",
        variant: "destructive",
      });
    },
  });

  const uploadImageMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("image", file);
      
      const response = await fetch("/api/client/upload-profile-image", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao fazer upload");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Foto atualizada!",
        description: "Sua foto de perfil foi alterada com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro no upload",
        description: error.message || "Não foi possível atualizar a foto.",
        variant: "destructive",
      });
    },
  });

  const fetchCep = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;

    setIsLoadingCep(true);
    form.setValue("street", "");
    form.setValue("neighborhood", "");
    form.setValue("city", "");
    form.setValue("state", "");
    
    try {
      const response = await fetch(`/api/cep/${cleanCep}`);
      if (response.ok) {
        const data = await response.json();
        form.setValue("street", data.logradouro || "");
        form.setValue("neighborhood", data.bairro || "");
        form.setValue("city", data.localidade || "");
        form.setValue("state", data.uf || "");
        toast({
          title: "Endereço encontrado!",
          description: "Os campos foram preenchidos automaticamente.",
        });
      } else if (response.status === 404) {
        toast({
          title: "CEP não encontrado",
          description: "Não foi possível localizar o endereço. Preencha manualmente.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao consultar CEP",
        description: "Preencha os campos de endereço manualmente.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingCep(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      toast({
        title: "Formato inválido",
        description: "Apenas imagens JPEG ou PNG são permitidas.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O tamanho máximo permitido é 10MB.",
        variant: "destructive",
      });
      return;
    }

    setUploadingImage(true);
    uploadImageMutation.mutate(file, {
      onSettled: () => setUploadingImage(false),
    });
  };

  const onSubmit = (data: MyDataForm) => {
    updateMutation.mutate(data);
  };

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.charAt(0) || "";
    const last = lastName?.charAt(0) || "";
    return (first + last).toUpperCase() || "U";
  };

  const formatDate = (dateString?: string | Date | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  if (authLoading || profileLoading || planLoading || (isClient && clientLoading)) {
    return (
      <AdminLayout>
        <div className="max-w-3xl mx-auto space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64" />
          <Skeleton className="h-40" />
        </div>
      </AdminLayout>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Meu Perfil</h1>
          <p className="text-muted-foreground">
            Gerencie suas informações pessoais e preferências
          </p>
        </div>

        {/* Meus Dados - Editable Section for Clients */}
        {isClient && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Meus Dados
                </CardTitle>
                <CardDescription>
                  Edite suas informações pessoais e endereço
                </CardDescription>
              </div>
              {!isEditing && (
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsEditing(true);
                    if (client) {
                      form.reset({
                        name: client.name || "",
                        email: client.email || "",
                        phone: client.phone || "",
                        cpf: client.cpf ? formatCpf(client.cpf) : "",
                        cep: client.cep ? formatCep(client.cep) : "",
                        street: client.street || "",
                        number: client.number || "",
                        complement: client.complement || "",
                        neighborhood: client.neighborhood || "",
                        city: client.city || "",
                        state: client.state || "",
                      });
                    }
                  }}
                  data-testid="button-edit-data"
                >
                  Editar
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Profile Image */}
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={client?.profileImageUrl || user?.profileImageUrl || undefined} />
                    <AvatarFallback className="text-2xl">
                      {getInitials(user?.firstName, user?.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                    data-testid="button-upload-photo"
                  >
                    {uploadingImage ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png"
                    className="hidden"
                    onChange={handleImageUpload}
                    data-testid="input-profile-image"
                  />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Clique no ícone para alterar a foto
                  </p>
                  <p className="text-xs text-muted-foreground">
                    JPEG ou PNG, máximo 10MB
                  </p>
                </div>
              </div>

              {/* Pending Email Alert */}
              {client?.pendingEmail && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Uma alteração de email para <strong>{client.pendingEmail}</strong> está pendente de confirmação. 
                    Verifique sua caixa de entrada.
                  </AlertDescription>
                </Alert>
              )}

              {isEditing ? (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    {/* Personal Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>Nome Completo</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-edit-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input {...field} type="email" data-testid="input-edit-email" />
                            </FormControl>
                            <FormMessage />
                            {field.value !== client?.email && (
                              <p className="text-xs text-amber-600">
                                Será necessário confirmar o novo email
                              </p>
                            )}
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Telefone</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="(00) 00000-0000" data-testid="input-edit-phone" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="cpf"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CPF</FormLabel>
                            <FormControl>
                              <Input 
                                {...field}
                                maxLength={14}
                                onChange={(e) => field.onChange(formatCpf(e.target.value))}
                                data-testid="input-edit-cpf"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Separator />

                    {/* Address */}
                    <div className="space-y-4">
                      <h3 className="font-medium flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Endereço
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="cep"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>CEP</FormLabel>
                              <FormControl>
                                <div className="flex gap-2">
                                  <Input 
                                    {...field}
                                    maxLength={9}
                                    onChange={(e) => field.onChange(formatCep(e.target.value))}
                                    onBlur={(e) => {
                                      field.onBlur();
                                      fetchCep(e.target.value);
                                    }}
                                    data-testid="input-edit-cep"
                                  />
                                  {isLoadingCep && <Loader2 className="h-5 w-5 animate-spin" />}
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="street"
                          render={({ field }) => (
                            <FormItem className="md:col-span-2">
                              <FormLabel>Rua</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  disabled={isLoadingCep}
                                  placeholder={isLoadingCep ? "Buscando..." : ""}
                                  data-testid="input-edit-street" 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="number"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Número</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-edit-number" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="complement"
                          render={({ field }) => (
                            <FormItem className="md:col-span-2">
                              <FormLabel>Complemento</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-edit-complement" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="neighborhood"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Bairro</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  disabled={isLoadingCep}
                                  placeholder={isLoadingCep ? "Buscando..." : ""}
                                  data-testid="input-edit-neighborhood" 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="city"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Cidade</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  disabled={isLoadingCep}
                                  placeholder={isLoadingCep ? "Buscando..." : ""}
                                  data-testid="input-edit-city" 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="state"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Estado</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field}
                                  disabled={isLoadingCep}
                                  maxLength={2}
                                  onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                                  data-testid="input-edit-state"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsEditing(false)}
                        data-testid="button-cancel-edit"
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        disabled={updateMutation.isPending}
                        data-testid="button-save-data"
                      >
                        {updateMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Salvando...
                          </>
                        ) : (
                          <>
                            <Save className="mr-2 h-4 w-4" />
                            Salvar
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Nome</p>
                      <p className="font-medium" data-testid="text-client-name">{client?.name || "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium" data-testid="text-client-email">{client?.email || "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Telefone</p>
                      <p className="font-medium">{client?.phone || "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">CPF</p>
                      <p className="font-medium">{client?.cpf ? formatCpf(client.cpf) : "-"}</p>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      Endereço
                    </p>
                    {client?.street ? (
                      <p className="font-medium">
                        {client.street}, {client.number}
                        {client.complement && ` - ${client.complement}`}
                        <br />
                        {client.neighborhood} - {client.city}/{client.state}
                        <br />
                        CEP: {client.cep ? formatCep(client.cep) : "-"}
                      </p>
                    ) : (
                      <p className="text-muted-foreground">Endereço não cadastrado</p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Informações Pessoais - For operational users */}
        {!isClient && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Informações Pessoais
              </CardTitle>
              <CardDescription>
                Seus dados de conta no ArtefatosPro
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={user?.profileImageUrl || undefined} />
                  <AvatarFallback className="text-2xl">
                    {getInitials(user?.firstName, user?.lastName)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-xl font-semibold" data-testid="text-user-name">
                    {user?.firstName} {user?.lastName}
                  </h2>
                  <p className="text-muted-foreground flex items-center gap-1" data-testid="text-user-email">
                    <Mail className="h-4 w-4" />
                    {user?.email}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Membro desde
                  </p>
                  <p className="font-medium" data-testid="text-member-since">
                    {formatDate(user?.createdAt)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant={user?.isActive ? "default" : "secondary"} data-testid="badge-status">
                    {user?.isActive ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Perfil de Acesso - For operational users */}
        {!isClient && userProfile && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Perfil de Acesso
              </CardTitle>
              <CardDescription>
                Seu nível de permissões no sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" data-testid="badge-profile-name">
                    {userProfile.name}
                  </Badge>
                  {userProfile.isSystem && (
                    <Badge variant="secondary" className="text-xs">Sistema</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground" data-testid="text-profile-description">
                  {userProfile.description}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Plano de Assinatura */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5" />
              Plano de Assinatura
            </CardTitle>
            <CardDescription>
              Seu plano atual e recursos disponíveis
            </CardDescription>
          </CardHeader>
          <CardContent>
            {userPlan ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <h3 className="text-lg font-semibold" data-testid="text-plan-name">
                      {userPlan.name}
                    </h3>
                    <p className="text-sm text-muted-foreground" data-testid="text-plan-description">
                      {userPlan.description}
                    </p>
                  </div>
                  <Badge variant="default" className="text-lg px-3 py-1" data-testid="badge-plan-price">
                    {userPlan.price === 0 ? "Grátis" : `R$ ${userPlan.price}/mês`}
                  </Badge>
                </div>

                <Separator />

                <div>
                  <p className="text-sm font-medium mb-2">Recursos inclusos:</p>
                  <div className="flex flex-wrap gap-2">
                    {userPlan.features?.map((feature, index) => (
                      <Badge key={index} variant="outline" data-testid={`badge-feature-${index}`}>
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">
                    Limite mensal: {userPlan.maxArtifactsPerMonth} artefatos
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">Nenhum plano atribuído</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

// Helper functions
function formatCpf(value: string): string {
  const numbers = value.replace(/\D/g, "").slice(0, 11);
  return numbers
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function formatCep(value: string): string {
  const numbers = value.replace(/\D/g, "").slice(0, 8);
  return numbers.replace(/(\d{5})(\d)/, "$1-$2");
}
