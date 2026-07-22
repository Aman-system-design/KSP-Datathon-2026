import { useState } from 'react';

import { MapCanvas } from './MapCanvas.jsx';
import { EvidenceDrawer } from './EvidenceDrawer.jsx';
import { LayerInspector } from './LayerInspector.jsx';
import { LayerPanel } from './LayerPanel.jsx';
import { VisibleFeatureTable } from './VisibleFeatureTable.jsx';
import { useGeospatialWorkspace } from './useGeospatialWorkspace.js';

export function GeospatialStudio({ api, MapComponent = MapCanvas }) {
  const workspace = useGeospatialWorkspace({ api });
  const [viewName, setViewName] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [layerPanelOpen, setLayerPanelOpen] = useState(true);
  const selectedEvidenceLayer = workspace.selectedFeature
    ? workspace.layers.find(layer => layer.id === workspace.selectedFeature.layerId) : null;
  const canSave = workspace.layers.length > 0
    && workspace.layers.every(layer => layer.spatialStatus === 'AVAILABLE');

  function selectMapFeature(selection) {
    const feature = workspace.visibleFeatures.find(item => item.id === selection.id);
    if (feature) workspace.selectFeature({ layerId: feature.layerId, id: feature.id, properties: selection.properties });
  }

  async function save(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setSaveStatus('Saving map view…');
    try {
      await workspace.saveView({ name: viewName, visibility: 'PRIVATE' });
      setSaveStatus('Map view saved.');
    } catch (error) {
      setSaveStatus(error?.message ?? 'The map view could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return <section className={`geospatial-studio${layerPanelOpen ? ' is-layer-panel-open' : ''}`} aria-label="Geospatial Intelligence Studio">
    <header className="geospatial-toolbar">
      <div className="geospatial-title-row">
        <button
          className="geospatial-panel-toggle" type="button"
          aria-label={`${layerPanelOpen ? 'Hide' : 'Show'} map configuration`}
          aria-expanded={layerPanelOpen} onClick={() => setLayerPanelOpen(open => !open)}
        >Layers</button>
        <div className="geospatial-title"><span>Crime intelligence</span><h1>Geospatial Studio</h1></div>
      </div>
      <form className="geospatial-save-form" onSubmit={save}>
        <label><span>Map view name</span><input aria-label="Map view name" value={viewName} onChange={event => setViewName(event.target.value)} placeholder="Name this view" /></label>
        <button className="primary-button" type="submit" disabled={saving || !viewName.trim() || !canSave}>
          {saving ? 'Saving map view…' : 'Save map view'}
        </button>
        <output aria-live="polite">{saveStatus}</output>
      </form>
      <div className="geospatial-toolbar-actions" aria-label="Map workspace actions">
        <button type="button" disabled title="Sharing will be enabled after governed sharing is configured">Share</button>
        <button type="button" disabled title="Dashboard embedding is delivered in the next platform stage">Add to dashboard</button>
        <button type="button" disabled title="Full-screen mode is not configured">Full screen</button>
      </div>
    </header>

    <div className={`geospatial-workspace${workspace.selectedLayer || workspace.selectedFeature ? ' has-inspector' : ''}`}>
      <LayerPanel
        datasets={workspace.datasets} savedViews={workspace.savedViews} layers={workspace.layers}
        catalogStatus={workspace.catalogStatus} catalogError={workspace.catalogError}
        onAddDataset={workspace.addDataset} onOpenView={workspace.loadView}
        onToggle={workspace.setLayerVisibility} onMove={workspace.moveLayer}
        onConfigure={workspace.setSelectedLayerId} onRetry={workspace.retryLayer} onRemove={workspace.removeLayer}
      />
      <main className="geospatial-map-workspace">
        <MapComponent
          layers={workspace.renderLayers} viewport={workspace.viewport}
          onViewportChange={workspace.setViewport} onFeatureSelect={selectMapFeature}
          onLayerError={workspace.reportLayerError}
        />
        {workspace.mapError ? <div className="geospatial-freshness-warning" role="alert">
          <span>The map renderer reported an error: {workspace.mapError}</span>
        </div> : null}
        {workspace.freshnessError ? <div className="geospatial-freshness-warning" role="status">
          <span>Freshness could not be checked. Visible verified results are retained.</span>
          <button type="button" onClick={workspace.retryFreshness}>Retry freshness check</button>
        </div> : null}
      </main>
      {workspace.selectedFeature ? <EvidenceDrawer
        selection={workspace.selectedFeature} layer={selectedEvidenceLayer}
        onClose={() => workspace.selectFeature(null)} onAcceptUpdate={workspace.acceptLayerUpdate}
      /> : workspace.selectedLayer ? <LayerInspector
        layer={workspace.selectedLayer} onApply={workspace.updateLayer}
        onClose={() => workspace.setSelectedLayerId(null)}
      /> : null}
    </div>
    <VisibleFeatureTable features={workspace.visibleFeatures} onSelect={workspace.selectFeature} />
  </section>;
}
