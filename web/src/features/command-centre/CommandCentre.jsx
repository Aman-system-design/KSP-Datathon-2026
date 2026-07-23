import { OrganizationBrand } from '../../components/OrganizationBrand.jsx';
import { usePlatformBrand } from '../../branding/BrandProvider.jsx';

export function CommandCentre({ data = {}, freshness = 'Latest verified run', synthetic = false }) {
  const brand = usePlatformBrand();
  return <main className="command-centre">
    <header className="command-centre__header"><OrganizationBrand compact /><div><span>{brand.organizationName}</span><h1>{brand.instanceName} Command Centre</h1></div><div className="command-centre__freshness"><small>Intelligence freshness</small><strong>{freshness}</strong></div></header>
    {synthetic && <div className="command-centre__synthetic">Synthetic demonstration data · Presentation-safe aggregate view</div>}
    <section className="command-centre__brief"><span>Verified intelligence posture</span><p>{data.brief?.executiveSummary ?? 'No verified intelligence brief is currently available.'}</p><small>All analytical signals require authorized human review.</small></section>
    <div className="command-centre__grid">
      <section><header><span>Priority signals</span><strong>{data.anomalies?.length ?? '—'} available</strong></header><div className="command-centre__list">
        {(data.anomalies ?? []).map(item => <article key={item.id}><i /><div><strong>{item.label}</strong><span>Observed {item.observed} against baseline {item.expected}</span></div><b>{Math.round((item.confidence ?? 0) * 100)}%</b></article>)}
        {!data.anomalies?.length && <p>No verified anomaly result is available.</p>}
      </div></section>
      <section><header><span>Active hotspot context</span><strong>{data.hotspots?.length ?? '—'} available</strong></header><div className="command-centre__list">
        {(data.hotspots ?? []).map(item => <article key={item.id}><i className="hotspot-indicator" /><div><strong>{item.area}</strong><span>{item.caseCount} contributing cases</span></div><b>{Math.round((item.severity ?? 0) * 100)}%</b></article>)}
        {!data.hotspots?.length && <p>No verified hotspot result is available.</p>}
      </div></section>
    </div>
    <footer>Read-only command display · No personal evidence or investigation controls</footer>
  </main>;
}
