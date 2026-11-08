import { Crosshair, Lightbulb, OctagonX } from 'lucide-react';
import type { SqlError } from '../api';
import { usePlayground } from '../state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// Shows a Postgres error with everything useful: message, SQLSTATE, detail/hint,
// the offending line with a caret under the error position, and a learning tip.
export function ErrorBox({ error, text, offset = 0 }: { error: SqlError; text?: string; offset?: number }) {
  const { editorView } = usePlayground();
  let snippet: { line: number; col: number; src: string } | null = null;
  if (error.position !== undefined && text !== undefined) {
    const pos = Math.min(error.position, text.length);
    const before = text.slice(0, pos);
    const lineStart = before.lastIndexOf('\n') + 1;
    const lineEnd = text.indexOf('\n', pos);
    const docBefore = editorView.current ? editorView.current.state.doc.lineAt(Math.min(offset + pos, editorView.current.state.doc.length)).number : before.split('\n').length;
    let src = text.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
    let col = pos - lineStart + 1;
    // long line: show a window around the error position
    if (src.length > 90 && col > 50) {
      const from = col - 45;
      src = '…' + src.slice(from, from + 90) + (src.length > from + 90 ? '…' : '');
      col = 46;
    } else if (src.length > 90) src = src.slice(0, 90) + '…';
    snippet = { line: docBefore, col, src };
  }
  const jump = () => {
    const v = editorView.current;
    if (!v || error.position === undefined) return;
    const at = Math.min(offset + error.position, v.state.doc.length);
    v.dispatch({ selection: { anchor: at }, scrollIntoView: true });
    v.focus();
  };
  const multi = (error.statementCount ?? 1) > 1;
  const rows: [string, React.ReactNode][] = [];
  if (multi)
    rows.push([
      'Statement',
      `${error.statementIndex! + 1} of ${error.statementCount} failed${error.statementIndex! > 0 ? '; the statements before it ran successfully (see below)' : ''}; the rest were not run.`,
    ]);
  if (error.detail) rows.push(['Detail', error.detail]);
  if (error.hint) rows.push(['Hint', error.hint]);
  if (error.constraint)
    rows.push([
      'Constraint',
      <>
        <code className="rounded bg-card px-1 py-0.5 text-[12px]">{error.constraint}</code>
        {error.table ? ` on table ${error.table}` : ''}
      </>,
    ]);
  if (error.where) rows.push(['Where', error.where]);

  return (
    <div className="m-3 rounded-xl border border-destructive/25 bg-danger-soft/70 p-4 text-[13px]" role="alert" data-testid="error">
      <div className="flex items-start gap-2.5">
        <OctagonX className="mt-0.5 size-4 flex-none text-destructive" />
        <div className="min-w-0 flex-1">
          <div className="text-[14px] leading-snug font-semibold text-destructive">{error.message}</div>
          {error.code && (
            <Badge variant="outline" className="mt-1.5 border-destructive/25 bg-card/60 font-mono text-[11px] font-normal text-muted-foreground">
              SQLSTATE {error.code}
              {error.codeName ? ` · ${error.codeName}` : ''}
            </Badge>
          )}
        </div>
      </div>

      {rows.length > 0 && (
        <dl className="mt-3 ml-6.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-[12px] font-medium text-muted-foreground">{k}</dt>
              <dd className="m-0">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-3 ml-6.5 space-y-2.5">
        {snippet && (
          <pre className="err-snippet">
            {`line ${snippet.line}: ${snippet.src}\n`}
            <span className="caret">{' '.repeat(`line ${snippet.line}: `.length + snippet.col - 1)}^</span>
          </pre>
        )}
        {error.tip && (
          <div className="flex gap-2.5 rounded-lg border bg-card p-3 leading-relaxed">
            <Lightbulb className="mt-0.5 size-4 flex-none text-warning" />
            <div>
              <span className="font-semibold">Tip: </span>
              {error.tip}
            </div>
          </div>
        )}
        {snippet && (
          <Button variant="outline" size="xs" onClick={jump} className="bg-card">
            <Crosshair /> Show in editor
          </Button>
        )}
      </div>
    </div>
  );
}
