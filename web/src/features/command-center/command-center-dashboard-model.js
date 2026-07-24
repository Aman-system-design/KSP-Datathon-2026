const OVERVIEW_TAB = Object.freeze({ id: 'overview', name: 'Overview' });

export function dashboardSections(items = []) {
  const visible = Array.isArray(items) ? items : [];
  return Object.freeze({
    recent: visible.slice(0, 5),
    owned: visible.filter(item => item.relationship === 'OWNED'),
    shared: visible.filter(item => item.relationship === 'SHARED'),
    system: visible.filter(item => item.relationship === 'SYSTEM'),
  });
}

export function normalizeDashboard(value = {}) {
  const declaredTabs = Array.isArray(value.tabs) && value.tabs.length ? value.tabs : [OVERVIEW_TAB];
  const items = Array.isArray(value.items) ? value.items : [];
  return Object.freeze({
    ...value,
    items,
    tabs: declaredTabs.map(tab => Object.freeze({
      ...tab,
      items: items.filter(item => (item.tabId ?? OVERVIEW_TAB.id) === tab.id),
    })),
  });
}

export function placementStyle(item) {
  return Object.freeze({
    left: `${((item.column - 1) / 12) * 100}%`,
    width: `${(item.width / 12) * 100}%`,
    top: `${(item.row - 1) * 96}px`,
    height: `${item.height * 96}px`,
  });
}
