import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { afterEach, expect, test, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { UtilityPage } from './UtilityPage.jsx';

const policyCss = readFileSync('src/features/utilities/utility-policy.css', 'utf8');

afterEach(cleanup);

const areaAttention = {
  key: 'area-attention', version: '1.0.0', name: 'Area Attention Intelligence',
  description: 'Prioritizes areas for review using bounded aggregate signals.',
  category: 'risk-prioritization', availability: 'ANALYSIS_ONLY', icon: 'scan-search',
  analyticalMethod: 'Weighted area-attention scoring',
  stages: [
    { stage: 'Data', label: 'Authorized aggregate area signals' },
    { stage: 'Analyze', label: 'Score area attention signals' },
    { stage: 'Explain', label: 'Inspect score components' },
    { stage: 'Alert', label: 'Alert policy awaiting validation' },
    { stage: 'Deliver', label: 'Open monitoring, maps and reports' },
  ],
  outputs: ['monitoring', 'maps', 'reports'],
  limitations: ['AREA_SIGNAL_NOT_INDIVIDUAL_PREDICTION', 'ALERT_POLICY_NOT_VALIDATED'],
  alertPolicy: { enabled: false, fields: {} },
};

const patterns = {
  key: 'patterns', version: '1.0.0', name: 'Cross-District Pattern Intelligence',
  description: 'Connects related signals across authorized districts for human review.',
  category: 'patterns-networks', availability: 'AVAILABLE', icon: 'network',
  analyticalMethod: 'Multi-signal pattern fusion',
  aiAssistance: {
    method: 'EXPLAINABLE_MULTI_SIGNAL_FUSION', engineVersion: '1.0.0',
    explanation: 'The model creates a machine-generated pattern signal by linking authorized case features across districts and assigning confidence to each link. Alert delivery is qualified by a human-governed policy, and human review is required before action.',
    governance: { machineGeneratedSignal: true, humanGovernedDelivery: true, humanReviewRequired: true },
  },
  stages: [
    { stage: 'Data', label: 'Authorized case features' },
    { stage: 'Analyze', label: 'Fuse cross-district signals' },
    { stage: 'Explain', label: 'Review linked evidence' },
    { stage: 'Alert', label: 'Apply a confidence rule' },
    { stage: 'Deliver', label: 'Open alerts and reports' },
  ],
  outputs: ['alerts', 'monitoring', 'reports'],
  limitations: ['SIMILARITY_IS_NOT_PROOF', 'REQUIRES_HUMAN_REVIEW'],
  alertPolicy: {
    enabled: true,
    fields: { threshold: { kind: 'number', min: 0.65, max: 1 }, evaluationWindowDays: { kind: 'integer', min: 1, max: 180 } },
  },
};

const hotspots = {
  ...patterns,
  key: 'hotspots', name: 'Emerging Hotspot Intelligence', category: 'spatial-intelligence', icon: 'map-pin',
  analyticalMethod: 'Density-based spatial clustering',
  aiAssistance: {
    method: 'HAVERSINE_DBSCAN', engineVersion: '1.0.0',
    explanation: 'The HAVERSINE_DBSCAN engine groups nearby cases within an authorized spatial and time window, using case density to create a machine-generated hotspot signal. Alert delivery is qualified by a human-governed policy, and human review is required before action.',
    governance: { machineGeneratedSignal: true, humanGovernedDelivery: true, humanReviewRequired: true },
  },
  alertPolicy: { enabled: true, fields: {
    minimumCases: { kind: 'integer', min: 2, max: 50 },
    evaluationWindowDays: { kind: 'integer', min: 1, max: 180 },
  } },
};

const anomalies = {
  ...patterns,
  key: 'anomalies', name: 'Trend Anomaly Intelligence', category: 'trends-anomalies', icon: 'chart-no-axes-combined',
  analyticalMethod: 'Baseline deviation analysis',
  aiAssistance: {
    method: 'MEDIAN_MAD', engineVersion: '1.0.0',
    explanation: 'The MEDIAN_MAD engine compares observed values with a robust median baseline and median absolute deviation; SEASONAL_MEDIAN_MAD is used only when a seasonal period is configured. The model creates a machine-generated anomaly signal for material departures. Alert delivery is qualified by a human-governed policy, and human review is required before action.',
    governance: { machineGeneratedSignal: true, humanGovernedDelivery: true, humanReviewRequired: true },
  },
  alertPolicy: { enabled: true, fields: {
    deviation: { kind: 'number', min: 1, max: 10 },
    evaluationWindowDays: { kind: 'integer', min: 1, max: 180 },
  } },
};

const savedPatternRule = {
  id: 'URULE-PRIVATE', utilityKey: 'patterns', enabled: true, scopeUnitId: 101,
  thresholds: { threshold: 0.8 }, evaluationWindowDays: 30, severity: 'HIGH',
  recipientRoles: ['DISTRICT_LEADERSHIP', 'CRIME_ANALYST'], utilityVersion: '1.0.0', version: 3,
  createdBy: 'CAT-ANALYST', createdAt: '2026-07-26T09:00:00.000Z',
  updatedAt: '2026-07-26T09:00:00.000Z', syntheticData: true,
};

function evaluationResponse(overrides = {}) {
  return {
    ruleId: 'URULE-PRIVATE', ruleVersion: 3, utilityKey: 'patterns', findingType: 'PATTERN',
    analysisRunId: 'RUN-1', runGroupId: 'GROUP-1', evaluated: 12, matched: 2, suppressed: 10,
    created: 1, existing: 0, alertIds: ['ALT-PRIVATE'], syntheticData: true, ...overrides,
  };
}

const analystWorkspace = { role: 'CRIME_ANALYST', scopeUnitId: 101 };

function renderRoute(api, path = '/utilities/area-attention', workspace = analystWorkspace) {
  return render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/utilities/:utilityKey" element={<UtilityPage api={api} workspace={workspace} />} />
  </Routes></MemoryRouter>);
}

