import { useMemo } from 'react';
import { Marked } from 'marked';
import { Copy, PencilLine, Play } from 'lucide-react';
import { highlightSql, escapeHtml } from '../lib/highlight';
import { usePlayground } from '../state';
import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// Lucide icons as plain SVG strings, for the code blocks that marked renders to HTML.
const svg = (inner: string, extra = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${inner}</svg>`;
const ICON_PLAY = svg('<polygon points="6 3 20 12 6 21 6 3" fill="currentColor"/>');
const ICON_COPY = svg('<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>');
const ICON_EDIT = svg('<path d="M13 21h8"/><path d="m15 5 4 4"/><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>');

const BTN_ICON = buttonVariants({ variant: 'ghost', size: 'icon-xs' }) + ' text-muted-foreground hover:text-foreground';
const BTN_LOAD = buttonVariants({ variant: 'ghost', size: 'xs' }) + ' text-muted-foreground hover:text-foreground';
const BTN_RUN = buttonVariants({ variant: 'default', size: 'xs' }) + ' shadow-sm';

// Renders lesson markdown. ```sql fences become code blocks with
// Copy, "Load into editor" and "Run" buttons; ```sql-A / ```sql-B run in that session.
export function Markdown({ md, className = 'md' }: { md: string; className?: string }) {
  const { loadSql, toast } = usePlayground();
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
            const copy = `<button class="${BTN_ICON}" data-copy="${i}" title="Copy" aria-label="Copy">${ICON_COPY}</button>`;
            if (sess) {
              sessions[i] = sess;
              return `<div class="codeblock session-${sess}"><div class="cb-head"><span class="cb-label"><span class="dot"></span>Session ${sess}</span><span class="cb-actions">${copy}<button class="${BTN_RUN}" data-run="${i}">${ICON_PLAY}Run in Session ${sess}</button></span></div><pre><code>${highlightSql(text)}</code></pre></div>`;
            }
            return `<div class="codeblock"><div class="cb-head"><span class="cb-label">SQL</span><span class="cb-actions">${copy}<button class="${BTN_LOAD}" data-load="${i}">${ICON_EDIT}Load into editor</button><button class="${BTN_RUN}" data-run="${i}">${ICON_PLAY}Run</button></span></div><pre><code>${highlightSql(text)}</code></pre></div>`;
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
        if (el.dataset.copy) copyText(codes[Number(el.dataset.copy)], toast);
        if (el.dataset.load) loadSql(codes[Number(el.dataset.load)]);
        if (el.dataset.run) loadSql(codes[Number(el.dataset.run)], { run: true, session: sessions[Number(el.dataset.run)] });
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function copyText(text: string, toast: (m: string, k?: 'ok' | 'err' | 'info') => void) {
  navigator.clipboard?.writeText(text.trim()).then(
    () => toast('Copied to clipboard', 'info'),
    () => toast('Could not copy', 'err'),
  );
}

export function CodeBlock({ sql, label = 'SQL', className, bare, savedId }: { sql: string; label?: string; className?: string; bare?: boolean; savedId?: string }) {
  const { loadSql, toast } = usePlayground();
  return (
    <div className={cn('codeblock', bare && 'm-0 rounded-none border-0', className)}>
      <div className="cb-head">
        <span className="cb-label">{label}</span>
        <span className="cb-actions">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-xs" className="text-muted-foreground hover:text-foreground" onClick={() => copyText(sql, toast)} aria-label="Copy">
                <Copy />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy</TooltipContent>
          </Tooltip>
          <Button variant="ghost" size="xs" className="text-muted-foreground hover:text-foreground" onClick={() => loadSql(sql, { savedId })}>
            <PencilLine /> Load into editor
          </Button>
          <Button size="xs" className="shadow-sm" onClick={() => loadSql(sql, { run: true, savedId })}>
            <Play className="fill-current" /> Run
          </Button>
        </span>
      </div>
      <pre>
        <code dangerouslySetInnerHTML={{ __html: highlightSql(sql) }} />
      </pre>
    </div>
  );
}
