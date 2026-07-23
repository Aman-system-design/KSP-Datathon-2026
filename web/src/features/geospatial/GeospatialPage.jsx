import { Component, lazy, Suspense } from 'react';
import { Busy } from '../../app/AsyncStates.jsx';

const GeospatialStudio = lazy(() => import('./GeospatialStudio.jsx'));
const KSP_GEOSPATIAL_CONFIG = Object.freeze({
  defaultViewport: Object.freeze({ center: Object.freeze([75.5, 15.2]), zoom: 5.6 }),
  jurisdictionLabel: 'Karnataka',
});
const KSP_DEFAULT_MAP_DATASETS = Object.freeze(['hotspots', 'anomalies', 'areaRisk']);

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
