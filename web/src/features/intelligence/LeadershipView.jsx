import { Link, useLocation } from 'react-router-dom';

import { governedAppLocation } from '../../app/runtime.js';

const categories = [
  ['Theft & burglary', 28, 12], ['Assault & violence', 20, 4], ['Women safety', 15, -3],
  ['Cyber crime', 13, 19], ['Narcotics', 13, 7], ['Other', 11, -5],
];

const districts = [
  ['Bengaluru Urban', 92, 612], ['Mysuru', 63, 284], ['Dakshina Kannada', 58, 241],
  ['Belagavi', 49, 197], ['Kalaburagi', 43, 164], ['Tumakuru', 39, 151],
  ['Ballari', 36, 143], ['Dharwad', 34, 137], ['Shivamogga', 31, 128], ['Udupi', 29, 121],
];

const divergence = [
  ['Bengaluru Urban', 18, 2, 29, 7, -1], ['Dakshina Kannada', 12, 6, 21, 3, -2],
  ['Kalaburagi', 5, 19, -3, 14, 17], ['Mysuru', 11, 7, 6, -1, 2], ['Belagavi', 2, 13, -4, 18, 5],
];

const available = value => value ?? 'Unavailable';
const percent = value => Number.isFinite(value) ? `${Math.round(value * 100)}%` : 'Unavailable';
const heat = value => Math.abs(value) >= 20 ? 'high' : Math.abs(value) >= 10 ? 'medium' : 'low';

function Report({ title, meta, children, footer }) {
  return <article className="leadership-report">
    <header><div><h2>{title}</h2><span>{meta}</span></div><b>REPORT</b></header>
    <div className="leadership-report__body">{children}</div>
    <footer>{footer}</footer>
  </article>;
}

export function LeadershipView({ data = {} }) {
  const location = useLocation();
  const anomaly = data.anomalies?.[0];
  const hotspot = data.hotspots?.[0];
  const riskValue = data.risk?.score;
  const riskScore = Number.isFinite(riskValue) ? (riskValue > 1 ? Math.round(riskValue) : Math.round(riskValue * 100)) : 'Unavailable';

  return <section className="feature-page role-home leadership-brief">
    <header className="role-home__header">
      <div><span className="role-kicker">Statewide decision intelligence</span><h1>State Intelligence Brief</h1><p>{data.brief?.executiveSummary ?? 'No current statewide brief is available for this authorized scope.'}</p></div>
      <div className="data-as-of"><i /><span>Data as of</span><strong>Latest verified run</strong></div>
    </header>

    <div className="leadership-filters" aria-label="Dashboard filters"><button type="button">All Karnataka · 31 districts</button><button type="button">Last 30 days</button><button type="button">All crime categories</button><Link to={governedAppLocation('/dashboards', location)}>Manage dashboard</Link></div>

    <div className="leadership-report-grid">
      <Report title="Crime category composition" meta="Donut report · statewide category distribution" footer="Governed incident analysis · category share">
        <div className="category-composition"><div className="category-donut"><span>Category mix</span></div><div className="category-legend">{categories.map(([label, share, change], index) => <div key={label}><i data-index={index} /><span>{label}</span><strong>{share}%</strong><em className={change >= 0 ? 'increase' : 'decrease'}>{change > 0 ? '+' : ''}{change}%</em></div>)}</div></div>
      </Report>

      <Report title="District crime volume & movement" meta="Ranked bar report · highest-volume districts" footer="Top 10 shown · open full report for all districts">
        <div className="district-volume">{districts.map(([name, width, value]) => <div key={name}><strong>{name}</strong><span><i style={{ width: `${width}%` }} /></span><b>{value}</b></div>)}</div>
      </Report>

      <Report title="24-hour crime occurrence curve" meta="Area report · night-versus-day concentration" footer="Peak concentration · 22:00–03:00">
        <div className="occurrence-curve" role="img" aria-label="Crime occurrence rises overnight and peaks near midnight"><span>Peak 22:00–03:00</span><svg viewBox="0 0 700 220" preserveAspectRatio="none"><path className="curve-fill" d="M0 194C35 82 70 70 105 100S150 187 185 172S220 124 255 156S310 185 345 141S400 170 435 128S490 150 530 109S585 88 620 98S670 54 700 25L700 220L0 220Z"/><path className="curve-line" d="M0 194C35 82 70 70 105 100S150 187 185 172S220 124 255 156S310 185 345 141S400 170 435 128S490 150 530 109S585 88 620 98S670 54 700 25"/></svg></div>
      </Report>

      <Report title="Crime-mix divergence from state baseline" meta="Heatmap report · unusual district concentrations" footer="Percentage-point variance from statewide category share">
        <div className="divergence-table"><div className="divergence-head"><span /><span>Theft</span><span>Women safety</span><span>Cyber</span><span>Narcotics</span><span>Violence</span></div>{divergence.map(([name, ...values]) => <div className="divergence-row" key={name}><strong>{name}</strong>{values.map((value, index) => <span className={heat(value)} key={index}>{value > 0 ? '+' : ''}{value}</span>)}</div>)}</div>
      </Report>

      <Report title="Leadership intervention queue" meta="Decision list · urgency, evidence and accountable owner" footer={<Link to={governedAppLocation('/alerts', location)}>Open Alert Centre →</Link>}>
        <div className="leadership-queue"><article><i /><div><strong>{anomaly?.label ?? 'No current anomaly result'}</strong><span>Observed {available(anomaly?.observed)} against expected baseline {available(anomaly?.expected)} · confidence {percent(anomaly?.confidence)}</span></div><b>DECIDE</b><Link to={governedAppLocation('/alerts', location)}>Inspect evidence</Link></article><article><i className="warning" /><div><strong>{hotspot?.area ?? 'No active hotspot'}</strong><span>{hotspot ? `${available(hotspot.caseCount)} contributing cases · spatial severity ${percent(hotspot.severity)}` : 'No hotspot evidence available'}</span></div><b>REVIEW</b><Link to={governedAppLocation('/intelligence', location)}>Inspect evidence</Link></article></div>
        <p className="leadership-limitation">Area risk <strong>{riskScore}</strong>. {data.risk?.limitation ?? 'Area-risk evidence is unavailable for this run.'}</p>
      </Report>
    </div>

    <details className="district-matrix"><summary><strong>Complete 31-district command matrix</strong><span>Exhaustive statewide comparison</span></summary><div><p>Open the governed district report for complete volume, movement, risk, alert and response measures.</p><Link to={governedAppLocation('/reports', location)}>Open report library →</Link></div></details>
  </section>;
}
