import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard,
  Users,
  Shield,
  Crown,
  LogOut,
  Home,
  ChevronUp,
  User,
  FileText,
  FileStack,
  Layers,
  UserCircle,
  CreditCard,
  Receipt,
  Wallet,
  BarChart3,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Profile } from "@shared/schema";
import logoImage from "@assets/image_1765327489003.png";

const mainMenuItems = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Artefatos",
    url: "/artefatos",
    icon: Wand2,
  },
  {
    title: "Meus Artefatos",
    url: "/meus-artefatos",
    icon: FileText,
  },
  {
    title: "Templates",
    url: "/templates",
    icon: FileStack,
  },
];

const managementItems = [
  {
    title: "Usuários",
    url: "/admin/usuarios",
    icon: Users,
  },
  {
    title: "Perfis",
    url: "/admin/perfis",
    icon: Shield,
  },
  {
    title: "Planos",
    url: "/admin/planos",
    icon: Crown,
  },
  {
    title: "Artefatos Gerados",
    url: "/admin/artefatos",
    icon: FileText,
  },
  {
    title: "Tipos de Artefatos",
    url: "/admin/tipos-artefatos",
    icon: Layers,
  },
];

const financialItems = [
  {
    title: "Clientes",
    url: "/admin/clientes",
    icon: UserCircle,
  },
  {
    title: "Assinaturas",
    url: "/admin/assinaturas",
    icon: CreditCard,
  },
  {
    title: "Mensalidades",
    url: "/admin/mensalidades",
    icon: Receipt,
  },
  {
    title: "Pagamentos",
    url: "/admin/pagamentos",
    icon: Wallet,
  },
  {
    title: "Relatórios",
    url: "/admin/relatorios",
    icon: BarChart3,
  },
];

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [location] = useLocation();
  const { user, isAuthenticated } = useAuth();

  const { data: userProfile } = useQuery<Profile>({
    queryKey: ["/api/user/profile"],
    enabled: isAuthenticated,
  });

  const isAdmin = userProfile?.name === "Administrador";

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.charAt(0) || "";
    const last = lastName?.charAt(0) || "";
    return (first + last).toUpperCase() || "U";
  };

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <Sidebar>
          <SidebarHeader className="border-b p-4">
            <a href="/" className="flex items-center gap-2" data-testid="link-sidebar-logo">
              <img src={logoImage} alt="ArtefatosPro" className="h-8 w-8 object-contain" />
              <span className="font-semibold text-lg">ArtefatosPro</span>
            </a>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Principal</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {mainMenuItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={location === item.url}
                        data-testid={`nav-${item.url.replace(/\//g, "-").slice(1)}`}
                      >
                        <a href={item.url}>
                          <item.icon />
                          <span>{item.title}</span>
                        </a>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {isAdmin && (
              <SidebarGroup>
                <SidebarGroupLabel>Administração</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {managementItems.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={location === item.url}
                          data-testid={`nav-${item.url.replace(/\//g, "-").slice(1)}`}
                        >
                          <a href={item.url}>
                            <item.icon />
                            <span>{item.title}</span>
                          </a>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}

            {isAdmin && (
              <SidebarGroup>
                <SidebarGroupLabel>Gestão Financeira</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {financialItems.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={location === item.url}
                          data-testid={`nav-${item.url.replace(/\//g, "-").slice(1)}`}
                        >
                          <a href={item.url}>
                            <item.icon />
                            <span>{item.title}</span>
                          </a>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </SidebarContent>

          <SidebarFooter className="border-t p-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 h-auto py-2 px-3"
                  data-testid="button-user-menu-sidebar"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.profileImageUrl || undefined} />
                    <AvatarFallback>
                      {getInitials(user?.firstName, user?.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start text-left flex-1 min-w-0">
                    <span className="text-sm font-medium truncate w-full">
                      {user?.firstName} {user?.lastName}
                    </span>
                    <span className="text-xs text-muted-foreground truncate w-full">
                      {user?.email}
                    </span>
                  </div>
                  <ChevronUp className="h-4 w-4 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56">
                <DropdownMenuItem asChild>
                  <a href="/perfil" className="cursor-pointer" data-testid="link-dropdown-profile">
                    <User className="mr-2 h-4 w-4" />
                    Meu Perfil
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href="/" className="cursor-pointer" data-testid="link-dropdown-home">
                    <Home className="mr-2 h-4 w-4" />
                    Página Inicial
                  </a>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <a href="/api/logout" className="cursor-pointer" data-testid="button-logout-sidebar">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sair
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-4 px-4 py-3 border-b bg-background">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
