import { Bell, Boxes, ChartNoAxesColumnIncreasing, FileText, Grid2X2, House } from 'lucide-react';
export const commandCenterDestinations = Object.freeze([
  { id: 'home', label: 'Home', icon: House }, { id: 'intelligence', label: 'Intelligence', icon: ChartNoAxesColumnIncreasing },
  { id: 'alerts', label: 'Alerts', icon: Bell }, { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'utilities', label: 'Utilities', icon: Boxes },
  { id: 'dashboards', label: 'Dashboards', icon: Grid2X2 },
]);
