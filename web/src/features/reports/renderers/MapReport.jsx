import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Info, X } from 'lucide-react';

import districtBoundaryText from '../../../assets/geospatial/karnataka-districts.geojson?raw';
import { KARNATAKA_FOCUSED_STYLE } from '../../geospatial/map-style.js';
import { paletteColors } from '../report-theme.js';
import './MapReport.css';

const LazyMapCanvas = lazy(() => import('../../geospatial/MapCanvas.jsx').then(module => ({ default: module.MapCanvas })));

export const KARNATAKA_BOUNDS = Object.freeze([74.04, 11.59, 78.59, 18.48]);
export const MAP_PALETTE = Object.freeze(['#eff6ff', '#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6']);
const districtBoundaries = JSON.parse(districtBoundaryText);

function rowValue(row) {
  const value = row.RecordCount_sum ?? row.CaseMasterID_count ?? row.caseCount ?? row.caseCount_sum ?? row.value ?? row.count;
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function rowMetric(row) {
  const value = row.RecordCount_sum ?? row.CaseMasterID_count ?? row.caseCount ?? row.caseCount_sum ?? row.value ?? row.count;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  if (typeof value !== 'number' && typeof value !== 'string') return undefined;
  return Number.isFinite(Number(value)) ? Number(value) : undefined;
}

function geometryPositions(value, output = []) {
  if (Array.isArray(value) && value.length >= 2 && Number.isFinite(value[0]) && Number.isFinite(value[1])) {
    output.push(value);
  } else if (Array.isArray(value)) {
    value.forEach(child => geometryPositions(child, output));
  }
  return output;
}

export function geometryBounds(geometry, padding = 0.08) {
  const positions = geometryPositions(geometry?.coordinates);
  if (positions.length === 0) return [...KARNATAKA_BOUNDS];
  const longitudes = positions.map(position => position[0]);
  const latitudes = positions.map(position => position[1]);
  return [
    Math.max(KARNATAKA_BOUNDS[0], Math.min(...longitudes) - padding),
    Math.max(KARNATAKA_BOUNDS[1], Math.min(...latitudes) - padding),
    Math.min(KARNATAKA_BOUNDS[2], Math.max(...longitudes) + padding),
    Math.min(KARNATAKA_BOUNDS[3], Math.max(...latitudes) + padding),
  ];
}

export function buildDistrictFeatureCollection(rows = []) {
  const knownCodes = new Set(districtBoundaries.features.map(feature => feature.properties.districtCode));
  const values = new Map(rows.filter(row => knownCodes.has(row.DistrictCode)).map(row => [row.DistrictCode, rowValue(row)]));
  const unmatchedDistrictCodes = [...new Set(rows.map(row => row.DistrictCode).filter(code => !knownCodes.has(code)))];
  return {
    ...districtBoundaries,
    unmatchedDistrictCodes,
    features: districtBoundaries.features.map(feature => ({
      ...feature,
      properties: {
        ...feature.properties,
        value: values.get(feature.properties.districtCode) ?? 0,
        caseCount: values.get(feature.properties.districtCode) ?? 0,
      },
    })),
  };
}

function hotspotCollection(hotspots) {
  return {
    type: 'FeatureCollection',
    features: hotspots.flatMap(hotspot => {
      const longitude = Number(hotspot.longitude ?? hotspot.centroid?.longitude);
      const latitude = Number(hotspot.latitude ?? hotspot.centroid?.latitude);
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return [];
      return [{
        type: 'Feature', id: hotspot.id,
        geometry: { type: 'Point', coordinates: [longitude, latitude] },
        properties: { ...hotspot, id: hotspot.id },
      }];
    }),
  };
}

function legendStops(maximum, palette = MAP_PALETTE) {
  if (maximum <= 0) return palette.map((color, index) => ({ color, label: index === 0 ? '0' : 'No cases' }));
  return palette.map((color, index) => {
    const from = Math.round((maximum * index) / palette.length);
    const to = Math.max(from, Math.round((maximum * (index + 1)) / palette.length));
    return { color, label: `${from}–${to}` };
  });
}

export function MapReport({ rows = [], mapMetadata = {}, MapComponent, palette = 'sequential', density = 'workbench' }) {
  const [hovered, setHovered] = useState(null);
  const [selected, setSelected] = useState(null);
  const [fitRequest, setFitRequest] = useState(0);
  const [showCaseNumbers, setShowCaseNumbers] = useState(true);
  const [showLegend, setShowLegend] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const infoTriggerRef = useRef(null);
  const infoPanelRef = useRef(null);
  const infoReturnFocusRef = useRef(null);
  const focusInfoOnOpenRef = useRef(false);
  const districtCollection = useMemo(() => buildDistrictFeatureCollection(rows), [rows]);
  const hotspots = Array.isArray(mapMetadata.hotspots) ? mapMetadata.hotspots : [];
  const maximum = Math.max(0, ...districtCollection.features.map(feature => feature.properties.caseCount));
  const knownDistrictCodes = useMemo(() => new Set(districtCollection.features.map(feature => feature.properties.districtCode)), [districtCollection]);
  const suppliedDistrictCodes = useMemo(() => new Set(rows
    .filter(row => knownDistrictCodes.has(row.DistrictCode) && rowMetric(row) !== undefined)
    .map(row => row.DistrictCode)), [knownDistrictCodes, rows]);
  const invalidMetricCount = rows.filter(row => knownDistrictCodes.has(row.DistrictCode) && rowMetric(row) === undefined).length;
  const metricAvailable = suppliedDistrictCodes.size > 0 && invalidMetricCount === 0;
  const selectedFeature = selected
    ? districtCollection.features.find(feature => feature.id === selected.id) : null;
  const districtHotspots = selectedFeature ? hotspots.filter(hotspot => hotspot.districtCode === selectedFeature.properties.districtCode) : [];
  const visibleHotspots = selectedFeature ? districtHotspots : hotspots;
  const viewport = { bounds: selectedFeature ? geometryBounds(selectedFeature.geometry) : [...KARNATAKA_BOUNDS] };
  const colorRange = Array.isArray(palette) ? palette : paletteColors(palette);
  const layers = [{
    layer: {
      id: 'karnataka-districts', datasetId: 'karnataka-districts', renderer: 'CHOROPLETH',
      colorField: 'caseCount', selectedFeatureId: selected?.id, colorRange,
      lineColor: '#ffffff', selectedLineColor: '#ffffff',
      tooltipFields: ['districtName', 'caseCount'],
      labelValueField: density === 'dashboard' && showCaseNumbers ? 'caseCount' : undefined,
    },
    featureCollection: districtCollection,
  }];
  if (visibleHotspots.length > 0) layers.push({
    layer: {
      id: 'report-hotspots', datasetId: 'hotspots', renderer: visibleHotspots.length > 40 ? 'CLUSTER' : 'POINT',
      sizeField: 'magnitude', tooltipFields: ['id', 'magnitude'],
    },
    featureCollection: hotspotCollection(visibleHotspots),
  });
  const Canvas = MapComponent ?? LazyMapCanvas;

  const unmatchedGeographyCount = Number(mapMetadata.unmatchedGeographyCount) || 0;
  const unmatchedSourceRowCount = rows.filter(row => !knownDistrictCodes.has(row.DistrictCode)).length;
  const dashboard = density === 'dashboard';
  const fitDuration = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ? 0 : 220;
  const openInfo = ({ focusPanel = false, returnFocus } = {}) => {
    infoReturnFocusRef.current = returnFocus ?? infoTriggerRef.current;
    focusInfoOnOpenRef.current = focusPanel;
    setInfoOpen(true);
  };
  const closeInfo = () => {
    setInfoOpen(false);
    const returnTarget = infoReturnFocusRef.current;
    if (returnTarget?.isConnected && typeof returnTarget.focus === 'function') returnTarget.focus();
    else infoTriggerRef.current?.focus();
  };
  useEffect(() => {
    if (!infoOpen) return undefined;
    if (focusInfoOnOpenRef.current) {
      infoPanelRef.current?.focus();
      focusInfoOnOpenRef.current = false;
    }
    const closeOnEscape = event => { if (event.key === 'Escape') closeInfo(); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [infoOpen]);
  const fitKarnataka = () => { setSelected(null); setFitRequest(value => value + 1); };
  const totalCases = districtCollection.features.reduce((sum, feature) => sum + feature.properties.caseCount, 0);
  const suppliedDistricts = districtCollection.features.filter(feature => suppliedDistrictCodes.has(feature.properties.districtCode));
  const highestDistrict = suppliedDistricts.reduce((highest, feature) => feature.properties.caseCount > highest.properties.caseCount ? feature : highest, suppliedDistricts[0]);
  const activeDistrict = selectedFeature ?? (hovered ? districtCollection.features.find(feature => feature.id === hovered.id) : null);
  return <section aria-label="Karnataka district map report" className={`map-report${dashboard ? ' map-report--dashboard' : ''}`} style={{ background: 'var(--report-surface)', color: 'var(--report-text)' }}>
    {!dashboard && (districtCollection.unmatchedDistrictCodes.length > 0 || unmatchedGeographyCount > 0) ? <p className="map-report__warning" role="alert">{districtCollection.unmatchedDistrictCodes.length > 0 ? `Unmatched district codes: ${districtCollection.unmatchedDistrictCodes.join(', ')}` : `${unmatchedGeographyCount} source rows could not be mapped to a governed district.`}</p> : null}
    {!metricAvailable ? <div className="map-report__unavailable" role="status">Visualization unavailable — sufficient district-level data is not available</div> : <>
    <div className="map-report__canvas">
      <Suspense fallback={<div className="loading-state" role="status">Loading Karnataka map…</div>}>
        <Canvas
          layers={layers}
          viewport={viewport}
          fitRequest={fitRequest}
          fitDuration={fitDuration}
          basemapStyle={KARNATAKA_FOCUSED_STYLE}
          showBasemapAttribution={false}
          showNavigationControls={!dashboard}
          fitOptions={{ padding: dashboard ? 34 : 48, maxZoom: 8, duration: fitDuration }}
          onFeatureHover={selection => setHovered(selection)}
          onFeatureSelect={selection => {
            if (selection?.layerId === 'report-hotspots') return;
            setSelected(selection);
          }}
        />
      </Suspense>
      <button className="map-report__fit" type="button" onClick={fitKarnataka}>Fit Karnataka</button>
      {dashboard ? <div className="map-report__compact-controls"><button type="button" aria-label={showCaseNumbers ? 'Hide case numbers' : 'Show case numbers'} aria-pressed={showCaseNumbers} onClick={() => setShowCaseNumbers(visible => !visible)}>Numbers</button><button type="button" aria-label={showLegend ? 'Hide case count legend' : 'Show case count legend'} aria-expanded={showLegend} onClick={() => setShowLegend(visible => !visible)}>Legend</button></div> : null}
      {dashboard && showLegend ? <ul aria-label="Case count legend" className="map-report__legend map-report__legend--overlay">{legendStops(maximum, colorRange).map(stop => <li key={`${stop.color}-${stop.label}`}><span aria-hidden="true" style={{ backgroundColor: stop.color }} />{stop.label}</li>)}</ul> : null}
      {dashboard && selectedFeature ? <div className="map-report__selected-label" role="status" aria-label={`Selected district ${selectedFeature.properties.districtName}`}><span>Selected district</span><strong>{selectedFeature.properties.districtName}</strong><small>{selectedFeature.properties.caseCount.toLocaleString()} cases</small></div> : null}
      {!dashboard ? <p className="map-report__hover" role="status" aria-live="polite">
        {hovered ? `${hovered.properties.districtName}: ${hovered.properties.caseCount.toLocaleString()} cases` : 'Hover a district for its case count'}
      </p> : null}
    </div>
    {!dashboard ? <aside className="map-report__legend-panel">
      <strong>Case count</strong>
      <ul aria-label="Case count legend" className="map-report__legend map-report__legend--vertical">
        {legendStops(maximum, colorRange).map(stop => <li key={`${stop.color}-${stop.label}`}><span aria-hidden="true" style={{ backgroundColor: stop.color }} />{stop.label}</li>)}
      </ul>
      <small>
        District boundaries: <a href="https://mapservice.gov.in/mapserviceserv176/rest/services/BharatMapService_Karnataka/Admin_Boundary_District/MapServer/1">Bharat Maps / NIC, Government of India</a> · GODL-India
      </small>
    </aside> : null}
    {dashboard && infoOpen ? <aside ref={infoPanelRef} id="map-report-information" className="map-report__info" role="region" aria-label="Map information" tabIndex={-1}>
      <header><div><span>{selectedFeature ? 'Selected district' : 'Karnataka intelligence'}</span><strong>{selectedFeature?.properties.districtName ?? 'Karnataka districts'}</strong>{selectedFeature ? <small>{selectedFeature.properties.caseCount.toLocaleString()} cases</small> : null}</div><button type="button" aria-label="Close map information" onClick={closeInfo}><X aria-hidden="true" /></button></header>
      <dl>
        {selectedFeature ? <div className="map-report__selected-row"><dt>District</dt><dd>{selectedFeature.properties.districtName} · {selectedFeature.properties.caseCount.toLocaleString()}</dd></div> : null}
        <div><dt>Total cases</dt><dd>{totalCases.toLocaleString()}</dd></div>
        <div><dt>Highest district</dt><dd>{highestDistrict.properties.districtName} · {highestDistrict.properties.caseCount.toLocaleString()}</dd></div>
        <div><dt>District data</dt><dd>{suppliedDistrictCodes.size} of {districtCollection.features.length} districts supplied</dd></div>
        <div><dt>Unmatched district rows</dt><dd>{unmatchedSourceRowCount}</dd></div>
        <div><dt>Unmapped source rows</dt><dd>{unmatchedGeographyCount}</dd></div>
        <div><dt>{selectedFeature ? 'Selected district' : hovered ? 'Hovered district' : 'Current district'}</dt><dd>{activeDistrict ? `${activeDistrict.properties.districtName} · ${activeDistrict.properties.caseCount.toLocaleString()}` : 'Select or hover a district'}</dd></div>
      </dl>
      <ul aria-label="Case count classification" className="map-report__legend map-report__legend--compact">{legendStops(maximum, colorRange).map(stop => <li key={`${stop.color}-${stop.label}`}><span aria-hidden="true" style={{ backgroundColor: stop.color }} />{stop.label}</li>)}</ul>
    </aside> : null}
    {selectedFeature && !dashboard ? <section className="map-report__evidence" role="region" aria-label="Selected district evidence">
      <span>Selected district</span>
      <strong>{selectedFeature.properties.districtName}</strong>
      <span>{selectedFeature.properties.caseCount.toLocaleString()} cases</span>
      <code>{selectedFeature.properties.districtCode}</code>
      {districtHotspots.length > 0 ? <div><strong>Hotspot evidence</strong><ul>{districtHotspots.map(hotspot => <li key={hotspot.id}>{hotspot.id}: {hotspot.magnitude ?? 0} cases{hotspot.evidenceCaseIds?.length ? ` · ${hotspot.evidenceCaseIds.join(', ')}` : ''}</li>)}</ul></div> : null}
      <button type="button" onClick={fitKarnataka}>Return to Karnataka</button>
    </section> : null}
    </>}
  </section>;
}
