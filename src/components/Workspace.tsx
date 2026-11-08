import { useEffect, useMemo, useRef, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { sql as sqlLang, PostgreSQL } from '@codemirror/lang-sql';
import { keymap, EditorView } from '@codemirror/view';
import { Prec } from '@codemirror/state';
import { lintGutter } from '@codemirror/lint';
import { ChevronDown, ChevronRight, CircleCheck, CircleX, Eraser, History, Info, Loader2, Play, SquareTerminal, TriangleAlert } from 'lucide-react';
import { usePlayground } from '../state';
import { DataTable } from './DataTable';
import { ErrorBox } from './ErrorBox';
import { PanelHeader, IconButton } from './PanelHeader';
import type { StatementResult } from '../api';
import { useDrag, useStoredNumber } from './layout';
import { editorTheme } from '@/lib/editor-theme';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
export const MOD = isMac ? '⌘' : 'Ctrl';

export function Workspace() {
  const { sql, setSql, session, setSession, txStatus, running, runEditor, cancel, editorView, schema, history, loadSql } = usePlayground();
  const runRef = useRef(runEditor);
  runRef.current = runEditor;
  const [editorHeight, setEditorHeight] = useStoredNumber('sqlpg.editorH', 300);
  const wrapRef = useRef<HTMLDivElement>(null);
  const drag = useDrag((dy, start) => setEditorHeight(Math.max(90, Math.min(start + dy, (wrapRef.current?.clientHeight ?? 800) - 140))), editorHeight, 'y');

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

  const tx = txStatus[session];

  return (
    <div className="flex min-h-0 flex-1 flex-col" ref={wrapRef}>
      <PanelHeader
        icon={<SquareTerminal />}
        title="Query editor"
        actions={
          <span className="hidden items-center gap-1.5 text-[12px] text-muted-foreground lg:flex">
            <KbdGroup>
              <Kbd>{MOD}</Kbd>
              <Kbd>↵</Kbd>
            </KbdGroup>
            to run · select text to run just that part
          </span>
        }
      />
      <div className="@container flex flex-none items-center gap-2 border-b px-3 py-2" data-testid="toolbar">
        {running ? (
          <Button size="sm" variant="destructive" onClick={cancel} data-action="stop">
            <Loader2 className="animate-spin" /> Stop
          </Button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" onClick={runEditor} data-action="run" className="gap-2 pr-2 shadow-sm">
                <Play className="fill-current" /> Run
                <span className="ml-0.5 hidden rounded bg-primary-foreground/15 px-1.5 py-px text-[10.5px] font-medium @[440px]:inline">{MOD} ↵</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Run the editor (or just the selected text)</TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={session}
              onValueChange={(v) => v && setSession(v as 'A' | 'B')}
              data-testid="sessions"
            >
              {(['A', 'B'] as const).map((s) => (
                <ToggleGroupItem key={s} value={s} className="gap-1.5 px-2.5 text-[12.5px] data-[state=on]:bg-brand-soft data-[state=on]:text-primary @[400px]:px-3">
                  <span className="hidden @[400px]:inline">Session</span> {s}
                  {txStatus[s] && txStatus[s] !== 'idle' && (
                    <span
                      className={cn(
                        'rounded px-1 text-[9.5px] font-bold tracking-wide',
                        txStatus[s] === 'in-transaction' ? 'bg-warning-soft text-warning' : 'bg-danger-soft text-destructive',
                      )}
                    >
                      {txStatus[s] === 'in-transaction' ? 'TX' : 'TX ✕'}
                    </span>
                  )}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </TooltipTrigger>
          <TooltipContent className="max-w-64">Two separate database connections. Use them to see how two transactions interact (Transactions lesson).</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" disabled={!history.length} className="text-muted-foreground" aria-label="History">
              <History /> <span className="hidden @[520px]:inline">History</span> <ChevronDown className="opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[min(460px,80vw)]">
            <DropdownMenuLabel className="text-xs text-muted-foreground">Recent queries</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="max-h-80 overflow-y-auto">
              {history.map((h, i) => (
                <DropdownMenuItem key={i} onSelect={() => loadSql(h)} title={h} className="block truncate font-mono text-[12px]">
                  {h.replace(/\s+/g, ' ')}
                </DropdownMenuItem>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="flex-1" />
        <IconButton label="Clear the editor" icon={<Eraser />} onClick={() => loadSql('')} />
      </div>

      {tx !== 'idle' && (
        <div
          className={cn(
            'flex flex-none items-start gap-2 border-b px-3.5 py-2 text-[12.5px]',
            tx === 'in-transaction' ? 'bg-warning-soft text-warning' : 'bg-danger-soft text-destructive',
          )}
        >
          <TriangleAlert className="mt-px size-3.5 flex-none" />
          <span>
            {tx === 'in-transaction'
              ? `Session ${session} has an open transaction. Its changes are invisible to other sessions until you run COMMIT (or undo them with ROLLBACK).`
              : `Session ${session}: the transaction failed. Every statement will be rejected until you run ROLLBACK.`}
          </span>
        </div>
      )}

      <div className="editor-wrap relative min-h-20 flex-none overflow-hidden bg-code" style={{ height: editorHeight }}>
        <CodeMirror
          value={sql}
          height="100%"
          theme={editorTheme}
          extensions={extensions}
          onChange={(v) => setSql(v)}
          onCreateEditor={(view) => {
            editorView.current = view;
          }}
          basicSetup={{ foldGutter: false, highlightActiveLine: true, highlightActiveLineGutter: true }}
        />
      </div>
      <div className={cn('gutter h', drag.dragging && 'dragging')} onMouseDown={drag.onMouseDown} />
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
      <div className="flex min-h-0 flex-1 flex-col" data-testid="results">
        <ResultsHeader>
          <span className="font-medium text-foreground">Results</span>
        </ResultsHeader>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          {running ? (
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          ) : (
            <>
              <div className="flex size-11 items-center justify-center rounded-xl border bg-muted/60 text-muted-foreground">
                <Play className="size-5" />
              </div>
              <div>
                <div className="text-[13.5px] font-medium">Run a query to see results</div>
                <div className="mt-1 flex items-center justify-center gap-1.5 text-[12.5px] text-muted-foreground">
                  Press
                  <KbdGroup>
                    <Kbd>{MOD}</Kbd>
                    <Kbd>↵</Kbd>
                  </KbdGroup>
                  or click Run · Session {session}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }
  const { response, clientError } = run;
  const results = response?.results ?? [];
  const lastWithRows = [...results].reverse().find((r) => r.fields.length > 0);
  const isOpen = (r: StatementResult) => open[r.index] ?? (results.length === 1 || r === lastWithRows || r.fields.length === 0);
  const total = results.reduce((s, r) => s + r.durationMs, 0);
  const failed = !!response?.error || !!clientError;

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="results">
      <ResultsHeader session={run.ranSession}>
        {running ? (
          <>
            <Loader2 className="size-3.5 animate-spin text-primary" /> <span>Running…</span>
          </>
        ) : clientError ? (
          <>
            <CircleX className="size-3.5 text-destructive" /> <span className="text-destructive">Request failed</span>
          </>
        ) : (
          <>
            {failed ? <CircleX className="size-3.5 text-destructive" /> : <CircleCheck className="size-3.5 text-success" />}
            <span>
              <span className="font-medium text-foreground">
                {results.length} statement{results.length === 1 ? '' : 's'} ran
              </span>
              {response?.error ? ', then an error' : ''}
              <span className="mx-1.5 text-border">•</span>
              {total.toFixed(1)} ms
            </span>
          </>
        )}
      </ResultsHeader>
      <ScrollArea className="min-h-0 flex-1" horizontal>
        {clientError && <div className="m-3 rounded-lg border border-destructive/30 bg-danger-soft p-3 text-[13px] text-destructive">{clientError}</div>}
        {response?.error && <ErrorBox error={response.error} text={run.ranText} offset={run.ranOffset} />}
        {results.map((r) =>
          results.length === 1 && r.fields.length > 0 ? (
            <ResultBody key={r.index} r={r} />
          ) : (
            <div className="border-b" key={r.index} data-testid="statement">
              <button
                className="flex w-full items-center gap-2 bg-muted/40 px-3 py-1.5 text-left text-[12px] transition-colors hover:bg-muted"
                onClick={() => setOpen((o) => ({ ...o, [r.index]: !isOpen(r) }))}
              >
                <ChevronRight className={cn('size-3.5 flex-none text-muted-foreground transition-transform', isOpen(r) && 'rotate-90')} />
                <Badge variant="secondary" className="rounded px-1.5 py-0 font-mono text-[10.5px] font-semibold">
                  {r.command}
                </Badge>
                <span className="min-w-0 flex-1 truncate font-mono text-muted-foreground">{r.sql.replace(/\s+/g, ' ')}</span>
                <span className="whitespace-nowrap text-muted-foreground">{summary(r)}</span>
              </button>
              {isOpen(r) && r.fields.length > 0 && <ResultBody r={r} />}
            </div>
          ),
        )}
      </ScrollArea>
    </div>
  );
}

function ResultsHeader({ children, session }: { children: React.ReactNode; session?: string }) {
  return (
    <div className="flex h-10 flex-none items-center gap-2 border-b px-3.5 text-[12.5px] text-muted-foreground">
      {children}
      <span className="flex-1" />
      {session && (
        <Badge variant="outline" className="font-normal text-muted-foreground">
          Session {session}
        </Badge>
      )}
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
      {r.truncated && (
        <div className="flex items-center gap-2 bg-warning-soft px-3.5 py-1.5 text-[12px] text-warning">
          <TriangleAlert className="size-3.5" /> Showing the first {r.rows.length} rows only: the query returned more. Add a LIMIT or a WHERE clause.
        </div>
      )}
      {r.fields.length > 0 && r.rows.length === 0 && (
        <div className="flex items-center gap-2 bg-muted/50 px-3.5 py-1.5 text-[12px] text-muted-foreground">
          <Info className="size-3.5" /> The query returned 0 rows.
        </div>
      )}
      {isPlan ? (
        <pre className="plan" dangerouslySetInnerHTML={{ __html: highlightPlan(r.rows.map((x) => x[0] ?? '').join('\n')) }} />
      ) : (
        r.rows.length > 0 && <DataTable fields={r.fields} rows={r.rows} />
      )}
      <div className="flex h-8 items-center gap-2 border-t px-3.5 text-[11.5px] text-muted-foreground">
        <span className="font-mono font-medium text-foreground/70">{r.command}</span>
        <span>·</span>
        <span>{summary(r)}</span>
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
