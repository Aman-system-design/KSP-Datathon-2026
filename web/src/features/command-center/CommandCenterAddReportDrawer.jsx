import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { readDemoPersona } from '../../app/runtime.js';
import { RECOMMENDED_COMMAND_REPORTS } from './state-intelligence-template.js';

export function CommandCenterAddReportDrawer({ api, open = false, onAdd = () => {}, onClose = () => {} }) {
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
      setReports(Array.isArray(response?.data) ? response.data : response?.data?.items ?? []);
      setStatus('');
    }).catch(() => { if (active) setStatus('Reports are unavailable.'); });
    return () => { active = false; };
  }, [api, open]);
  const filtered = useMemo(() => reports.filter(report => report.name?.toLowerCase().includes(query.toLowerCase())), [reports, query]);
  const recommended = useMemo(() => RECOMMENDED_COMMAND_REPORTS
    .filter(definition => !reports.some(report => report.name === definition.name))
    .filter(definition => definition.name.toLowerCase().includes(query.toLowerCase())), [reports, query]);
  if (!open) return null;
  const reportParams = new URLSearchParams({ persona: readDemoPersona(location.search) ?? 'COMMAND_CENTER' });
  reportParams.set('returnTo', 'command-center');
  const addReport = async report => {
    if (report.id) { onAdd(report); return; }
    setStatus(`Creating ${report.name}…`);
    try {
      const created = (await api.post('/v1/reports', report)).data;
      setReports(current => [...current, created]);
      setStatus('');
      onAdd(created);
    } catch (error) {
      const reason = error?.code ? ` (${error.code})` : '';
      setStatus(`Could not create ${report.name}${reason}.`);
    }
  };
  return <aside className="command-center-add-report" aria-label="Add chart from datastore">
    <header><div><strong>Add chart</strong><span>Governed datastore reports</span></div><button type="button" aria-label="Close report picker" onClick={onClose}><X aria-hidden="true" /></button></header>
    <Link aria-label="Create new report" className="command-center-add-report__new" to={{ pathname: '/reports/new', search: `?${reportParams}` }}><Plus aria-hidden="true" />Create chart from datastore</Link>
    <label><span className="sr-only">Search saved reports</span><Search aria-hidden="true" /><input aria-label="Search saved reports" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search reports" /></label>
    {status ? <p role="status">{status}</p> : filtered.length === 0 && recommended.length === 0 ? <p>No matching reports.</p> : <div className="command-center-add-report__list">
      {recommended.length ? <small className="command-center-add-report__section-label">Recommended command reports</small> : null}
      {recommended.map(definition => <button type="button" aria-label={`Add ${definition.name}`} key={definition.name} onClick={() => addReport(definition)}><div><strong>{definition.name}</strong><span>{definition.sourceKey} · {definition.visualization.type} · Editable</span></div><Plus aria-hidden="true" /></button>)}
      {filtered.length ? <small className="command-center-add-report__section-label">Saved reports</small> : null}
      {filtered.map(report => <button type="button" aria-label={`Add ${report.name}`} key={report.id} onClick={() => addReport(report)}><div><strong>{report.name}</strong><span>{report.definition?.sourceKey ?? 'Governed source'} · {report.definition?.visualization?.type ?? 'table'}</span></div><Plus aria-hidden="true" /></button>)}
    </div>}
  </aside>;
}
