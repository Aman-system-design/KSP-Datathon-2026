import { Link, useLocation } from 'react-router-dom';
import { MoreHorizontal } from 'lucide-react';

import { governedAppLocation } from '../../app/runtime.js';
import { ReportPreview } from '../reports/ReportPreview.jsx';

function normalizedSelection(item, selection) {
  if (!selection || typeof selection !== 'object') return selection;
  if (typeof selection.field === 'string' && Object.hasOwn(selection, 'value') && selection.row) return selection;
  const row = selection.row ?? selection;
  const field = item.definition?.dimensions?.[0];
  return field ? { field, value: row?.[field], row } : selection;
}

export function CommandCenterReportSurface({ item, editing = false, onRemove = () => {}, onSelect, showPreviewMeta = true }) {
  const location = useLocation();
  return <article className="command-center-report" aria-label={item.title}>
    <header><div>{showPreviewMeta ? <span>Governed report</span> : null}<h2>{item.title}</h2></div><div className="command-center-report-actions">{editing ? <button type="button" aria-label={`Report actions for ${item.title}`}><MoreHorizontal aria-hidden="true" /></button> : null}</div></header>
    <div className="command-center-report-body">{item.status === 'error'
      ? <div className="command-center-report-error" role="alert"><strong>Report unavailable</strong><span>Other dashboard intelligence remains available.</span><small>Reference {item.errorCode}</small></div>
      : item.mapExecution
        ? <div className="command-center-report-map-placeholder">Governed map output</div>
        : <ReportPreview
          preview={item.data ?? []}
          definition={item.definition}
          density="dashboard"
          showMeta={showPreviewMeta}
          hasRun
          provenance={item.provenance ?? (item.syntheticData ? 'SYNTHETIC' : '')}
          onSelect={typeof onSelect === 'function' ? selection => onSelect(item, normalizedSelection(item, selection)) : undefined}
        />}</div>
    <footer>{showPreviewMeta ? (item.freshness ? <span>{item.freshness}</span> : <span>Viewer-scoped result</span>) : <span>Current result</span>}<Link to={governedAppLocation(`/reports/${item.reportId}`, location)}>Open report</Link></footer>
  </article>;
}
