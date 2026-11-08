import { useEffect, useRef, useState } from 'react';
import { usePlayground } from '../state';
import type { SchemaTable } from '../api';

// Always-visible database schema: tables, columns, keys and relationships.
// It refreshes automatically after statements that may change the schema.
export function SchemaPanel({ onHide }: { onHide?: () => void }) {
  const { schema, schemaError, refreshSchema, focusTable, setFocusTable } = usePlayground();
  const [filter, setFilter] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({ customers: true, orders: true });
  const refs = useRef<Record<string, HTMLDivElement | null>>({});
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    if (!focusTable) return;
    setOpen((o) => ({ ...o, [focusTable]: true }));
    setFlash(focusTable);
    setTimeout(() => refs.current[focusTable]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 30);
    const t = setTimeout(() => setFlash(null), 1300);
    setFocusTable(null);
    return () => clearTimeout(t);
  }, [focusTable, setFocusTable]);

  const f = filter.trim().toLowerCase();
  const tables = (schema?.tables ?? []).filter((t) => !f || t.name.includes(f) || t.columns.some((c) => c.name.includes(f)));

  return (
    <>
      <div className="col-head">
        Schema
        <span className="spacer" />
        <button className="btn small ghost" onClick={() => setOpen(Object.fromEntries((schema?.tables ?? []).map((t) => [t.name, true])))} title="Expand all">
          ⊞
        </button>
        <button className="btn small ghost" onClick={() => setOpen({})} title="Collapse all">
          ⊟
        </button>
        <button className="btn small ghost" onClick={() => refreshSchema()} title="Refresh">
          ↻
        </button>
        {onHide && (
          <button className="btn small ghost" onClick={onHide} title="Hide schema panel">
            »
          </button>
        )}
      </div>
      <input className="schema-search" placeholder="Filter tables / columns…" value={filter} onChange={(e) => setFilter(e.target.value)} />
      <div className="scroll">
        {schemaError && <div className="errorbox">{schemaError}</div>}
        {!schema && !schemaError && <div className="empty">Loading schema…</div>}
        {schema && schema.tables.length === 0 && (
          <div className="empty">No tables in the database. (Did you drop them all? Use Reset DB to bring them back.)</div>
        )}
        {tables.map((t) => (
          <TableEntry
            key={t.name}
            t={t}
            open={!!open[t.name] || !!f}
            flash={flash === t.name}
            setRef={(el) => (refs.current[t.name] = el)}
            toggle={() => setOpen((o) => ({ ...o, [t.name]: !o[t.name] }))}
            highlight={f}
          />
        ))}
        {schema && schema.relationships.length > 0 && !f && (
          <div className="rels">
            <h4>Relationships (foreign keys)</h4>
            {schema.relationships.map((r, i) => (
              <div key={i}>
                {r.from}.{r.columns.join(',')} <span className="arrow">→</span> {r.to}.{r.refColumns.join(',')}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="legend">
        <span>
          <span className="pk">🔑</span> primary key
        </span>
        <span>
          <span className="fk">↗</span> foreign key
        </span>
        <span>
          <b>NN</b> = NOT NULL
        </span>
      </div>
    </>
  );
}

function TableEntry({ t, open, toggle, flash, setRef, highlight }: { t: SchemaTable; open: boolean; toggle: () => void; flash: boolean; setRef: (el: HTMLDivElement | null) => void; highlight: string }) {
  const { loadSql, setFocusTable } = usePlayground();
  return (
    <div className={`tbl ${flash ? 'flash' : ''}`} ref={setRef}>
      <button className="tbl-head" onClick={toggle} title={t.comment ?? undefined}>
        <span className="chev">{open ? '▼' : '▶'}</span>
        <span className="name">{t.name}</span>
        {t.kind !== 'table' && <span className="kind">{t.kind}</span>}
        {t.rowCount !== null && <span className="rows">{t.rowCount.toLocaleString()} rows</span>}
      </button>
      {open && (
        <div className="tbl-body">
          {t.comment && <p className="tbl-comment">{t.comment}</p>}
          {t.columns.map((c) => (
            <div className="colrow" key={c.name} title={[c.comment, c.default ? `default: ${c.default}` : null].filter(Boolean).join('\n') || undefined}>
              <span className="k">{c.isPrimaryKey ? <span className="pk">🔑</span> : c.references ? <span className="fk">↗</span> : ''}</span>
              <span className="cname" style={highlight && c.name.includes(highlight) ? { background: 'var(--warn-soft)' } : undefined}>
                {c.name}
              </span>
              <span className="ctype">{c.type}</span>
              {!c.nullable && !c.isPrimaryKey && <span className="nn">NN</span>}
              {c.isUnique && <span className="nn">UQ</span>}
              {c.references && (
                <button className="ref" onClick={() => setFocusTable(c.references!.table)} title="Jump to the referenced table">
                  → {c.references.table}.{c.references.column}
                </button>
              )}
            </div>
          ))}
          {(t.checks.length > 0 || t.indexes.length > 0 || t.foreignKeys.length > 0 || t.viewDefinition) && (
            <details className="tbl-extra">
              <summary>
                constraints & indexes ({t.checks.length + t.foreignKeys.length + t.uniques.length} constraints, {t.indexes.length} indexes)
              </summary>
              {t.foreignKeys.map((fk) => (
                <code key={fk.name}>
                  {fk.name}: {fk.def}
                </code>
              ))}
              {t.checks.map((c) => (
                <code key={c.name}>
                  {c.name}: {c.def}
                </code>
              ))}
              {t.indexes.map((i) => (
                <code key={i.name}>{i.def.replace(' ON public.', ' ON ')}</code>
              ))}
              {t.viewDefinition && <code>{t.viewDefinition}</code>}
            </details>
          )}
          <div className="tbl-actions">
            <button className="btn small" onClick={() => loadSql(`SELECT *\nFROM ${t.name}\nLIMIT 100;`, { run: true })}>
              ▶ SELECT * (100 rows)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
