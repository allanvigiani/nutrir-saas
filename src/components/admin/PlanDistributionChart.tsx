import { useCallback, useEffect, useState } from 'react';
import { Pie, PieChart, Cell } from 'recharts';
import { PieChart as PieChartIcon, RefreshCw } from 'lucide-react';
import { apiRequest } from '../../hooks/useApi';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from '../ui/chart';

interface PlanDistributionResponse {
  free: number;
  premium: number;
  admin: number;
  total: number;
}

// Paleta restrita do Nutrir (DESIGN.md): verde é o sinal de "ação/receita" (premium),
// âmbar é o acento secundário (admin — grupo minoritário e distinto), e o gratuito
// usa o tom neutro já usado nos badges "Gratuito" existentes (bg-muted/text-muted-foreground)
// em vez de inventar uma terceira cor fora do sistema de tokens já validado no app.
const chartConfig: ChartConfig = {
  premium: { label: 'Premium', color: 'var(--chart-1)' },
  free: { label: 'Gratuito', color: 'var(--muted-foreground)' },
  admin: { label: 'Admin', color: 'var(--chart-3)' },
};

export function PlanDistributionChart() {
  const [stats, setStats] = useState<PlanDistributionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<PlanDistributionResponse>('/api/admin/stats/plan-distribution', 'GET');
      setStats(res);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const chartData = stats
    ? [
        { key: 'premium', name: 'Premium', value: stats.premium, fill: 'var(--color-premium)' },
        { key: 'free', name: 'Gratuito', value: stats.free, fill: 'var(--color-free)' },
        { key: 'admin', name: 'Admin', value: stats.admin, fill: 'var(--color-admin)' },
      ].filter((d) => d.value > 0)
    : [];

  const isEmpty = !loading && !error && (!stats || stats.total === 0);

  return (
    <Card className="border-none shadow-sm bg-card">
      <CardHeader className="flex flex-row items-start gap-3 border-b border-border pb-4">
        <PieChartIcon className="w-5 h-5 text-primary mt-0.5 shrink-0" />
        <div>
          <CardTitle className="text-base font-bold">Distribuição Free vs. Premium</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Estado atual da base de nutricionistas</p>
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
            <p className="text-sm text-muted-foreground">Nenhum nutricionista cadastrado.</p>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[220px] w-full">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="key" />} />
              <Pie data={chartData} dataKey="value" nameKey="key" innerRadius={50} outerRadius={80} strokeWidth={2} stroke="var(--card)">
                {chartData.map((entry) => (
                  <Cell key={entry.key} fill={entry.fill} />
                ))}
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="key" />} />
            </PieChart>
          </ChartContainer>
        )}
        {stats && !loading && !error && !isEmpty && (
          <p className="text-center text-xs text-muted-foreground mt-2">{stats.total} nutricionista(s) no total</p>
        )}
      </CardContent>
    </Card>
  );
}
