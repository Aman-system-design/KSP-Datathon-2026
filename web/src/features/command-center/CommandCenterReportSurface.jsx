import { Link, useLocation } from 'react-router-dom';
import { BarChart3, Pencil, Trash2 } from 'lucide-react';

import { governedAppLocation } from '../../app/runtime.js';
import { demonstrationLabel } from '../../lib/display-text.js';
import { ReportPreview } from '../reports/ReportPreview.jsx';

function normalizedSelection(item, selection) {
  if (!selection || typeof selection !== 'object') return selection;
  if (typeof selection.field === 'string' && Object.hasOwn(selection, 'value') && selection.row) return selection;
  const row = selection.row ?? selection;
  const field = item.definition?.dimensions?.[0];
  return field ? { field, value: row?.[field], row } : selection;
}

function ResultTable({ rows }) {
  const columns = [...new Set(rows.flatMap(row => Object.keys(row)))];
  if (!rows.length) return <div className="command-center-report-empty">No matching data in the authorized scope.</div>;
  return <div className="command-center-report-table-wrap"><table><thead><tr>{columns.map(column => <th key={column}>{column.replaceAll('_', ' ')}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{columns.map(column => <td key={column}>{demonstrationLabel(row[column] ?? '—')}</td>)}</tr>)}</tbody></table></div>;
}

export function CommandCenterReportSurface({ item, editing = false, onRemove = () => {}, onSelect, showPreviewMeta = true, returnTo = '' }) {
  const location = useLocation();
  const baseReportLocation = governedAppLocation(`/reports/${item.reportId}`, location);
  const reportParams = new URLSearchParams(baseReportLocation.search);
  if (returnTo) reportParams.set('returnTo', returnTo);
  const reportLocation = { ...baseReportLocation, search: reportParams.toString() ? `?${reportParams}` : '' };
  const visualization = item.definition?.visualization?.type;
  const definition = visualization === 'map'
      ? { ...item.definition, style: { ...item.definition.style, palette: item.definition.style?.palette ?? 'mapBlue' } }
    : visualization === 'pie'
      ? { ...item.definition, visualization: { ...item.definition.visualization, variant: item.definition.visualization?.variant ?? 'doughnut' }, style: { ...item.definition.style, palette: item.definition.style?.palette ?? 'dashboardPie', legend: item.definition.style?.legend ?? 'right', valueLabels: item.definition.style?.valueLabels ?? true } }
      : visualization === 'bar'
        ? { ...item.definition, visualization: { ...item.definition.visualization, variant: item.definition.visualization?.variant ?? 'horizontal' }, style: { ...item.definition.style, valueLabels: item.definition.style?.valueLabels ?? true } }
        : visualization === 'line'
          ? { ...item.definition, visualization: { ...item.definition.visualization, variant: item.definition.visualization?.variant ?? 'area' }, style: { ...item.definition.style, legend: item.definition.style?.legend ?? 'none' } }
          : item.definition;
  return <article className="command-center-report" aria-label={item.title}>
    <header><div className="command-center-report-title"><span aria-hidden="true"><BarChart3 /></span><h2>{item.title}</h2></div><div className="command-center-report-actions">{editing ? <><Link aria-label={`Edit ${item.title} report`} title="Edit report" to={reportLocation}><Pencil aria-hidden="true" /></Link><button type="button" aria-label={`Remove ${item.title} report`} title="Remove report" onClick={() => onRemove(item.id)}><Trash2 aria-hidden="true" /></button></> : null}</div></header>
    <div className="command-center-report-body">{item.status === 'error'
      ? <div className="command-center-report-error" role="alert"><strong>Report unavailable</strong><span>Other dashboard intelligence remains available.</span><small>Reference {item.errorCode}</small></div>
      : item.mapExecution
        ? <div className="command-center-report-map-placeholder">Governed map output</div>
        : definition
          ? <ReportPreview appearance="light" density="dashboard" definition={definition} preview={item.data ?? []} mapMetadata={item.mapMetadata} provenance={item.syntheticData ? 'Demonstration data' : ''} showMeta={showPreviewMeta} onSelect={typeof onSelect === 'function' ? selection => onSelect(item, normalizedSelection(item, selection)) : undefined} hasRun />
          : <ResultTable rows={item.data ?? []} />}</div>
    <footer>{item.syntheticData ? <span>Demonstration data</span> : item.freshness ? <span>{item.freshness}</span> : <span>Viewer-scoped result</span>}<Link to={reportLocation}>Open report</Link></footer>
  </article>;
}
