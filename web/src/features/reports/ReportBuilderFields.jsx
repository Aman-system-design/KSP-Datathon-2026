const ICONS = { number: '123', table: '▦', bar: '▥', line: '⌁', map: '⌖' };

export function ReportBuilderFields({ name, onName, sources, sourceKey, onSource, dimensions, dimension,
  onDimension, measures, measure, onMeasure, visualizations, visualization, onVisualization,
  mapViews, mapViewId, onMapView }) {
  return <div className="report-builder-fields">
    <section className="report-step-section"><div className="report-step-heading"><span>1</span><div><h2>Data</h2><p>Select an authorized intelligence source.</p></div></div>
      <label>Report name<input aria-label="Report name" value={name} onChange={event => onName(event.target.value)} required /></label>
      <label>Intelligence source<select aria-label="Intelligence source" value={sourceKey} onChange={event => onSource(event.target.value)}>{sources.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
    </section>
    <section className="report-step-section"><div className="report-step-heading"><span>2</span><div><h2>Visualization</h2><p>Choose how the result should be read.</p></div></div>
      <div className="visualization-picker" role="radiogroup" aria-label="Visualization type">{visualizations.map(type => <button className={type === visualization ? 'selected' : ''} key={type} type="button" role="radio" aria-checked={type === visualization} onClick={() => onVisualization(type)}><b aria-hidden="true">{ICONS[type] ?? '◫'}</b><span>{type}</span></button>)}</div>
      <label className="sr-only">Visualization<select aria-label="Visualization" value={visualization} onChange={event => onVisualization(event.target.value)}>{visualizations.map(type => <option key={type}>{type}</option>)}</select></label>
    </section>
    <section className="report-step-section"><div className="report-step-heading"><span>3</span><div><h2>Configure</h2><p>Define grouping and an auditable measure.</p></div></div>
      {visualization === 'map' ? <label>Saved map view<select aria-label="Saved map view" value={mapViewId} onChange={event => onMapView(event.target.value)} required>{mapViews.length === 0 ? <option value="">No authorized map views</option> : mapViews.map(view => <option key={view.id} value={view.id}>{view.name}</option>)}</select></label> : <div className="form-row">
        <label>Group by<select aria-label="Group by" value={dimension} onChange={event => onDimension(event.target.value)}><option value="">No grouping</option>{dimensions.map(([key]) => <option key={key}>{key}</option>)}</select></label>
        <label>Measure<select aria-label="Measure" value={measure} onChange={event => onMeasure(event.target.value)}><option value="">Choose measure</option>{measures.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>}
    </section>
  </div>;
}
