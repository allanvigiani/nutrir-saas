import { useCallback, useEffect, useState } from 'react';
import { format, parseISO, startOfMonth, subMonths, differenceInCalendarMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { RefreshCw, Users } from 'lucide-react';
import { apiRequest } from '../../hooks/useApi';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { DateRangeFilter, type DateRangeValue } from './DateRangeFilter';
import { AdminIntensityGrid } from './AdminIntensityGrid';

interface CohortRetention {
  cohortMonth: string;
  cohortSize: number;
  retention: { offset: number; pct: number }[];
}

const OFFSET_LABELS = ['Mês 0', 'Mês +1', 'Mês +2', 'Mês +3'];

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

export function AdminCohortGrid() {
  const [range, setRange] = useState<DateRangeValue>(defaultRange);
  const [cohorts, setCohorts] = useState<CohortRetention[] | null>(null);
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
      const res = await apiRequest<{ data: CohortRetention[] }>(
        `/api/admin/stats/retention-cohort?from=${range.from}&to=${range.to}`,
        'GET'
      );
      setCohorts(res?.data ?? []);
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

  const cohortsWithData = (cohorts ?? []).filter((c) => c.cohortSize > 0);
  const isEmpty = !loading && !error && cohortsWithData.length === 0;

  return (
    <Card className="border-none shadow-sm bg-card">
      <CardHeader className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-start gap-3">
          <Users className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div>
            <CardTitle className="text-base font-bold">Cohort de Retenção</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">% de nutricionistas ativos por mês desde o cadastro</p>
          </div>
        </div>
        <DateRangeFilter id="retention-cohort" value={range} onChange={setRange} disabled={loading} />
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
            <p className="text-sm text-muted-foreground">Nenhum nutricionista cadastrado no período selecionado.</p>
          </div>
        ) : (
          <AdminIntensityGrid
            rowLabels={cohortsWithData.map((c) => `${monthLabel(c.cohortMonth)} (${c.cohortSize})`)}
            colLabels={OFFSET_LABELS}
            values={cohortsWithData.map((c) => {
              const byOffset = new Map(c.retention.map((r) => [r.offset, r.pct]));
              return OFFSET_LABELS.map((_, offset) => byOffset.get(offset) ?? 0);
            })}
            formatValue={(v) => `${v}%`}
          />
        )}
      </CardContent>
    </Card>
  );
}
