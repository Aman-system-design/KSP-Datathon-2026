import { deny } from './identity.mjs';

export function buildAuthorizedUnitSet({ scopeUnitId, units }) {
  if (!Array.isArray(units) || units.length === 0) deny('INVALID_UNIT_HIERARCHY');
  const byId = new Map();
  for (const unit of units) {
    if (byId.has(unit.UnitID)) deny('INVALID_UNIT_HIERARCHY');
    byId.set(unit.UnitID, unit);
  }
  if (!byId.has(scopeUnitId)) deny('INVALID_UNIT_HIERARCHY');
  for (const unit of units) {
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

  const authorized = new Set([scopeUnitId]);
  let added = true;
  while (added) {
    added = false;
    for (const unit of units) {
      if (authorized.has(unit.ParentUnit) && !authorized.has(unit.UnitID)) {
        authorized.add(unit.UnitID);
        added = true;
      }
    }
  }
  return authorized;
}

export function buildEscalationUnitSet({ scopeUnitId, units }) {
  buildAuthorizedUnitSet({ scopeUnitId, units });
  const byId = new Map(units.map(unit => [unit.UnitID, unit]));
  const result = new Set();
  let parent = byId.get(scopeUnitId).ParentUnit;
  while (parent !== null && parent !== undefined) {
    result.add(parent);
    parent = byId.get(parent).ParentUnit;
  }
  return result;
}
