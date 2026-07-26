import { Component, lazy, Suspense } from 'react';
import { Busy } from '../../app/AsyncStates.jsx';
import { KSP_DEFAULT_MAP_DATASETS, KSP_GEOSPATIAL_CONFIG } from './geospatial-config.js';

const GeospatialStudio = lazy(() => import('./GeospatialStudio.jsx'));

export class GeospatialRouteErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <div className="failure-state" role="alert">
      <strong>Geospatial workspace is unavailable</strong>
      <span>The map workspace could not be loaded. Other authorized modules remain available.</span>
      <button type="button" onClick={() => (this.props.reload ?? (() => globalThis.location?.reload?.()))()}>Reload map workspace</button>
    </div>;
  }
}

export function GeospatialPage({ api, Studio = GeospatialStudio, reload }) {
  return <GeospatialRouteErrorBoundary reload={reload}>
    <Suspense fallback={<Busy label="Loading geospatial workspace…" />}>
      <Studio api={api} organizationConfig={KSP_GEOSPATIAL_CONFIG} defaultDatasetIds={KSP_DEFAULT_MAP_DATASETS} />
    </Suspense>
  </GeospatialRouteErrorBoundary>;
}
