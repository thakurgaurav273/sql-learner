import type { Cell, Field } from '../api';

const NUMERIC = /^(integer|bigint|smallint|numeric|real|double precision|oid)/;

export function DataTable({ fields, rows, rowClass, startIndex = 1 }: { fields: Field[]; rows: Cell[][]; rowClass?: (i: number) => string; startIndex?: number }) {
  const numeric = fields.map((f) => NUMERIC.test(f.type));
  return (
    <table className="datatable">
      <thead>
        <tr>
          <th className="rn">#</th>
          {fields.map((f, i) => (
            <th key={i} title={`${f.name} : ${f.type}`}>
              {f.name || '?column?'}
              <span className="ty">{f.type}</span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri} className={rowClass?.(ri)}>
            <td className="rn">{ri + startIndex}</td>
            {row.map((v, ci) =>
              v === null ? (
                <td key={ci} className="null">
                  NULL
                </td>
              ) : (
                <td key={ci} className={numeric[ci] ? 'num' : ''} title={v.length > 40 ? v : undefined}>
                  {v}
                </td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
