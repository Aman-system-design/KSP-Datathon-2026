import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { readDemoPersona } from '../../app/runtime.js';

const INCLUDE_ALL_REPORTS = () => true;

export function CommandCenterAddReportDrawer({ api, open = false, onAdd = () => {}, onClose = () => {}, reportPredicate = INCLUDE_ALL_REPORTS }) {
  const location = useLocation();
  const [reports, setReports] = useState([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    setStatus('Loading reports…');
    api.get('/v1/reports').then(response => {
      if (!active) return;
      setReports(Array.isArray(response?.data) ? response.data : []);
      setStatus('');
    }).catch(() => { if (active) setStatus('Reports are unavailable.'); });
    return () => { active = false; };
  }, [api, open]);
  const filtered = useMemo(() => reports.filter(report => reportPredicate(report)
    && report.name?.toLowerCase().includes(query.toLowerCase())), [reports, query, reportPredicate]);
  if (!open) return null;
  const reportParams = new URLSearchParams({ persona: readDemoPersona(location.search) ?? 'COMMAND_CENTER' });
  reportParams.set('returnTo', 'command-center');
  return <aside className="command-center-add-report" aria-label="Add report">
    <header><div><strong>Add report</strong><span>Authorized saved reports</span></div><button type="button" aria-label="Close report picker" onClick={onClose}><X aria-hidden="true" /></button></header>
    <Link className="command-center-add-report__new" to={{ pathname: '/reports/new', search: `?${reportParams}` }}><Plus aria-hidden="true" />Create new report</Link>
    <label><span className="sr-only">Search saved reports</span><Search aria-hidden="true" /><input aria-label="Search saved reports" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search reports" /></label>
    {status ? <p role="status">{status}</p> : filtered.length === 0 ? <p>No matching reports.</p> : <div className="command-center-add-report__list">{filtered.map(report => <button type="button" aria-label={`Add ${report.name}`} key={report.id} onClick={() => onAdd(report)}><div><strong>{report.name}</strong><span>{report.definition?.sourceKey ?? 'Governed source'} · {report.definition?.visualization?.type ?? 'table'}</span></div><Plus aria-hidden="true" /></button>)}</div>}
  </aside>;
}
