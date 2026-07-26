import { Suspense } from 'react';
import { adaptReportRows, cleanReportLabel } from './report-preview-adapters.js';
import { reportTheme } from './report-theme.js';
import { BarReport } from './renderers/BarReport.jsx';
import { FunnelReport } from './renderers/FunnelReport.jsx';
import { LineReport } from './renderers/LineReport.jsx';
import { MapReport } from './renderers/MapReport.jsx';
import { PieReport } from './renderers/PieReport.jsx';
import { RiskReport } from './renderers/RiskReport.jsx';
import { TableReport } from './renderers/TableReport.jsx';

function humanize(value = '') { return value.replace(/([a-z])([A-Z])/gu, '$1 $2').replaceAll('_', ' ').replace(/\b\w/gu, letter => letter.toUpperCase()); }
function NumberReport({ points, definition }) { const value = points.reduce((sum, point) => sum + (point.value ?? 0), 0); const label = definition.description?.trim() || humanize(definition.measures?.[0]?.field) || 'Total'; return <div aria-label="number report visualization" className="report-number" data-testid="report-number"><strong>{value.toLocaleString()}</strong><span>{label}</span></div>; }
function Unsupported({ type }) { return <div className="report-unsupported" role="alert">{['area', 'heatmap', 'pivot', 'network'].includes(type) ? `Legacy ${type} reports are unsupported. Edit this report and choose an approved visualization.` : 'This report visualization is unsupported.'}</div>; }

function unavailableReason(definition, rows) {
  const type = definition.visualization?.type ?? 'table';
  if (type === 'table' || rows.length === 0) return '';
  const dimension = definition.dimensions?.[0];
  const measure = definition.measures?.[0];
  const output = measure ? `${measure.field}_${measure.aggregate}` : '';
  if (type === 'map') {
    if (!dimension) return 'District geography is not configured.';
    if (!rows.some(row => row?.[dimension] !== undefined && row?.[dimension] !== null && (typeof row[dimension] !== 'string' || row[dimension].trim() !== ''))) return `The governed result does not contain ${dimension}.`;
  } else if (['bar', 'pie', 'line', 'funnel'].includes(type)) {
    if (!dimension) return 'A grouping field is not configured.';
    if (!rows.some(row => row?.[dimension] !== undefined && row?.[dimension] !== null && (typeof row[dimension] !== 'string' || row[dimension].trim() !== ''))) return `The governed result does not contain ${dimension}.`;
  }
  if (['number', 'bar', 'pie', 'line', 'funnel', 'map'].includes(type)) {
    if (!output) return 'A measure is not configured.';
    if (!rows.some(row => row?.[output] !== undefined && row?.[output] !== null && (typeof row[output] !== 'string' || row[output].trim() !== '') && Number.isFinite(Number(row[output])))) return `The governed result does not contain numeric ${output} values.`;
  }
  return '';
}

function Visual({ definition, points, rows, selectionRows, mapMetadata, onSelect, MapComponent, density }) {
  const { type = 'table', variant } = definition.visualization ?? {}; const showValues = Boolean(definition.style?.valueLabels);
  if (type === 'number' && variant === 'risk') return <RiskReport points={points} variant="risk" onSelect={onSelect} showValues={showValues} />;
  if (type === 'number') return <NumberReport definition={definition} points={points} />;
  if (type === 'table') return <TableReport rows={rows} selectionRows={selectionRows} selectionField={definition.dimensions?.[0]} density={definition.style?.tableDensity} onSelect={onSelect} />;
  if (type === 'bar' && variant === 'workload') return <div data-testid="report-bar"><RiskReport points={points} variant="workload" onSelect={onSelect} showValues={showValues} /></div>;
  if (type === 'bar') return <div data-testid="report-bar"><BarReport points={points} variant={variant} onSelect={onSelect} showValues={showValues} /></div>;
  if (type === 'pie') return <div data-testid="report-pie"><PieReport points={points} variant={variant} palette={definition.style?.palette} legend={definition.style?.legend} showValues={showValues} onSelect={onSelect} /></div>;
  if (type === 'line') return <div data-testid="report-line"><LineReport points={points} variant={variant} palette={definition.style?.palette} onSelect={onSelect} showValues={showValues} /></div>;
  if (type === 'map') return <MapReport rows={rows} mapMetadata={mapMetadata} palette={definition.style?.palette} density={density} MapComponent={MapComponent} />;
  if (type === 'funnel') return <FunnelReport points={points} onSelect={onSelect} showValues={showValues} />;
  return <Unsupported type={type} />;
}

