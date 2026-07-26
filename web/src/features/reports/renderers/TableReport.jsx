export function TableReport({ rows, density = 'comfortable' }) {
  const columns = [...new Set(rows.flatMap(row => Object.keys(row)))];
  return <div aria-label="table report visualization" className={`report-table-wrap report-table-wrap--${density}`} data-testid="report-table"><table className="report-table"><thead><tr>{columns.map(column => <th key={column}>{column.replaceAll('_', ' ')}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{columns.map(column => <td key={column}>{row[column] ?? '—'}</td>)}</tr>)}</tbody></table></div>;
}
