import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

import { Busy, Failure } from '../../app/AsyncStates.jsx';
import { governedAppLocation } from '../../app/runtime.js';
import { useLoad } from '../../app/useLoad.js';
import { getPersonaPresentation } from '../../app/workspace-navigation.js';
import { Icon } from '../../components/icons.jsx';
import { getUtilityPresentation, loadUtility } from './utility-catalog.js';
import './utility-policy.css';

const stageIcons = Object.freeze({
  Data: 'report', Analyze: 'utilities', Explain: 'audit', Alert: 'alerts', Deliver: 'dashboard',
});

function formatToken(value) {
  return value.replaceAll('_', ' ').toLowerCase();
}

const recipientOptions = Object.freeze([
  ['COMMAND_CENTER', 'Command Centre'],
  ['STATE_LEADERSHIP', 'State leadership'],
  ['REGIONAL_LEADERSHIP', 'Regional leadership'],
  ['DISTRICT_LEADERSHIP', 'District leadership'],
  ['CRIME_ANALYST', 'Crime analyst'],
]);

const thresholdLabels = Object.freeze({
  threshold: 'Confidence threshold', minimumCases: 'Minimum cases', deviation: 'Baseline deviation',
});
const severityOptions = Object.freeze(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const recipientValues = new Set(recipientOptions.map(([value]) => value));
const ruleManagerRoles = new Set([
  'STATE_LEADERSHIP', 'REGIONAL_LEADERSHIP', 'DISTRICT_LEADERSHIP', 'CRIME_ANALYST', 'PLATFORM_ADMIN',
]);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeRule(rule, utility) {
  const thresholdEntry = Object.entries(utility.alertPolicy.fields).find(([name]) => name !== 'evaluationWindowDays');
  const [thresholdName, thresholdBounds] = thresholdEntry ?? [];
  const threshold = isRecord(rule?.thresholds) ? rule.thresholds[thresholdName] : undefined;
  const windowBounds = utility.alertPolicy.fields.evaluationWindowDays;
  if (!isRecord(rule) || typeof rule.id !== 'string' || !rule.id
    || rule.utilityKey !== utility.key || typeof rule.enabled !== 'boolean'
    || !Number.isSafeInteger(rule.scopeUnitId) || rule.scopeUnitId < 1
    || !isRecord(rule.thresholds) || Object.keys(rule.thresholds).length !== 1
    || typeof threshold !== 'number' || !Number.isFinite(threshold)
    || threshold < thresholdBounds.min || threshold > thresholdBounds.max
    || (thresholdBounds.kind === 'integer' && !Number.isSafeInteger(threshold))
    || !Number.isSafeInteger(rule.evaluationWindowDays)
    || rule.evaluationWindowDays < windowBounds.min || rule.evaluationWindowDays > windowBounds.max
    || !severityOptions.includes(rule.severity)
    || !Array.isArray(rule.recipientRoles) || rule.recipientRoles.length === 0
    || new Set(rule.recipientRoles).size !== rule.recipientRoles.length
    || rule.recipientRoles.some(role => !recipientValues.has(role))
    || !Number.isSafeInteger(rule.version) || rule.version < 1) return null;
  return {
    id: rule.id, utilityKey: rule.utilityKey, enabled: rule.enabled, scopeUnitId: rule.scopeUnitId,
    thresholds: { [thresholdName]: threshold }, evaluationWindowDays: rule.evaluationWindowDays,
    severity: rule.severity, recipientRoles: [...rule.recipientRoles], version: rule.version,
  };
}

async function fetchRules(api, utility) {
  const result = await api.get(`/v1/utility-alert-rules?utilityKey=${encodeURIComponent(utility.key)}`);
  if (!isRecord(result?.data) || !Array.isArray(result.data.items)) throw new TypeError('Invalid utility rules response');
  const rules = result.data.items.map(rule => normalizeRule(rule, utility));
  if (rules.some(rule => !rule)) throw new TypeError('Invalid utility rule');
  return rules;
}

function defaultDraft(utility, scopeUnitId) {
  const [thresholdName, bounds] = Object.entries(utility.alertPolicy.fields)
    .find(([name]) => name !== 'evaluationWindowDays');
  const preferred = thresholdName === 'threshold' ? 0.8 : thresholdName === 'minimumCases' ? 5 : 2;
  return {
    enabled: true, scopeUnitId: String(scopeUnitId), thresholdName,
    threshold: String(Math.min(bounds.max, Math.max(bounds.min, preferred))),
    evaluationWindowDays: '30', severity: 'HIGH', recipientRoles: ['COMMAND_CENTER', 'CRIME_ANALYST'],
  };
}

function draftFromRule(rule) {
  const [thresholdName, threshold] = Object.entries(rule.thresholds)[0];
  return {
    enabled: rule.enabled, scopeUnitId: String(rule.scopeUnitId), thresholdName, threshold: String(threshold),
    evaluationWindowDays: String(rule.evaluationWindowDays), severity: rule.severity,
    recipientRoles: [...rule.recipientRoles],
  };
}

function publicError(error) {
  if (error?.code === 'VERSION_CONFLICT') return 'This policy changed since you opened it. Your edits are preserved; review and save again.';
  if (error?.code === 'FORBIDDEN_ACTION' || error?.code === 'FORBIDDEN_SCOPE') return 'You do not have permission to save this policy.';
  return 'The policy could not be saved. Check the fields and try again.';
}

function PolicyForm({ utility, rule, api, scopeUnitId: defaultScopeUnitId, scopeLabel, reloadRule, onCancel, onSaved }) {
  const [baseRule, setBaseRule] = useState(rule);
  const [draft, setDraft] = useState(() => rule ? draftFromRule(rule) : defaultDraft(utility, defaultScopeUnitId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const idempotency = useRef(null);
  const thresholdBounds = utility.alertPolicy.fields[draft.thresholdName];
  const windowBounds = utility.alertPolicy.fields.evaluationWindowDays;
  const scopeUnitId = Number(draft.scopeUnitId);
  const threshold = Number(draft.threshold);
  const evaluationWindowDays = Number(draft.evaluationWindowDays);
  const valid = Number.isSafeInteger(scopeUnitId) && scopeUnitId > 0
    && Number.isFinite(threshold) && threshold >= thresholdBounds.min && threshold <= thresholdBounds.max
    && (thresholdBounds.kind !== 'integer' || Number.isSafeInteger(threshold))
    && Number.isSafeInteger(evaluationWindowDays)
    && evaluationWindowDays >= windowBounds.min && evaluationWindowDays <= windowBounds.max
    && draft.recipientRoles.length > 0;

  const update = (name, value) => {
    setDraft(current => ({ ...current, [name]: value }));
    setError(null);
    setSuccess(null);
  };

  const submit = async event => {
    event.preventDefault();
    if (!valid || saving) return;
    const payload = {
      enabled: draft.enabled, scopeUnitId,
      thresholds: { [draft.thresholdName]: threshold }, evaluationWindowDays,
      severity: draft.severity,
      recipientRoles: recipientOptions.map(([value]) => value).filter(value => draft.recipientRoles.includes(value)),
    };
    setSaving(true); setError(null); setSuccess(null);
    try {
      let response;
      if (baseRule) {
        response = await api.patch(`/v1/utility-alert-rules/${encodeURIComponent(baseRule.id)}`, {
          expectedVersion: baseRule.version, ...payload,
        });
      } else {
        const body = { utilityKey: utility.key, ...payload };
        const fingerprint = JSON.stringify(body);
        if (idempotency.current?.fingerprint !== fingerprint) {
          idempotency.current = {
            fingerprint,
            key: globalThis.crypto?.randomUUID?.() ?? `RULE-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          };
        }
        response = await api.idempotent('/v1/utility-alert-rules', body, idempotency.current.key);
      }
      idempotency.current = null;
      setSuccess('Alert setup saved.');
      onSaved(response.data);
    } catch (saveError) {
      if (saveError?.code === 'VERSION_CONFLICT' && baseRule) {
        try {
          const latest = await reloadRule(baseRule.id);
          setBaseRule(latest);
        } catch {
          setError('The latest policy could not be loaded. Your edits are preserved.');
          return;
        }
      }
      setError(publicError(saveError));
    } finally {
      setSaving(false);
    }
  };

  const toggleRecipient = role => update('recipientRoles', draft.recipientRoles.includes(role)
    ? draft.recipientRoles.filter(item => item !== role)
    : [...draft.recipientRoles, role]);

  return <form className="utilities-policy-form" onSubmit={submit}>
    <div className="utilities-policy-form__heading">
      <div><h3>{baseRule ? 'Edit alert setup' : 'New alert setup'}</h3>{baseRule ? <small>Revision {baseRule.version}</small> : null}</div>
      <label className="utilities-policy-switch"><input type="checkbox" checked={draft.enabled} onChange={event => update('enabled', event.target.checked)} /> Enabled policy</label>
    </div>
    <div className="utilities-policy-fields">
      <div className="utilities-policy-scope"><span>Authorized scope</span><strong>{scopeLabel}</strong></div>
      <label>{thresholdLabels[draft.thresholdName]}
        <input aria-label={thresholdLabels[draft.thresholdName]} type="number" required min={thresholdBounds.min} max={thresholdBounds.max} step={thresholdBounds.kind === 'integer' ? 1 : 0.01} value={draft.threshold} onChange={event => update('threshold', event.target.value)} />
        <small>{thresholdBounds.min} to {thresholdBounds.max}</small>
      </label>
      <label>Evaluation window (days)<input type="number" required min={windowBounds.min} max={windowBounds.max} step="1" value={draft.evaluationWindowDays} onChange={event => update('evaluationWindowDays', event.target.value)} /></label>
      <label>Severity<select value={draft.severity} onChange={event => update('severity', event.target.value)}>{severityOptions.map(value => <option key={value}>{value}</option>)}</select></label>
    </div>
    <fieldset className="utilities-policy-recipients"><legend>Recipients</legend>
      {recipientOptions.map(([value, label]) => <label key={value}><input type="checkbox" checked={draft.recipientRoles.includes(value)} onChange={() => toggleRecipient(value)} /> {label}</label>)}
    </fieldset>
    {error ? <p className="utilities-policy-message utilities-policy-message--error" role="alert">{error}</p> : null}
    {success ? <p className="utilities-policy-message utilities-policy-message--success" role="status">{success}</p> : null}
    <div className="utilities-policy-actions">
      <button type="button" className="utilities-policy-secondary" onClick={onCancel}>Cancel</button>
      <button type="submit" disabled={!valid || saving}>{saving ? 'Saving…' : 'Save setup'}</button>
    </div>
  </form>;
}

function ruleThresholdSummary(rule) {
  const [name, value] = Object.entries(rule.thresholds ?? {})[0] ?? [];
  return name ? `${name === 'threshold' ? 'Confidence' : thresholdLabels[name]} ${value}` : 'Governed threshold';
}

function normalizeEvaluation(value, rule) {
  const keys = ['ruleId', 'ruleVersion', 'utilityKey', 'findingType', 'analysisRunId', 'runGroupId', 'evaluated', 'matched', 'suppressed', 'created', 'existing', 'alertIds', 'syntheticData'];
  const findingTypes = { patterns: 'PATTERN', hotspots: 'HOTSPOT', anomalies: 'ANOMALY' };
  if (!isRecord(value) || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))
    || value.ruleId !== rule.id || value.ruleVersion !== rule.version || value.utilityKey !== rule.utilityKey
    || value.findingType !== findingTypes[rule.utilityKey]
    || typeof value.analysisRunId !== 'string' || !value.analysisRunId
    || typeof value.runGroupId !== 'string' || !value.runGroupId
    || !Number.isSafeInteger(value.evaluated) || value.evaluated < 0
    || !Number.isSafeInteger(value.matched) || value.matched < 0
    || !Number.isSafeInteger(value.suppressed) || value.suppressed < 0
    || value.matched + value.suppressed !== value.evaluated
    || !Number.isSafeInteger(value.created) || value.created < 0
    || !Number.isSafeInteger(value.existing) || value.existing < 0
    || !Array.isArray(value.alertIds)
    || value.alertIds.some(id => typeof id !== 'string' || !id)
    || new Set(value.alertIds).size !== value.alertIds.length
    || value.created + value.existing !== value.alertIds.length
    || value.created + value.existing > value.matched
    || value.syntheticData !== true) return null;
  return {
    evaluated: value.evaluated, matched: value.matched, suppressed: value.suppressed,
    alertIds: [...value.alertIds], syntheticData: value.syntheticData,
  };
}

function EvaluationAction({ api, rule, location }) {
  const [state, setState] = useState({ busy: false, error: null, result: null });
  const run = async () => {
    if (!rule.enabled || state.busy) return;
    setState({ busy: true, error: null, result: null });
    try {
      const response = await api.post(`/v1/utility-alert-rules/${encodeURIComponent(rule.id)}/evaluate`, {
        expectedVersion: rule.version,
      });
      const result = normalizeEvaluation(response?.data, rule);
      if (!result) throw new TypeError('Invalid utility evaluation response');
      setState({ busy: false, error: null, result });
    } catch {
      setState({ busy: false, error: 'Evaluation could not be completed. Try again.', result: null });
    }
  };
  if (!rule.enabled) return null;
  return <div className="utilities-policy-evaluation">
    <button type="button" disabled={state.busy} onClick={run}>{state.busy ? 'Evaluating…' : 'Run evaluation'}</button>
    {state.error ? <p className="utilities-policy-message utilities-policy-message--error" role="alert">{state.error}</p> : null}
    {state.result ? <div className="utilities-policy-result" role="status">
      <span>{state.result.evaluated} evaluated · {state.result.matched} matched · {state.result.suppressed} suppressed</span>
      <p>Published model findings were assessed against governed scope and evaluation-window rules. {state.result.matched} findings matched the human-governed delivery qualification, while {state.result.suppressed} were suppressed. Human review is required before action.</p>
      {state.result.syntheticData ? <small className="utilities-policy-provenance">Demonstration data</small> : null}
      {state.result.alertIds[0] ? <Link to={governedAppLocation(`/alerts/${encodeURIComponent(state.result.alertIds[0])}`, location)}>Open alert</Link> : null}
    </div> : null}
  </div>;
}

function AiAssistedDetection({ aiAssistance }) {
  return <aside className="utilities-ai-assistance" aria-label="AI-assisted detection">
    <div className="utilities-ai-assistance__heading">
      <span>AI-assisted detection</span>
      <strong>{aiAssistance.method}</strong>
      <small>{aiAssistance.engineVersion}</small>
    </div>
    <p>{aiAssistance.explanation}</p>
  </aside>;
}

function AlertSetupOverview() {
  const steps = [
    ['Monitor', 'Utility findings'],
    ['Route', 'Relevant personas'],
    ['Human action', 'Review and assign'],
  ];
  return <aside className="utilities-alert-setup-overview" aria-label="Alert setup flow">
    <p>Set when this utility should create an alert and which operational personas should receive it. Analytical signals support monitoring; people review, assign and act on every alert.</p>
    <ol>{steps.map(([name, detail]) => <li key={name}><span>{name}</span><strong>{detail}</strong></li>)}</ol>
  </aside>;
}

function AlertPolicy({ utility, api, workspace, location }) {
  const [state, setState] = useState({ loading: utility.alertPolicy.enabled, error: null, rules: [] });
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState(null);
  const scopeLabel = getPersonaPresentation(workspace?.role).scope;
  const scopeUnitId = workspace?.scopeUnitId;
  const canManage = ruleManagerRoles.has(workspace?.role);

  useEffect(() => {
    if (!utility.alertPolicy.enabled) return undefined;
    let current = true;
    fetchRules(api, utility)
      .then(rules => { if (current) setState({ loading: false, error: null, rules }); })
      .catch(error => { if (current) setState({ loading: false, error, rules: [] }); });
    return () => { current = false; };
  }, [api, utility.alertPolicy.enabled, utility.key]);

  if (!utility.alertPolicy.enabled) return <div className="utilities-alert-unavailable">
    <strong>Alert unavailable</strong>
    <span>Area Attention is a visual review signal and does not create alerts in this MVP.</span>
  </div>;
  if (state.loading) return <p className="utilities-policy-loading" role="status">Loading alert policies…</p>;
  if (state.error) return <p className="utilities-policy-message utilities-policy-message--error" role="alert">Alert setups could not be loaded.</p>;

  const saveRule = saved => {
    const normalized = normalizeRule(saved, utility);
    if (!normalized) {
      setState(current => ({ ...current, error: new TypeError('Invalid saved utility rule') }));
      return;
    }
    setState(current => ({ ...current, rules: current.rules.some(item => item.id === normalized.id)
      ? current.rules.map(item => item.id === normalized.id ? normalized : item) : [...current.rules, normalized] }));
    setEditing(null); setCreating(false); setNotice('Alert setup saved.');
  };

  const reloadRule = async id => {
    const rules = await fetchRules(api, utility);
    const latest = rules.find(item => item.id === id);
    if (!latest) throw new TypeError('Utility rule missing after conflict');
    setState(current => ({ ...current, rules }));
    return latest;
  };

  if (creating || editing) return <PolicyForm utility={utility} rule={editing} api={api} scopeUnitId={scopeUnitId} scopeLabel={scopeLabel} reloadRule={reloadRule} onCancel={() => { setCreating(false); setEditing(null); }} onSaved={saveRule} />;

  return <div className="utilities-policy">
    <div className="utilities-policy__heading"><div><h3>Alert setups</h3><p>Configure a bounded rule for this utility's published findings.</p></div>
      {state.rules.length === 0 && canManage ? <button type="button" onClick={() => setCreating(true)}>Add alert setup</button> : null}
    </div>
    {notice ? <p className="utilities-policy-message utilities-policy-message--success" role="status">{notice}</p> : null}
    {state.rules.length === 0 ? <p className="utilities-policy-empty">No alert setup is configured for this utility.</p> : <ul className="utilities-policy-list">
      {state.rules.map(rule => <li key={rule.id}>
        <span className={`utilities-policy-state${rule.enabled ? '' : ' utilities-policy-state--off'}`}>{rule.enabled ? 'Enabled' : 'Paused'}</span>
        <div><strong>{scopeLabel}</strong><small><span>{ruleThresholdSummary(rule)}</span> · {rule.evaluationWindowDays} days · {formatToken(rule.severity)}</small></div>
        {canManage ? <div className="utilities-policy-row-actions">
          <button type="button" onClick={() => { setNotice(null); setEditing(rule); }}>Edit policy</button>
          <EvaluationAction api={api} rule={rule} location={location} />
        </div> : null}
      </li>)}
    </ul>}
  </div>;
}

export function UtilityPage({ api, workspace }) {
  const { utilityKey } = useParams();
  const location = useLocation();
  const [activePanel, setActivePanel] = useState(null);
  const state = useLoad(() => loadUtility(api, utilityKey), [api, utilityKey]);
  const catalogueLocation = governedAppLocation('/utilities', location);

  if (state.loading) return <Busy label="Loading utility definition…" />;
  if (state.error?.status === 404 || state.error?.code === 'NOT_FOUND') return <section className="utilities-page utilities-not-found">
    <h1>Utility not found</h1><p>The requested utility is not available in this catalogue.</p>
    <Link to={catalogueLocation}>Back to utilities</Link>
  </section>;
  if (state.error) return <Failure error={state.error} />;

  const utility = state.data;
  if (!utility || typeof utility !== 'object') return <Failure error={{ code: 'UTILITY_CONTRACT_INVALID' }} />;
  const presentation = getUtilityPresentation(utility.icon);

  return <article className={`utilities-page utilities-detail utilities-detail--${presentation.tone}`}>
    <Link className="utilities-back" to={catalogueLocation}>← All utilities</Link>
    <header className="utilities-detail-intro">
      <div className="utilities-detail-mark"><Icon name={presentation.icon} size={25} /></div>
      <div><h1>{utility.name}</h1><p>{utility.description}</p></div>
      <span className={`utilities-status${utility.availability === 'AVAILABLE' ? '' : ' utilities-status--limited'}`}>
        {utility.availability === 'AVAILABLE' ? 'Active' : 'Analysis only'}
      </span>
    </header>
    <section className="utilities-flow-wrap">
      <h2>How this utility works</h2>
      <ol className="utilities-flow" aria-label="How this utility works">
        {(utility.stages ?? []).map(stage => <li key={stage.stage}>
          <div className="utilities-flow-icon"><Icon name={stageIcons[stage.stage] ?? 'utilities'} /></div>
          <h3>{stage.stage}</h3><span>{stage.label}</span>
          {stage.stage === 'Analyze' ? <small>{utility.analyticalMethod}</small> : null}
        </li>)}
      </ol>
    </section>
    <nav className="utilities-detail-links" aria-label="Utility definition sections">
      <button id="input-logic-tab" type="button" aria-label="Input & Logic" aria-expanded={activePanel === 'input-logic'} aria-controls="input-logic" onClick={() => setActivePanel(current => current === 'input-logic' ? null : 'input-logic')}><Icon name="utilities" /><span><b>Input &amp; Logic</b><small>Inspect governed method</small></span></button>
      <button id="alert-policy-tab" type="button" aria-label="Alerts (Setup)" aria-expanded={activePanel === 'alert-policy'} aria-controls="alert-policy" onClick={() => setActivePanel(current => current === 'alert-policy' ? null : 'alert-policy')}><Icon name="alerts" /><span><b>Alerts (Setup)</b><small>Configure monitoring and routing</small></span></button>
      <button id="outputs-tab" type="button" aria-label="Outputs" aria-expanded={activePanel === 'outputs'} aria-controls="outputs" onClick={() => setActivePanel(current => current === 'outputs' ? null : 'outputs')}><Icon name="dashboard" /><span><b>Outputs</b><small>Inspect delivery channels</small></span></button>
    </nav>
    {activePanel ? <div className="utilities-detail-sections">
      {activePanel === 'input-logic' ? <section id="input-logic" role="region" aria-labelledby="input-logic-tab"><h2>Input &amp; Logic</h2><p>{utility.stages?.[0]?.label}</p><strong>{utility.analyticalMethod}</strong>
        <ul>{(utility.limitations ?? []).map(item => <li key={item}>{formatToken(item)}</li>)}</ul>
      </section> : null}
      {activePanel === 'alert-policy' ? <section id="alert-policy" role="region" aria-labelledby="alert-policy-tab"><h2>Alerts (Setup)</h2><AlertSetupOverview />{utility.aiAssistance ? <AiAssistedDetection aiAssistance={utility.aiAssistance} /> : null}<AlertPolicy utility={utility} api={api} workspace={workspace} location={location} /></section> : null}
      {activePanel === 'outputs' ? <section id="outputs" role="region" aria-labelledby="outputs-tab"><h2>Outputs</h2><ul>{(utility.outputs ?? []).map(output => <li key={output}>{formatToken(output)}</li>)}</ul></section> : null}
    </div> : null}
  </article>;
}
