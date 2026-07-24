import { Link, useLocation } from 'react-router-dom';
import { MoreHorizontal } from 'lucide-react';

import { governedAppLocation } from '../../app/runtime.js';

function ResultTable({ rows }) {
  const columns = [...new Set(rows.flatMap(row => Object.keys(row)))];
  if (!rows.length) return <div className="command-center-report-empty">No matching data in the authorized scope.</div>;
  return <div className="command-center-report-table-wrap"><table><thead><tr>{columns.map(column => <th key={column}>{column.replaceAll('_', ' ')}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{columns.map(column => <td key={column}>{row[column] ?? '—'}</td>)}</tr>)}</tbody></table></div>;
}

export function CommandCenterReportSurface({ item, editing = false, onRemove = () => {} }) {
  const location = useLocation();
  return <article className="command-center-report" aria-label={item.title}>
    <header><div><span>Governed report</span><h2>{item.title}</h2></div><div className="command-center-report-actions">{editing ? <button type="button" aria-label={`Report actions for ${item.title}`}><MoreHorizontal aria-hidden="true" /></button> : null}</div></header>
    <div className="command-center-report-body">{item.status === 'error'
      ? <div className="command-center-report-error" role="alert"><strong>Report unavailable</strong><span>Other dashboard intelligence remains available.</span><small>Reference {item.errorCode}</small></div>
      : item.mapExecution
        ? <div className="command-center-report-map-placeholder">Governed map output</div>
        : <ResultTable rows={item.data ?? []} />}</div>
    <footer>{item.freshness ? <span>{item.freshness}</span> : <span>Viewer-scoped result</span>}<Link to={governedAppLocation(`/reports/${item.reportId}`, location)}>Open report</Link></footer>
  </article>;
}
