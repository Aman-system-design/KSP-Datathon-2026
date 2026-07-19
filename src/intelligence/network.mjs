export function buildEvidenceGraph(features) {
  const nodes = new Map();
  const edges = [];
  const addNode = (id, type) => nodes.set(id, { id, type, synthetic: true });

  for (const row of features) {
    addNode(row.caseId, 'CASE');
    const people = row.accused.map(accused => {
      const personId = accused.personId ? `PERSON:${accused.personId}` : `APPEARANCE:${accused.appearanceId}`;
      addNode(personId, accused.personId ? 'PERSON' : 'APPEARANCE');
      edges.push({
        from: row.caseId,
        to: personId,
        type: 'CASE_HAS_ACCUSED',
        evidenceType: accused.personId ? 'SOURCE_PERSON_ID' : 'SOURCE_APPEARANCE',
        sourceCaseId: row.caseId,
        confidence: accused.personId ? 1 : 0.5,
        synthetic: true,
      });
      return personId;
    });
    for (let left = 0; left < people.length; left += 1) {
      for (let right = left + 1; right < people.length; right += 1) {
        edges.push({
          from: people[left],
          to: people[right],
          type: 'PERSON_CO_ACCUSED',
          evidenceType: 'SOURCE_CO_APPEARANCE',
          sourceCaseId: row.caseId,
          confidence: 1,
          synthetic: true,
        });
      }
    }
  }
  return { nodes: [...nodes.values()], edges };
}

export function connectedCaseComponents(graph) {
  const adjacency = new Map(graph.nodes.map(node => [node.id, new Set()]));
  const nodeType = new Map(graph.nodes.map(node => [node.id, node.type]));
  for (const edge of graph.edges) {
    adjacency.get(edge.from).add(edge.to);
    adjacency.get(edge.to).add(edge.from);
  }
  const visited = new Set();
  const components = [];
  for (const node of graph.nodes.filter(item => item.type === 'CASE')) {
    if (visited.has(node.id)) continue;
    const queue = [node.id];
    const caseIds = [];
    while (queue.length) {
      const current = queue.shift();
      if (visited.has(current)) continue;
      visited.add(current);
      if (nodeType.get(current) === 'CASE') caseIds.push(current);
      for (const next of adjacency.get(current) ?? []) if (!visited.has(next)) queue.push(next);
    }
    if (caseIds.length > 1) components.push(caseIds.sort());
  }
  return components.sort((a, b) => a[0].localeCompare(b[0]));
}
