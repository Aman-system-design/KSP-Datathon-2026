import { Activity, Clock3, MapPinned, Share2 } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

import { governedAppLocation } from '../../app/runtime.js';

const displayValue = value => value ?? 'Unavailable';
const percent = value => Number.isFinite(value) ? `${Math.round(value * 100)}%` : 'Unavailable';

function InsightPanel({ icon: Icon, eyebrow, title, action, children }) {
  return <section className="command-intelligence-panel">
    <header><span><Icon aria-hidden="true" /></span><div><small>{eyebrow}</small><h2>{title}</h2></div>{action}</header>
    <div className="command-intelligence-panel__body">{children}</div>
  </section>;
}

export function CommandCenterIntelligence({ data = {} }) {
  const location = useLocation();
  const anomaly = data.anomalies?.[0];
  const hotspot = data.hotspots?.[0];
  return <main className="command-intelligence-page">
    <header className="command-intelligence-hero">
      <div><span className="eyebrow">Command Center</span><h1>Operational Intelligence</h1><p>Detect changes, examine concentrations and move from governed signals to supporting evidence.</p></div>
      <Link className="primary-link" to={governedAppLocation('/reports', location)}>Open governed reports</Link>
    </header>
    <nav aria-label="Operational intelligence views" className="command-intelligence-tabs">
      <a href="#changes">Changes</a><a href="#concentration">Concentration</a><a href="#timing">Timing</a><a href="#connections">Connections</a>
    </nav>
    <div className="command-intelligence-grid">
      <div id="changes"><InsightPanel icon={Activity} eyebrow="Latest governed signal" title="What changed" action={<Link to={governedAppLocation('/alerts', location)}>Review evidence</Link>}>
        {anomaly ? <article className="command-intelligence-finding"><strong>{anomaly.label}</strong><p>Observed <b>{displayValue(anomaly.observed)}</b> against baseline <b>{displayValue(anomaly.expected)}</b>.</p><span>{percent(anomaly.confidence)} confidence · Human review required</span></article> : <p className="honest-empty">No current change signal is available for the authorized scope.</p>}
      </InsightPanel></div>
      <div id="concentration"><InsightPanel icon={MapPinned} eyebrow="Spatial evidence" title="Where it concentrates" action={<Link to={governedAppLocation('/geospatial', location)}>Open analysis</Link>}>
        {hotspot ? <dl className="command-intelligence-metrics"><div><dt>Area</dt><dd>{hotspot.area}</dd></div><div><dt>Cases</dt><dd>{displayValue(hotspot.caseCount)}</dd></div><div><dt>Severity</dt><dd>{percent(hotspot.severity)}</dd></div></dl> : <p className="honest-empty">No hotspot result is available for the authorized scope.</p>}
      </InsightPanel></div>
      <div id="timing"><InsightPanel icon={Clock3} eyebrow="Report-powered view" title="When it occurs" action={<Link to={governedAppLocation('/reports', location)}>Open time reports</Link>}>
        <p className="command-intelligence-guidance">Compare monthly movement and incident-hour demand through editable governed reports before assigning operational significance.</p>
      </InsightPanel></div>
      <div id="connections"><InsightPanel icon={Share2} eyebrow="Relationship evidence" title="Connections" action={<Link to={governedAppLocation('/networks', location)}>Open network analysis</Link>}>
        <p className="command-intelligence-guidance">Examine governed case and entity relationships as investigative signals. Connections are not proof.</p>
      </InsightPanel></div>
    </div>
    <p className="command-intelligence-limitation">{data.risk?.limitation ?? 'Area and time intelligence only; not an individual prediction.'}</p>
  </main>;
}
