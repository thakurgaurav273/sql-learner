import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { EditorView } from '@codemirror/view';
import { setDiagnostics } from '@codemirror/lint';
import { toast as sonnerToast } from 'sonner';
import { api, type QueryResponse, type Schema, type Status, type TxStatus } from './api';

// Shared app state: editor contents, query execution, schema and progress.

type RunState = {
  response: QueryResponse | null;
  ranText: string; // exact text that was sent (whole editor or the selection)
  ranOffset: number; // where that text starts inside the editor document
  ranSession: string;
  clientError: string | null;
  at: number;
};

type Ctx = {
  sql: string;
  setSql: (s: string) => void;
  session: 'A' | 'B';
  setSession: (s: 'A' | 'B') => void;
  txStatus: Record<string, TxStatus>;
  running: boolean;
  run: RunState | null;
  runEditor: () => void;
  cancel: () => void;
  loadSql: (sql: string, opts?: { run?: boolean; session?: 'A' | 'B' }) => void;
  editorView: React.MutableRefObject<EditorView | null>;
  getEditorText: () => { text: string; offset: number; isSelection: boolean };
  schema: Schema | null;
  schemaError: string | null;
  refreshSchema: () => Promise<void>;
  status: Status | null;
  statusError: string | null;
  refreshStatus: () => Promise<void>;
  solved: Set<string>;
  markSolved: (id: string) => void;
  focusTable: string | null;
  setFocusTable: (t: string | null) => void;
  history: string[];
  toast: (msg: string, kind?: 'ok' | 'err' | 'info') => void;
  afterReset: () => Promise<void>;
};

const PlaygroundContext = createContext<Ctx | null>(null);
export const usePlayground = () => {
  const c = useContext(PlaygroundContext);
  if (!c) throw new Error('usePlayground outside provider');
  return c;
};

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

const DEFAULT_SQL = `-- Welcome! Write any SQL here and press Run (Cmd/Ctrl + Enter).
-- Select part of the text to run only that part.

SELECT c.first_name, c.city, o.id AS order_id, o.ordered_at, o.status
FROM customers AS c
JOIN orders AS o ON o.customer_id = c.id
ORDER BY o.ordered_at DESC
LIMIT 10;
`;

