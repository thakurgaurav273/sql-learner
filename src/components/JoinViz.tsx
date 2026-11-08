import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { JoinType, JoinVizConfig, VizTable, VizValue } from '../content/types';
import { highlightSql } from '../lib/highlight';
import { usePlayground } from '../state';

// Interactive picture of how a join combines rows: left table, right table
// (with lines between matching rows) and the result, side by side. You can
// switch the join type, hover rows to see where they came from, and step
// through the algorithm one left row at a time.

type Pair = { l: number | null; r: number | null; rejected?: boolean };
type Step = { l: number | null; rs: number[]; from: number; to: number; msg: string };

const TYPE_LABEL: Record<JoinType, string> = {
  concept: 'Concept: all pairs + filter',
  inner: 'INNER',
  left: 'LEFT',
  right: 'RIGHT',
  full: 'FULL',
  cross: 'CROSS',
  anti: 'LEFT … IS NULL (anti)',
};

const colIndex = (t: VizTable, c?: string) => (c ? t.columns.indexOf(c) : -1);
const show = (v: VizValue) => (v === null ? 'NULL' : String(v));
const sqlLit = (v: VizValue) => (v === null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);

function rowLabel(t: VizTable & { labelColumn?: string; labelPrefix?: string }, i: number) {
  const row = t.rows[i];
  const textIdx = t.labelColumn ? t.columns.indexOf(t.labelColumn) : row.findIndex((v) => typeof v === 'string');
  if (textIdx >= 0) return `${t.labelPrefix ?? ''}${show(row[textIdx])}`;
  return `${t.name} row ${show(row[0])}`;
}
const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

function compute(cfg: JoinVizConfig, type: JoinType) {
  const { left, right } = cfg;
  const lk = colIndex(left, left.key);
  const rk = colIndex(right, right.key);
  const matchesOf = (li: number) =>
    right.rows
      .map((_, ri) => ri)
      .filter((ri) => {
        if (lk < 0 || rk < 0) return false;
        const a = left.rows[li][lk];
        const b = right.rows[ri][rk];
        return a !== null && b !== null && a === b;
      });

  const pairs: Pair[] = [];
  const steps: Step[] = [];
  const rightMatched = new Set<number>();
  const R = right.rows.length;
  const L = left.rows.length;
  const lName = rowLabel.bind(null, left);
  const rName = rowLabel.bind(null, right);

  for (let li = 0; li < L; li++) {
    const from = pairs.length;
    const label = `<b>${lName(li)}</b>`;
    if (type === 'cross') {
      for (let ri = 0; ri < R; ri++) pairs.push({ l: li, r: ri });
      steps.push({ l: li, rs: right.rows.map((_, i) => i), from, to: pairs.length, msg: `${label} is paired with all ${R} rows of ${right.name} (no condition).` });
      continue;
    }
    const ms = matchesOf(li);
    ms.forEach((ri) => rightMatched.add(ri));
    const keyNull = left.rows[li][lk] === null;
    if (type === 'concept') {
      for (let ri = 0; ri < R; ri++) pairs.push({ l: li, r: ri, rejected: !ms.includes(ri) });
      steps.push({
        l: li,
        rs: ms,
        from,
        to: pairs.length,
        msg: `${label} is paired with every ${right.name} row (${R} pairs); the ON condition is true for ${ms.length} of them, the rest are thrown away.`,
      });
      continue;
    }
    if (type !== 'anti') ms.forEach((ri) => pairs.push({ l: li, r: ri }));
    let msg: string;
    if (ms.length) {
      msg =
        type === 'anti'
          ? `${label} has ${ms.length} match(es), so after the LEFT JOIN its ${right.alias}.${right.key} is not NULL - the WHERE clause removes it.`
          : `${label} matches ${ms.length} row(s) in ${right.name} (${list(ms.map(rName))}) → ${ms.length} result row(s).`;
    } else {
      const why = keyNull ? ` (its ${left.key} is NULL, and NULL never equals anything)` : '';
      if (type === 'left' || type === 'full' || type === 'anti') {
        pairs.push({ l: li, r: null });
        msg =
          type === 'anti'
            ? `${label} has no match${why} → kept: this is exactly what the anti-join looks for.`
            : `${label} has no match${why} → kept anyway, with NULL in every ${right.name} column.`;
      } else msg = `${label} has no match${why} → dropped.`;
    }
    steps.push({ l: li, rs: ms, from, to: pairs.length, msg });
  }
  if (type === 'right' || type === 'full') {
    const unmatched = right.rows.map((_, i) => i).filter((ri) => !rightMatched.has(ri));
    const from = pairs.length;
    unmatched.forEach((ri) => pairs.push({ l: null, r: ri }));
    steps.push({
      l: null,
      rs: unmatched,
      from,
      to: pairs.length,
      msg: unmatched.length
        ? `Finally, ${right.name} rows that matched nothing (${list(unmatched.map((i) => `<b>${rName(i)}</b>`))}) are added with NULL in every ${left.name} column.`
        : `Every ${right.name} row matched something, so nothing extra is added.`,
    });
  }
  return { pairs, steps, rightMatched, matchesOf };
}

