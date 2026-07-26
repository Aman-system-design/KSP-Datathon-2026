function rowSelection(row, selectionField) {
  const field = Object.hasOwn(row, 'caseId') ? 'caseId' : selectionField ?? Object.keys(row)[0];
  return { field, value: field ? row[field] : undefined, row };
}

function actionLabel(row, index, selectionField) {
  const caseIdentity = row.caseNumber ?? row.caseId;
  if (Object.hasOwn(row, 'caseId') && caseIdentity !== undefined && caseIdentity !== null && String(caseIdentity).trim()) {
    return `Open case ${caseIdentity}`;
  }
  const selection = rowSelection(row, selectionField);
  return selection.field ? `Select ${selection.value}` : `Select row ${index + 1}`;
}

export function TableReport({ rows, selectionRows = rows, selectionField, density = 'comfortable', onSelect }) {
  const columns = [...new Set(rows.flatMap(row => Object.keys(row)))];
  const interactive = typeof onSelect === 'function';
  return <div aria-label="table report visualization" className={`report-table-wrap report-table-wrap--${density}`} data-testid="report-table">
    <table className="report-table">
      <thead><tr>{interactive ? <th>Action</th> : null}{columns.map(column => <th key={column}>{column.replaceAll('_', ' ')}</th>)}</tr></thead>
      <tbody>{rows.map((row, index) => {
        const sourceRow = selectionRows[index] ?? row;
        const label = actionLabel(sourceRow, index, selectionField);
        return <tr key={index}>
          {interactive ? <td><button type="button" onClick={() => onSelect(rowSelection(sourceRow, selectionField))}>{label}</button></td> : null}
          {columns.map(column => <td key={column}>{row[column] ?? '\u2014'}</td>)}
        </tr>;
      })}</tbody>
    </table>
  </div>;
}
