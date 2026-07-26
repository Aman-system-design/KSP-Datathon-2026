import { useState } from 'react';
import { paletteColors } from '../report-theme.js';

const polar = (angle, radius) => {
  const radians = (angle - 90) * Math.PI / 180;
  return [50 + radius * Math.cos(radians), 50 + radius * Math.sin(radians)];
};

function sector(start, end, innerRadius) {
  const [x1, y1] = polar(start, 46); const [x2, y2] = polar(end, 46);
  const large = end - start > 180 ? 1 : 0;
  if (!innerRadius) return `M50 50 L${x1} ${y1} A46 46 0 ${large} 1 ${x2} ${y2} Z`;
  const [ix2, iy2] = polar(end, innerRadius); const [ix1, iy1] = polar(start, innerRadius);
  return `M${x1} ${y1} A46 46 0 ${large} 1 ${x2} ${y2} L${ix2} ${iy2} A${innerRadius} ${innerRadius} 0 ${large} 0 ${ix1} ${iy1} Z`;
}

export function PieReport({ points, variant = 'pie', palette = 'categorical', onSelect, legend = 'right', showValues = true }) {
  const total = points.reduce((sum, point) => sum + Math.max(0, point.value ?? 0), 0) || 1;
  const colors = paletteColors(palette);
  const [selected, setSelected] = useState(null); const [hovered, setHovered] = useState(null);
  let angle = 0;
  const slices = points.map((point, index) => {
    const start = angle; angle += Math.max(0, point.value ?? 0) / total * 360;
    return { point, index, start, end: angle, color: colors[index % colors.length] };
  });
  const active = hovered ?? selected;
  const activate = index => { setSelected(index); onSelect?.(points[index].row); };
  const keySelect = (event, index) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(index); } };
  return <div aria-label="pie report visualization" className={`report-pie-layout report-pie-layout--${legend}`} data-testid="report-pie-chart" data-variant={variant}>
    <div className={`report-pie report-pie--${variant}`}>
      <svg aria-label={variant === 'doughnut' ? `Total ${total}` : 'Category share'} role="img" viewBox="0 0 100 100">
        {slices.map(slice => <path aria-label={`${slice.point.label}: ${slice.point.value ?? 'No value'}`} className={active === slice.index ? 'is-active' : ''} d={sector(slice.start, slice.end, variant === 'doughnut' ? 30 : 0)} fill={slice.color} key={slice.index} onClick={() => activate(slice.index)} onFocus={() => setHovered(slice.index)} onKeyDown={event => keySelect(event, slice.index)} onMouseEnter={() => setHovered(slice.index)} onMouseLeave={() => setHovered(null)} role="button" tabIndex="0" />)}
      </svg>
      <span role="status">{active !== null ? <><strong>{Number(points[active].value ?? 0).toLocaleString()}</strong><small>{points[active].label}</small></> : variant === 'doughnut' && showValues ? <><strong>{total.toLocaleString()}</strong><small>Total records</small></> : null}</span>
    </div>
    {legend !== 'none' && <div aria-label="Category legend" className="report-legend" data-testid="report-legend">{points.map((point, index) => <button aria-pressed={selected === index} key={index} onClick={() => activate(index)} onFocus={() => setHovered(index)} onMouseEnter={() => setHovered(index)} onMouseLeave={() => setHovered(null)} title={`${point.label}: ${point.value ?? 'No value'}`}><i style={{ background: colors[index % colors.length] }} /><span>{point.label}</span><small>{Math.round((Math.max(0, point.value ?? 0) / total) * 100)}%</small>{showValues && <strong>{Number(point.value ?? 0).toLocaleString()}</strong>}</button>)}</div>}
    {selected !== null && <aside aria-label="Selected category" className="report-pie-selection" role="region"><span>Selected category</span><strong>{points[selected].label}</strong><b>{Number(points[selected].value ?? 0).toLocaleString()}</b><small>{Math.round((Math.max(0, points[selected].value ?? 0) / total) * 100)}% of total</small></aside>}
  </div>;
}
