interface AdminIntensityGridProps {
  rowLabels: string[];
  colLabels: string[];
  values: number[][]; // values[rowIndex][colIndex]
  formatValue?: (value: number) => string;
}

export function AdminIntensityGrid({
  rowLabels,
  colLabels,
  values,
  formatValue = (v) => v.toLocaleString('pt-BR'),
}: AdminIntensityGridProps) {
  const maxValue = Math.max(0, ...values.flat());

  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-1">
        <thead>
          <tr>
            <th className="w-20" />
            {colLabels.map((label) => (
              <th key={label} className="text-[10px] font-medium text-muted-foreground px-1 whitespace-nowrap">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowLabels.map((rowLabel, rowIndex) => (
            <tr key={rowLabel}>
              <th className="text-[10px] font-medium text-muted-foreground text-right pr-2 whitespace-nowrap">
                {rowLabel}
              </th>
              {colLabels.map((colLabel, colIndex) => {
                const value = values[rowIndex]?.[colIndex] ?? 0;
                const intensity = maxValue > 0 ? value / maxValue : 0;
                return (
                  <td
                    key={colLabel}
                    title={`${rowLabel} · ${colLabel}: ${formatValue(value)}`}
                    className="w-6 h-6 rounded-sm"
                    style={{
                      backgroundColor: `color-mix(in srgb, var(--primary) ${Math.round(intensity * 100)}%, var(--muted))`,
                    }}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