test('renders the server-defined lifecycle before progressively revealing one selected definition panel', async () => {
  const api = { get: vi.fn(async () => ({ data: areaAttention })) };
  renderRoute(api, '/utilities/area-attention?persona=CRIME_ANALYST');

  expect(await screen.findByRole('heading', { name: 'Area Attention Intelligence' })).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledWith('/v1/utilities/area-attention');
  const lifecycle = screen.getByRole('list', { name: 'How this utility works' });
  expect(within(lifecycle).getAllByRole('listitem')).toHaveLength(5);
  expect(within(lifecycle).getByText('Weighted area-attention scoring')).toBeInTheDocument();
  const inputButton = screen.getByRole('button', { name: 'Input & Logic' });
  const alertButton = screen.getByRole('button', { name: 'Alerts (Setup)' });
  const outputsButton = screen.getByRole('button', { name: 'Outputs' });
  expect(inputButton).toHaveAttribute('aria-expanded', 'false');
  expect(alertButton).toHaveAttribute('aria-expanded', 'false');
  expect(outputsButton).toHaveAttribute('aria-expanded', 'false');
  expect(inputButton).not.toHaveAttribute('aria-selected');
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
  expect(screen.queryByText('Alert unavailable')).not.toBeInTheDocument();

  fireEvent.click(inputButton);
  expect(inputButton).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('region', { name: 'Input & Logic' })).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Alerts (Setup)' })).not.toBeInTheDocument();

  fireEvent.click(alertButton);
  expect(alertButton).toHaveAttribute('aria-expanded', 'true');
  expect(inputButton).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('region', { name: 'Input & Logic' })).not.toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Alerts (Setup)' })).toHaveTextContent('Alert unavailable');

  fireEvent.click(outputsButton);
  expect(outputsButton).toHaveAttribute('aria-expanded', 'true');
  expect(screen.queryByRole('region', { name: 'Alerts (Setup)' })).not.toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Outputs' })).toHaveTextContent('monitoring');
  fireEvent.click(outputsButton);
  expect(outputsButton).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: /all utilities/i })).toHaveAttribute('href', '/utilities?persona=CRIME_ANALYST');
  expect(screen.queryByText(/QuickML/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/accuracy|success rate/i)).not.toBeInTheDocument();
});

