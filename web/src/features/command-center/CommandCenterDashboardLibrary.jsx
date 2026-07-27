import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, LayoutDashboard, MoreHorizontal, Plus, Search, Trash2 } from 'lucide-react';

import { DashboardDeleteDialog } from '../dashboards/DashboardDeleteDialog.jsx';
import { dashboardSections } from './command-center-dashboard-model.js';

const labels = Object.freeze({ owned: 'Owned by you', shared: 'Shared with you', system: 'System dashboards' });

export function CommandCenterDashboardLibrary({ api, dashboards = [], createMode = false, onOpen = () => {}, onCreateMode = () => {}, onCreated = () => {}, onCancelCreate = () => {} }) {
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [visibleDashboards, setVisibleDashboards] = useState(dashboards);
  const [menuDashboardId, setMenuDashboardId] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => setVisibleDashboards(dashboards), [dashboards]);
  const filtered = useMemo(() => visibleDashboards.filter(item => item.name?.toLowerCase().includes(query.trim().toLowerCase())), [visibleDashboards, query]);
  const sections = dashboardSections(filtered);
  const create = async event => {
    event.preventDefault();
    const normalized = name.trim();
    if (!normalized) return setError('Enter a dashboard name.');
    setCreating(true);
    setError('');
    try {
      const result = await api.post('/v1/dashboards', { name: normalized, description: '' });
      onCreated(result.data.id);
    } catch (failure) {
      setError(failure.message || 'Dashboard could not be created.');
      setCreating(false);
    }
  };
  const removeDashboard = async () => {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete(`/v1/dashboards/${pendingDelete.id}`);
      setVisibleDashboards(current => current.filter(item => item.id !== pendingDelete.id));
      setNotice(`${pendingDelete.name} was deleted. Reports remain available.`);
      setPendingDelete(null);
    } catch (failure) {
      setDeleteError(failure.message || 'Dashboard could not be deleted.');
    } finally {
      setDeleting(false);
    }
  };
  return <main className="command-center-dashboard-library">
    <header className="command-center-dashboard-library__header">
      <div><span className="eyebrow">Intelligence workspaces</span><h1>Dashboard Library</h1><p>Open, organize, and compose authorized operational views.</p></div>
      {!createMode ? <button className="primary" type="button" onClick={onCreateMode}><Plus aria-hidden="true" />New dashboard</button> : null}
    </header>
    {createMode ? <form className="command-center-dashboard-create" onSubmit={create}>
      <div className="command-center-dashboard-create__icon"><LayoutDashboard aria-hidden="true" /></div>
      <div className="command-center-dashboard-create__body"><span className="eyebrow">New intelligence workspace</span><h2>Name your dashboard</h2><p>Create a private canvas. Reports and layout can be added after it opens.</p>
        <label>Dashboard name<input autoFocus type="text" aria-label="Dashboard name" maxLength="128" value={name} onChange={event => { setName(event.target.value); setError(''); }} placeholder="e.g. State Crime Overview" /></label>
        {error ? <span className="command-center-dashboard-create__error" role="alert">{error}</span> : null}
        <div><button type="button" onClick={onCancelCreate}>Cancel</button><button className="primary" type="submit" disabled={creating}>{creating ? 'Creatingâ€¦' : 'Create dashboard'}</button></div>
      </div>
    </form> : <>
      <label className="command-center-dashboard-library__search"><Search aria-hidden="true" /><input type="search" aria-label="Search dashboard library" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search dashboards" /></label>
      {notice ? <p className="command-center-dashboard-library__notice" role="status">{notice}</p> : null}
      {filtered.length === 0 ? <section className="command-center-dashboard-library__empty"><LayoutDashboard aria-hidden="true" /><h2>No dashboards yet</h2><p>{query ? 'No authorized dashboards match your search.' : 'Create your first intelligence workspace when you are ready.'}</p>{!query ? <button className="primary" type="button" onClick={onCreateMode}><Plus aria-hidden="true" />New dashboard</button> : null}</section>
        : <div className="command-center-dashboard-library__sections">{Object.entries(labels).map(([key, label]) => sections[key]?.length ? <section key={key}><h2>{label}</h2><div>{sections[key].map(item => <article className="command-center-dashboard-card" key={item.id}><div><span>{item.relationship === 'OWNED' ? 'Private workspace' : item.relationship === 'SHARED' ? 'Shared workspace' : 'Governed workspace'}</span><h3>{item.name}</h3><p>{item.description || 'Authorized operational intelligence dashboard'}</p></div><div className="command-center-dashboard-card__actions"><button type="button" aria-label={`Open ${item.name}`} onClick={() => onOpen(item.id)}>Open<ArrowRight aria-hidden="true" /></button><div><button type="button" aria-label={`More actions for ${item.name}`} aria-expanded={menuDashboardId === item.id} onClick={() => setMenuDashboardId(current => current === item.id ? null : item.id)}><MoreHorizontal aria-hidden="true" /></button>{menuDashboardId === item.id ? <div className="command-center-dashboard-card__menu" role="menu"><button role="menuitem" type="button" onClick={() => { setPendingDelete(item); setDeleteError(''); setMenuDashboardId(null); }}><Trash2 aria-hidden="true" />Delete dashboard</button></div> : null}</div></div></article>)}</div></section> : null)}</div>}
    </>}
    <DashboardDeleteDialog dashboard={pendingDelete} deleting={deleting} error={deleteError} onCancel={() => { setPendingDelete(null); setDeleteError(''); }} onConfirm={removeDashboard} />
  </main>;
}
