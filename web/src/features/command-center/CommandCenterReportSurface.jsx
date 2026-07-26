import { Link, useLocation } from 'react-router-dom';
import { MoreHorizontal } from 'lucide-react';

import { governedAppLocation } from '../../app/runtime.js';
import { ReportPreview } from '../reports/ReportPreview.jsx';

export function CommandCenterReportSurface({ item, editing = false, onRemove = () => {}, onSelect }) {
  const location = useLocation();
  return <article className="command-center-report" aria-label={item.title}>
    <header><div><span>Governed report</span><h2>{item.title}</h2></div><div className="command-center-report-actions">{editing ? <button type="button" aria-label={`Report actions for ${item.title}`}><MoreHorizontal aria-hidden="true" /></button> : null}</div></header>
    <div className="command-center-report-body">{item.status === 'error'
      ? <div className="command-center-report-error" role="alert"><strong>Report unavailable</strong><span>Other dashboard intelligence remains available.</span><small>Reference {item.errorCode}</small></div>
      : item.mapExecution
        ? <div className="command-center-report-map-placeholder">Governed map output</div>
        : <ReportPreview
          preview={item.data ?? []}
          definition={item.definition}
          density="dashboard"
          hasRun
          provenance={item.syntheticData ? 'Demonstration data' : item.provenance ?? ''}
          onSelect={typeof onSelect === 'function' ? selection => onSelect(item, selection) : undefined}
        />}</div>
    <footer>{item.freshness ? <span>{item.freshness}</span> : <span>Viewer-scoped result</span>}<Link to={governedAppLocation(`/reports/${item.reportId}`, location)}>Open report</Link></footer>
  </article>;
}