test('presents alert configuration as setup, routing and human action without automation claims', async () => {
  const api = { get: vi.fn(async path => path.startsWith('/v1/utilities/')
    ? { data: patterns }
    : { data: { items: [] } }) };
  renderRoute(api, '/utilities/patterns?persona=CRIME_ANALYST');

  await screen.findByRole('heading', { name: patterns.name });
  const setupButton = screen.getByRole('button', { name: 'Alerts (Setup)' });
  expect(setupButton).toHaveTextContent('Configure monitoring and routing');
  fireEvent.click(setupButton);

  const section = screen.getByRole('region', { name: 'Alerts (Setup)' });
  expect(within(section).getByText('Monitor')).toBeInTheDocument();
  expect(within(section).getByText('Route')).toBeInTheDocument();
  expect(within(section).getByText('Human action')).toBeInTheDocument();
  expect(section).toHaveTextContent(/people review, assign and act on every alert/i);
  expect(section).not.toHaveTextContent(/24\/7|continuous|real-time/i);
});

test.each(['COMMAND_CENTER', 'STATE_LEADERSHIP', 'DISTRICT_LEADERSHIP', 'STATION_OPERATIONS', 'CRIME_ANALYST'])(
  'shows Alerts (Setup) for the %s utility experience',
  async persona => {
    const api = { get: vi.fn(async () => ({ data: areaAttention })) };
    renderRoute(api, `/utilities/area-attention?persona=${persona}`, { role: persona, scopeUnitId: 101 });

    await screen.findByRole('heading', { name: areaAttention.name });
    fireEvent.click(screen.getByRole('button', { name: 'Alerts (Setup)' }));
    const section = screen.getByRole('region', { name: 'Alerts (Setup)' });
    expect(section).toHaveTextContent('Alert unavailable');
    expect(section).toHaveTextContent('does not create alerts in this MVP');
  },
);

test.each([
  ['key', null],
  ['name', ''],
  ['category', []],
  ['stages', [{ stage: 'Data', label: 'Incomplete' }]],
  ['outputs', [null]],
  ['limitations', 'not-a-list'],
  ['alertPolicy', { enabled: 'yes', fields: {} }],
])('rejects a malformed detail %s with a stable contract failure', async (field, value) => {
  const api = { get: vi.fn(async () => ({ data: { ...areaAttention, [field]: value } })) };
  renderRoute(api);

  expect(await screen.findByText('Reference UTILITY_CONTRACT_INVALID')).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Area Attention Intelligence' })).not.toBeInTheDocument();
});

test.each([
  ['non-plain object', Object.assign(Object.create({ inherited: true }), patterns.aiAssistance)],
  ['extra unsafe key', { ...patterns.aiAssistance, internalPrompt: 'private' }],
  ['empty method', { ...patterns.aiAssistance, method: '' }],
  ['oversized engine version', { ...patterns.aiAssistance, engineVersion: 'v'.repeat(33) }],
  ['oversized explanation', { ...patterns.aiAssistance, explanation: 'x'.repeat(1201) }],
  ['missing governance', { ...patterns.aiAssistance, governance: undefined }],
  ['disabled human review', { ...patterns.aiAssistance, governance: { ...patterns.aiAssistance.governance, humanReviewRequired: false } }],
  ['extra governance key', { ...patterns.aiAssistance, governance: { ...patterns.aiAssistance.governance, autonomousAction: false } }],
  ['unrecognized legacy metadata', {
    label: 'Unknown model', methodVersion: 'UNKNOWN-1.0',
    explanation: 'The model creates a machine-generated pattern signal. The alert policy is human-governed delivery qualification and human review is required.',
  }],
])('rejects available utility AI assistance with %s', async (_case, aiAssistance) => {
  const api = { get: vi.fn(async () => ({ data: { ...patterns, aiAssistance } })) };
  renderRoute(api, '/utilities/patterns');

  expect(await screen.findByText('Reference UTILITY_CONTRACT_INVALID')).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: patterns.name })).not.toBeInTheDocument();
});

test('accepts revised server-owned AI assistance copy without a client copy allowlist', async () => {
  const explanation = 'Seasonal observations are processed into a review signal. Delivery remains governed and requires review.';
  const api = { get: vi.fn(async path => path.startsWith('/v1/utilities/')
    ? { data: { ...anomalies, aiAssistance: { ...anomalies.aiAssistance, method: 'SEASONAL_MEDIAN_MAD', explanation } } }
    : { data: { items: [] } }) };
  renderRoute(api, '/utilities/anomalies');
  await screen.findByRole('heading', { name: anomalies.name });
  fireEvent.click(screen.getByRole('button', { name: 'Alerts (Setup)' }));

  const panel = await screen.findByRole('complementary', { name: 'AI-assisted detection' });
  expect(panel).toHaveTextContent('SEASONAL_MEDIAN_MAD');
  expect(panel).toHaveTextContent(explanation);
});

