import { useMemo, useState } from 'react';

function LayerState({ layer }) {
  if (layer.state === 'GEOMETRY_NOT_AVAILABLE') {
    return <p className="geospatial-layer-message">Geometry is not available in the authorized source projection.</p>;
  }
  if (layer.state === 'UNAUTHORIZED') return <p className="geospatial-layer-message">Not authorized for this layer.</p>;
  if (layer.state === 'FAILED' || layer.state === 'STALE') return <p className="geospatial-layer-message">{layer.error}</p>;
  return <span className={`geospatial-layer-status geospatial-layer-status--${layer.state.toLowerCase()}`}>{layer.state}</span>;
}

export function LayerPanel({
  datasets, savedViews, layers, catalogStatus, catalogError,
  viewsStatus = 'READY', viewsError, onRetryViews,
  onAddDataset, onOpenView, onToggle, onMove, onConfigure, onRetry, onRemove,
  query: controlledQuery, onQueryChange,
}) {
  const [localQuery, setLocalQuery] = useState('');
  const query = controlledQuery ?? localQuery;
  const setQuery = onQueryChange ?? setLocalQuery;
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matchingDatasets = useMemo(() => datasets.filter(dataset => (
    !normalizedQuery || `${dataset.name} ${dataset.description ?? ''}`.toLocaleLowerCase().includes(normalizedQuery)
  )), [datasets, normalizedQuery]);
  const orderedLayers = [...layers].sort((left, right) => left.order - right.order);

  return <aside className="geospatial-panel geospatial-layer-panel" aria-label="Map configuration">
    <section className="geospatial-panel-section">
      <div className="geospatial-section-heading"><h2>Saved views</h2></div>
      {viewsStatus === 'LOADING' ? <p className="geospatial-muted" role="status">Loading saved views…</p> : null}
      {viewsStatus === 'FAILED' ? <div className="geospatial-view-error" role="alert">
        <p className="geospatial-layer-message">{viewsError}</p>
        <button className="geospatial-text-button" type="button" onClick={onRetryViews}>Retry saved views</button>
      </div> : null}
      {viewsStatus === 'READY' && savedViews.length === 0
        ? <p className="geospatial-muted">No saved views in your authorized workspace.</p>
        : viewsStatus === 'READY' ? <ul className="geospatial-view-list">{savedViews.filter(view => (
          !normalizedQuery || view.name.toLocaleLowerCase().includes(normalizedQuery)
        )).map(view => <li key={view.id}>
          <button type="button" onClick={() => onOpenView(view)}>{view.name}</button>
          <span>{view.visibility}</span>
        </li>)}</ul> : null}
    </section>

    <section className="geospatial-panel-section">
      <div className="geospatial-section-heading"><h2>Datasets</h2><span>{datasets.length}</span></div>
      <label className="geospatial-search-label">
        <span>Search datasets</span>
        <input type="search" aria-label="Search datasets" value={query} onChange={event => setQuery(event.target.value)} />
      </label>
      {catalogStatus === 'LOADING' ? <p className="geospatial-muted" role="status">Loading authorized datasets…</p> : null}
      {catalogStatus === 'FAILED' ? <p role="alert" className="geospatial-layer-message">{catalogError}</p> : null}
      <ul className="geospatial-dataset-list">{matchingDatasets.map(dataset => <li key={dataset.id}>
        <div><strong>{dataset.name}</strong><span>{dataset.description}</span></div>
        <button type="button" aria-label={`Add ${dataset.name}`} onClick={() => onAddDataset(dataset.id)}>Add</button>
      </li>)}</ul>
    </section>

    <section className="geospatial-panel-section geospatial-panel-section--layers">
      <div className="geospatial-section-heading"><h2>Layers</h2><span>{layers.length}</span></div>
      {orderedLayers.length === 0 ? <p className="geospatial-muted">Add an authorized dataset to begin.</p> : null}
      <ol className="geospatial-layer-list">{orderedLayers.map((layer, index) => <li key={layer.id}>
        <div className="geospatial-layer-row">
          <label className="geospatial-visibility-toggle">
            <input
              type="checkbox" aria-label={`Show ${layer.name}`} checked={layer.visible}
              onChange={event => onToggle(layer.id, event.target.checked)}
            />
          </label>
          <button className="geospatial-layer-name" type="button" aria-label={`Configure ${layer.name}`} onClick={() => onConfigure(layer.id)}>
            <strong>{layer.name}</strong><span>{layer.renderer}</span>
          </button>
          <div className="geospatial-order-controls" aria-label={`Order ${layer.name}`}>
            <button type="button" aria-label={`Move ${layer.name} up`} disabled={index === 0} onClick={() => onMove(layer.id, 'up')}>Up</button>
            <button type="button" aria-label={`Move ${layer.name} down`} disabled={index === orderedLayers.length - 1} onClick={() => onMove(layer.id, 'down')}>Down</button>
          </div>
        </div>
        <LayerState layer={layer} />
        {['FAILED', 'STALE', 'UNAUTHORIZED'].includes(layer.state)
          ? <button className="geospatial-text-button" type="button" onClick={() => onRetry(layer.id)}>Retry layer</button> : null}
        <button className="geospatial-text-button" type="button" aria-label={`Remove ${layer.name}`} onClick={() => onRemove(layer.id)}>Remove layer</button>
      </li>)}</ol>
    </section>
  </aside>;
}
