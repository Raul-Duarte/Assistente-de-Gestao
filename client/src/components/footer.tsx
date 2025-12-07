import { Link } from "wouter";
import { Sparkles } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              <span className="font-semibold text-lg">ArtefatosPro</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Transforme suas reuniões em documentos estruturados com inteligência artificial.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Produto</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/ferramentas" className="text-muted-foreground hover:text-foreground transition-colors">
                  Ferramentas
                </Link>
              </li>
              <li>
                <Link href="/precos" className="text-muted-foreground hover:text-foreground transition-colors">
                  Preços
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Empresa</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/sobre" className="text-muted-foreground hover:text-foreground transition-colors">
                  Sobre
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Legal</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <span className="text-muted-foreground">Termos de Uso</span>
              </li>
              <li>
                <span className="text-muted-foreground">Privacidade</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t mt-8 pt-8 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} ArtefatosPro. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
