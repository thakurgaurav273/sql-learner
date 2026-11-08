import { useEffect, useMemo, useRef, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { sql as sqlLang, PostgreSQL } from '@codemirror/lang-sql';
import { keymap, EditorView } from '@codemirror/view';
import { Prec } from '@codemirror/state';
import { lintGutter } from '@codemirror/lint';
import { usePlayground } from '../state';
import { DataTable } from './DataTable';
import { ErrorBox } from './ErrorBox';
import type { StatementResult } from '../api';
import { useDrag, useStoredNumber } from './layout';

function useDarkMode() {
  const [dark, setDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const fn = () => setDark(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return dark;
}

const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
const MOD = isMac ? '⌘' : 'Ctrl';

export function Workspace() {
  const { sql, setSql, session, setSession, txStatus, running, runEditor, cancel, editorView, schema, history, loadSql } = usePlayground();
  const dark = useDarkMode();
  const runRef = useRef(runEditor);
  runRef.current = runEditor;
  const [editorHeight, setEditorHeight] = useStoredNumber('sqlpg.editorH', 300);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [showHistory, setShowHistory] = useState(false);
  const drag = useDrag((dy, start) => setEditorHeight(Math.max(90, Math.min(start + dy, (wrapRef.current?.clientHeight ?? 800) - 120))), editorHeight, 'y');

  const extensions = useMemo(() => {
    const schemaMap: Record<string, string[]> = {};
    for (const t of schema?.tables ?? []) schemaMap[t.name] = t.columns.map((c) => c.name);
    return [
      sqlLang({ dialect: PostgreSQL, schema: schemaMap, upperCaseKeywords: true }),
      Prec.highest(
        keymap.of([
          { key: 'Mod-Enter', run: () => (runRef.current(), true) },
          { key: 'Shift-Enter', run: () => (runRef.current(), true) },
        ]),
      ),
      lintGutter(),
      EditorView.lineWrapping,
    ];
  }, [schema]);

  return (
    <div className="workspace" ref={wrapRef}>
      <div className="col-head">
        Query editor
        <span className="spacer" />
        <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
          <kbd>{MOD}</kbd>+<kbd>Enter</kbd> runs · select text to run part of it
        </span>
      </div>
      <div className="toolbar">
        {running ? (
          <button className="btn danger" onClick={cancel} title="Cancel the running query">
            <span className="spinner" /> Stop
          </button>
        ) : (
          <button className="btn primary" onClick={runEditor} title={`Run (${MOD}+Enter)`}>
            &#9654; Run
          </button>
        )}
        <div className="seg" title="Two separate database connections. Use them to see how two transactions interact (Transactions lesson).">
          {(['A', 'B'] as const).map((s) => (
            <button key={s} className={session === s ? 'on' : ''} onClick={() => setSession(s)}>
              Session {s}
              {txStatus[s] && txStatus[s] !== 'idle' && <span className={`tx-badge ${txStatus[s]}`}>{txStatus[s] === 'in-transaction' ? 'TX' : 'TX ✕'}</span>}
            </button>
          ))}
        </div>
        <div style={{ position: 'relative' }}>
          <button className="btn ghost" onClick={() => setShowHistory((s) => !s)} disabled={!history.length}>
            History ▾
          </button>
          {showHistory && (
            <div className="history-menu" onMouseLeave={() => setShowHistory(false)}>
              {history.map((h, i) => (
                <button
                  key={i}
                  title={h}
                  onClick={() => {
                    loadSql(h);
                    setShowHistory(false);
                  }}
                >
                  {h.replace(/\s+/g, ' ')}
                </button>
              ))}
            </div>
          )}
        </div>
        <span className="spacer" />
        <button className="btn ghost" onClick={() => loadSql('')} title="Clear the editor">
          Clear
        </button>
      </div>
      {txStatus[session] !== 'idle' && (
        <div className={`tx-banner ${txStatus[session]}`}>
          {txStatus[session] === 'in-transaction'
            ? `Session ${session} has an open transaction. Its changes are invisible to other sessions until you run COMMIT (or undo them with ROLLBACK).`
            : `Session ${session}: the transaction failed. Every statement will be rejected until you run ROLLBACK.`}
        </div>
      )}
      <div className="editor-wrap" style={{ height: editorHeight, flex: 'none' }}>
        <CodeMirror
          value={sql}
          height="100%"
          theme={dark ? 'dark' : 'light'}
          extensions={extensions}
          onChange={(v) => setSql(v)}
          onCreateEditor={(view) => {
            editorView.current = view;
          }}
          basicSetup={{ foldGutter: false, highlightActiveLine: true }}
        />
      </div>
      <div className={`gutter h ${drag.dragging ? 'dragging' : ''}`} onMouseDown={drag.onMouseDown} />
      <Results />
    </div>
  );
}

function Results() {
  const { run, running, session } = usePlayground();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  useEffect(() => setOpen({}), [run]);

  if (!run) {
    return (
      <div className="results">
        <div className="results-head">Results</div>
        <div className="empty">
          <div className="big">⌘</div>
          {running ? 'Running…' : `Run a query to see its results here (Session ${session}).`}
        </div>
      </div>
    );
  }
  const { response, clientError } = run;
  const results = response?.results ?? [];
  const lastWithRows = [...results].reverse().find((r) => r.fields.length > 0);
  const isOpen = (r: StatementResult) => open[r.index] ?? (results.length === 1 || r === lastWithRows || r.fields.length === 0);
  const total = results.reduce((s, r) => s + r.durationMs, 0);

  return (
    <div className="results">
      <div className="results-head">
        {running ? (
          <>
            <span className="spinner" /> Running…
          </>
        ) : clientError ? (
          <span style={{ color: 'var(--err)' }}>Request failed</span>
        ) : (
          <>
            <span>
              {results.length} statement{results.length === 1 ? '' : 's'} ran{response?.error ? ', then an error' : ''} · {total.toFixed(1)} ms
            </span>
          </>
        )}
        <span className="spacer" />
        <span>Session {run.ranSession}</span>
      </div>
      <div className="scroll">
        {clientError && <div className="errorbox">{clientError}</div>}
        {response?.error && <ErrorBox error={response.error} text={run.ranText} offset={run.ranOffset} />}
        {results.map((r) =>
          results.length === 1 && r.fields.length > 0 ? (
            <ResultBody key={r.index} r={r} />
          ) : (
            <div className="stmt" key={r.index}>
              <button className="stmt-head" onClick={() => setOpen((o) => ({ ...o, [r.index]: !isOpen(r) }))}>
                <span>{isOpen(r) ? '▾' : '▸'}</span>
                <span className="cmd">{r.command}</span>
                <span className="sql-preview">{r.sql.replace(/\s+/g, ' ')}</span>
                <span className="meta">{summary(r)}</span>
              </button>
              {isOpen(r) && r.fields.length > 0 && <ResultBody r={r} />}
            </div>
          ),
        )}
      </div>
    </div>
  );
}

function summary(r: StatementResult) {
  const ms = `${r.durationMs} ms`;
  if (r.fields.length > 0) return `${r.truncated ? `first ${r.rows.length}` : r.rows.length} row${r.rows.length === 1 ? '' : 's'} · ${ms}`;
  if (r.rowCount !== null && /INSERT|UPDATE|DELETE|MERGE|COPY/.test(r.command)) return `${r.rowCount} row${r.rowCount === 1 ? '' : 's'} affected · ${ms}`;
  return `✓ done · ${ms}`;
}

function ResultBody({ r }: { r: StatementResult }) {
  const isPlan = r.fields.length === 1 && r.fields[0].name === 'QUERY PLAN';
  return (
    <div>
      {r.truncated && <div className="notice">Showing the first {r.rows.length} rows only - the query returned more. Add a LIMIT or a WHERE clause.</div>}
      {r.fields.length > 0 && r.rows.length === 0 && <div className="notice" style={{ color: 'var(--text-2)', background: 'var(--panel-2)' }}>The query returned 0 rows.</div>}
      {isPlan ? (
        <pre className="plan" dangerouslySetInnerHTML={{ __html: highlightPlan(r.rows.map((x) => x[0] ?? '').join('\n')) }} />
      ) : (
        r.rows.length > 0 && <DataTable fields={r.fields} rows={r.rows} />
      )}
      <div className="results-head" style={{ borderTop: '1px solid var(--border)', borderBottom: 0 }}>
        {r.command} · {summary(r)}
      </div>
    </div>
  );
}

const PLAN_NODES = [
  'Seq Scan', 'Parallel Seq Scan', 'Index Only Scan', 'Index Scan', 'Bitmap Heap Scan', 'Bitmap Index Scan', 'Nested Loop', 'Hash Join', 'Merge Join',
  'Hash', 'Sort', 'Incremental Sort', 'Aggregate', 'HashAggregate', 'GroupAggregate', 'Limit', 'Materialize', 'Memoize', 'Gather', 'Gather Merge',
  'WindowAgg', 'Unique', 'Append', 'Subquery Scan', 'CTE Scan', 'Result', 'Values Scan', 'Function Scan', 'SetOp', 'ModifyTable', 'LockRows',
  'Hash Left Join', 'Hash Right Join', 'Hash Full Join', 'Hash Anti Join', 'Hash Semi Join', 'Hash Right Anti Join', 'Hash Right Semi Join',
  'Merge Left Join', 'Merge Right Join', 'Merge Full Join', 'Merge Anti Join', 'Merge Semi Join',
  'Nested Loop Left Join', 'Nested Loop Anti Join', 'Nested Loop Semi Join', 'Nested Loop Full Join',
].sort((a, b) => b.length - a.length);
const PLAN_RE = new RegExp(`\\b(${PLAN_NODES.join('|')})\\b`, 'g');

function highlightPlan(text: string) {
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return esc.replace(PLAN_RE, '<span class="hl">$1</span>');
}
