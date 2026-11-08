import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, ChevronDown, CircleHelp, Database, Eraser, Loader2, Server, ShieldAlert, SquareTerminal, Square, X } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { api, type StatementResult, type TerminalResponse, type TxStatus } from '../api';
import { usePlayground } from '../state';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// A psql-style terminal connected as the "postgres" superuser of the local
// playground database. Output is formatted the way psql prints it.

type Entry =
  | { kind: 'input'; prompt: string; text: string }
  | { kind: 'output'; res: TerminalResponse }
  | { kind: 'text'; text: string; tone?: 'muted' | 'error' | 'warn' };

const HISTORY_KEY = 'sqlpg.terminalHistory';
const loadHistory = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
  } catch {
    return [];
  }
};

const promptFor = (db: string, tx: TxStatus, cont = false) => `${db}${cont ? '-' : tx === 'in-transaction' ? '=*' : tx === 'failed-transaction' ? '=!' : '='}#`;

// ---- psql-like formatting ---------------------------------------------------
const NUM = /^-?\d+(\.\d+)?(e[+-]?\d+)?$/i;
function center(s: string, w: number) {
  const pad = Math.max(0, w - s.length);
  const left = Math.floor(pad / 2);
  return ' '.repeat(left) + s + ' '.repeat(pad - left);
}
export function psqlTable(r: StatementResult & { title?: string }) {
  const names = r.fields.map((f) => f.name || '?column?');
  const cells = r.rows.map((row) => row.map((v) => (v === null ? '' : v.replace(/\r?\n/g, '↵'))).map((v) => (v.length > 160 ? v.slice(0, 159) + '…' : v)));
  const widths = names.map((n, i) => Math.max(n.length, ...cells.map((c) => c[i]?.length ?? 0)));
  const numeric = names.map((_, i) => cells.length > 0 && cells.every((c) => c[i] === '' || NUM.test(c[i])));
  const header = ' ' + names.map((n, i) => center(n, widths[i])).join(' | ');
  const sep = widths.map((w) => '-'.repeat(w + 2)).join('+');
  const lines = cells.map((c) => (' ' + c.map((v, i) => (numeric[i] ? v.padStart(widths[i]) : v.padEnd(widths[i]))).join(' | ')).trimEnd());
  const n = r.rows.length;
  const footer = r.truncated ? `(showing the first ${n} rows)` : `(${n} row${n === 1 ? '' : 's'})`;
  return [r.title ? center(r.title, sep.length).trimEnd() : null, header.trimEnd(), sep, ...lines, footer].filter((x) => x !== null).join('\n');
}
function commandTag(r: StatementResult) {
  const sql = r.sql.replace(/^(\s*(--[^\n]*\n|\/\*[\s\S]*?\*\/))*\s*/, '');
  const ddl = /^(CREATE|DROP|ALTER|TRUNCATE|COMMENT|GRANT|REVOKE)\s+(?:OR\s+REPLACE\s+)?(?:UNIQUE\s+|TEMP(?:ORARY)?\s+|MATERIALIZED\s+)?(\w+)?/i.exec(sql);
  if (ddl) return ['TRUNCATE', 'GRANT', 'REVOKE'].includes(ddl[1].toUpperCase()) ? ddl[1].toUpperCase() : `${ddl[1]} ${ddl[2] ?? ''}`.trim().toUpperCase();
  if (r.command === 'INSERT') return `INSERT 0 ${r.rowCount ?? 0}`;
  if (/^(UPDATE|DELETE|MERGE|COPY|FETCH|MOVE|SELECT)$/.test(r.command)) return `${r.command} ${r.rowCount ?? 0}`;
  return r.command;
}

