# Utility Alerts Setup MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename and clarify the existing utility alert-rule experience as “Alerts (Setup)” across supported personas without changing any backend behavior, authorization, or stored data.

**Architecture:** Keep `UtilityPage` and its existing `AlertPolicy`/`PolicyForm` flow as the single owner of utility alert setup. Add one small presentational overview inside the existing alert section, update visible terminology in place, and style it only through the existing utility policy stylesheet. All API calls, data contracts, permissions, manual evaluation, and alert navigation remain unchanged.

**Tech Stack:** React 19, React Router, Vitest, Testing Library, CSS, Vite

---

## File map

- Modify `web/src/features/utilities/UtilityPage.jsx`: terminology, compact setup explanation, and existing form/action copy.
- Modify `web/src/features/utilities/utility-policy.css`: compact three-step explanation layout and responsive behavior.
- Modify `web/src/features/utilities/UtilityPage.test.jsx`: terminology, persona visibility, unavailable state, behavior regression, and CSS contract tests.
- No backend, Function, schema, report, dashboard, authentication, or API files change.

### Task 1: Lock the Alerts (Setup) language and behavior contract

**Files:**
- Modify: `web/src/features/utilities/UtilityPage.test.jsx`
- Modify: `web/src/features/utilities/UtilityPage.jsx`

- [ ] **Step 1: Write the failing terminology and explanation test**

Add this test after the progressive-disclosure test:

```jsx
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
```

Update existing test queries and expected copy in the same file using these exact mappings:

```text
Alert Policy       -> Alerts (Setup)
Alert policies     -> Alert setups
Add alert policy   -> Add alert setup
Edit alert policy  -> Edit alert setup
New alert policy   -> New alert setup
Save policy        -> Save setup
Policy saved.      -> Alert setup saved.
```

- [ ] **Step 2: Run the focused test and confirm it fails before implementation**

Run:

```powershell
npm.cmd run web:test -- UtilityPage.test.jsx
```

Expected: FAIL because the `Alerts (Setup)` button and Monitor/Route/Human action explanation do not exist yet.

- [ ] **Step 3: Add the minimal overview and rename visible controls**

Add this presentational component above `AlertPolicy` in `UtilityPage.jsx`:

```jsx
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
```

Render it inside the existing alert section before `AiAssistedDetection`:

```jsx
{activePanel === 'alert-policy' ? <section id="alert-policy" role="region" aria-labelledby="alert-policy-tab">
  <h2>Alerts (Setup)</h2>
  <AlertSetupOverview />
  {utility.aiAssistance ? <AiAssistedDetection aiAssistance={utility.aiAssistance} /> : null}
  <AlertPolicy utility={utility} api={api} workspace={workspace} location={location} />
</section> : null}
```

Change the existing navigation button to:

```jsx
<button id="alert-policy-tab" type="button" aria-label="Alerts (Setup)" aria-expanded={activePanel === 'alert-policy'} aria-controls="alert-policy" onClick={() => setActivePanel(current => current === 'alert-policy' ? null : 'alert-policy')}>
  <Icon name="alerts" />
  <span><b>Alerts (Setup)</b><small>Configure monitoring and routing</small></span>
</button>
```

Apply the exact text mappings from Step 1 to form headings, buttons, success messages, list headings, and empty-state copy. Keep route paths, API calls, variables, component names, and backend payloads unchanged.

- [ ] **Step 4: Run the focused utility tests**

Run:

```powershell
npm.cmd run web:test -- UtilityPage.test.jsx
```

Expected: PASS with all utility page tests green.

- [ ] **Step 5: Commit the terminology and behavior slice**

```powershell
git add -- web/src/features/utilities/UtilityPage.jsx web/src/features/utilities/UtilityPage.test.jsx
git commit -m "feat(utilities): present alert rules as setup"
```

### Task 2: Add compact responsive setup-flow styling

**Files:**
- Modify: `web/src/features/utilities/UtilityPage.test.jsx`
- Modify: `web/src/features/utilities/utility-policy.css`

- [ ] **Step 1: Write the failing CSS contract test**

Add beside the existing typography CSS test:

```jsx
test('keeps the alert setup explanation compact and responsive', () => {
  expect(policyCss).toMatch(/\.utilities-alert-setup-overview\s*\{[^}]*border-left:\s*3px solid #2468b4/s);
  expect(policyCss).toMatch(/\.utilities-alert-setup-overview ol\s*\{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/s);
  expect(policyCss).toMatch(/@media \(max-width: 760px\)[\s\S]*\.utilities-alert-setup-overview ol\s*\{[^}]*grid-template-columns:\s*1fr/s);
});
```

- [ ] **Step 2: Run the focused test and confirm the CSS contract fails**

Run:

```powershell
npm.cmd run web:test -- UtilityPage.test.jsx
```

