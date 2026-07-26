const DISTRICT_CODES = Object.freeze([
  'KA-524', 'KA-528', 'KA-527', 'KA-526', 'KA-525', 'KA-529', 'KA-531', 'KA-630',
  'KA-532', 'KA-533', 'KA-534', 'KA-535', 'KA-536', 'KA-537', 'KA-539', 'KA-540',
  'KA-538', 'KA-541', 'KA-542', 'KA-543', 'KA-544', 'KA-545', 'KA-546', 'KA-631',
  'KA-547', 'KA-548', 'KA-549', 'KA-550', 'KA-738', 'KA-530', 'KA-635',
]);

const DISTRICT_COUNTS = Object.freeze([
  322, 296, 286, 276, 266, 256, 246, 237, 227, 217, 207, 197, 187, 177, 167, 158,
  148, 138, 128, 118, 108, 98, 88, 79, 69, 59, 49, 39, 29, 19, 9,
]);

const RESULTS = Object.freeze({
  'Statewide FIR Volume': Object.freeze([{ RecordCount_sum: 4900 }]),
  'Crime Category Share': Object.freeze([
    { CrimeMajorHeadName: 'Synthetic Property Crime', RecordCount_sum: 2470 },
    { CrimeMajorHeadName: 'Synthetic Public Order', RecordCount_sum: 1458 },
    { CrimeMajorHeadName: 'Synthetic Cyber Crime', RecordCount_sum: 972 },
  ]),
  'Top Reported Crime Types': Object.freeze([
    { CrimeMinorHeadName: 'Synthetic Vehicle Theft', RecordCount_sum: 1470 },
    { CrimeMinorHeadName: 'Synthetic Public Order', RecordCount_sum: 1458 },
    { CrimeMinorHeadName: 'Synthetic Burglary', RecordCount_sum: 1000 },
    { CrimeMinorHeadName: 'Synthetic Payment Fraud', RecordCount_sum: 972 },
  ]),
  'Case Lifecycle Funnel': Object.freeze([
    { CaseStatusLabel: 'Synthetic Under Investigation', RecordCount_sum: 3920 },
    { CaseStatusLabel: 'Synthetic Chargesheet Filed', RecordCount_sum: 980 },
  ]),
  '24-Hour Crime Pattern': Object.freeze(Array.from({ length: 24 }, (_, hour) => ({
    IncidentHour: hour,
    RecordCount_sum: [92, 78, 69, 61, 58, 72, 110, 154, 206, 238, 251, 263, 272, 281, 275, 268, 257, 246, 232, 224, 216, 199, 173, 125][hour],
  }))),
  'District FIR Ranking': Object.freeze(DISTRICT_CODES.slice(0, 12).map((DistrictCode, index) => ({ DistrictCode, RecordCount_sum: DISTRICT_COUNTS[index] }))),
  'Hourly FIR Demand': Object.freeze(Array.from({ length: 24 }, (_, hour) => ({ IncidentHour: hour, RecordCount_sum: [92, 78, 69, 61, 58, 72, 110, 154, 206, 238, 251, 263, 272, 281, 275, 268, 257, 246, 232, 224, 216, 199, 173, 125][hour] }))),
  'Case Status Distribution': Object.freeze([
    { CaseStatusLabel: 'Under Investigation', RecordCount_sum: 3920 },
    { CaseStatusLabel: 'Chargesheet Filed', RecordCount_sum: 980 },
  ]),
  'Major Crime Comparison': Object.freeze([
    { CrimeMajorHeadName: 'Property Crime', RecordCount_sum: 2470 },
    { CrimeMajorHeadName: 'Public Order', RecordCount_sum: 1458 },
    { CrimeMajorHeadName: 'Cyber Crime', RecordCount_sum: 972 },
  ]),
  'Monthly FIR Trend': Object.freeze([
    { IncidentMonth: '2026-01', RecordCount_sum: 712 }, { IncidentMonth: '2026-02', RecordCount_sum: 748 },
    { IncidentMonth: '2026-03', RecordCount_sum: 781 }, { IncidentMonth: '2026-04', RecordCount_sum: 824 },
    { IncidentMonth: '2026-05', RecordCount_sum: 879 }, { IncidentMonth: '2026-06', RecordCount_sum: 956 },
  ]),
  'District FIR Concentration': Object.freeze(['Bengaluru City', 'Mysuru', 'Belagavi', 'Tumakuru', 'Dakshina Kannada', 'Kalaburagi', 'Ballari', 'Shivamogga', 'Dharwad', 'Hassan'].map((DistrictName, index) => ({ DistrictName, RecordCount_sum: DISTRICT_COUNTS[index] }))),
  'Police Station Load Concentration': Object.freeze(['Central', 'Market', 'City', 'Traffic East', 'Women', 'Cyber Crime', 'Rural', 'North', 'South', 'Railway'].map((name, index) => ({ PoliceStationName: `Synthetic ${name} Police Station`, RecordCount_sum: [184, 171, 163, 151, 143, 136, 128, 119, 111, 103][index], IsSynthetic: true }))),
  'Crime Category Mix': Object.freeze([
    { CrimeMajorHeadName: 'Synthetic Property Crime', RecordCount_sum: 2470 },
    { CrimeMajorHeadName: 'Synthetic Public Order', RecordCount_sum: 1458 },
    { CrimeMajorHeadName: 'Synthetic Cyber Crime', RecordCount_sum: 972 },
  ]),
  'Case Lifecycle': Object.freeze([
    { CaseStatusLabel: 'Synthetic Under Investigation', RecordCount_sum: 3920 },
    { CaseStatusLabel: 'Synthetic Chargesheet Filed', RecordCount_sum: 980 },
  ]),
});

const DISTRICT_ROWS = Object.freeze(DISTRICT_CODES.map((DistrictCode, index) => Object.freeze({
  DistrictCode,
  RecordCount_sum: DISTRICT_COUNTS[index],
})));

export function submissionSyntheticRows(reportName) {
  const rows = reportName === 'FIRs by Karnataka District' ? DISTRICT_ROWS : RESULTS[reportName];
  return rows ? rows.map(row => ({ ...row })) : [];
}
