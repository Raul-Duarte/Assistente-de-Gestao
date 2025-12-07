import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Shield, Zap, ArrowRight } from "lucide-react";
import { SiGoogle, SiGithub } from "react-icons/si";

export default function Login() {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      window.location.href = "/dashboard";
    }
  }, [isAuthenticated, isLoading]);

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
                Escolha como deseja acessar sua conta
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                className="w-full"
                size="lg"
                asChild
                data-testid="button-login-google"
              >
                <a href="/api/login">
                  <SiGoogle className="mr-2 h-4 w-4" />
                  Continuar com Google
                </a>
              </Button>

              <Button
                className="w-full"
                size="lg"
                variant="outline"
                asChild
                data-testid="button-login-github"
              >
                <a href="/api/login">
                  <SiGithub className="mr-2 h-4 w-4" />
                  Continuar com GitHub
                </a>
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    ou
                  </span>
                </div>
              </div>

              <Button
                className="w-full"
                size="lg"
                variant="secondary"
                asChild
                data-testid="button-login-replit"
              >
                <a href="/api/login">
                  Continuar com Replit
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
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
              Ainda não tem uma conta?{" "}
              <a
                href="/api/login"
                className="text-primary hover:underline font-medium"
                data-testid="link-signup"
              >
                Criar conta grátis
              </a>
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
