const numberFormatter = new Intl.NumberFormat('en-IN');

function percent(value, total) {
  return total > 0 ? `${Math.round((value / total) * 100)}%` : '0%';
}

export function FunnelReport({ points, onSelect, showValues = true }) {
  const total = points.reduce((sum, point) => sum + (point.value ?? 0), 0);
  const firstValue = points[0]?.value ?? 0;
  const chargesheetValue = points.find(point => /chargesheet/iu.test(point.label))?.value ?? points[1]?.value ?? 0;
  const conversion = firstValue > 0 ? Math.round((chargesheetValue / firstValue) * 100) : 0;

  return <div aria-label="funnel report visualization" className="report-funnel" data-testid="report-funnel-chart">
    <div className="report-funnel__stages">
      {points.map((point, index) => <button
        aria-label={`${point.label}: ${point.value ?? 'No value'}`}
        className="report-funnel__stage"
        key={index}
        onClick={() => onSelect?.(point.row)}
        title={`${point.label}: ${point.value ?? 'No value'}`}
        type="button"
      >
        <span>{point.label}</span>
        {showValues ? <strong>{numberFormatter.format(point.value ?? 0)}</strong> : null}
        <small>{percent(point.value ?? 0, total)}</small>
      </button>)}
    </div>
    {points.length > 1 ? <div aria-label={`Chargesheet conversion ${conversion}%`} className="report-funnel__summary">
      <span>Chargesheet conversion</span>
      <strong>{conversion}%</strong>
    </div> : null}
  </div>;
}
