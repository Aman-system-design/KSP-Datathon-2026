import { describe, expect, test } from 'vitest';

import { normalizeReportDefinition } from '../../../../../src/backend/reporting/report-definition.mjs';
import { REPORT_SOURCES } from '../../../../../src/backend/reporting/semantic-sources.mjs';
import { PERSONA_DASHBOARD_TEMPLATES } from './persona-dashboard-templates.js';

describe('persona dashboard templates', () => {
  test('defines three separate dashboards with unique reports and complete layouts', () => {
    expect(PERSONA_DASHBOARD_TEMPLATES.map(value => value.name)).toEqual([
      'District Intelligence Dashboard',
      'Crime Analyst Dashboard',
      'Police Station Dashboard',
    ]);
    for (const template of PERSONA_DASHBOARD_TEMPLATES) {
      expect(template.reports.length).toBeGreaterThan(5);
      expect(template.layout).toHaveLength(template.reports.length);
      expect(new Set(template.reports.map(report => report.name)).size).toBe(template.reports.length);
    }
    expect(PERSONA_DASHBOARD_TEMPLATES[0].reports.map(value => value.name))
      .not.toEqual(PERSONA_DASHBOARD_TEMPLATES[1].reports.map(value => value.name));
  });

  test('uses only governed fields exposed by each semantic source', () => {
    const [district, analyst, station] = PERSONA_DASHBOARD_TEMPLATES;
    expect(district.reports).toHaveLength(6);
    expect(analyst.reports).toHaveLength(6);
    for (const template of PERSONA_DASHBOARD_TEMPLATES) {
      for (const report of template.reports) {
        expect(() => normalizeReportDefinition(report, REPORT_SOURCES[report.sourceKey])).not.toThrow();
      }
    }
    expect(new Set(station.reports.map(report => report.sourceKey))).toEqual(new Set(['stationCases', 'alerts']));
  });
});
