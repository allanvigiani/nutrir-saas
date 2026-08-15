import { Eye } from 'lucide-react';

interface ReadOnlyBannerProps {
  context?: string;
}

/**
 * Banner fixo exigido pela spec em toda a navegação cross-tenant somente leitura
 * (nutricionista → pacientes → paciente → consultas/planos). Deixa claro que o
 * admin está vendo dados de outro nutricionista, sem nenhuma ação de edição.
 */
export function ReadOnlyBanner({ context }: ReadOnlyBannerProps) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-accent-foreground">
      <Eye className="w-4 h-4 shrink-0" />
      <p className="text-sm font-medium">
        Modo leitura — dados de outro nutricionista
        {context && <span className="font-normal opacity-80"> · {context}</span>}
      </p>
    </div>
  );
}
