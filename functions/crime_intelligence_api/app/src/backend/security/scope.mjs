import { deny } from './identity.mjs';

const unitId = value => {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < 1) deny('INVALID_UNIT_HIERARCHY');
  return normalized;
};

export function buildAuthorizedUnitSet({ scopeUnitId, units }) {
  if (!Array.isArray(units) || units.length === 0) deny('INVALID_UNIT_HIERARCHY');
  const normalizedScopeUnitId = unitId(scopeUnitId);
  const normalizedUnits = units.map(unit => ({
    ...unit,
    UnitID: unitId(unit.UnitID),
    ParentUnit: unit.ParentUnit === null || unit.ParentUnit === undefined ? null : unitId(unit.ParentUnit),
  }));
  const byId = new Map();
  for (const unit of normalizedUnits) {
    if (byId.has(unit.UnitID)) deny('INVALID_UNIT_HIERARCHY');
    byId.set(unit.UnitID, unit);
  }
  if (!byId.has(normalizedScopeUnitId)) deny('INVALID_UNIT_HIERARCHY');
  for (const unit of normalizedUnits) {
    if (unit.ParentUnit !== null && unit.ParentUnit !== undefined && !byId.has(unit.ParentUnit)) {
      deny('INVALID_UNIT_HIERARCHY');
    }
  }

  const visiting = new Set();
  const visited = new Set();
  const visit = (unitId) => {
    if (visiting.has(unitId)) deny('INVALID_UNIT_HIERARCHY');
    if (visited.has(unitId)) return;
    visiting.add(unitId);
    const parent = byId.get(unitId).ParentUnit;
    if (parent !== null && parent !== undefined) visit(parent);
    visiting.delete(unitId);
    visited.add(unitId);
  };
  for (const unitId of byId.keys()) visit(unitId);

  const authorized = new Set([normalizedScopeUnitId]);
  let added = true;
  while (added) {
    added = false;
    for (const unit of normalizedUnits) {
      if (authorized.has(unit.ParentUnit) && !authorized.has(unit.UnitID)) {
        authorized.add(unit.UnitID);
        added = true;
      }
    }
  }
  return authorized;
}

export function buildEscalationUnitSet({ scopeUnitId, units }) {
  const normalizedScopeUnitId = unitId(scopeUnitId);
  buildAuthorizedUnitSet({ scopeUnitId: normalizedScopeUnitId, units });
  const byId = new Map(units.map(unit => {
    const normalizedUnitId = unitId(unit.UnitID);
    const parentUnit = unit.ParentUnit === null || unit.ParentUnit === undefined ? null : unitId(unit.ParentUnit);
    return [normalizedUnitId, { ...unit, UnitID: normalizedUnitId, ParentUnit: parentUnit }];
  }));
  const result = new Set();
  let parent = byId.get(normalizedScopeUnitId).ParentUnit;
  while (parent !== null && parent !== undefined) {
    result.add(parent);
    parent = byId.get(parent).ParentUnit;
  }
  return result;
}