test('loads an older deployed utility without inventing missing AI assistance metadata', async () => {
  const { aiAssistance: _missing, ...legacyUtility } = patterns;
  const api = { get: vi.fn(async path => path.startsWith('/v1/utilities/')
    ? { data: legacyUtility }
    : { data: { items: [] } }) };
  renderRoute(api, '/utilities/patterns');

  await screen.findByRole('heading', { name: patterns.name });
  fireEvent.click(screen.getByRole('button', { name: 'Alerts (Setup)' }));
  expect(screen.queryByRole('complementary', { name: 'AI-assisted detection' })).not.toBeInTheDocument();
});

test('accepts the legacy deployed AI assistance contract while the backend rolls forward', async () => {
  const legacyAssistance = {
    label: 'Multi-signal pattern fusion',
    methodVersion: 'PF-1.0',
    explanation: 'The model creates a machine-generated pattern signal by linking authorized case features across districts and assigning confidence to each link. The alert policy is human-governed delivery qualification, not a crime prediction or autonomous decision, and human review is required before action.',
  };
  const api = { get: vi.fn(async path => path.startsWith('/v1/utilities/')
    ? { data: { ...patterns, aiAssistance: legacyAssistance } }
    : { data: { items: [] } }) };
  renderRoute(api, '/utilities/patterns');

  await screen.findByRole('heading', { name: patterns.name });
  fireEvent.click(screen.getByRole('button', { name: 'Alerts (Setup)' }));
  const panel = await screen.findByRole('complementary', { name: 'AI-assisted detection' });
  expect(panel).toHaveTextContent('Multi-signal pattern fusion');
  expect(panel).toHaveTextContent('PF-1.0');
  expect(panel).toHaveTextContent(/human review is required/i);
});

