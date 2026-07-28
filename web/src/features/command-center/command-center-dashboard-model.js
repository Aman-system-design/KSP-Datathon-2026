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

const isGridPlacement = item => Number.isInteger(item?.column)
  && item.column >= 1
  && Number.isInteger(item?.row)
  && item.row >= 1
  && Number.isInteger(item?.width)
  && item.width >= 1
  && item.width <= 12
  && Number.isInteger(item?.height)
  && item.height >= 1
  && item.column + item.width <= 13;

export function compactDashboardItems(items = []) {
  if (!Array.isArray(items) || items.some(item => !isGridPlacement(item))) {
    return Array.isArray(items) ? items.map(item => ({ ...item })) : [];
  }

  const ordered = items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => left.item.row - right.item.row
      || left.item.column - right.item.column
      || left.index - right.index);
  const occupied = new Set();
  const fits = (row, column, width, height) => {
    if (column + width > 13) return false;
    for (let y = row; y < row + height; y += 1) {
      for (let x = column; x < column + width; x += 1) {
        if (occupied.has(`${x}:${y}`)) return false;
      }
    }
    return true;
  };
  const reserve = (row, column, width, height) => {
    for (let y = row; y < row + height; y += 1) {
      for (let x = column; x < column + width; x += 1) occupied.add(`${x}:${y}`);
    }
  };

  return ordered.map(({ item }) => {
    for (let row = 1; ; row += 1) {
      for (let column = 1; column <= 13 - item.width; column += 1) {
        if (!fits(row, column, item.width, item.height)) continue;
        reserve(row, column, item.width, item.height);
        return { ...item, column, row };
      }
    }
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
