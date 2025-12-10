import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, MapPin, User, CreditCard, Home } from "lucide-react";

const completeCadastroSchema = z.object({
  name: z.string().min(3, "Nome completo deve ter pelo menos 3 caracteres"),
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

type CompleteCadastroForm = z.infer<typeof completeCadastroSchema>;

export default function CompletarCadastro() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoadingCep, setIsLoadingCep] = useState(false);

  const { data: clientData, isLoading: isLoadingClient } = useQuery({
    queryKey: ["/api/client/me"],
    retry: false,
  });

  const form = useForm<CompleteCadastroForm>({
    resolver: zodResolver(completeCadastroSchema),
    defaultValues: {
      name: "",
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

  // Update form when client data loads
  const client = clientData as any;
  if (client && !form.formState.isDirty) {
    if (client.name && !client.name.startsWith("pending-")) {
      form.setValue("name", client.name);
    }
    if (client.cpf && !client.cpf.startsWith("pending-")) {
      form.setValue("cpf", formatCpf(client.cpf));
    }
    if (client.cep) form.setValue("cep", formatCep(client.cep));
    if (client.street) form.setValue("street", client.street);
    if (client.number) form.setValue("number", client.number);
    if (client.complement) form.setValue("complement", client.complement);
    if (client.neighborhood) form.setValue("neighborhood", client.neighborhood);
    if (client.city) form.setValue("city", client.city);
    if (client.state) form.setValue("state", client.state);
  }

  const completeMutation = useMutation({
    mutationFn: async (data: CompleteCadastroForm) => {
      const response = await apiRequest("PUT", "/api/client/complete-registration", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Cadastro completo!",
        description: "Seus dados foram salvos com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/client/me"] });
      setLocation("/dashboard");
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao salvar",
        description: error.message || "Ocorreu um erro ao salvar seus dados.",
        variant: "destructive",
      });
    },
  });

  const fetchCep = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;

    setIsLoadingCep(true);
    try {
      const response = await fetch(`/api/cep/${cleanCep}`);
      if (response.ok) {
        const data = await response.json();
        if (!data.erro) {
          form.setValue("street", data.logradouro || "");
          form.setValue("neighborhood", data.bairro || "");
          form.setValue("city", data.localidade || "");
          form.setValue("state", data.uf || "");
          toast({
            title: "Endereço encontrado!",
            description: "Os campos foram preenchidos automaticamente.",
          });
        } else {
          toast({
            title: "CEP não encontrado",
            description: "Verifique o CEP digitado.",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error("Error fetching CEP:", error);
    } finally {
      setIsLoadingCep(false);
    }
  };

  const onSubmit = (data: CompleteCadastroForm) => {
    completeMutation.mutate(data);
  };

  if (isLoadingClient) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Complete seu Cadastro</CardTitle>
          <CardDescription>
            Precisamos de algumas informações para finalizar seu registro na plataforma.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Personal Information */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-lg font-medium">
                  <User className="h-5 w-5" />
                  <span>Dados Pessoais</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Nome Completo</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="Seu nome completo"
                            data-testid="input-name"
                          />
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
                            placeholder="000.000.000-00"
                            maxLength={14}
                            onChange={(e) => {
                              const formatted = formatCpf(e.target.value);
                              field.onChange(formatted);
                            }}
                            data-testid="input-cpf"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Address Information */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-lg font-medium">
                  <Home className="h-5 w-5" />
                  <span>Endereço</span>
                </div>

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
                              placeholder="00000-000"
                              maxLength={9}
                              onChange={(e) => {
                                const formatted = formatCep(e.target.value);
                                field.onChange(formatted);
                              }}
                              onBlur={(e) => {
                                field.onBlur();
                                fetchCep(e.target.value);
                              }}
                              data-testid="input-cep"
                            />
                            {isLoadingCep && (
                              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            )}
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
                            placeholder="Nome da rua"
                            data-testid="input-street"
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
                          <Input 
                            {...field} 
                            placeholder="123"
                            data-testid="input-number"
                          />
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
                        <FormLabel>Complemento (opcional)</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="Apto, Bloco, etc."
                            data-testid="input-complement"
                          />
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
                            placeholder="Nome do bairro"
                            data-testid="input-neighborhood"
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
                            placeholder="Nome da cidade"
                            data-testid="input-city"
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
                            placeholder="UF"
                            maxLength={2}
                            onChange={(e) => {
                              field.onChange(e.target.value.toUpperCase());
                            }}
                            data-testid="input-state"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full"
                disabled={completeMutation.isPending}
                data-testid="button-submit-registration"
              >
                {completeMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Completar Cadastro"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper functions for formatting
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
