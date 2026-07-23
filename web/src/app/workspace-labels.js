export const titleCase = value => String(value ?? '').toLowerCase().split('_')
  .map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

const roleLabels = Object.freeze({ DEMO_PRESENTER: 'KSP Intelligence' });

export const roleLabel = value => roleLabels[value] ?? titleCase(value);
