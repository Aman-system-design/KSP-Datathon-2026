import { useEffect, useMemo, useRef } from 'react';

import { EvidenceDrawer } from './EvidenceDrawer.jsx';
import { MapCanvas } from './MapCanvas.jsx';
import { VisibleFeatureTable } from './VisibleFeatureTable.jsx';
import { useGeospatialWorkspace } from './useGeospatialWorkspace.js';
import { createEmbeddedExecutionManager } from './embedded-execution-manager.js';

export function EmbeddedMapView({ api, mapExecution, MapComponent = MapCanvas, executionManager, executionScope }) {
  const localManager = useMemo(() => executionManager ?? createEmbeddedExecutionManager(api), [api, executionManager]);
  const scope = executionScope ?? mapExecution?.mapView?.id ?? 'embedded-map';
  const embeddedApi = useMemo(() => localManager.client(scope), [localManager, scope]);
  useEffect(() => () => localManager.release(scope), [localManager, scope]);
  const workspace = useGeospatialWorkspace({
    api: embeddedApi, loadSavedViews: false, pollIntervalMs: 0,
    executionDescriptors: mapExecution?.executions,
  });
  const loadedView = useRef(null);
  const mapView = mapExecution?.mapView;
  const viewKey = mapView ? `${mapView.id}:${mapView.version}` : null;

  useEffect(() => {
    if (workspace.catalogStatus !== 'READY' || !mapView?.definition || loadedView.current === viewKey) return;
    loadedView.current = viewKey;
    workspace.loadView(mapView);
  }, [mapView, viewKey, workspace.catalogStatus, workspace.loadView]);

  if (!mapView?.definition) return <div className="widget-error" role="alert">Governed map definition is unavailable.</div>;
  const failedLayer = workspace.layers.find(layer => layer.state === 'FAILED' || layer.state === 'UNAUTHORIZED');
  const selectedLayer = workspace.layers.find(layer => layer.id === workspace.selectedFeature?.layerId);

  return <section className="geospatial-embedded" aria-label={`${mapView.name} map`}>
    {workspace.catalogStatus === 'FAILED' ? <div className="widget-error" role="alert">{workspace.catalogError}</div> : null}
    {failedLayer ? <div className="widget-error" role="alert">{failedLayer.error ?? 'Map layer unavailable.'}</div> : null}
    <MapComponent
      layers={workspace.renderLayers} viewport={workspace.viewport}
      onViewportChange={workspace.setViewport} onFeatureSelect={workspace.selectFeature}
      onLayerError={workspace.reportLayerError}
    />
    {workspace.selectedFeature && selectedLayer ? <EvidenceDrawer
      selection={workspace.selectedFeature} layer={selectedLayer}
      onClose={() => workspace.selectFeature(null)} onAcceptUpdate={workspace.acceptLayerUpdate}
    /> : null}
    <VisibleFeatureTable features={workspace.visibleFeatures} onSelect={workspace.selectFeature} />
  </section>;
}

export default EmbeddedMapView;
