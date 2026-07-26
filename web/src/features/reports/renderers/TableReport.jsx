function rowSelection(row) {
  const field = Object.hasOwn(row, 'caseId') ? 'caseId' : Object.keys(row)[0];
  return { field, value: field ? row[field] : undefined, row };
}

function rowLabel(row, index) {
  const identity = row.caseNumber ?? row.caseId;
  if (identity !== undefined && identity !== null && String(identity).trim()) return `Select case ${identity}`;
  const selection = rowSelection(row);
  return selection.field ? `Select ${selection.field} ${selection.value}` : `Select row ${index + 1}`;
}

export function TableReport({ rows, selectionRows = rows, density = 'comfortable', onSelect }) {
  const columns = [...new Set(rows.flatMap(row => Object.keys(row)))];
  const interactive = typeof onSelect === 'function';
  return <div aria-label="table report visualization" className={`report-table-wrap report-table-wrap--${density}`} data-testid="report-table">
    <table className="report-table">
      <thead><tr>{interactive ? <th>Action</th> : null}{columns.map(column => <th key={column}>{column.replaceAll('_', ' ')}</th>)}</tr></thead>
      <tbody>{rows.map((row, index) => {
        const sourceRow = selectionRows[index] ?? row;
        return <tr key={index}>
          {interactive ? <td><button type="button" aria-label={rowLabel(sourceRow, index)} onClick={() => onSelect(rowSelection(sourceRow))}>Open</button></td> : null}
          {columns.map(column => <td key={column}>{row[column] ?? '\u2014'}</td>)}
        </tr>;
      })}</tbody>
    </table>
  </div>;
}
