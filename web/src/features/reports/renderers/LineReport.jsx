import { paletteColors } from '../report-theme.js';

function linePath(coordinates, interpolation) {
  if (!coordinates.length) return '';
  if (interpolation === 'step') return coordinates.slice(1).reduce((path, [x, y], index) => `${path} H${x} V${y}`, `M${coordinates[0][0]},${coordinates[0][1]}`);
  if (interpolation === 'smooth') return coordinates.slice(1).reduce((path, [x, y], index) => {
    const [previousX, previousY] = coordinates[index]; const middle = (previousX + x) / 2;
    return `${path} C${middle},${previousY} ${middle},${y} ${x},${y}`;
  }, `M${coordinates[0][0]},${coordinates[0][1]}`);
  return coordinates.map(([x, y], index) => `${index ? 'L' : 'M'}${x},${y}`).join(' ');
}

export function LineReport({ points, variant = 'line', palette = 'categorical', onSelect, showValues = true }) {
  const max = Math.max(...points.map(point => point.value ?? 0), 1); const width = 640; const height = 240;
  const interpolation = ['smooth', 'step'].includes(variant) ? variant : 'straight';
  const coordinates = points.map((point, index) => [points.length <= 1 ? width / 2 : index * width / (points.length - 1), height - ((point.value ?? 0) / max * (height - 30)) - 15]);
  const path = linePath(coordinates, interpolation); const color = paletteColors(palette)[0];
  const peak = points.reduce((best, point) => (point.value ?? 0) > (best?.value ?? -1) ? point : best, null);
  const keySelect = (event, point) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect?.(point.row); } };
  return <div aria-label="line report visualization" className="report-line" data-interpolation={interpolation} data-testid="report-line-chart" data-variant={variant}>
    <div className="report-line__summary"><span>Peak evidence</span><strong aria-label={`Peak ${peak?.label}: ${Number(peak?.value ?? 0).toLocaleString()}`} data-testid="report-line-peak">{Number(peak?.value ?? 0).toLocaleString()}</strong></div>
    <svg aria-label={variant === 'area' ? 'Area chart' : `${interpolation} line chart`} viewBox={`0 0 ${width} ${height}`} role="img">
      <g className="report-line__grid" data-testid="report-chart-grid">{[0, 1, 2, 3, 4].map(index => <line key={index} x1="0" x2={width} y1={index * height / 4} y2={index * height / 4} />)}</g>
      {variant === 'area' && <path className="report-line__area" d={`${path} L${width},${height} L0,${height} Z`} style={{ fill: color }} />}
      <path className="report-line__path" d={path} data-testid="report-line-path" style={{ stroke: color }} />
      {coordinates.map(([x, y], index) => <g key={index}><circle aria-label={`${points[index].label}: ${points[index].value ?? 'No value'}`} cx={x} cy={y} fill={color} r="6" role="button" tabIndex="0" onClick={() => onSelect?.(points[index].row)} onKeyDown={event => keySelect(event, points[index])} />{showValues && <text x={x} y={Math.max(12, y - 12)} textAnchor="middle">{points[index].value ?? '—'}</text>}</g>)}
    </svg>
    <div className="report-axis-labels">{points.map((point, index) => <span key={index}>{point.label}</span>)}</div>
  </div>;
}
