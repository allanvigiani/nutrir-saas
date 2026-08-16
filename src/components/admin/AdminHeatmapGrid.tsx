import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Activity } from 'lucide-react';
import { apiRequest } from '../../hooks/useApi';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { AdminIntensityGrid } from './AdminIntensityGrid';

interface ActivityHeatmapPoint {
  day: number;
  hour: number;
  count: number;
}

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const HOUR_LABELS = Array.from({ length: 24 }, (_, h) => `${h}h`);

export function AdminHeatmapGrid() {
  const [points, setPoints] = useState<ActivityHeatmapPoint[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ data: ActivityHeatmapPoint[] }>('/api/admin/stats/activity-heatmap', 'GET');
      setPoints(res?.data ?? []);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const values = DAY_LABELS.map((_, day) =>
    HOUR_LABELS.map((_, hour) => points?.find((p) => p.day === day && p.hour === hour)?.count ?? 0)
  );
  const isEmpty = !loading && !error && values.flat().every((v) => v === 0);

  return (
    <Card className="border-none shadow-sm bg-card">
      <CardHeader className="flex flex-row items-start gap-3 border-b border-border pb-4">
        <Activity className="w-5 h-5 text-primary mt-0.5 shrink-0" />
        <div>
          <CardTitle className="text-base font-bold">Agendamentos por Dia e Horário</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Agendamentos nos últimos 90 dias (horário de Brasília)</p>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {loading ? (
          <div className="h-[220px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="h-[220px] flex flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
              <RefreshCw className="w-3.5 h-3.5" /> Tentar novamente
            </Button>
          </div>
        ) : isEmpty ? (
          <div className="h-[220px] flex items-center justify-center text-center">
            <p className="text-sm text-muted-foreground">Nenhuma atividade nos últimos 90 dias.</p>
          </div>
        ) : (
          <AdminIntensityGrid rowLabels={DAY_LABELS} colLabels={HOUR_LABELS} values={values} />
        )}
      </CardContent>
    </Card>
  );
}
