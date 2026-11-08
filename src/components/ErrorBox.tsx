import type { SqlError } from '../api';
import { usePlayground } from '../state';

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
  return (
    <div className="errorbox" role="alert">
      <div className="title">
        <span className="msg">ERROR: {error.message}</span>
        {error.code && (
          <span className="code">
            SQLSTATE {error.code}
            {error.codeName ? ` (${error.codeName})` : ''}
          </span>
        )}
      </div>
      <dl>
        {multi && (
          <>
            <dt>Statement</dt>
            <dd>
              {error.statementIndex! + 1} of {error.statementCount} failed
              {error.statementIndex! > 0 ? ' - the statements before it ran successfully (see below)' : ''}; the rest were not run.
            </dd>
          </>
        )}
        {error.detail && (
          <>
            <dt>Detail</dt>
            <dd>{error.detail}</dd>
          </>
        )}
        {error.hint && (
          <>
            <dt>Hint</dt>
            <dd>{error.hint}</dd>
          </>
        )}
        {error.constraint && (
          <>
            <dt>Constraint</dt>
            <dd>
              <code>{error.constraint}</code>
              {error.table ? ` on table ${error.table}` : ''}
            </dd>
          </>
        )}
        {error.where && (
          <>
            <dt>Where</dt>
            <dd>{error.where}</dd>
          </>
        )}
      </dl>
      {snippet && (
        <pre className="snippet">
          {`line ${snippet.line}: ${snippet.src}\n`}
          <span className="caret">{' '.repeat(`line ${snippet.line}: `.length + snippet.col - 1)}^</span>
        </pre>
      )}
      {error.tip && (
        <div className="tip">
          <b>Tip:</b> {error.tip}
        </div>
      )}
      {snippet && (
        <div className="actions">
          <button className="btn small" onClick={jump}>
            Show in editor
          </button>
        </div>
      )}
    </div>
  );
}
