import { Bell, Boxes, ChartNoAxesColumnIncreasing, FileText, Grid2X2, House, Map, Share2 } from 'lucide-react';
export const commandCenterDestinations = Object.freeze([
  { id: 'home', label: 'Home', icon: House }, { id: 'analytics', label: 'Analytics', icon: ChartNoAxesColumnIncreasing },
  { id: 'alerts', label: 'Alerts', icon: Bell }, { id: 'map', label: 'Map', icon: Map },
  { id: 'network', label: 'Network', icon: Share2 }, { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'utilities', label: 'Utilities', icon: Boxes },
  { id: 'dashboards', label: 'Dashboards', icon: Grid2X2 },
]);
