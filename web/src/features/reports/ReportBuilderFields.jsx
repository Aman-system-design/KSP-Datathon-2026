import { BarChart3, Filter, Hash, LineChart, MapPinned, PieChart, Table2 } from 'lucide-react';

const ICONS = { number: Hash, table: Table2, bar: BarChart3, line: LineChart, pie: PieChart, funnel: Filter, map: MapPinned };
const FIELD_LABELS = {
  areaId: 'Area', unitId: 'Police unit', metric: 'Metric', period: 'Period', patternId: 'Pattern',
  patternType: 'Pattern type', caseCount: 'Case count', confidence: 'Confidence', anomalyId: 'Anomaly',
  signalType: 'Signal type', observed: 'Observed value', expected: 'Expected value', severity: 'Severity',
  score: 'Risk score', indicator: 'Indicator', value: 'Value', alertId: 'Alert', alertType: 'Alert type',
  state: 'Status', createdAt: 'Created date', areaType: 'Area type', latitude: 'Latitude', longitude: 'Longitude',
};
const OPERATORS = [['eq', 'is'], ['neq', 'is not'], ['gte', 'at least'], ['lte', 'at most'], ['between', 'between'], ['in', 'one of']];
export const fieldLabel = key => FIELD_LABELS[key] ?? key.replace(/([A-Z])/g, ' $1').replace(/^./, value => value.toUpperCase());

export function DataStep({ name, onName, description, onDescription, sources, sourceKey, onSource }) {
  return <div className="report-stage"><h2>Choose data</h2><p>Select a governed source and name the report.</p>
    <div className="report-data-grid"><label>Report name<input aria-label="Report name" maxLength={128} required value={name} onChange={event => onName(event.target.value)} /></label>
      <label>Intelligence source<select aria-label="Intelligence source" value={sourceKey} onChange={event => onSource(event.target.value)}>{sources.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select><small className="report-source-governance">Approved Data Store source · viewer scoped</small></label></div>
    <label>Description<textarea aria-label="Description" rows="3" value={description} onChange={event => onDescription(event.target.value)} /></label>
  </div>;
}

export function TypeStep({ choices, compatibilityReason, visualization, onVisualization }) {
  return <div className="report-stage"><h2>Select a visualization</h2><p>Choose the clearest way to communicate this result.</p>
    <div className="report-type-picker" role="radiogroup" aria-label="Visualization type">{choices.map(choice => { const Icon = ICONS[choice.type] ?? Table2; return <button aria-checked={choice.type === visualization} className={choice.type === visualization ? 'selected' : ''} key={choice.type} onClick={() => onVisualization(choice.type)} role="radio" type="button"><Icon size={22} /><span>{choice.label}</span></button>; })}</div>
    {compatibilityReason ? <p className="report-compatibility-message" role="status">{compatibilityReason}</p> : null}
    <label className="sr-only">Visualization<select aria-label="Visualization" value={visualization} onChange={event => onVisualization(event.target.value)}>{choices.map(choice => <option key={choice.type} value={choice.type}>{choice.label}</option>)}</select></label>
  </div>;
}

export function ConfigureStep({ source, dimensions, dimension, onDimension, measures, measure, onMeasure, visualization, mapViews, mapViewId, onMapView, onCreateMapView, filter, onFilter, sortDirection, onSortDirection, limit, onLimit }) {
  const fields = Object.keys(source?.fields ?? {});
  if (visualization === 'map') return <div className="report-stage report-map-configure"><div><h2>Configure the map</h2><p>Reuse an authorized map view or create one from governed data without leaving this report.</p></div><div className="report-map-configure-actions"><label>Saved map view<select aria-label="Saved map view" required value={mapViewId} onChange={event => onMapView(event.target.value)}>{mapViews.length === 0 ? <option value="">No authorized map views</option> : mapViews.map(view => <option key={view.id} value={view.id}>{view.name}</option>)}</select></label><button className="secondary-button" type="button" onClick={onCreateMapView}>Create map view</button></div><small>Map views support points, clustering, heatmaps, H3 and choropleths with geographic drilldown to authorized records.</small></div>;
  return <div className="report-stage"><h2>Configure the result</h2><p>Group, measure, filter and order the authorized records.</p>
    <div className="report-config-grid"><label>Group by<select aria-label="Group by" value={dimension} onChange={event => onDimension(event.target.value)}><option value="">No grouping</option>{dimensions.map(([key]) => <option key={key} value={key}>{fieldLabel(key)}</option>)}</select></label>
      <label>Measure<select aria-label="Measure" value={measure} onChange={event => onMeasure(event.target.value)}><option value="">Choose measure</option>{measures.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Order<select aria-label="Order" value={sortDirection} onChange={event => onSortDirection(event.target.value)}><option value="">Default</option><option value="desc">Highest first</option><option value="asc">Lowest first</option></select></label>
      <label>Maximum rows<input aria-label="Maximum rows" min="1" max="200" type="number" value={limit} onChange={event => onLimit(Number(event.target.value))} /></label></div>
    <fieldset className="report-filter"><legend>Filter</legend><div><select aria-label="Filter field" value={filter.field} onChange={event => onFilter({ ...filter, field: event.target.value })}><option value="">No filter</option>{fields.map(key => <option key={key} value={key}>{fieldLabel(key)}</option>)}</select><select aria-label="Filter operator" disabled={!filter.field} value={filter.operator} onChange={event => onFilter({ ...filter, operator: event.target.value })}>{OPERATORS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><input aria-label="Filter value" disabled={!filter.field} placeholder={filter.operator === 'between' || filter.operator === 'in' ? 'Separate values with commas' : 'Value'} value={filter.value} onChange={event => onFilter({ ...filter, value: event.target.value })} /></div></fieldset>
  </div>;
}

export function StyleStep({ visualization }) {
  return <div className="report-stage"><h2>Presentation</h2><p>KSP ACE applies the accessible standard theme for {fieldLabel(visualization)} reports.</p><div className="report-standard-style"><span>Standard theme</span><strong>Clear labels · Accessible contrast · Responsive layout</strong><small>Additional presentation controls will be enabled only when they can be saved and reproduced consistently.</small></div></div>;
}
