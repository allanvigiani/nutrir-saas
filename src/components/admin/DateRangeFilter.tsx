import { differenceInCalendarMonths } from 'date-fns';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

export interface DateRangeValue {
  from: string; // yyyy-MM-dd
  to: string;   // yyyy-MM-dd
}

interface DateRangeFilterProps {
  id: string;
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  maxMonths?: number;
  disabled?: boolean;
}

/**
 * Seletor de período livre (data inicial/final) usado nos gráficos de série temporal
 * do painel admin. Segue o mesmo padrão de <Input type="date"> já usado em
 * Financial.tsx e Schedule.tsx, em vez de introduzir um Popover+Calendar de range
 * inédito no restante do app.
 */
export function DateRangeFilter({ id, value, onChange, maxMonths = 24, disabled }: DateRangeFilterProps) {
  const isInverted = value.from && value.to && value.from > value.to;
  const exceedsMax =
    !isInverted &&
    value.from &&
    value.to &&
    differenceInCalendarMonths(new Date(`${value.to}T00:00:00`), new Date(`${value.from}T00:00:00`)) > maxMonths;

  const error = isInverted
    ? 'Data inicial deve ser anterior à final.'
    : exceedsMax
    ? `Intervalo máximo de ${maxMonths} meses.`
    : null;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <Label htmlFor={`${id}-from`} className="text-xs text-muted-foreground font-normal">
            De
          </Label>
          <Input
            id={`${id}-from`}
            type="date"
            disabled={disabled}
            className="h-8 w-[140px] bg-muted/30 border-none rounded-lg text-xs"
            value={value.from}
            max={value.to || undefined}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Label htmlFor={`${id}-to`} className="text-xs text-muted-foreground font-normal">
            Até
          </Label>
          <Input
            id={`${id}-to`}
            type="date"
            disabled={disabled}
            className="h-8 w-[140px] bg-muted/30 border-none rounded-lg text-xs"
            value={value.to}
            min={value.from || undefined}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
          />
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
