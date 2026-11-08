import { useMemo } from 'react';
import { Marked } from 'marked';
import { highlightSql, escapeHtml } from '../lib/highlight';
import { usePlayground } from '../state';

// Renders lesson markdown. ```sql fences become code blocks with
// "Load into editor" and "Run" buttons.
export function Markdown({ md, className = 'md' }: { md: string; className?: string }) {
  const { loadSql } = usePlayground();
  const { html, codes, sessions } = useMemo(() => {
    const codes: string[] = [];
    const sessions: Record<number, 'A' | 'B'> = {};
    const marked = new Marked({
      gfm: true,
      renderer: {
        code({ text, lang }) {
          const m = /^sql(?:-([AB]))?$/i.exec((lang ?? '').trim());
          if (m) {
            const i = codes.push(text) - 1;
            const sess = m[1]?.toUpperCase() as 'A' | 'B' | undefined;
            if (sess) {
              sessions[i] = sess;
              return `<div class="codeblock session-${sess}"><div class="session-label">Session ${sess}</div><pre><code>${highlightSql(text)}</code></pre><div class="cb-actions"><button class="btn small primary" data-run="${i}">&#9654; Run in Session ${sess}</button></div></div>`;
            }
            return `<div class="codeblock"><pre><code>${highlightSql(text)}</code></pre><div class="cb-actions"><button class="btn small" data-load="${i}">Load into editor</button><button class="btn small primary" data-run="${i}">&#9654; Run</button></div></div>`;
          }
          return `<div class="codeblock plain"><pre><code>${escapeHtml(text)}</code></pre></div>`;
        },
      },
    });
    return { html: marked.parse(md.replace(/^\n+/, '')) as string, codes, sessions };
  }, [md]);

  return (
    <div
      className={className}
      onClick={(e) => {
        const el = (e.target as HTMLElement).closest('button');
        if (!el) return;
        if (el.dataset.load) loadSql(codes[Number(el.dataset.load)]);
        if (el.dataset.run) loadSql(codes[Number(el.dataset.run)], { run: true, session: sessions[Number(el.dataset.run)] });
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function CodeBlock({ sql }: { sql: string }) {
  const { loadSql } = usePlayground();
  return (
    <div className="codeblock">
      <pre>
        <code dangerouslySetInnerHTML={{ __html: highlightSql(sql) }} />
      </pre>
      <div className="cb-actions">
        <button className="btn small" onClick={() => loadSql(sql)}>
          Load into editor
        </button>
        <button className="btn small primary" onClick={() => loadSql(sql, { run: true })}>
          &#9654; Run
        </button>
      </div>
    </div>
  );
}
