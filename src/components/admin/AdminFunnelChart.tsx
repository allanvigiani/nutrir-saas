import { useCallback, useEffect, useState } from 'react';
import { Funnel, FunnelChart, LabelList } from 'recharts';
import { Filter, RefreshCw } from 'lucide-react';
import { format, startOfMonth, subMonths, differenceInCalendarMonths } from 'date-fns';
import { apiRequest } from '../../hooks/useApi';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '../ui/chart';
import { DateRangeFilter, type DateRangeValue } from './DateRangeFilter';

interface ConversionFunnel {
  signedUp: number;
  activated: number;
  premium: number;
}

const chartConfig: ChartConfig = {
  value: { label: 'Nutricionistas', color: 'var(--chart-1)' },
};

function defaultRange(): DateRangeValue {
  const to = new Date();
  const from = startOfMonth(subMonths(to, 5));
  return { from: format(from, 'yyyy-MM-dd'), to: format(to, 'yyyy-MM-dd') };
}

export function AdminFunnelChart() {
  const [range, setRange] = useState<DateRangeValue>(defaultRange);
  const [funnel, setFunnel] = useState<ConversionFunnel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const rangeValid =
    !!range.from &&
    !!range.to &&
    range.from <= range.to &&
    differenceInCalendarMonths(new Date(`${range.to}T00:00:00`), new Date(`${range.from}T00:00:00`)) <= 24;

  const fetchData = useCallback(async () => {
    if (!rangeValid) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ data: ConversionFunnel }>(
        `/api/admin/stats/conversion-funnel?from=${range.from}&to=${range.to}`,
        'GET'
      );
      setFunnel(res?.data ?? null);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to, rangeValid]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const data = funnel
    ? [
        { key: 'signedUp', name: 'Cadastrados', value: funnel.signedUp, fill: 'var(--chart-1)' },
        { key: 'activated', name: 'Ativados', value: funnel.activated, fill: 'var(--chart-2)' },
        { key: 'premium', name: 'Premium', value: funnel.premium, fill: 'var(--chart-3)' },
      ]
    : [];

  const isEmpty = !loading && !error && (!funnel || funnel.signedUp === 0);

  return (
    <Card className="border-none shadow-sm bg-card">
      <CardHeader className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-start gap-3">
          <Filter className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div>
            <CardTitle className="text-base font-bold">Funil de Conversão</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Cadastro → paciente ativo → premium</p>
          </div>
        </div>
        <DateRangeFilter id="conversion-funnel" value={range} onChange={setRange} disabled={loading} />
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
        ) : !rangeValid ? (
          <div className="h-[220px] flex items-center justify-center text-center">
            <p className="text-sm text-muted-foreground">Ajuste o período selecionado para ver os dados.</p>
          </div>
        ) : isEmpty ? (
          <div className="h-[220px] flex items-center justify-center text-center">
            <p className="text-sm text-muted-foreground">Nenhum cadastro no período selecionado.</p>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[220px] w-full">
            <FunnelChart>
              <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="key" />} />
              <Funnel dataKey="value" data={data} nameKey="key">
                <LabelList position="right" dataKey="name" fill="var(--foreground)" stroke="none" fontSize={12} />
              </Funnel>
            </FunnelChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
