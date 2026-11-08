import { useState } from 'react';
import { ArrowDownUp, Check, CircleCheck, CircleX, Eye, EyeOff, Info, Lightbulb, Loader2, PencilLine, SquarePen, Table2 } from 'lucide-react';
import type { Exercise } from '../content/types';
import { api, type CheckResponse } from '../api';
import { usePlayground } from '../state';
import { Markdown, CodeBlock } from './Markdown';
import { DataTable } from './DataTable';
import { ErrorBox } from './ErrorBox';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function ExerciseCard({ ex, n }: { ex: Exercise; n: number }) {
  const { loadSql, getEditorText, solved, markSolved } = usePlayground();
  const [hint, setHint] = useState(false);
  const [solution, setSolution] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<CheckResponse | null>(null);
  const [checkedText, setCheckedText] = useState<{ text: string; offset: number } | null>(null);
  const [showExpected, setShowExpected] = useState(false);
  const isSolved = solved.has(ex.id);

  const start = () => {
    const comment = `-- Exercise: ${ex.title}\n` + ex.prompt.replace(/\*\*|`/g, '').split('\n').map((l) => `-- ${l}`.trimEnd()).join('\n');
    loadSql(`${comment}\n\n${ex.starter ?? ''}`);
  };

  const check = async () => {
    const { text, offset } = getEditorText();
    setChecking(true);
    setShowExpected(false);
    try {
      const r = await api.check({ sql: text, solution: ex.solution, ordered: ex.ordered, verify: ex.verify });
      setResult(r);
      setCheckedText({ text, offset });
      if (r.pass) markSolved(ex.id);
    } catch (e) {
      setResult({ pass: false, reason: (e as Error).message });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border bg-card shadow-[var(--shadow-card)] transition-colors',
        isSolved && 'border-success/40',
      )}
      data-testid="exercise"
      data-solved={isSolved || undefined}
    >
      <div className={cn('flex items-center gap-3 border-b px-4 py-3', isSolved ? 'bg-success-soft/50' : 'bg-muted/30')}>
        {isSolved ? (
          <CircleCheck className="size-5 flex-none fill-success text-card" />
        ) : (
          <span className="flex size-5 flex-none items-center justify-center rounded-full border-[1.5px] border-muted-foreground/40 text-[10px] font-semibold text-muted-foreground tabular-nums">
            {n}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Exercise {n}</div>
          <h3 className="text-[14.5px] leading-snug font-semibold">{ex.title}</h3>
        </div>
        {ex.ordered && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="gap-1 font-normal text-muted-foreground">
                <ArrowDownUp className="size-3" /> ordered
              </Badge>
            </TooltipTrigger>
            <TooltipContent>Row order is checked</TooltipContent>
          </Tooltip>
        )}
        {ex.verify && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="gap-1 font-normal text-muted-foreground">
                <PencilLine className="size-3" /> modifies data
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-64">Your statement changes data; the checker runs it in a transaction that is rolled back, then compares the resulting table</TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="px-4 pt-3.5 pb-4">
        <Markdown md={ex.prompt} className="md text-[14px] [&>p:last-child]:mb-0" />

        <div className="@container mt-3.5 flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={start}>
            <SquarePen /> Start in editor
          </Button>
          <Button size="sm" onClick={check} disabled={checking} className="shadow-sm" data-action="check">
            {checking ? <Loader2 className="animate-spin" /> : <Check />} Check my answer
          </Button>
          <span className="flex-1" />
          {ex.hint && (
            <Button
              variant="ghost"
              size="sm"
              aria-pressed={hint}
              title={hint ? 'Hide hint' : 'Show a hint'}
              onClick={() => setHint((h) => !h)}
              className={cn('text-muted-foreground', hint && 'bg-warning-soft text-warning hover:bg-warning-soft hover:text-warning')}
            >
              <Lightbulb /> <span className="hidden @[540px]:inline">Hint</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            aria-pressed={solution}
            title={solution ? 'Hide the solution' : 'Show the solution'}
            onClick={() => setSolution((s) => !s)}
            className={cn('text-muted-foreground', solution && 'bg-accent text-foreground')}
          >
            {solution ? <EyeOff /> : <Eye />} <span className="hidden @[540px]:inline">Solution</span>
          </Button>
        </div>

        {hint && ex.hint && (
          <div className="mt-3 flex gap-2.5 rounded-lg border border-warning/30 bg-warning-soft/70 px-3.5 py-2.5 text-[13.5px]">
            <Lightbulb className="mt-0.5 size-4 flex-none text-warning" />
            <Markdown md={ex.hint} className="md text-[13.5px] [&_p]:m-0" />
          </div>
        )}
        {solution && <CodeBlock sql={ex.solution} label="Solution" className="mt-3 mb-0" />}

        {result && (
          <div
            className={cn('mt-3.5 rounded-lg border px-3.5 py-3 text-[13px]', result.pass ? 'border-success/30 bg-success-soft' : 'border-destructive/25 bg-danger-soft/70')}
            data-testid="check-result"
            data-pass={result.pass}
          >
            <div className={cn('flex items-start gap-2 font-semibold', result.pass ? 'text-success' : 'text-destructive')}>
              {result.pass ? <CircleCheck className="mt-px size-4 flex-none" /> : <CircleX className="mt-px size-4 flex-none" />}
              <span className="reason">{result.pass ? 'Correct! Your result matches the expected result.' : result.reason ?? 'Not quite.'}</span>
            </div>
            {result.note && <div className="mt-1 ml-6 text-muted-foreground">{result.note}</div>}
            {result.error && (
              <div className="-mx-3 -mb-3">
                <ErrorBox error={result.error} text={checkedText?.text} offset={checkedText?.offset} />
              </div>
            )}
            {!result.pass && !!result.missing?.length && result.expected && (
              <DiffTable title={`Expected but missing from your result (${result.missingCount})`} tone="missing">
                <DataTable fields={result.expected.fields} rows={result.missing} rowClass={() => 'missing'} />
              </DiffTable>
            )}
            {!result.pass && !!result.extra?.length && result.actual && (
              <DiffTable title={`In your result but not expected (${result.extraCount})`} tone="extra">
                <DataTable fields={result.actual.fields} rows={result.extra} rowClass={() => 'extra'} />
              </DiffTable>
            )}
            {!result.pass && result.expected && (
              <Button variant="outline" size="xs" className="mt-3 bg-card" onClick={() => setShowExpected((s) => !s)}>
                <Table2 /> {showExpected ? 'Hide' : 'Show'} expected result ({result.expected.total} rows)
              </Button>
            )}
            {showExpected && result.expected && (
              <div className="mt-2 max-h-56 overflow-auto rounded-md border bg-card">
                <DataTable fields={result.expected.fields} rows={result.expected.rows} />
              </div>
            )}
          </div>
        )}

        <p className="mt-3 flex items-start gap-1.5 text-[12px] leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-3.5 flex-none" />
          <span>
            Checks the query in the editor (or just the selected text) against a pristine copy of the data{ex.verify ? ' inside a transaction that is rolled back' : ''}.{' '}
            {ex.ordered ? 'Row order matters here.' : 'Row order does not matter.'}
          </span>
        </p>
      </div>
    </div>
  );
}

function DiffTable({ title, tone, children }: { title: string; tone: 'missing' | 'extra'; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <div className="mb-1.5 flex items-center gap-2 text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">
        <span className={cn('size-2 rounded-sm', tone === 'missing' ? 'bg-success' : 'bg-destructive')} />
        {title}
      </div>
      <div className="max-h-56 overflow-auto rounded-md border bg-card">{children}</div>
    </div>
  );
}
