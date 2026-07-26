const palettes = {
  categorical: ['#2563eb', '#0891b2', '#7c3aed', '#db2777', '#d97706', '#059669'],
  risk: ['#0f766e', '#65a30d', '#d97706', '#dc2626', '#991b1b'],
  sequential: ['#dbeafe', '#93c5fd', '#3b82f6', '#1d4ed8', '#172554'],
  mapBlue: ['#eff6ff', '#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6'],
  dashboardPie: ['#2563eb', '#38bdf8', '#14b8a6', '#8b5cf6', '#6366f1', '#0ea5e9'],
  diverging: ['#1d4ed8', '#93c5fd', '#e2e8f0', '#fca5a5', '#b91c1c'],
  ksp: ['#174f78', '#367da9', '#65a9d8', '#d6a84b', '#b64145', '#0f6b64'],
};

export function reportTheme(style = {}, appearance = 'light') {
  const colors = palettes[style.palette] ?? palettes.categorical;
  const dark = appearance === 'dark';
  return {
    '--report-accent': colors[0], '--report-accent-2': colors[1],
    '--report-grid': dark ? '#24364d' : '#dbe5ef', '--report-grid-strong': dark ? '#37506d' : '#b8c9db',
    '--report-surface': dark ? '#111827' : '#ffffff', '--report-surface-soft': dark ? '#172033' : '#f7fafe',
    '--report-text': dark ? '#edf4fc' : '#14243a', '--report-muted': dark ? '#9db0c8' : '#63768d',
    '--report-track': dark ? '#1b314b' : '#e9f0f7', '--report-danger': '#f0444c', '--report-warning': '#f59e0b',
    '--report-tooltip': dark ? '#07111f' : '#10233c', '--report-focus': dark ? '#79b8ff' : '#1769aa',
  };
}

export function paletteColors(name) { return palettes[name] ?? palettes.categorical; }
