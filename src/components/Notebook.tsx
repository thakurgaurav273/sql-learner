import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BookmarkPlus, Bookmark, Database, Download, FileCode2, Loader2, MoreHorizontal, NotebookPen, PencilLine, Play, Search, SquarePen, Trash2, X } from 'lucide-react';
import { useSwitch } from './Databases';
import type { SavedQuery } from '../api';
import { lessons } from '../content';
import { usePlayground } from '../state';
import { Markdown, CodeBlock } from './Markdown';
import { IconButton } from './PanelHeader';
import { sameSql } from './SaveQueryDialog';
import { fullDate, timeAgo } from '@/lib/time';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const lessonTitle = (id: string | null) => (id ? lessons.find((l) => l.id === id)?.title ?? null : null);
const firstLine = (s: string) =>
  s
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith('--')) ?? '';

function download(name: string, text: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** One .sql file with every saved query, its notes as comments. */
function toSqlFile(items: SavedQuery[]) {
  const comment = (s: string) => s.split('\n').map((l) => `-- ${l}`.trimEnd()).join('\n');
  const parts = items.map((q) => {
    const meta = [`Saved: ${fullDate(q.updatedAt)}`, lessonTitle(q.lessonId) && `Lesson: ${lessonTitle(q.lessonId)}`].filter(Boolean).join(' · ');
    return [`-- ${'='.repeat(70)}`, `-- ${q.title}`, `-- ${meta}`, q.notes.trim() ? `--\n${comment(q.notes.trim())}` : null, `-- ${'='.repeat(70)}`, q.sql.trimEnd()].filter(Boolean).join('\n');
  });
  return `-- SQL Playground notebook, exported ${fullDate(new Date().toISOString())}\n-- ${items.length} saved quer${items.length === 1 ? 'y' : 'ies'}\n\n${parts.join('\n\n\n')}\n`;
}
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'query';

// ---------------------------------------------------------------------------
// Sidebar list ("Saved" tab)
// ---------------------------------------------------------------------------
export function SavedList() {
  const { saved, savedLoaded, savedError, savedViewId, setSavedViewId, linkedSavedId, sql, setSaveDialogOpen, toast, status } = usePlayground();
  const practiceDb = status?.practiceDatabase ?? 'learn';
  const [filter, setFilter] = useState('');
  const f = filter.trim().toLowerCase();
  const items = useMemo(
    () => saved.filter((q) => !f || q.title.toLowerCase().includes(f) || q.notes.toLowerCase().includes(f) || q.sql.toLowerCase().includes(f)),
    [saved, f],
  );
  const saveCurrent = () => (sql.trim() ? setSaveDialogOpen(true) : toast('Nothing to save yet: write a query first.', 'info'));

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="saved-list">
      <div className="flex flex-none items-center gap-1.5 p-2.5 pb-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search saved queries…" className="h-8 bg-card pr-7 pl-8 text-[13px] shadow-none" />
          {filter && (
            <button onClick={() => setFilter('')} className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground" aria-label="Clear search">
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <IconButton
          label="Export all as .sql"
          icon={<Download />}
          disabled={!saved.length}
          onClick={() => download(`sql-playground-notebook-${new Date().toISOString().slice(0, 10)}.sql`, toSqlFile(saved))}
        />
      </div>
      <div className="flex-none px-2.5 pb-2">
        <Button variant="outline" size="sm" className="w-full justify-start bg-card text-[12.5px]" onClick={saveCurrent} data-action="save-current">
          <BookmarkPlus className="text-primary" /> Save the current query
          <span className="ml-auto text-[11px] text-muted-foreground">{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl+'}S</span>
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="px-2.5 pb-4">
          {savedError && <div className="rounded-lg border border-destructive/25 bg-danger-soft p-3 text-[12.5px] text-destructive">{savedError}</div>}
          {!savedLoaded && (
            <div className="flex justify-center p-6">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          )}
          {savedLoaded && !savedError && saved.length === 0 && (
            <div className="mt-6 flex flex-col items-center gap-2 px-3 text-center">
              <div className="flex size-10 items-center justify-center rounded-xl border bg-card text-muted-foreground">
                <NotebookPen className="size-5" />
              </div>
              <div className="text-[13px] font-medium">Your notebook is empty</div>
              <p className="text-[12px] leading-relaxed text-muted-foreground">Write a query in the editor and save it with notes. Use it to keep queries you're proud of, or to write down what you learned.</p>
            </div>
          )}
          {saved.length > 0 && items.length === 0 && <div className="p-4 text-center text-[12.5px] text-muted-foreground">Nothing matches “{filter}”.</div>}
          <div className="flex flex-col gap-1">
            {items.map((q) => {
              const active = q.id === savedViewId;
              const inEditor = q.id === linkedSavedId;
              const dirty = inEditor && !sameSql(sql, q.sql);
              const lt = lessonTitle(q.lessonId);
              return (
                <button
                  key={q.id}
                  onClick={() => setSavedViewId(q.id)}
                  aria-current={active ? 'page' : undefined}
                  data-saved={q.id}
                  className={cn(
                    'group flex w-full flex-col gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors',
                    active ? 'border-primary/30 bg-brand-soft' : 'border-transparent hover:border-border hover:bg-card',
                  )}
                >
                  <span className="flex w-full items-center gap-1.5">
                    <span className={cn('min-w-0 flex-1 truncate text-[13px] font-medium', active && 'text-primary')}>{q.title}</span>
                    {inEditor && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className={cn('size-1.5 flex-none rounded-full', dirty ? 'bg-warning' : 'bg-success')} />
                        </TooltipTrigger>
                        <TooltipContent side="right">{dirty ? 'Open in the editor, with unsaved changes' : 'Open in the editor'}</TooltipContent>
                      </Tooltip>
                    )}
                  </span>
                  {q.notes.trim() ? (
                    <span className="line-clamp-2 text-[12px] leading-snug text-muted-foreground">{q.notes.replace(/[#*`>_~]/g, '').trim()}</span>
                  ) : (
                    <span className="truncate font-mono text-[11px] text-muted-foreground/80">{firstLine(q.sql)}</span>
                  )}
                  <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground/80">
                    {q.database && q.database !== practiceDb && (
                      <span className="flex max-w-[45%] items-center gap-1 truncate rounded bg-muted px-1.5 py-px font-mono text-[10.5px]">
                        <Database className="size-2.5 flex-none" />
                        {q.database}
                      </span>
                    )}
                    {lt && <span className="max-w-[50%] truncate rounded bg-muted px-1.5 py-px text-[10.5px]">{lt}</span>}
                    <span>{timeAgo(q.updatedAt)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </ScrollArea>
      <div className="flex-none border-t px-3 py-2 text-[11px] leading-snug text-muted-foreground">
        Saved on this computer in <code className="text-[10.5px]">data/saved-queries.json</code>. Reset DB doesn't touch them.
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Middle panel: one saved query with its notes
// ---------------------------------------------------------------------------
export function SavedQueryView({ query, backTo, onBack, goLesson }: { query: SavedQuery; backTo: string; onBack: () => void; goLesson: (id: string) => void }) {
  const { loadSql, linkedSavedId, sql, updateSaved, deleteSaved, toast, setSaveDialogOpen, status, databases } = usePlayground();
  const sw = useSwitch();
  const dbExists = !!query.database && !!databases?.databases.some((d) => d.name === query.database);
  const otherDb = !!query.database && !!status && query.database !== status.database;
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(query.title);
  const [notes, setNotes] = useState(query.notes);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    setEditing(false);
    setTitle(query.title);
    setNotes(query.notes);
  }, [query.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const inEditor = linkedSavedId === query.id;
  const dirty = inEditor && !sameSql(sql, query.sql);
  const lt = lessonTitle(query.lessonId);

  const saveEdits = async () => {
    setBusy(true);
    try {
      await updateSaved(query.id, { title: title.trim() || 'Untitled query', notes });
      setEditing(false);
      toast('Notes saved');
    } catch (e) {
      toast(`Could not save: ${(e as Error).message}`, 'err');
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    try {
      await deleteSaved(query.id);
      toast(`Deleted “${query.title}”`);
    } catch (e) {
      toast(`Could not delete: ${(e as Error).message}`, 'err');
    }
  };

  return (
    <ScrollArea className="min-h-0 flex-1">
      <article className="mx-auto max-w-[860px] px-7 pt-5 pb-16" data-testid="saved-view">
        <Button variant="ghost" size="xs" className="-ml-2 text-muted-foreground" onClick={onBack}>
          <ArrowLeft /> Back to {backTo}
        </Button>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
          <Badge variant="secondary" className="gap-1 font-medium">
            <Bookmark className="size-3" /> Saved query
          </Badge>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>Updated {timeAgo(query.updatedAt)}</span>
            </TooltipTrigger>
            <TooltipContent>
              Created {fullDate(query.createdAt)}
              <br />
              Updated {fullDate(query.updatedAt)}
            </TooltipContent>
          </Tooltip>
          {lt && (
            <>
              <span className="text-border">•</span>
              <button className="underline-offset-2 hover:text-foreground hover:underline" onClick={() => goLesson(query.lessonId!)}>
                Lesson: {lt}
              </button>
            </>
          )}
          {query.database && (
            <>
              <span className="text-border">•</span>
              <span className="flex items-center gap-1">
                <Database className="size-3" /> Database: <code className="font-mono">{query.database}</code>
                {!dbExists && databases && <span className="text-warning">(deleted)</span>}
              </span>
            </>
          )}
        </div>
        {otherDb && dbExists && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/25 bg-brand-soft/60 px-3 py-2 text-[12.5px]" data-testid="saved-db-hint">
            <Database className="size-3.5 text-primary" />
            Written for <code className="font-mono">{query.database}</code>; the editor is using <code className="font-mono">{status!.database}</code>.
            <Button size="xs" variant="outline" className="ml-auto bg-card" onClick={() => sw.request(query.database!)} data-action="switch-to-saved-db">
              Switch to {query.database}
            </Button>
          </div>
        )}
        {sw.confirm}

        {editing ? (
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            autoFocus
            className="mt-3 h-auto py-1.5 text-[22px] font-semibold tracking-tight md:text-[22px]"
            aria-label="Title"
          />
        ) : (
          <h1 className="mt-3 text-[28px] leading-tight font-semibold tracking-tight break-words">{query.title}</h1>
        )}

        {!editing && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => loadSql(query.sql, { savedId: query.id })} className="shadow-sm" data-action="open-in-editor">
              <SquarePen /> Open in editor
            </Button>
            <Button size="sm" variant="outline" onClick={() => loadSql(query.sql, { savedId: query.id, run: true })}>
              <Play className="fill-current" /> Run
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(true)} data-action="edit-notes">
              <PencilLine /> Edit notes
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon-sm" variant="ghost" aria-label="More actions" className="text-muted-foreground">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onSelect={() => download(`${slug(query.title)}.sql`, toSqlFile([query]))}>
                  <FileCode2 /> Download as .sql
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)} data-action="delete">
                  <Trash2 /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {inEditor && (
          <div
            className={cn(
              'mt-4 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-[12.5px]',
              dirty ? 'border-warning/30 bg-warning-soft text-warning' : 'border-success/25 bg-success-soft text-success',
            )}
            data-testid="linked-banner"
          >
            <span className={cn('size-1.5 rounded-full', dirty ? 'bg-warning' : 'bg-success')} />
            {dirty ? 'Open in the editor, with changes that are not saved yet.' : 'Open in the editor. Changes you make there can be saved back here.'}
            {dirty && (
              <Button size="xs" variant="outline" className="ml-auto bg-card text-foreground" onClick={() => setSaveDialogOpen(true)}>
                Save changes…
              </Button>
            )}
          </div>
        )}

        <section className="mt-7">
          <h2 className="mb-2.5 text-[12px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">Notes</h2>
          {editing ? (
            <div className="space-y-2">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault();
                    saveEdits();
                  }
                  if (e.key === 'Escape') setEditing(false);
                }}
                placeholder={'Write anything: what the query does, why it works, what tripped you up.\n**bold**, `code`, lists and ```sql blocks are supported.'}
                className="min-h-48 bg-card text-[14px] leading-relaxed"
                data-testid="notes-editor"
              />
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={saveEdits} disabled={busy} data-action="save-notes">
                  {busy && <Loader2 className="animate-spin" />} Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditing(false);
                    setTitle(query.title);
                    setNotes(query.notes);
                  }}
                >
                  Cancel
                </Button>
                <span className="ml-auto text-[11.5px] text-muted-foreground">Markdown supported · {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+Enter to save</span>
              </div>
            </div>
          ) : query.notes.trim() ? (
            <div className="rounded-xl border bg-card px-5 py-4 shadow-[var(--shadow-card)]">
              <Markdown md={query.notes} className="md [&>*:last-child]:mb-0" />
            </div>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="flex w-full items-center gap-2 rounded-xl border border-dashed px-4 py-5 text-left text-[13px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <PencilLine className="size-4" /> No notes yet. Click to write down what this query does.
            </button>
          )}
        </section>

        <section className="mt-7">
          <h2 className="mb-2.5 text-[12px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">Query</h2>
          <CodeBlock sql={query.sql} savedId={query.id} />
        </section>
      </article>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{query.title}”?</AlertDialogTitle>
            <AlertDialogDescription>The query and its notes are removed from your notebook. This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive text-white hover:bg-destructive/90" data-action="confirm-delete">
              <Trash2 /> Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ScrollArea>
  );
}