function explain(cfg: JoinVizConfig, type: JoinType, pairs: Pair[], matchesOf: (li: number) => number[], rightMatched: Set<number>) {
  const { left, right } = cfg;
  const L = left.rows.length;
  const R = right.rows.length;
  const unmatchedL = left.rows.map((_, i) => i).filter((i) => matchesOf(i).length === 0).map((i) => rowLabel(left, i));
  const unmatchedR = right.rows.map((_, i) => i).filter((i) => !rightMatched.has(i)).map((i) => rowLabel(right, i));
  const multi = left.rows.map((_, i) => [i, matchesOf(i).length] as const).filter(([, n]) => n > 1);
  const parts: string[] = [];
  const rk = colIndex(right, right.key);
  const nullRight = right.rows.map((_, i) => i).filter((i) => rk >= 0 && right.rows[i][rk] === null);

  switch (type) {
    case 'concept':
      parts.push(`Think of a join as: build <b>every possible pair</b> (${L} × ${R} = ${L * R}), then keep the pairs where the ON condition is true (<b>${pairs.filter((p) => !p.rejected).length}</b> kept; struck-through pairs are rejected). That is exactly an INNER JOIN. Postgres never really builds all pairs - it uses smarter algorithms (see the <i>Join algorithms</i> lesson) - but the result is identical.`);
      break;
    case 'inner':
      parts.push(`<b>INNER JOIN</b> keeps only the pairs where the ON condition is true.`);
      if (unmatchedL.length) parts.push(`${list(unmatchedL)} (no match in ${right.name}) ${unmatchedL.length > 1 ? 'are' : 'is'} dropped.`);
      if (unmatchedR.length) parts.push(`${list(unmatchedR)} (no match in ${left.name}) ${unmatchedR.length > 1 ? 'are' : 'is'} dropped too.`);
      break;
    case 'left':
      parts.push(`<b>LEFT JOIN</b> keeps <b>every</b> row of the left table (${left.name}).`);
      if (unmatchedL.length) parts.push(`${list(unmatchedL)} had no match, so the ${right.name} columns are filled with NULL.`);
      if (unmatchedR.length) parts.push(`Unmatched rows of the right table (${list(unmatchedR)}) are still dropped.`);
      break;
    case 'right':
      parts.push(`<b>RIGHT JOIN</b> keeps <b>every</b> row of the right table (${right.name}).`);
      if (unmatchedR.length) parts.push(`${list(unmatchedR)} had no match, so the ${left.name} columns are NULL.`);
      if (unmatchedL.length) parts.push(`Unmatched left rows (${list(unmatchedL)}) are dropped. A RIGHT JOIN is just a LEFT JOIN with the tables swapped.`);
      break;
    case 'full':
      parts.push(`<b>FULL OUTER JOIN</b> keeps every row from <b>both</b> tables: matched pairs, plus unmatched rows from either side padded with NULLs.`);
      if (unmatchedL.length || unmatchedR.length) parts.push(`Unmatched: ${list([...unmatchedL, ...unmatchedR])}.`);
      break;
    case 'cross':
      parts.push(`<b>CROSS JOIN</b> has no condition: every row is paired with every row, ${L} × ${R} = <b>${L * R}</b> rows. Useful for generating combinations; dangerous on big tables.`);
      break;
    case 'anti':
      parts.push(`LEFT JOIN, then <code>WHERE ${right.alias}.${right.key} IS NULL</code> keeps only the rows that found <b>no</b> match: ${list(unmatchedL) || 'none'}. This "anti-join" answers questions like <i>"which customers have never ordered?"</i> (same as NOT EXISTS).`);
      break;
  }
  if (type !== 'cross' && type !== 'anti') {
    for (const [li, n] of multi) parts.push(`${rowLabel(left, li)} appears ${n} times: a row is repeated once for every match.`);
    if (nullRight.length && !cfg.selfJoin) parts.push(`${list(nullRight.map((i) => rowLabel(right, i)))} has ${right.key} = NULL. <code>NULL = 1</code> is not true (it is <i>unknown</i>), so a NULL key never matches.`);
  }
  return parts;
}

