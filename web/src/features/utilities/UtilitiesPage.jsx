import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { Busy, Failure } from '../../app/AsyncStates.jsx';
import { governedAppLocation } from '../../app/runtime.js';
import { useLoad } from '../../app/useLoad.js';
import { Icon } from '../../components/icons.jsx';
import { getCategoryLabel, getUtilityPresentation, loadUtilities } from './utility-catalog.js';

function UtilityRow({ utility, location }) {
  const presentation = getUtilityPresentation(utility.icon);
  const compactStages = [utility.stages?.[0], utility.stages?.[1], utility.stages?.[4]].filter(Boolean);
  return <article className="utilities-row">
    <div className={`utilities-icon utilities-icon--${presentation.tone}`}><Icon name={presentation.icon} /></div>
    <div className="utilities-identity">
      <h3>{utility.name}</h3>
      <p>{utility.description}</p>
    </div>
    <div className="utilities-mini-flow" aria-label={`${utility.name} summary`}>
      {compactStages.map((stage, index) => <span key={stage.stage}>
        {index > 0 ? <i aria-hidden="true">→</i> : null}<b>{stage.label}</b>
      </span>)}
    </div>
    <span className={`utilities-status${utility.availability === 'AVAILABLE' ? '' : ' utilities-status--limited'}`}>
      {utility.availability === 'AVAILABLE' ? 'Active' : 'Analysis only'}
    </span>
    <Link className="utilities-open" to={governedAppLocation(`/utilities/${utility.key}`, location)} aria-label={`Open ${utility.name}`}>
      <span aria-hidden="true">›</span>
    </Link>
  </article>;
}

export function UtilitiesPage({ api }) {
  const location = useLocation();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const state = useLoad(() => loadUtilities(api), [api]);

  if (state.loading) return <Busy label="Loading intelligence utilities…" />;
  if (state.error) return <Failure error={state.error} />;

  const utilities = Array.isArray(state.data) ? state.data : [];
  const categories = [...new Set(utilities.map(utility => utility.category).filter(Boolean))];
  const visibleUtilities = selectedCategory === 'all'
    ? utilities
    : utilities.filter(utility => utility.category === selectedCategory);
  const lifecycle = utilities[0]?.stages?.map(({ stage }) => stage) ?? ['Data', 'Analyze', 'Explain', 'Alert', 'Deliver'];

  return <section className="utilities-page utilities-catalogue">
    <header className="utilities-intro">
      <div className="utilities-intro-mark"><Icon name="utilities" size={23} /></div>
      <div><h1>Intelligence Utilities</h1><p>Independent analytical capabilities that turn governed crime data into explainable operational action.</p></div>
      <ol className="utilities-lifecycle-compact" aria-label="Utility lifecycle">
        {lifecycle.map(stage => <li key={stage}>{stage}</li>)}
      </ol>
    </header>
    <nav className="utilities-filters" aria-label="Utility categories">
      <button type="button" aria-pressed={selectedCategory === 'all'} onClick={() => setSelectedCategory('all')}>All utilities</button>
      {categories.map(category => <button key={category} type="button" aria-pressed={selectedCategory === category} onClick={() => setSelectedCategory(category)}>
        {getCategoryLabel(category)}
      </button>)}
    </nav>
    <div className="utilities-section-heading"><h2>Available utilities</h2><span>{visibleUtilities.length} configured</span></div>
    <div className="utilities-list">
      {visibleUtilities.map(utility => <UtilityRow key={utility.key} utility={utility} location={location} />)}
      {visibleUtilities.length === 0 ? <p className="utilities-empty">No utilities are configured for this category.</p> : null}
    </div>
    <p className="utilities-footnote">Open a utility to inspect its inputs, analytical logic, alert policy and outputs.</p>
  </section>;
}
