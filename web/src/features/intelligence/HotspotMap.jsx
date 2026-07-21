import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const located = hotspots => (hotspots ?? []).filter(item => Number.isFinite(item.latitude) && Number.isFinite(item.longitude));

export function HotspotMap({ hotspots }) {
  const points = located(hotspots);
  if (points.length === 0) return <section className="panel empty-state">No authorized hotspot coordinates are available.</section>;
  const centre = [points[0].latitude, points[0].longitude];
  return <section className="feature-page">
    <div className="page-heading"><div><span className="eyebrow">Geospatial intelligence</span><h1>Crime hotspot map</h1><p>Only authorized, evidence-derived hotspot centroids are displayed. Select a marker for its current signal.</p></div></div>
    <div className="panel hotspot-map-panel">
      <MapContainer center={centre} zoom={12} scrollWheelZoom className="leaflet-map">
        <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {points.map(item => <CircleMarker key={item.id} center={[item.latitude, item.longitude]}
          radius={8 + Math.min(18, Number(item.caseCount) || 0)} pathOptions={{ color: '#f97316', fillColor: '#dc2626', fillOpacity: 0.55 }}>
          <Popup><strong>{item.area}</strong><br />{item.caseCount} contributing cases<br />Severity {Math.round((item.severity ?? 0) * 100)}%</Popup>
        </CircleMarker>)}
      </MapContainer>
      <table className="map-table"><caption>Accessible hotspot coordinate table</caption><thead><tr><th>Area</th><th>Coordinates</th><th>Cases</th><th>Severity</th></tr></thead><tbody>{points.map(item => <tr key={item.id}><td>{item.area}</td><td>{item.latitude}, {item.longitude}</td><td>{item.caseCount}</td><td>{Math.round((item.severity ?? 0) * 100)}%</td></tr>)}</tbody></table>
    </div>
  </section>;
}
