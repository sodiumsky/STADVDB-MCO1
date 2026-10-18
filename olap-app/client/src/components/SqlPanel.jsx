// Shows exactly what was sent to MySQL. Open by default only when there is nothing else to see.
export default function SqlPanel({ data }) {
  if (!data) return null;
  const hasSql = Boolean(data.sql);

  return (
    <details className="sql-panel">
      <summary>SQL and parameters used</summary>
      <div className="sql-body">
        <dl className="sql-meta">
          <dt>Query entry</dt>
          <dd><code>{data.key}</code></dd>
        </dl>

        <h3>SQL</h3>
        {hasSql ? <pre className="sql-code"><code>{data.sql}</code></pre> : <p className="muted">No SQL yet. This entry is empty.</p>}

        <h3>Parameters</h3>
        {data.paramNames && data.paramNames.length > 0 ? (
          <table className="param-table">
            <thead>
              <tr><th scope="col">Position</th><th scope="col">Name</th><th scope="col">Value given</th></tr>
            </thead>
            <tbody>
              {data.paramNames.map((p, i) => (
                <tr key={`${p.name}-${i}`}>
                  <td>{i + 1}</td>
                  <td>{p.name}</td>
                  <td><code>{JSON.stringify(p.value)}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">This entry lists no parameters.</p>
        )}

        {hasSql && (
          <>
            <h3>Values bound to the ? placeholders</h3>
            <pre className="sql-code"><code>{JSON.stringify(data.params)}</code></pre>
          </>
        )}
      </div>
    </details>
  );
}
