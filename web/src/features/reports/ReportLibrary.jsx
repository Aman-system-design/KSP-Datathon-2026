import { BarChart3, FileBarChart, Map, Plus, Search, Table2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const TYPE_ICONS = { map: Map, table: Table2, bar: BarChart3, line: FileBarChart, number: FileBarChart };
const TABS = [
  ['all', 'All reports'],
  ['private', 'My reports'],
  ['global', 'Organization'],
];

function reportScope(report) {
  if (report.visibility === 'GLOBAL') return 'Organization';
  if (report.visibility === 'PRIVATE') return 'Private';
  return 'Shared';
}

export function ReportLibrary({ api }) {
  const { search } = useLocation();
  const [reports, setReports] = useState([]);
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('Loading reports…');

  useEffect(() => {
    let active = true;
    api.get('/v1/reports').then(({ data }) => {
      if (!active) return;
      setReports(Array.isArray(data) ? data : []);
      setStatus('');
    }).catch(() => { if (active) setStatus('Reports could not be loaded.'); });
    return () => { active = false; };
  }, [api]);

  const visible = useMemo(() => reports.filter(report => {
    const visibility = String(report.visibility ?? '').toLowerCase();
    const matchesTab = tab === 'all' || visibility === tab;
    return matchesTab && report.name?.toLowerCase().includes(query.trim().toLowerCase());
  }), [query, reports, tab]);

  return <section className="reports-app">
    <header className="reports-header">
      <div><h1>Reports</h1><p>Create and run governed analysis using the data available to your role.</p></div>
      <Link className="primary-button reports-create" to={{ pathname: '/reports/new', search }}><Plus size={16} />Create report</Link>
    </header>
    <div className="reports-toolbar">
      <nav aria-label="Report views">{TABS.map(([value, label]) => <button aria-pressed={tab === value} key={value} onClick={() => setTab(value)} type="button">{label}</button>)}</nav>
      <label className="reports-search"><Search size={15} /><span className="sr-only">Search reports</span><input aria-label="Search reports" onChange={event => setQuery(event.target.value)} placeholder="Search reports" value={query} /></label>
    </div>
    <div className="reports-table-wrap">
      <table className="reports-table">
        <thead><tr><th>Type</th><th>Title</th><th>Source</th><th>Access</th><th>Last modified</th></tr></thead>
        <tbody>{visible.map(report => {
          const type = report.definition?.visualization?.type ?? 'table';
          const Icon = TYPE_ICONS[type] ?? FileBarChart;
          return <tr key={report.id}>
            <td><span className="report-type"><Icon size={15} />{type}</span></td>
            <td><Link to={{ pathname: `/reports/${encodeURIComponent(report.id)}`, search }}>{report.name}</Link></td>
            <td>{report.definition?.sourceKey ?? '—'}</td><td>{reportScope(report)}</td>
            <td>{report.updatedAt ? new Date(report.updatedAt).toLocaleString() : '—'}</td>
          </tr>;
        })}</tbody>
      </table>
      {status ? <p className="reports-empty" role="status">{status}</p> : visible.length === 0 ? <p className="reports-empty">No reports match this view.</p> : null}
    </div>
  </section>;
}
