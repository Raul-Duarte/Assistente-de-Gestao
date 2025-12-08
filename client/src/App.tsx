import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { useAuth } from "@/hooks/useAuth";

import Landing from "@/pages/landing";
import Pricing from "@/pages/pricing";
import About from "@/pages/about";
import Tools from "@/pages/tools";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Artefatos from "@/pages/artefatos";
import MeusArtefatos from "@/pages/meus-artefatos";
import Templates from "@/pages/templates";
import AdminUsers from "@/pages/admin/users";
import AdminProfiles from "@/pages/admin/profiles";
import AdminPlans from "@/pages/admin/plans";
import AdminArtifacts from "@/pages/admin/artifacts";
import Perfil from "@/pages/perfil";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      <Route path="/" component={isLoading || !isAuthenticated ? Landing : Dashboard} />
      <Route path="/precos" component={Pricing} />
      <Route path="/sobre" component={About} />
      <Route path="/ferramentas" component={Tools} />
      <Route path="/login" component={Login} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/artefatos" component={Artefatos} />
      <Route path="/meus-artefatos" component={MeusArtefatos} />
      <Route path="/templates" component={Templates} />
      <Route path="/admin/usuarios" component={AdminUsers} />
      <Route path="/admin/perfis" component={AdminProfiles} />
      <Route path="/admin/planos" component={AdminPlans} />
      <Route path="/admin/artefatos" component={AdminArtifacts} />
      <Route path="/perfil" component={Perfil} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="artefatos-theme">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
