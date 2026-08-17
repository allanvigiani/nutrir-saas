import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Clock, CreditCard, TrendingDown, RefreshCw } from 'lucide-react';
import { apiRequest } from '../../hooks/useApi';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';

type AdminAlertType = 'churnRisk' | 'atLimit' | 'gracePeriodEnding' | 'paymentIssue';

interface AdminAlert {
  type: AdminAlertType;
  nutritionistId: string;
  name: string;
  email: string;
  detail: string;
}

const ALERT_GROUPS: { type: AdminAlertType; title: string; icon: typeof AlertTriangle }[] = [
  { type: 'gracePeriodEnding', title: 'Período de Carência Terminando', icon: Clock },
  { type: 'paymentIssue', title: 'Problemas de Pagamento', icon: CreditCard },
  { type: 'churnRisk', title: 'Risco de Churn', icon: TrendingDown },
  { type: 'atLimit', title: 'Atingiu Limite do Plano Gratuito', icon: AlertTriangle },
];

export function AdminAlertsTab() {
  const [alerts, setAlerts] = useState<AdminAlert[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ data: AdminAlert[] }>('/api/admin/alerts', 'GET');
      setAlerts(res?.data ?? []);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar alertas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  if (loading) {
    return (
      <div className="h-40 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-40 flex flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchAlerts} className="gap-2">
          <RefreshCw className="w-3.5 h-3.5" /> Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {ALERT_GROUPS.map(({ type, title, icon: Icon }) => {
        const items = (alerts ?? []).filter((a) => a.type === type);
        return (
          <Card key={type} className="border-none shadow-sm bg-card">
            <CardHeader className="flex flex-row items-center gap-3 border-b border-border pb-4">
              <Icon className="w-5 h-5 text-accent-foreground shrink-0" />
              <div>
                <CardTitle className="text-base font-bold">{title}</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">{items.length} nutricionista(s)</p>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {items.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">Nenhum alerta nesta categoria.</p>
              ) : (
                <div className="divide-y divide-border">
                  {items.map((a) => (
                    <Link
                      key={a.nutritionistId}
                      to={`/admin/nutritionists/${a.nutritionistId}`}
                      className="flex items-center justify-between px-6 py-3 hover:bg-muted/30 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium">{a.name}</p>
                        <p className="text-xs text-muted-foreground">{a.email}</p>
                      </div>
                      <span className="text-xs text-accent-foreground font-medium">{a.detail}</span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
