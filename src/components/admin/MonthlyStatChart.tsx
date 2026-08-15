import { useCallback, useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts';
import { format, parseISO, startOfMonth, subMonths, differenceInCalendarMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { RefreshCw, type LucideIcon } from 'lucide-react';
import { apiRequest } from '../../hooks/useApi';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '../ui/chart';
import { DateRangeFilter, type DateRangeValue } from './DateRangeFilter';

export interface MonthlyPoint {
  month: string; // 'YYYY-MM'
  value: number;
}

interface MonthlyStatChartProps {
  title: string;
  description?: string;
  icon: LucideIcon;
  endpoint: string;
  valueFormatter?: (value: number) => string;
  color?: string;
}

function defaultRange(): DateRangeValue {
  const to = new Date();
  const from = startOfMonth(subMonths(to, 5));
  return { from: format(from, 'yyyy-MM-dd'), to: format(to, 'yyyy-MM-dd') };
}

function monthLabel(month: string): string {
  try {
    return format(parseISO(`${month}-01`), 'MMM/yy', { locale: ptBR });
  } catch {
    return month;
  }
}

export function MonthlyStatChart({
  title,
  description,
  icon: Icon,
  endpoint,
  valueFormatter = (v) => v.toLocaleString('pt-BR'),
  color = 'var(--chart-1)',
}: MonthlyStatChartProps) {
  const [range, setRange] = useState<DateRangeValue>(defaultRange);
  const [data, setData] = useState<MonthlyPoint[] | null>(null);
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
      const res = await apiRequest<{ data: MonthlyPoint[] }>(
        `${endpoint}?from=${range.from}&to=${range.to}`,
        'GET'
      );
      setData(res?.data ?? []);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, range.from, range.to, rangeValid]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const chartConfig: ChartConfig = {
    value: { label: title, color },
  };

  const isEmpty = !loading && !error && (!data || data.length === 0 || data.every((d) => d.value === 0));

  return (
    <Card className="border-none shadow-sm bg-card">
      <CardHeader className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-start gap-3">
          <Icon className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div>
            <CardTitle className="text-base font-bold">{title}</CardTitle>
            {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
          </div>
        </div>
        <DateRangeFilter
          id={endpoint}
          value={range}
          onChange={setRange}
          disabled={loading}
        />
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
            <p className="text-sm text-muted-foreground">Nenhum dado no período selecionado.</p>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[220px] w-full">
            <BarChart data={data ?? []} margin={{ left: 4, right: 4, top: 4 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="month"
                tickFormatter={monthLabel}
                tickLine={false}
                axisLine={false}
                fontSize={12}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(label) => monthLabel(String(label))}
                    formatter={(value) => (
                      <div className="flex w-full items-center justify-between gap-3">
                        <span className="text-muted-foreground">{title}</span>
                        <span className="font-mono font-medium text-foreground tabular-nums">
                          {valueFormatter(Number(value))}
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
