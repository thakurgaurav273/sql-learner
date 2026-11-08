import { useState } from 'react';
import type { Exercise } from '../content/types';
import { api, type CheckResponse } from '../api';
import { usePlayground } from '../state';
import { Markdown, CodeBlock } from './Markdown';
import { DataTable } from './DataTable';
import { ErrorBox } from './ErrorBox';

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
    <div className={`card exercise ${isSolved ? 'solved' : ''}`}>
      <div className="card-head">
        <span className="status-icon" title={isSolved ? 'Solved' : 'Not solved yet'}>
          {isSolved ? '✅' : '⬜'}
        </span>
        <h3>
          Exercise {n}: {ex.title}
        </h3>
        {ex.ordered && <span className="chip" title="Row order is checked">ordered</span>}
        {ex.verify && <span className="chip" title="Your statement changes data; the checker runs it in a transaction that is rolled back, then compares the resulting table">modifies data</span>}
      </div>
      <div className="card-body">
        <Markdown md={ex.prompt} />
        <div className="actions">
          <button className="btn" onClick={start}>
            ✎ Start in editor
          </button>
          <button className="btn primary" onClick={check} disabled={checking}>
            {checking ? <span className="spinner" /> : '✓'} Check my answer
          </button>
          {ex.hint && (
            <button className="btn ghost" onClick={() => setHint((h) => !h)}>
              💡 {hint ? 'Hide hint' : 'Hint'}
            </button>
          )}
          <button className="btn ghost" onClick={() => setSolution((s) => !s)}>
            {solution ? 'Hide solution' : 'Show solution'}
          </button>
        </div>
        {hint && ex.hint && (
          <div className="hint">
            <Markdown md={ex.hint} />
          </div>
        )}
        {solution && (
          <div style={{ marginTop: 10 }}>
            <CodeBlock sql={ex.solution} />
          </div>
        )}
        {result && (
          <div className={`check-result ${result.pass ? 'pass' : 'fail'}`}>
            <div className="reason">{result.pass ? '✅ Correct! Your result matches the expected result.' : `✗ ${result.reason ?? 'Not quite.'}`}</div>
            {result.note && <div style={{ color: 'var(--text-2)', marginTop: 4 }}>{result.note}</div>}
            {result.error && <ErrorBox error={result.error} text={checkedText?.text} offset={checkedText?.offset} />}
            {!result.pass && !!result.missing?.length && result.expected && (
              <>
                <h5>
                  Expected but missing from your result ({result.missingCount})
                </h5>
                <div className="mini-table">
                  <DataTable fields={result.expected.fields} rows={result.missing} rowClass={() => 'missing'} />
                </div>
              </>
            )}
            {!result.pass && !!result.extra?.length && result.actual && (
              <>
                <h5>In your result but not expected ({result.extraCount})</h5>
                <div className="mini-table">
                  <DataTable fields={result.actual.fields} rows={result.extra} rowClass={() => 'extra'} />
                </div>
              </>
            )}
            {!result.pass && result.expected && (
              <div style={{ marginTop: 8 }}>
                <button className="btn small" onClick={() => setShowExpected((s) => !s)}>
                  {showExpected ? 'Hide' : 'Show'} expected result ({result.expected.total} rows)
                </button>
              </div>
            )}
            {showExpected && result.expected && (
              <div className="mini-table" style={{ marginTop: 6 }}>
                <DataTable fields={result.expected.fields} rows={result.expected.rows} />
              </div>
            )}
          </div>
        )}
        <div className="check-note">
          "Check" runs the query in the editor (or just the selected text) against a pristine copy of the seed data{ex.verify ? ' inside a transaction that is rolled back' : ''}, and compares it with the reference solution{ex.ordered ? ' - row order matters here' : ' - row order does not matter'}.
        </div>
      </div>
    </div>
  );
}
