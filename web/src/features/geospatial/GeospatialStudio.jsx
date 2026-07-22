import { useEffect, useRef, useState } from 'react';

import { MapCanvas } from './MapCanvas.jsx';
import { EvidenceDrawer } from './EvidenceDrawer.jsx';
import { LayerInspector } from './LayerInspector.jsx';
import { LayerPanel } from './LayerPanel.jsx';
import { VisibleFeatureTable } from './VisibleFeatureTable.jsx';
import { useGeospatialWorkspace } from './useGeospatialWorkspace.js';

const PANEL_LIMITS = Object.freeze({ left: [260, 420], right: [300, 480] });

function ResizeHandle({ side, value, onChange, visible = true }) {
  const drag = useRef(null);
  if (!visible) return null;
  const [minimum, maximum] = PANEL_LIMITS[side];
  const update = next => onChange(Math.max(minimum, Math.min(maximum, next)));
  const onKeyDown = event => {
    const direction = side === 'left' ? 1 : -1;
    if (event.key === 'ArrowLeft') { event.preventDefault(); update(value - (10 * direction)); }
    if (event.key === 'ArrowRight') { event.preventDefault(); update(value + (10 * direction)); }
    if (event.key === 'Home') { event.preventDefault(); update(minimum); }
    if (event.key === 'End') { event.preventDefault(); update(maximum); }
  };
  return <div
    className={`geospatial-resize-handle geospatial-resize-handle--${side}`}
    role="separator" aria-label={`Resize ${side === 'left' ? 'layer' : 'evidence'} panel`}
    aria-orientation="vertical" aria-valuemin={minimum} aria-valuemax={maximum} aria-valuenow={value}
    tabIndex={0} onKeyDown={onKeyDown}
    onPointerDown={event => {
      drag.current = { x: event.clientX, value };
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }}
    onPointerMove={event => {
      if (!drag.current) return;
      const direction = side === 'left' ? 1 : -1;
      update(drag.current.value + ((event.clientX - drag.current.x) * direction));
    }}
    onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
  />;
}

export function GeospatialStudio({
  api, MapComponent = MapCanvas, organizationConfig = {}, clock = () => new Date(),
}) {
  const workspace = useGeospatialWorkspace({ api, initialViewport: organizationConfig.defaultViewport });
  const [viewName, setViewName] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [layerPanelOpen, setLayerPanelOpen] = useState(true);
  const [workspaceSearch, setWorkspaceSearch] = useState('');
  const [timeRange, setTimeRange] = useState('ALL');
  const [leftPanelWidth, setLeftPanelWidth] = useState(310);
  const [rightPanelWidth, setRightPanelWidth] = useState(350);
  const selectedEvidenceLayer = workspace.selectedFeature
    ? workspace.layers.find(layer => layer.id === workspace.selectedFeature.layerId) : null;
  const canSave = workspace.layers.length > 0
    && workspace.layers.every(layer => layer.spatialStatus === 'AVAILABLE');
  const timeCapable = workspace.layers.some(layer => (
    layer.spatialStatus === 'AVAILABLE' && typeof layer.dataset?.timeField === 'string'
  ));

  useEffect(() => {
    if (!timeCapable && workspace.timeWindow) {
      setTimeRange('ALL');
      workspace.setTimeWindow(null);
    }
  }, [timeCapable, workspace.timeWindow, workspace.setTimeWindow]);

  function selectMapFeature(selection) {
    const feature = workspace.visibleFeatures.find(item => (
      item.layerId === selection.layerId && String(item.id) === String(selection.id)
    ));
    if (feature) {
      workspace.setSelectedLayerId(null);
      workspace.selectFeature({
        layerId: feature.layerId, id: feature.id, properties: structuredClone(feature.properties ?? {}),
      });
    }
  }

  function selectTableFeature(feature) {
    workspace.setSelectedLayerId(null);
    workspace.selectFeature(feature);
  }

  function changeTimeRange(event) {
    const value = event.target.value;
    setTimeRange(value);
    if (value === 'ALL') { workspace.setTimeWindow(null); return; }
    const to = clock();
    if (!(to instanceof Date) || !Number.isFinite(to.getTime())) { workspace.setTimeWindow(null); return; }
    const days = value === 'LAST_7_DAYS' ? 7 : 30;
    workspace.setTimeWindow({
      from: new Date(to.getTime() - (days * 86_400_000)).toISOString(), to: to.toISOString(),
    });
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

  return <section
    className={`geospatial-studio${layerPanelOpen ? ' is-layer-panel-open' : ''}`}
    aria-label="Geospatial Intelligence Studio"
    style={{ '--geospatial-left-width': `${leftPanelWidth}px`, '--geospatial-right-width': `${rightPanelWidth}px` }}
  >
    <header className="geospatial-toolbar">
      <div className="geospatial-title-row">
        <button
          className="geospatial-panel-toggle" type="button"
          aria-label={`${layerPanelOpen ? 'Hide' : 'Show'} map configuration`}
          aria-expanded={layerPanelOpen} onClick={() => setLayerPanelOpen(open => !open)}
        >Layers</button>
        <div className="geospatial-title"><span>Crime intelligence</span><h1>Geospatial Studio</h1></div>
      </div>
      <div className="geospatial-context-controls">
        <label>Jurisdiction<select aria-label="Jurisdiction" value="AUTHORIZED" disabled title="Jurisdiction is enforced by your authenticated access">
          <option value="AUTHORIZED">{organizationConfig.jurisdictionLabel ?? 'Authorized jurisdiction'}</option>
        </select></label>
        <label>Time range<select aria-label="Time range" value={timeRange} disabled={!timeCapable} onChange={changeTimeRange} title={timeCapable ? undefined : 'The selected datasets do not publish a time field'}>
          <option value="ALL">Source observation window</option><option value="LAST_7_DAYS">Last 7 days</option><option value="LAST_30_DAYS">Last 30 days</option>
        </select></label>
        <label>Search workspace<input type="search" aria-label="Search workspace" value={workspaceSearch} onChange={event => setWorkspaceSearch(event.target.value)} /></label>
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
        viewsStatus={workspace.viewsStatus} viewsError={workspace.viewsError} onRetryViews={workspace.retryViews}
        query={workspaceSearch} onQueryChange={setWorkspaceSearch}
        onAddDataset={workspace.addDataset} onOpenView={workspace.loadView}
        onToggle={workspace.setLayerVisibility} onMove={workspace.moveLayer}
        onConfigure={workspace.setSelectedLayerId} onRetry={workspace.retryLayer} onRemove={workspace.removeLayer}
      />
      <ResizeHandle side="left" value={leftPanelWidth} onChange={setLeftPanelWidth} />
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
        locale={organizationConfig.locale} timezone={organizationConfig.timezone}
      /> : workspace.selectedLayer ? <LayerInspector
        layer={workspace.selectedLayer} timeWindow={workspace.timeWindow} onApply={workspace.updateLayer}
        onClose={() => workspace.setSelectedLayerId(null)}
      /> : null}
      <ResizeHandle
        side="right" value={rightPanelWidth} onChange={setRightPanelWidth}
        visible={Boolean(workspace.selectedLayer || workspace.selectedFeature)}
      />
    </div>
    <VisibleFeatureTable features={workspace.visibleFeatures} onSelect={selectTableFeature} />
  </section>;
}