const provenanceLabel = (provenance, demonstration) => {
  if (demonstration || provenance === 'SYNTHETIC') return 'Demonstration data';
  if (provenance === 'OPERATIONAL') return 'Operational data';
  if (provenance === 'MIXED') return 'Mixed provenance';
  if (provenance === 'EMPTY') return 'No source rows';
  return 'Viewer scoped';
};

function Heading({ definition, demonstration, provenance }) { return <div className="panel-heading"><div>{definition.style?.titleVisible !== false && <h2>{definition.name || 'Live preview'}</h2>}{definition.style?.subtitleVisible !== false && <p>Executed within the current viewer&apos;s authorised scope.</p>}</div><span>{provenanceLabel(provenance, demonstration)}</span></div>; }

export function ReportPreview({ api, mapPreview, mapMetadata, preview = [], definition, visualization, EmbeddedMapComponent, MapComponent, appearance = 'light', density = 'workbench', loading = false, error = '', onSelect, hasRun = false, provenance = '' }) {
  const firstRow = preview[0] ?? {};
  const inferredDimension = Object.keys(firstRow).find(key => typeof firstRow[key] === 'string');
  const inferredOutput = Object.keys(firstRow).find(key => Number.isFinite(Number(firstRow[key])));
  const separator = inferredOutput?.lastIndexOf('_') ?? -1;
  const inferredMeasure = separator > 0 ? { field: inferredOutput.slice(0, separator), aggregate: inferredOutput.slice(separator + 1) } : null;
  const resolved = definition ?? { dimensions: inferredDimension ? [inferredDimension] : [], measures: inferredMeasure ? [inferredMeasure] : [], visualization: { type: visualization ?? 'table' }, style: {} };
  const demonstration = provenance === 'SYNTHETIC' || provenance === 'Demonstration data' || preview.some(row => row?.IsSynthetic === true || row?.isSynthetic === true);
  const displayRows = preview.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, cleanReportLabel(value, demonstration)])));
  const points = adaptReportRows(preview, resolved, { demonstration }); const theme = reportTheme(resolved.style, appearance); const unavailable = unavailableReason(resolved, preview);
  let content;
  if (loading) content = <div className="loading-state" role="status">Running governed report…</div>;
  else if (error) content = <div className="error-state" role="alert">{error}</div>;
  else if (mapPreview && EmbeddedMapComponent) content = <Suspense fallback={<div className="loading-state" role="status">Loading governed map…</div>}><EmbeddedMapComponent api={api} mapExecution={mapPreview} /></Suspense>;
  else if (preview.length === 0) content = hasRun
    ? <div className="empty-state report-empty-state"><strong>No matching records</strong><span>Change the source, filters, or grouping and run again.</span><small>The query completed within the current viewer&apos;s authorised scope.</small></div>
    : <div className="empty-state report-empty-state"><strong>Preview your governed report</strong><span>Configure the definition, then Run without saving.</span><small>Results always use the current viewer&apos;s authorised scope.</small></div>;
  else if (unavailable) content = <div className="error-state" role="alert"><strong>Visualization unavailable</strong><span>{unavailable}</span></div>;
  else content = <Visual definition={resolved} points={points} rows={displayRows} selectionRows={preview} mapMetadata={mapMetadata ?? preview.mapMetadata} onSelect={onSelect} MapComponent={MapComponent} density={density} />;
  return <section className="report-preview-canvas" aria-label="Report preview" data-appearance={appearance} data-density={density} style={theme}><Heading definition={resolved} demonstration={demonstration} provenance={provenance} />{content}</section>;
}