function Output({ res }: { res: TerminalResponse }) {
  const blocks: React.ReactNode[] = [];
  res.results.forEach((r, i) => {
    const isMeta = r.title !== undefined;
    blocks.push(
      <pre key={`r${i}`} className="whitespace-pre text-[#d0d7de]">
        {r.fields.length ? psqlTable(r) : commandTag(r)}
      </pre>,
    );
    if (!isMeta && r.durationMs !== undefined) blocks.push(<div key={`t${i}`} className="text-[#6e7681]">Time: {r.durationMs.toFixed(3)} ms</div>);
  });
  res.messages.forEach((m, i) =>
    blocks.push(
      <pre key={`m${i}`} className="whitespace-pre-wrap text-[#d0d7de]">
        {m}
      </pre>,
    ),
  );
  res.notices.forEach((n, i) =>
    blocks.push(
      <pre key={`n${i}`} className="whitespace-pre-wrap text-[#e3b341]">
        {n}
      </pre>,
    ),
  );
  const e = res.error;
  if (e) {
    blocks.push(
      <pre key="err" className="whitespace-pre-wrap text-[#ff7b72]">
        {[
          `ERROR:  ${e.message}${e.code ? `  (SQLSTATE ${e.code})` : ''}`,
          e.detail && `DETAIL:  ${e.detail}`,
          e.hint && `HINT:  ${e.hint}`,
          (e.statementCount ?? 1) > 1 && `(statement ${(e.statementIndex ?? 0) + 1} of ${e.statementCount}; the ones before it ran, the rest did not)`,
        ]
          .filter(Boolean)
          .join('\n')}
      </pre>,
    );
    if (e.tip) blocks.push(<div key="tip" className="whitespace-pre-wrap text-[#79c0ff]">Tip: {e.tip}</div>);
  }
  return <div className="space-y-1.5 pb-1">{blocks}</div>;
}

const WELCOME: Entry[] = [
  { kind: 'text', text: 'Root terminal: connected to the whole PostgreSQL server in the playground container, as the superuser "postgres".' },
  {
    kind: 'text',
    text: 'Like psql, a connection always sits in one database (shown in the prompt) for table commands. Server-wide commands work from anywhere:\n\\l lists every database, CREATE / DROP DATABASE, roles and privileges. \\c NAME (or the database picker above) hops between databases. \\? shows all commands.',
    tone: 'muted',
  },
  { kind: 'text', text: 'Protected so the app keeps working: roles postgres and learner; databases postgres, learn_template, learn_check.', tone: 'muted' },
];

