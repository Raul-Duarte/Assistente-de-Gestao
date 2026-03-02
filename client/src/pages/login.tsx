import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Shield, Zap } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function Login() {
  const { isAuthenticated, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      window.location.href = "/dashboard";
    }
  }, [isAuthenticated, isLoading]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await apiRequest("POST", "/api/auth/login", { email, password });
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      window.location.href = "/dashboard";
    } catch (err: any) {
      setError(err?.message?.replace(/^401:\s*/, "") || "Falha ao autenticar");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h1 className="text-3xl font-bold mb-2">Bem-vindo de volta</h1>
            <p className="text-muted-foreground">
              Entre na sua conta para continuar
            </p>
          </div>

          <Card>
            <CardHeader className="text-center">
              <CardTitle>Entrar</CardTitle>
              <CardDescription>
                Acesse com credenciais locais
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@local.dev"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    required
                    data-testid="input-login-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Digite sua senha"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                    data-testid="input-login-password"
                  />
                </div>

                {error ? (
                  <p className="text-sm text-destructive" data-testid="text-login-error">
                    {error}
                  </p>
                ) : null}

                <Button
                  className="w-full"
                  size="lg"
                  type="submit"
                  disabled={isSubmitting}
                  data-testid="button-login-submit"
                >
                  {isSubmitting ? "Entrando..." : "Entrar"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="mt-8 space-y-4">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Shield className="h-4 w-4 text-primary" />
              <span>Seus dados estão seguros e protegidos</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Zap className="h-4 w-4 text-primary" />
              <span>Acesso instantâneo a todas as ferramentas</span>
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              Credenciais são definidas via variáveis locais do servidor.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
