import { useEffect, useState } from 'react';
import { useParams, useLocation, Link, Navigate } from 'react-router-dom';
import { ArrowLeft, Search, Users } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { apiRequest } from '../hooks/useApi';
import { Patient, Nutritionist } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { cn } from '../lib/utils';
import { ReadOnlyBanner } from '../components/admin/ReadOnlyBanner';

interface PaginatedPatients {
  data: Patient[];
  total: number;
  page: number;
  totalPages: number;
}

export const AdminNutritionistPatients = () => {
  const { nutritionist: currentAdmin, loading: authLoading } = useAuth();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const stateNutritionist = (location.state as { nutritionist?: Nutritionist } | null)?.nutritionist;

  const [patients, setPatients] = useState<Patient[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const LIMIT = 20;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiRequest<PaginatedPatients>(`/api/admin/nutritionists/${id}/patients?page=${page}&limit=${LIMIT}`, 'GET')
      .then((res) => {
        if (cancelled) return;
        setPatients(res?.data ?? []);
        setTotal(res?.total ?? 0);
        setTotalPages(res?.totalPages ?? 1);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Erro ao carregar pacientes.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, page]);

  if (authLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (currentAdmin?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  if (!id) {
    return <Navigate to="/admin" replace />;
  }

  const filteredPatients = patients.filter((p) => {
    const term = searchTerm.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      (p.email || '').toLowerCase().includes(term) ||
      p.id.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="gap-1.5" render={<Link to={`/admin/nutritionists/${id}`} state={{ nutritionist: stateNutritionist }} />}>
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
      </div>

      <ReadOnlyBanner context={stateNutritionist ? `${stateNutritionist.name} (${stateNutritionist.email})` : undefined} />

      <Card className="border-none shadow-sm bg-card">
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between border-b border-border pb-6 gap-4">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Pacientes {stateNutritionist ? `de ${stateNutritionist.name}` : ''}
          </CardTitle>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, e-mail ou ID..."
              className="pl-10 bg-muted/30 border-none rounded-xl h-8 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-muted/30 text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
                  <th className="px-6 py-4 font-bold">Paciente</th>
                  <th className="hidden lg:table-cell px-6 py-4 font-bold">ID</th>
                  <th className="hidden md:table-cell px-6 py-4 font-bold">Telefone</th>
                  <th className="px-6 py-4 font-bold">Status</th>
                  <th className="hidden md:table-cell px-6 py-4 font-bold">Cadastro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                      {error}
                    </td>
                  </tr>
                ) : filteredPatients.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                      Nenhum paciente encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredPatients.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4">
                        <Link to={`/admin/patients/${p.id}`} className="flex items-center gap-3 group">
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-bold shrink-0">
                            {p.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-foreground group-hover:text-primary transition-colors">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{p.email}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="hidden lg:table-cell px-6 py-4">
                        <span className="font-mono text-xs text-muted-foreground">{p.id}</span>
                      </td>
                      <td className="hidden md:table-cell px-6 py-4 text-muted-foreground">{p.phone || '—'}</td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            'px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider',
                            p.status === 'active' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                          )}
                        >
                          {p.status === 'active' ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="hidden md:table-cell px-6 py-4 text-muted-foreground whitespace-nowrap">
                        {p.createdAt ? format(parseISO(p.createdAt), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Página {page} de {totalPages} · {total} paciente(s)
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                  Anterior
                </Button>
                <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
