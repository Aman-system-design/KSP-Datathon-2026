import { Component, lazy, Suspense } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { governedAppLocation } from '../../app/runtime.js';

const LazyEmbeddedMapView = lazy(() => import('../geospatial/EmbeddedMapView.jsx'));

class WidgetBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed
      ? <div className="widget-error" role="alert"><strong>Widget unavailable</strong><span>Other dashboard intelligence remains available.</span></div>
      : this.props.children;
  }
}

function Widget({ api, item, EmbeddedMapComponent, location }) {
  const row = item.data?.[0] ?? {};
  const value = Object.entries(row).find(([key, candidate]) => /_(sum|avg|min|max|count)$/.test(key) && typeof candidate === 'number')?.[1]
    ?? row.value ?? row.caseCount ?? row.observed;
  const label = row.label ?? (row.unitId !== undefined ? `Unit ${row.unitId}` : 'Current result');
  return <article className="panel report-widget">
    <div className="panel-heading"><div><span className="eyebrow">Governed report</span><h2>{item.title}</h2></div></div>
    {item.status === 'error'
      ? <div className="widget-error"><strong>Widget unavailable</strong><span>Other dashboard intelligence remains available.</span></div>
      : item.visualization === 'map' && item.mapExecution
        ? <WidgetBoundary><Suspense fallback={<div className="loading-state" role="status">Loading governed map…</div>}>
          <EmbeddedMapComponent api={api} mapExecution={item.mapExecution} />
        </Suspense></WidgetBoundary>
      : <div className="widget-value"><strong>{value ?? '—'}</strong><span>{label}</span></div>}
    <Link to={governedAppLocation(`/reports/${item.reportId}`, location)}>Open evidence</Link>
  </article>;
}

export function DashboardWorkspace({ api, dashboard, EmbeddedMapComponent = LazyEmbeddedMapView }) {
  const location = useLocation();
  return <section className="feature-page">
    <div className="page-heading"><div><span className="eyebrow">Role workspace</span><h1>{dashboard?.name ?? 'Command workspace'}</h1><p>Reusable intelligence widgets. Every result is recalculated within the current viewer’s authorized geography.</p></div></div>
    <div className="dashboard-grid">{(dashboard?.items ?? []).map(item => <Widget key={item.id} api={api} item={item} EmbeddedMapComponent={EmbeddedMapComponent} location={location} />)}</div>
  </section>;
}
