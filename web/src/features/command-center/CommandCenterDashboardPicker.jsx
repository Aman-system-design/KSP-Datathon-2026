import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';

import { dashboardSections } from './command-center-dashboard-model.js';

const sectionLabels = Object.freeze({ results: 'Results', recent: 'Recent', owned: 'Owned by you', shared: 'Shared with you', system: 'System dashboards' });

export function CommandCenterDashboardPicker({ open, dashboards = [], onSelect, onClose, onOpenAll }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => dashboards.filter(item => item.name?.toLowerCase().includes(query.trim().toLowerCase())), [dashboards, query]);
  const sections = dashboardSections(filtered);
  const displayedSections = query.trim() ? { results: filtered } : sections;
  if (!open) return null;
  return <aside className="command-center-dashboard-picker" role="dialog" aria-label="Dashboards">
    <header><div><strong>Dashboards</strong><span>Authorized workspaces</span></div><button type="button" aria-label="Close dashboards" onClick={onClose}><X aria-hidden="true" /></button></header>
    <label className="command-center-dashboard-search"><Search aria-hidden="true" /><input type="search" aria-label="Search dashboards" value={query} onChange={event => setQuery(event.target.value)} /></label>
    <div className="command-center-dashboard-sections">{Object.entries(sectionLabels).map(([key, label]) => displayedSections[key]?.length ? <section key={key}><h2>{label}</h2>{displayedSections[key].map(item => <button type="button" key={`${key}-${item.id}`} onClick={() => { onSelect(item.id); onClose(); }} aria-label={item.name}><strong>{item.name}</strong><span>{item.description || 'Authorized dashboard'}</span></button>)}</section> : null)}</div>
    <button className="command-center-dashboard-picker__all" type="button" onClick={onOpenAll}>Open all dashboards</button>
  </aside>;
}