export function PlaygroundProvider({ children }: { children: ReactNode }) {
  const [sql, setSqlState] = useState<string>(() => load('sqlpg.sql', DEFAULT_SQL));
  const [session, setSession] = useState<'A' | 'B'>('A');
  const [txStatus, setTxStatus] = useState<Record<string, TxStatus>>({ A: 'idle', B: 'idle' });
  const [runningSessions, setRunningSessions] = useState<Record<string, boolean>>({});
  const [runs, setRuns] = useState<Record<string, RunState | null>>({});
  const [schema, setSchema] = useState<Schema | null>(null);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [solved, setSolved] = useState<Set<string>>(() => new Set(load<string[]>('sqlpg.solved', [])));
  const [focusTable, setFocusTable] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>(() => load('sqlpg.history', []));
  const editorView = useRef<EditorView | null>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const setSql = useCallback((s: string) => {
    setSqlState(s);
    save('sqlpg.sql', s);
  }, []);

  const toast = useCallback((msg: string, kind: 'ok' | 'err' | 'info' = 'ok') => {
    if (kind === 'err') sonnerToast.error(msg);
    else if (kind === 'info') sonnerToast(msg);
    else sonnerToast.success(msg);
  }, []);

  const refreshSchema = useCallback(async () => {
    try {
      setSchema(await api.schema());
      setSchemaError(null);
    } catch (e) {
      setSchemaError((e as Error).message);
    }
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const s = await api.status();
      setStatus(s);
      setTxStatus(s.sessions);
      setStatusError(null);
    } catch (e) {
      setStatusError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
    refreshSchema();
  }, [refreshSchema, refreshStatus]);

  const clearDiagnostics = () => {
    const v = editorView.current;
    if (v) v.dispatch(setDiagnostics(v.state, []));
  };

  const getEditorText = useCallback(() => {
    const v = editorView.current;
    if (v) {
      const sel = v.state.selection.main;
      if (!sel.empty) return { text: v.state.sliceDoc(sel.from, sel.to), offset: sel.from, isSelection: true };
      return { text: v.state.doc.toString(), offset: 0, isSelection: false };
    }
    return { text: sql, offset: 0, isSelection: false };
  }, [sql]);

  const execute = useCallback(
    async (text: string, offset: number) => {
      const sess = sessionRef.current;
      clearDiagnostics();
      setRunningSessions((r) => ({ ...r, [sess]: true }));
      const trimmed = text.trim();
      if (trimmed) {
        setHistory((h) => {
          const next = [trimmed, ...h.filter((x) => x !== trimmed)].slice(0, 40);
          save('sqlpg.history', next);
          return next;
        });
      }
      let state: RunState;
      try {
        const response = await api.query(text, sess);
        state = { response, ranText: text, ranOffset: offset, ranSession: sess, clientError: null, at: Date.now() };
        if (response.txStatus) setTxStatus((t) => ({ ...t, [sess]: response.txStatus! }));
        const err = response.error;
        const v = editorView.current;
        if (err?.position !== undefined && v && v.state.doc.toString().length >= offset + err.position) {
          const from = offset + err.position;
          const line = v.state.doc.lineAt(from);
          const to = Math.min(line.to, from + Math.max(1, /^\w+/.exec(v.state.sliceDoc(from, line.to))?.[0].length ?? 1));
          v.dispatch(setDiagnostics(v.state, [{ from, to: Math.max(to, from + 1), severity: 'error', message: err.message }]));
        }
        // statements may have changed the schema (CREATE/DROP/ALTER/INSERT...)
        const changed = response.results.some((r) => !/^(SELECT|SHOW|EXPLAIN|BEGIN|SET)$/i.test(r.command ?? ''));
        if (changed) refreshSchema();
      } catch (e) {
        state = { response: null, ranText: text, ranOffset: offset, ranSession: sess, clientError: (e as Error).message, at: Date.now() };
      }
      setRuns((r) => ({ ...r, [sess]: state }));
      setRunningSessions((r) => ({ ...r, [sess]: false }));
    },
    [refreshSchema],
  );

  const runEditor = useCallback(() => {
    const { text, offset } = getEditorText();
    execute(text, offset);
  }, [execute, getEditorText]);

  const loadSql = useCallback(
    (text: string, opts?: { run?: boolean; session?: 'A' | 'B' }) => {
      if (opts?.session) {
        sessionRef.current = opts.session;
        setSession(opts.session);
      }
      const t = text.replace(/\s+$/, '') + '\n';
      setSql(t);
      const v = editorView.current;
      if (v) {
        v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: t }, selection: { anchor: 0 } });
        v.focus();
      }
      if (opts?.run) execute(t, 0);
    },
    [execute, setSql],
  );

  const cancel = useCallback(() => {
    api.cancel(sessionRef.current).catch(() => {});
  }, []);

  const markSolved = useCallback((id: string) => {
    setSolved((s) => {
      if (s.has(id)) return s;
      const next = new Set(s);
      next.add(id);
      save('sqlpg.solved', [...next]);
      return next;
    });
  }, []);

  const afterReset = useCallback(async () => {
    setRuns({});
    setTxStatus({ A: 'idle', B: 'idle' });
    clearDiagnostics();
    await Promise.all([refreshSchema(), refreshStatus()]);
  }, [refreshSchema, refreshStatus]);

  const value = useMemo<Ctx>(
    () => ({
      sql,
      setSql,
      session,
      setSession,
      txStatus,
      running: !!runningSessions[session],
      run: runs[session] ?? null,
      runEditor,
      cancel,
      loadSql,
      editorView,
      getEditorText,
      schema,
      schemaError,
      refreshSchema,
      status,
      statusError,
      refreshStatus,
      solved,
      markSolved,
      focusTable,
      setFocusTable,
      history,
      toast,
      afterReset,
    }),
    [sql, setSql, session, txStatus, runningSessions, runs, runEditor, cancel, loadSql, getEditorText, schema, schemaError, refreshSchema, status, statusError, refreshStatus, solved, markSolved, focusTable, history, toast, afterReset],
  );
  return <PlaygroundContext.Provider value={value}>{children}</PlaygroundContext.Provider>;
}