function buildSql(cfg: JoinVizConfig, type: JoinType) {
  const { left, right } = cfg;
  const on = `${left.alias}.${left.key} = ${right.alias}.${right.key}`;
  const from = cfg.selfJoin ? `FROM ${left.name} ${left.alias}` : `FROM ${left.name} ${left.alias}`;
  const sel = `SELECT ${left.alias}.*, ${right.alias}.*`;
  switch (type) {
    case 'concept':
      return `${sel}\n${from}\nCROSS JOIN ${right.name} ${right.alias}\nWHERE ${on};   -- same result as INNER JOIN ... ON ${on}`;
    case 'cross':
      return `${sel}\n${from}\nCROSS JOIN ${right.name} ${right.alias};`;
    case 'anti':
      return `${sel}\n${from}\nLEFT JOIN ${right.name} ${right.alias} ON ${on}\nWHERE ${right.alias}.${right.key} IS NULL;`;
    default:
      return `${sel}\n${from}\n${type.toUpperCase()} JOIN ${right.name} ${right.alias} ON ${on};`;
  }
}

function runnableSql(cfg: JoinVizConfig, type: JoinType) {
  const cte = (t: VizTable) => `${t.name} (${t.columns.join(', ')}) AS (\n  VALUES ${t.rows.map((r) => `(${r.map(sqlLit).join(', ')})`).join(',\n         ')}\n)`;
  const ctes = cfg.selfJoin ? [cte(cfg.left)] : [cte(cfg.left), cte(cfg.right)];
  return `-- The mini tables from the picture, built with VALUES so you can run the join for real.\n-- (Inside this query the CTE names hide the real tables of the same name.)\nWITH ${ctes.join(',\n')}\n${buildSql(cfg, type)}`;
}

export function JoinViz({ config }: { config: JoinVizConfig }) {
  const [expanded, setExpanded] = useState(false);
  const [type, setType] = useState<JoinType>(config.initial);
  const props = { config, type, setType, expanded, setExpanded };
  return (
    <>
      <JoinVizInner {...props} />
      {expanded && (
        <div className="overlay" onClick={() => setExpanded(false)}>
          <div className="modal wide" onClick={(e) => e.stopPropagation()}>
            <JoinVizInner {...props} inModal />
          </div>
        </div>
      )}
    </>
  );
}