Expected: FAIL because `.utilities-alert-setup-overview` is not styled.

- [ ] **Step 3: Add the minimal styles to `utility-policy.css`**

Insert after `.utilities-ai-assistance p`:

```css
.utilities-alert-setup-overview {
  display: grid;
  gap: 12px;
  padding: 13px 15px;
  margin: 0 0 16px;
  background: #f5f9fd;
  border: 1px solid #d7e4ef;
  border-left: 3px solid #2468b4;
  border-radius: 6px;
}

.utilities-alert-setup-overview p {
  max-width: 760px;
  margin: 0;
  color: #536981;
  font-size: 12px;
  line-height: 1.45;
}

.utilities-alert-setup-overview ol {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 9px;
  padding: 0;
  margin: 0;
  list-style: none;
}

.utilities-alert-setup-overview li {
  display: grid;
  gap: 3px;
  padding: 9px 10px;
  background: white;
  border: 1px solid #dce6ef;
  border-radius: 5px;
}

.utilities-alert-setup-overview span {
  color: #657990;
  font-size: 9px;
  font-weight: 750;
  letter-spacing: .05em;
  text-transform: uppercase;
}

.utilities-alert-setup-overview strong { color: #173452; font-size: 11px; }
```

Add inside the existing `@media (max-width: 760px)` block:

```css
.utilities-alert-setup-overview ol { grid-template-columns: 1fr; }
```

Add `.utilities-alert-setup-overview *` to the existing reduced-motion selector without changing its behavior.

- [ ] **Step 4: Run the focused utility tests**

Run:

```powershell
npm.cmd run web:test -- UtilityPage.test.jsx
```

Expected: PASS.

- [ ] **Step 5: Commit the responsive styling slice**

```powershell
git add -- web/src/features/utilities/utility-policy.css web/src/features/utilities/UtilityPage.test.jsx
git commit -m "style(utilities): clarify alert setup flow"
```

### Task 3: Prove persona consistency and preserve existing behavior

**Files:**
- Modify: `web/src/features/utilities/UtilityPage.test.jsx`

- [ ] **Step 1: Add a persona visibility regression test**

Add the following test using the existing `renderRoute` helper:

```jsx
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
```

This uses Area Attention deliberately: it proves consistent setup visibility across personas without invoking rule-management permissions or creating data.

- [ ] **Step 2: Run the focused utility tests**

Run:

```powershell
npm.cmd run web:test -- UtilityPage.test.jsx
```

Expected: PASS, including existing create, retry, optimistic-version, evaluation, recipient, malformed-response, and unavailable-state tests.

- [ ] **Step 3: Run the full frontend suite and production build**

Run:

```powershell
npm.cmd run web:test
npm.cmd run web:build
```

Expected: all frontend test files pass; Vite production build and bundle-budget check pass.

- [ ] **Step 4: Inspect the final diff boundary**

Run:

```powershell
git diff --check
git status --short
git diff --stat origin/main...HEAD
```

Expected: only the approved spec/plan plus `UtilityPage.jsx`, `UtilityPage.test.jsx`, and `utility-policy.css` are changed; no backend, Function, report, dashboard, schema, authentication, or generated deployment file appears.

- [ ] **Step 5: Commit the persona regression coverage**

```powershell
git add -- web/src/features/utilities/UtilityPage.test.jsx
git commit -m "test(utilities): cover alert setup across personas"
```

### Task 4: Browser acceptance before any deployment

**Files:**
- Verify only; do not modify application files.

- [ ] **Step 1: Start the existing local frontend from the isolated worktree**

Run:

```powershell
npm.cmd run dev --workspace web -- --host 127.0.0.1 --port 5181
```

Expected: Vite serves the application on `http://127.0.0.1:5181`.

- [ ] **Step 2: Verify the active utility experience**

Open:

```text
http://127.0.0.1:5181/utilities/patterns?persona=COMMAND_CENTER
```

Verify the visible button and section say **Alerts (Setup)**; the section shows Monitor, Route and Human action; existing setup controls remain intact where the authenticated local environment permits them; no 24/7, continuous or real-time claim appears.

- [ ] **Step 3: Verify the honest unavailable experience**

Open:

```text
http://127.0.0.1:5181/utilities/area-attention?persona=CRIME_ANALYST
```

Verify **Alerts (Setup)** is visible and opening it shows the existing Area Attention unavailable message without an Add/Save/Run control.

- [ ] **Step 4: Verify representative responsive behavior**

At desktop width and at or below 760px, confirm the explanation uses three columns on desktop and one column on narrow screens, with no horizontal scrolling or clipped actions.

- [ ] **Step 5: Stop and report the tested commit**

Do not push or deploy as part of implementation unless the user separately approves the exact GitHub push and the Slate-only Catalyst Development deployment. Report test totals, build result, browser routes, changed files, current commit, and rollback commit.