export function RootTerminal({ onClose }: { onClose: () => void }) {
  const { applyDatabases, refreshSchema, terminalOpen } = usePlayground();
  const [db, setDb] = useState('learn');
  const [server, setServer] = useState<{ host: string; port: number; databases: { name: string; internal: boolean }[] } | null>(null);
  const refreshInfo = () =>
    api.terminal
      .info()
      .then((i) => {
        setDb(i.database);
        setServer({ host: i.host, port: i.port, databases: i.databases });
      })
      .catch(() => {});
  const [tx, setTx] = useState<TxStatus>('idle');
  const [entries, setEntries] = useState<Entry[]>(WELCOME);
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const history = useRef<string[]>(loadHistory());
  const histIdx = useRef<number>(-1);
  const draft = useRef('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    refreshInfo();
  }, []);
  useEffect(() => {
    if (terminalOpen) setTimeout(() => inputRef.current?.focus(), 30);
  }, [terminalOpen]);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries, running]);

  const pushHistory = (text: string) => {
    const h = [text, ...history.current.filter((x) => x !== text)].slice(0, 200);
    history.current = h;
    histIdx.current = -1;
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
    } catch {
      /* ignore */
    }
  };

  const execute = async (text: string) => {
    const trimmed = text.trim();
    setInput('');
    if (!trimmed) {
      setEntries((e) => [...e, { kind: 'input', prompt: promptFor(db, tx), text: '' }]);
      return;
    }
    pushHistory(trimmed);
    if (/^\\(clear|cls)\b/i.test(trimmed)) {
      setEntries([]);
      return;
    }
    setEntries((e) => [...e, { kind: 'input', prompt: promptFor(db, tx), text: text.replace(/\s+$/, '') }]);
    setRunning(true);
    try {
      const res = await api.terminal.run(text);
      setDb(res.database);
      setTx(res.txStatus);
      setEntries((e) => [...e, { kind: 'output', res }]);
    } catch (err) {
      setEntries((e) => [...e, { kind: 'text', tone: 'error', text: (err as Error).message }]);
    } finally {
      setRunning(false);
      // the terminal can change anything: refresh the database list, the active database and the schema
      refreshInfo();
      api.databases
        .list()
        .then(applyDatabases)
        .catch(() => {});
      refreshSchema();
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    const mod = e.metaKey || e.ctrlKey;
    if (e.key === 'Enter' && !e.shiftKey) {
      const t = input.trim();
      const complete = !t || t.startsWith('\\') || /;\s*(--[^\n]*)?$/.test(t);
      if (mod || complete) {
        e.preventDefault();
        if (!running) execute(input);
      }
      return; // otherwise: a new line, like psql's continuation prompt
    }
    if (e.ctrlKey && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      setEntries([]);
      return;
    }
    if (e.ctrlKey && e.key.toLowerCase() === 'c' && el.selectionStart === el.selectionEnd) {
      e.preventDefault();
      if (running) api.terminal.cancel().catch(() => {});
      else if (input) {
        setEntries((x) => [...x, { kind: 'input', prompt: promptFor(db, tx), text: input + '^C' }]);
        setInput('');
      }
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const s = el.selectionStart;
      setInput(input.slice(0, s) + '  ' + input.slice(el.selectionEnd));
      requestAnimationFrame(() => el.setSelectionRange(s + 2, s + 2));
      return;
    }
    const onFirstLine = !input.slice(0, el.selectionStart).includes('\n');
    const onLastLine = !input.slice(el.selectionEnd).includes('\n');
    if (e.key === 'ArrowUp' && onFirstLine && history.current.length) {
      e.preventDefault();
      if (histIdx.current === -1) draft.current = input;
      histIdx.current = Math.min(histIdx.current + 1, history.current.length - 1);
      setInput(history.current[histIdx.current]);
    } else if (e.key === 'ArrowDown' && onLastLine && histIdx.current >= 0) {
      e.preventDefault();
      histIdx.current -= 1;
      setInput(histIdx.current === -1 ? draft.current : history.current[histIdx.current]);
    }
  };

  const lines = input.split('\n');
  return (
    <div className="dark flex h-full flex-col bg-[#0d1117] font-mono text-[12.5px] leading-[1.6] text-[#d0d7de]" data-testid="root-terminal">
      <div className="flex h-10 flex-none items-center gap-2.5 border-b border-white/10 bg-[#161b22] px-3 font-sans">
        <SquareTerminal className="size-4 text-[#8b949e]" />
        <span className="text-[13px] font-semibold text-[#e6edf3]">Root terminal</span>
        <span className="flex items-center gap-1 rounded-full bg-[#e3b341]/15 px-2 py-0.5 text-[11px] font-medium text-[#e3b341]">
          <ShieldAlert className="size-3" /> postgres · superuser
        </span>
        <span className="hidden items-center gap-1.5 text-[12px] text-[#8b949e] lg:flex">
          <Server className="size-3.5" /> server {server ? `${server.host === '127.0.0.1' ? 'localhost' : server.host}:${server.port}` : ''} · all databases
        </span>
        <DropdownMenu onOpenChange={(o) => o && refreshInfo()}>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[12px] text-[#e6edf3] transition-colors hover:bg-white/10"
              data-testid="terminal-db-picker"
              title="The database this connection is in (\c switches)"
            >
              <Database className="size-3.5 text-[#7ee787]" /> {db} <ChevronDown className="size-3 text-[#8b949e]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Connect the terminal to (\c)</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="max-h-72 overflow-y-auto">
              {server?.databases.map((d) => (
                <DropdownMenuItem key={d.name} onSelect={() => d.name !== db && execute(`\\c ${d.name}`)} className="font-mono text-[12.5px]" data-terminal-db={d.name}>
                  <Database className={cn(d.internal ? 'opacity-50' : '')} />
                  <span className={cn('flex-1 truncate', d.internal && 'text-muted-foreground')}>{d.name}</span>
                  {d.internal && <span className="font-sans text-[10.5px] text-muted-foreground">internal</span>}
                  {d.name === db && <Check className="text-primary" />}
                </DropdownMenuItem>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
        {tx !== 'idle' && <span className={cn('text-[11px] font-semibold', tx === 'in-transaction' ? 'text-[#e3b341]' : 'text-[#ff7b72]')}>{tx === 'in-transaction' ? 'TRANSACTION OPEN' : 'TRANSACTION FAILED'}</span>}
        <span className="flex-1" />
        {running && (
          <button onClick={() => api.terminal.cancel().catch(() => {})} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-[#ff7b72] hover:bg-white/5">
            <Square className="size-3 fill-current" /> Cancel
          </button>
        )}
        <TermButton label="Help (\?)" onClick={() => execute('\\?')}>
          <CircleHelp />
        </TermButton>
        <TermButton label="Clear (Ctrl+L)" onClick={() => setEntries([])}>
          <Eraser />
        </TermButton>
        <TermButton label="Hide (Ctrl+`)" onClick={onClose}>
          <X />
        </TermButton>
      </div>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-auto px-4 py-3 [scrollbar-color:#30363d_transparent] [&::-webkit-scrollbar-thumb]:bg-[#30363d]"
        onMouseUp={() => {
          if (!window.getSelection()?.toString()) inputRef.current?.focus();
        }}
      >
        {entries.map((en, i) =>
          en.kind === 'input' ? (
            <pre key={i} className="whitespace-pre-wrap">
              {en.text.split('\n').map((l, j) => (
                <span key={j} className="block">
                  <span className="text-[#7ee787] select-none">{j === 0 ? en.prompt : en.prompt.replace(/[=*!]+#$/, '-#')} </span>
                  {l}
                </span>
              ))}
            </pre>
          ) : en.kind === 'output' ? (
            <Output key={i} res={en.res} />
          ) : (
            <div key={i} className={cn('whitespace-pre-wrap', en.tone === 'muted' && 'text-[#8b949e]', en.tone === 'error' && 'text-[#ff7b72]', en.tone === 'warn' && 'text-[#e3b341]')}>
              {en.text}
            </div>
          ),
        )}
        {running ? (
          <div className="flex items-center gap-2 text-[#8b949e]">
            <Loader2 className="size-3.5 animate-spin" /> running… <span className="text-[#6e7681]">(Ctrl+C to cancel)</span>
          </div>
        ) : (
          <div className="flex items-start">
            <div className="pr-[1ch] text-[#7ee787] select-none" aria-hidden>
              {lines.map((_, j) => (
                <div key={j}>{promptFor(db, tx, j > 0)}</div>
              ))}
            </div>
            <textarea
              ref={inputRef}
              value={input}
              rows={lines.length}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              aria-label="Terminal input"
              onChange={(e) => {
                setInput(e.target.value);
                histIdx.current = -1;
              }}
              onKeyDown={onKeyDown}
              className="min-w-0 flex-1 resize-none overflow-hidden bg-transparent p-0 font-mono text-[12.5px] leading-[1.6] text-[#e6edf3] caret-[#7ee787] outline-none"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function TermButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button onClick={onClick} aria-label={label} className="rounded-md p-1.5 text-[#8b949e] transition-colors hover:bg-white/5 hover:text-[#e6edf3] [&>svg]:size-4">
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