function JoinVizInner({
  config,
  type,
  setType,
  setExpanded,
  inModal,
}: {
  config: JoinVizConfig;
  type: JoinType;
  setType: (t: JoinType) => void;
  expanded: boolean;
  setExpanded: (b: boolean) => void;
  inModal?: boolean;
}) {
  const { loadSql } = usePlayground();
  const { left, right } = config;
  const { pairs, steps, rightMatched, matchesOf } = useMemo(() => compute(config, type), [config, type]);
  const [step, setStep] = useState<number | null>(null);
  const [hover, setHover] = useState<{ l?: number | null; r?: number | null; p?: number } | null>(null);
  const srcRef = useRef<HTMLDivElement>(null);
  const leftRows = useRef<(HTMLTableRowElement | null)[]>([]);
  const rightRows = useRef<(HTMLTableRowElement | null)[]>([]);
  const [geom, setGeom] = useState<{ ly: number[]; ry: number[]; x1: number; x2: number } | null>(null);

  const changeType = (t: JoinType) => {
    setType(t);
    setStep(null);
  };

  const measure = useCallback(() => {
    const box = srcRef.current?.getBoundingClientRect();
    if (!box) return;
    const ly = leftRows.current.map((el) => (el ? el.getBoundingClientRect().top + el.offsetHeight / 2 - box.top : 0));
    const ry = rightRows.current.map((el) => (el ? el.getBoundingClientRect().top + el.offsetHeight / 2 - box.top : 0));
    const l0 = leftRows.current[0]?.getBoundingClientRect();
    const r0 = rightRows.current[0]?.getBoundingClientRect();
    if (!l0 || !r0) return;
    setGeom({ ly, ry, x1: l0.right - box.left, x2: r0.left - box.left });
  }, []);

  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (srcRef.current) ro.observe(srcRef.current);
    return () => ro.disconnect();
  }, [measure, type, step]);

  const cur = step !== null ? steps[step] : null;
  const visibleCount = cur ? cur.to : pairs.length;
  const visiblePairs = pairs.slice(0, visibleCount);

  // colours: each left row has a colour; right rows take the colour of the left row they match
  const leftColor = (li: number) => `cc${li % 6}`;
  const rightOwner = new Map<number, number>();
  if (type !== 'cross') {
    left.rows.forEach((_, li) => matchesOf(li).forEach((ri) => (rightOwner.has(ri) ? rightOwner.set(ri, -1) : rightOwner.set(ri, li))));
  }
  const rightColor = (ri: number) => {
    const o = rightOwner.get(ri);
    return o !== undefined && o >= 0 ? leftColor(o) : '';
  };

  const lk = colIndex(left, left.key);
  const rk = colIndex(right, right.key);
  const hotPair = hover?.p !== undefined ? pairs[hover.p] : null;
  const isHotLeft = (li: number) => hover?.l === li || hotPair?.l === li;
  const isHotRight = (ri: number) => hover?.r === ri || hotPair?.r === ri;

  const lines: { l: number; r: number; hot: boolean; faint: boolean; cls: string }[] = [];
  if (geom) {
    const seen = new Set<string>();
    const add = (l: number, r: number, faint: boolean) => {
      const k = `${l}-${r}`;
      if (seen.has(k)) return;
      seen.add(k);
      const hot = (hotPair?.l === l && hotPair?.r === r) || hover?.l === l || hover?.r === r || (cur?.l === l && cur.rs.includes(r));
      lines.push({ l, r, hot, faint, cls: `c${l % 6}b` });
    };
    if (type === 'cross') visiblePairs.forEach((p) => p.l !== null && p.r !== null && add(p.l, p.r, true));
    else if (type === 'anti' || type === 'concept') {
      left.rows.forEach((_, li) => {
        if (cur && cur.l !== null && li > cur.l) return;
        matchesOf(li).forEach((ri) => add(li, ri, type === 'anti'));
      });
    } else visiblePairs.forEach((p) => p.l !== null && p.r !== null && add(p.l, p.r, false));
  }

  const leftUnmatched = (li: number) => matchesOf(li).length === 0;
  const rightUnmatched = (ri: number) => !rightMatched.has(ri);
  const sqlText = buildSql(config, type);
  const parts = explain(config, type, pairs, matchesOf, rightMatched);

  const rowClass = (base: string, opts: { hot?: boolean; dim?: boolean; probe?: boolean; unmatched?: boolean }) =>
    [base, opts.hot && 'hot', opts.dim && 'dim', opts.probe && 'probe', opts.unmatched && 'unmatched'].filter(Boolean).join(' ');

  return (
    <div className="jv">
      <div className="jv-top">
        <span className="label">Join type</span>
        <div className="seg">
          {config.types.map((t) => (
            <button key={t} className={t === type ? 'on' : ''} onClick={() => changeType(t)}>
              {TYPE_LABEL[t]}
            </button>
          ))}
        </div>
        <span className="spacer" />
        <button className="btn small" onClick={() => loadSql(runnableSql(config, type), { run: true })} title="Load an equivalent query (with these mini tables as CTEs) into the editor and run it on Postgres">
          &#9654; Run in Postgres
        </button>
        {!inModal ? (
          <button className="btn small ghost" onClick={() => setExpanded(true)} title="Open bigger">
            &#x2922; Expand
          </button>
        ) : (
          <button className="btn small" onClick={() => setExpanded(false)}>
            Close
          </button>
        )}
      </div>
      <pre className="jv-sql">
        <code dangerouslySetInnerHTML={{ __html: highlightSql(sqlText) }} />
      </pre>
      <div className="jv-stage">
        <div className="jv-src" ref={srcRef}>
          <svg aria-hidden>
            {geom &&
              lines.map(({ l, r, hot, faint, cls }) => {
                const y1 = geom.ly[l];
                const y2 = geom.ry[r];
                const mid = (geom.x1 + geom.x2) / 2;
                return (
                  <path
                    key={`${l}-${r}`}
                    d={`M ${geom.x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${geom.x2} ${y2}`}
                    fill="none"
                    style={{ stroke: `var(--${cls})` }}
                    strokeWidth={hot ? 2.6 : faint ? 1 : 1.6}
                    strokeDasharray={faint && !hot ? '3 3' : undefined}
                    opacity={hot ? 1 : faint ? 0.35 : hover || cur ? 0.35 : 0.85}
                  />
                );
              })}
          </svg>
          <table className="jv-table">
            <caption>
              {left.name} <span className="alias">AS {left.alias}</span> <span className="tag">left</span>
            </caption>
            <thead>
              <tr>
                {left.columns.map((c, i) => (
                  <th key={c} className={i === lk ? 'key' : ''}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {left.rows.map((row, li) => (
                <tr
                  key={li}
                  ref={(el) => {
                    leftRows.current[li] = el;
                  }}
                  className={rowClass('', {
                    hot: isHotLeft(li),
                    probe: cur?.l === li,
                    dim: !!cur && cur.l !== li && (cur.l === null || li > cur.l),
                    unmatched: type !== 'cross' && type !== 'concept' && leftUnmatched(li),
                  })}
                  onMouseEnter={() => setHover({ l: li })}
                  onMouseLeave={() => setHover(null)}
                >
                  {row.map((v, ci) => (
                    <td key={ci} className={`${type === 'cross' || !leftUnmatched(li) ? leftColor(li) : ''} ${v === null ? 'nullcell' : ''}`}>
                      {show(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <table className="jv-table">
            <caption>
              {right.name} <span className="alias">AS {right.alias}</span> <span className="tag">right</span>
            </caption>
            <thead>
              <tr>
                {right.columns.map((c, i) => (
                  <th key={c} className={i === rk ? 'key' : ''}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {right.rows.map((row, ri) => (
                <tr
                  key={ri}
                  ref={(el) => {
                    rightRows.current[ri] = el;
                  }}
                  className={rowClass('', {
                    hot: isHotRight(ri),
                    probe: !!cur && cur.rs.includes(ri),
                    unmatched: type !== 'cross' && type !== 'concept' && rightUnmatched(ri),
                  })}
                  onMouseEnter={() => setHover({ r: ri })}
                  onMouseLeave={() => setHover(null)}
                >
                  {row.map((v, ci) => (
                    <td key={ci} className={`${type === 'cross' ? '' : rightColor(ri)} ${v === null ? 'nullcell' : ''}`}>
                      {show(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="jv-arrow">→</div>
        <div>
          <table className="jv-table">
            <caption>
              result <span className="alias">({type === 'concept' ? `${pairs.filter((p) => !p.rejected).length} of ${pairs.length} pairs kept` : `${pairs.length} rows`})</span>
            </caption>
            <thead>
              <tr>
                {left.columns.map((c) => (
                  <th key={`l${c}`}>
                    {left.alias}.{c}
                  </th>
                ))}
                {right.columns.map((c, i) => (
                  <th key={`r${c}`} className={i === 0 ? 'sep' : ''}>
                    {right.alias}.{c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pairs.map((p, pi) => {
                const hidden = pi >= visibleCount;
                const isNew = !!cur && pi >= cur.from && pi < cur.to;
                const hot = hover?.p === pi || (hover?.l !== undefined && hover.l !== null && p.l === hover.l) || (hover?.r !== undefined && hover.r !== null && p.r === hover.r);
                // matched rows keep their row colour; rows kept without a partner stay neutral (like in the source table)
                const color = p.l !== null && (p.r !== null || type === 'cross') ? leftColor(p.l) : '';
                const rColor = type === 'cross' ? '' : p.l !== null ? leftColor(p.l) : '';
                return (
                  <tr
                    key={pi}
                    className={[hidden && 'hidden-row', hot && 'hot', isNew && 'probe', p.rejected && 'rejected'].filter(Boolean).join(' ')}
                    onMouseEnter={() => setHover({ p: pi })}
                    onMouseLeave={() => setHover(null)}
                  >
                    {left.columns.map((_, ci) =>
                      p.l === null ? (
                        <td key={`l${ci}`} className="nullcell">
                          NULL
                        </td>
                      ) : (
                        <td key={`l${ci}`} className={`${p.rejected ? '' : color} ${left.rows[p.l][ci] === null ? 'nullcell' : ''}`}>
                          {show(left.rows[p.l][ci])}
                        </td>
                      ),
                    )}
                    {right.columns.map((_, ci) =>
                      p.r === null ? (
                        <td key={`r${ci}`} className={`nullcell ${ci === 0 ? 'sep' : ''}`}>
                          NULL
                        </td>
                      ) : (
                        <td key={`r${ci}`} className={`${p.rejected ? '' : rColor} ${ci === 0 ? 'sep' : ''} ${right.rows[p.r][ci] === null ? 'nullcell' : ''}`}>
                          {show(right.rows[p.r][ci])}
                        </td>
                      ),
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {visibleCount === 0 && <div className="jv-empty-result">(no rows yet)</div>}
        </div>
      </div>
      <div className="jv-explain">
        {parts.map((p, i) => (
          <p key={i} dangerouslySetInnerHTML={{ __html: p }} />
        ))}
      </div>
      <div className="jv-step">
        <button className="btn small" onClick={() => setStep(0)} disabled={step === 0}>
          {step === null ? '▶ Step through' : '⏮ Restart'}
        </button>
        <button className="btn small" disabled={step === null || step === 0} onClick={() => setStep((s) => (s === null ? 0 : Math.max(0, s - 1)))}>
          ◀ Prev
        </button>
        <button className="btn small" disabled={step !== null && step >= steps.length - 1} onClick={() => setStep((s) => (s === null ? 0 : Math.min(steps.length - 1, s + 1)))}>
          Next ▶
        </button>
        <button className="btn small ghost" disabled={step === null} onClick={() => setStep(null)}>
          Show all
        </button>
        <span className="msg" dangerouslySetInnerHTML={{ __html: cur ? `<b>Step ${step! + 1}/${steps.length}:</b> ${cur.msg}` : 'Hover over any row to see where it comes from, or step through the join one row at a time.' }} />
      </div>
    </div>
  );
}