test('keeps an invalid utility key inside a safe catalogue boundary', async () => {
  const notFound = Object.assign(new Error('private service detail'), { status: 404, code: 'NOT_FOUND' });
  const api = { get: vi.fn(async () => { throw notFound; }) };
  renderRoute(api, '/utilities/not-a-real-key?persona=CRIME_ANALYST');

  expect(await screen.findByRole('heading', { name: 'Utility not found' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Back to utilities' })).toHaveAttribute('href', '/utilities?persona=CRIME_ANALYST');
  expect(screen.queryByText('private service detail')).not.toBeInTheDocument();
});

test('loads and lists alert policies only after the progressive section is opened', async () => {
  const api = { get: vi.fn(async path => path.startsWith('/v1/utilities/')
    ? { data: patterns }
    : { data: { items: [savedPatternRule] } }) };
  renderRoute(api, '/utilities/patterns');

  await screen.findByRole('heading', { name: patterns.name });
  expect(api.get).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Alerts (Setup)' }));

  expect(await screen.findByRole('heading', { name: 'Alert setups' })).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledWith('/v1/utility-alert-rules?utilityKey=patterns');
  expect(screen.getByText('Assigned units and cases')).toBeInTheDocument();
  expect(screen.queryByText(/101/)).not.toBeInTheDocument();
  expect(screen.getByText('Confidence 0.8')).toBeInTheDocument();
  expect(screen.queryByText('URULE-PRIVATE')).not.toBeInTheDocument();
  expect(screen.queryByText(/QuickML/i)).not.toBeInTheDocument();
});

test.each([
  [patterns, /linking authorized case features.*assigning confidence/i],
  [hotspots, /authorized spatial and time window.*case density/i],
  [anomalies, /SEASONAL_MEDIAN_MAD.*seasonal period is configured/i],
])('renders one governed AI-assisted detection panel for $key', async (utility, methodExplanation) => {
  const api = { get: vi.fn(async path => path.startsWith('/v1/utilities/')
    ? { data: utility }
    : { data: { items: [] } }) };
  renderRoute(api, `/utilities/${utility.key}`);
  await screen.findByRole('heading', { name: utility.name });
  fireEvent.click(screen.getByRole('button', { name: 'Alerts (Setup)' }));

  const panels = await screen.findAllByRole('complementary', { name: 'AI-assisted detection' });
  expect(panels).toHaveLength(1);
  expect(panels[0]).toHaveTextContent(utility.aiAssistance.method);
  expect(panels[0]).toHaveTextContent(utility.aiAssistance.engineVersion);
  expect(panels[0]).toHaveTextContent(methodExplanation);
  expect(panels[0]).toHaveTextContent(/human review is required/i);
});

test('keeps AI assistance and evaluation narrative typography at 12px', () => {
  expect(policyCss).toMatch(/\.utilities-ai-assistance p\s*\{[^}]*font-size:\s*12px/);
  expect(policyCss).toMatch(/\.utilities-policy-result p\s*\{[^}]*font-size:\s*12px/);
});

test('keeps the alert setup explanation compact and responsive', () => {
  expect(policyCss).toMatch(/\.utilities-alert-setup-overview\s*\{[^}]*border-left:\s*3px solid #2468b4/s);
  expect(policyCss).toMatch(/\.utilities-alert-setup-overview ol\s*\{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/s);
  expect(policyCss).toMatch(/@media \(max-width: 760px\)[\s\S]*\.utilities-alert-setup-overview ol\s*\{[^}]*grid-template-columns:\s*1fr/s);
});

test('creates one bounded policy and keeps its idempotency key for a retry until the draft changes', async () => {
  const failure = Object.assign(new Error('failed'), { code: 'INTERNAL_ERROR' });
  const api = {
    get: vi.fn(async path => path.startsWith('/v1/utilities/') ? { data: patterns } : { data: { items: [] } }),
    idempotent: vi.fn().mockRejectedValueOnce(failure).mockRejectedValueOnce(failure)
      .mockResolvedValueOnce({ data: { ...savedPatternRule, version: 1 } }),
  };
  renderRoute(api, '/utilities/patterns');
  await screen.findByRole('heading', { name: patterns.name });
  fireEvent.click(screen.getByRole('button', { name: 'Alerts (Setup)' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Add alert setup' }));
  expect(screen.getByText('Assigned units and cases')).toBeInTheDocument();
  expect(screen.getByLabelText('Command Centre')).toBeChecked();
  expect(screen.getByLabelText('Crime analyst')).toBeChecked();
  expect(screen.getByLabelText('District leadership')).not.toBeChecked();

  fireEvent.click(screen.getByRole('button', { name: 'Save setup' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('could not be saved');
  fireEvent.click(screen.getByRole('button', { name: 'Save setup' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('could not be saved');
  expect(api.idempotent.mock.calls[0][2]).toBe(api.idempotent.mock.calls[1][2]);

  fireEvent.change(screen.getByLabelText('Confidence threshold'), { target: { value: '0.85' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save setup' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Alert setup saved');
  expect(api.idempotent.mock.calls[2][2]).not.toBe(api.idempotent.mock.calls[1][2]);
  expect(api.idempotent.mock.calls[2][0]).toBe('/v1/utility-alert-rules');
  expect(api.idempotent.mock.calls[2][1]).toEqual(expect.objectContaining({
    utilityKey: 'patterns', scopeUnitId: 101, thresholds: { threshold: 0.85 },
    evaluationWindowDays: 30, severity: 'HIGH', recipientRoles: ['COMMAND_CENTER', 'CRIME_ANALYST'], enabled: true,
  }));
});

test('keeps existing policy recipients unchanged when saving an edit', async () => {
  const api = {
    get: vi.fn(async path => path.startsWith('/v1/utilities/')
      ? { data: patterns }
      : { data: { items: [savedPatternRule] } }),
    patch: vi.fn(async () => ({ data: { ...savedPatternRule, version: 4 } })),
  };
  renderRoute(api, '/utilities/patterns');
  await screen.findByRole('heading', { name: patterns.name });
  fireEvent.click(screen.getByRole('button', { name: 'Alerts (Setup)' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Edit policy' }));

  expect(screen.getByLabelText('Command Centre')).not.toBeChecked();
  expect(screen.getByLabelText('District leadership')).toBeChecked();
  expect(screen.getByLabelText('Crime analyst')).toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'Save setup' }));

  expect(api.patch).toHaveBeenCalledWith('/v1/utility-alert-rules/URULE-PRIVATE', expect.objectContaining({
    recipientRoles: ['DISTRICT_LEADERSHIP', 'CRIME_ANALYST'],
  }));
});

test('reloads the latest visible revision after conflict while preserving local input', async () => {
  const conflict = Object.assign(new Error('changed'), { code: 'VERSION_CONFLICT', status: 409 });
  const latest = { ...savedPatternRule, version: 4, enabled: true };
  let listCount = 0;
  const api = {
    get: vi.fn(async path => {
      if (path.startsWith('/v1/utilities/')) return { data: patterns };
      listCount += 1;
      return { data: { items: [listCount === 1 ? savedPatternRule : latest] } };
    }),
    patch: vi.fn().mockRejectedValueOnce(conflict).mockResolvedValueOnce({ data: { ...latest, enabled: false, version: 5 } }),
  };
  renderRoute(api, '/utilities/patterns');
  await screen.findByRole('heading', { name: patterns.name });
  fireEvent.click(screen.getByRole('button', { name: 'Alerts (Setup)' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Edit policy' }));
  fireEvent.click(screen.getByLabelText('Enabled policy'));
  fireEvent.click(screen.getByRole('button', { name: 'Save setup' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('changed since you opened it');
  expect(screen.getByLabelText('Enabled policy')).not.toBeChecked();
  expect(screen.getByText('Revision 4')).toBeInTheDocument();
  expect(api.patch).toHaveBeenCalledWith('/v1/utility-alert-rules/URULE-PRIVATE', expect.objectContaining({
    expectedVersion: 3, enabled: false,
  }));
  fireEvent.click(screen.getByRole('button', { name: 'Save setup' }));
  expect(api.patch).toHaveBeenLastCalledWith('/v1/utility-alert-rules/URULE-PRIVATE', expect.objectContaining({
    expectedVersion: 4, enabled: false,
  }));
});

test('fails safely when an alert policy response contains a malformed rule', async () => {
  const api = { get: vi.fn(async path => path.startsWith('/v1/utilities/')
    ? { data: patterns }
    : { data: { items: [{ ...savedPatternRule, recipientRoles: 'CRIME_ANALYST' }] } }) };
  renderRoute(api, '/utilities/patterns');
  await screen.findByRole('heading', { name: patterns.name });
  fireEvent.click(screen.getByRole('button', { name: 'Alerts (Setup)' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded');
});

test('preserves an integer threshold contract and rejects decimal hotspot counts', async () => {
  const api = { get: vi.fn(async path => path.startsWith('/v1/utilities/') ? { data: hotspots } : { data: { items: [] } }) };
  renderRoute(api, '/utilities/hotspots');
  await screen.findByRole('heading', { name: hotspots.name });
  fireEvent.click(screen.getByRole('button', { name: 'Alerts (Setup)' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Add alert setup' }));
  const minimumCases = screen.getByLabelText('Minimum cases');
  expect(minimumCases).toHaveAttribute('step', '1');
  fireEvent.change(minimumCases, { target: { value: '2.5' } });
  expect(screen.getByRole('button', { name: 'Save setup' })).toBeDisabled();
});

test('runs a saved policy and links the first created alert without exposing its identifier', async () => {
  let resolveEvaluation;
  const evaluation = new Promise(resolve => { resolveEvaluation = resolve; });
  const api = {
    get: vi.fn(async path => path.startsWith('/v1/utilities/') ? { data: patterns } : { data: { items: [savedPatternRule] } }),
    post: vi.fn(() => evaluation),
  };
  renderRoute(api, '/utilities/patterns?persona=CRIME_ANALYST');
  await screen.findByRole('heading', { name: patterns.name });
  fireEvent.click(screen.getByRole('button', { name: 'Alerts (Setup)' }));
  const run = await screen.findByRole('button', { name: 'Run evaluation' });
  fireEvent.click(run);
  expect(run).toBeDisabled();
  expect(screen.getByText('Evaluating…')).toBeInTheDocument();
  resolveEvaluation({ data: evaluationResponse() });

  expect(await screen.findByText('12 evaluated · 2 matched · 10 suppressed')).toBeInTheDocument();
  const result = screen.getByRole('status');
  expect(result).toHaveTextContent(/published model findings were assessed against governed scope and evaluation-window rules/i);
  expect(result).toHaveTextContent(/2 findings matched the human-governed delivery qualification, while 10 were suppressed/i);
  expect(result).toHaveTextContent(/human review is required before action/i);
  expect(result).toHaveTextContent('Synthetic demonstration data');
  expect(result).not.toHaveTextContent(/confidence/i);
  expect(screen.getByRole('link', { name: 'Open alert' })).toHaveAttribute('href', '/alerts/ALT-PRIVATE?persona=CRIME_ANALYST');
  expect(screen.queryByText('ALT-PRIVATE')).not.toBeInTheDocument();
  expect(api.post).toHaveBeenCalledWith('/v1/utility-alert-rules/URULE-PRIVATE/evaluate', { expectedVersion: 3 });
});

test('shows a truthful zero-match result and disables evaluation for paused policies', async () => {
  const api = {
    get: vi.fn(async path => path.startsWith('/v1/utilities/') ? { data: patterns } : { data: { items: [savedPatternRule] } }),
    post: vi.fn(async () => ({ data: evaluationResponse({ evaluated: 8, matched: 0, suppressed: 8, created: 0, alertIds: [] }) })),
  };
  renderRoute(api, '/utilities/patterns');
  await screen.findByRole('heading', { name: patterns.name });
  fireEvent.click(screen.getByRole('button', { name: 'Alerts (Setup)' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Run evaluation' }));
  const result = await screen.findByRole('status');
  expect(result).toHaveTextContent('8 evaluated · 0 matched · 8 suppressed');
  expect(result).toHaveTextContent(/0 findings matched the human-governed delivery qualification, while 8 were suppressed/i);
  expect(screen.queryByRole('link', { name: 'Open alert' })).not.toBeInTheDocument();

  cleanup();
  const pausedApi = { get: vi.fn(async path => path.startsWith('/v1/utilities/')
    ? { data: patterns }
    : { data: { items: [{ ...savedPatternRule, enabled: false }] } }) };
  renderRoute(pausedApi, '/utilities/patterns');
  await screen.findByRole('heading', { name: patterns.name });
  fireEvent.click(screen.getByRole('button', { name: 'Alerts (Setup)' }));
  expect(screen.queryByRole('button', { name: 'Run evaluation' })).not.toBeInTheDocument();
});

test('fails evaluation safely when its response is malformed', async () => {
  const api = {
    get: vi.fn(async path => path.startsWith('/v1/utilities/') ? { data: patterns } : { data: { items: [savedPatternRule] } }),
    post: vi.fn(async () => ({ data: evaluationResponse({ evaluated: '12' }) })),
  };
  renderRoute(api, '/utilities/patterns');
  await screen.findByRole('heading', { name: patterns.name });
  fireEvent.click(screen.getByRole('button', { name: 'Alerts (Setup)' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Run evaluation' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Evaluation could not be completed');
  expect(screen.queryByText(/evaluated ·/i)).not.toBeInTheDocument();
});

test('lets station operations inspect policies without exposing management or evaluation actions', async () => {
  const stationWorkspace = { role: 'STATION_OPERATIONS', scopeUnitId: 101 };
  const api = { get: vi.fn(async path => path.startsWith('/v1/utilities/')
    ? { data: patterns }
    : { data: { items: [savedPatternRule] } }) };
  renderRoute(api, '/utilities/patterns', stationWorkspace);
  await screen.findByRole('heading', { name: patterns.name });
  fireEvent.click(screen.getByRole('button', { name: 'Alerts (Setup)' }));
  expect(await screen.findByText('Authorized station')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Edit policy' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Run evaluation' })).not.toBeInTheDocument();

  cleanup();
  const emptyApi = { get: vi.fn(async path => path.startsWith('/v1/utilities/')
    ? { data: patterns }
    : { data: { items: [] } }) };
  renderRoute(emptyApi, '/utilities/patterns', stationWorkspace);
  await screen.findByRole('heading', { name: patterns.name });
  fireEvent.click(screen.getByRole('button', { name: 'Alerts (Setup)' }));
  expect(await screen.findByText('No alert setup is configured for this utility.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Add alert setup' })).not.toBeInTheDocument();
});

test('keeps Area Attention visual-only and explains why no alert editor is available', async () => {
  const api = { get: vi.fn(async () => ({ data: areaAttention })) };
  renderRoute(api);
  await screen.findByRole('heading', { name: areaAttention.name });
  fireEvent.click(screen.getByRole('button', { name: 'Alerts (Setup)' }));

  expect(screen.getByText(/does not create alerts/i)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /add alert setup/i })).not.toBeInTheDocument();
  expect(api.get).toHaveBeenCalledTimes(1);
});
