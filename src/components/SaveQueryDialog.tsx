import { useEffect, useRef, useState } from 'react';
import { BookmarkPlus, Loader2, Save } from 'lucide-react';
import { toast as sonnerToast } from 'sonner';
import type { Lesson } from '../content/types';
import { usePlayground } from '../state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/** Suggest a title from the query: its first comment line, or its first line. */
export function suggestTitle(sql: string) {
  const lines = sql.split('\n').map((l) => l.trim()).filter(Boolean);
  const comment = lines.find((l) => l.startsWith('--'))?.replace(/^-+\s*/, '');
  const pick = comment || lines.find((l) => !l.startsWith('--')) || 'Untitled query';
  return pick.length > 80 ? pick.slice(0, 77).trimEnd() + '…' : pick;
}

export const sameSql = (a: string, b: string) => a.trimEnd() === b.trimEnd();

// "Save query" dialog plus the Cmd/Ctrl+S shortcut. When the editor is linked to a
// saved query, Cmd/Ctrl+S saves the changes straight away; otherwise it opens the dialog.
export function SaveQueryDialog({ lesson }: { lesson: Lesson }) {
  const { sql, saved, linkedSavedId, setLinkedSavedId, createSaved, updateSaved, saveDialogOpen, setSaveDialogOpen, toast, setSavedViewId, setNavTab, status } = usePlayground();
  const linked = saved.find((q) => q.id === linkedSavedId) ?? null;
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [attach, setAttach] = useState(true);
  const [busy, setBusy] = useState<'new' | 'update' | null>(null);

  // prefill every time the dialog opens
  useEffect(() => {
    if (!saveDialogOpen) return;
    setTitle(linked?.title ?? suggestTitle(sql));
    setNotes(linked?.notes ?? '');
    setAttach(linked ? linked.lessonId !== null : true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveDialogOpen]);

  const view = (id: string) => {
    setNavTab('saved');
    setSavedViewId(id);
  };

  const submit = async (mode: 'new' | 'update') => {
    if (!sql.trim()) return;
    setBusy(mode);
    try {
      const body = {
        title: title.trim() || 'Untitled query',
        notes,
        sql: sql.trimEnd() + '\n',
        lessonId: attach ? (mode === 'update' && linked?.lessonId) || lesson.id : null,
        database: status?.database ?? null, // the database it was written for
      };
      const item = mode === 'update' && linked ? await updateSaved(linked.id, body) : await createSaved(body);
      setLinkedSavedId(item.id);
      setSaveDialogOpen(false);
      toast(mode === 'update' ? `Saved changes to “${item.title}”` : `Saved “${item.title}” to your notebook`);
      if (mode === 'new') view(item.id);
    } catch (e) {
      toast(`Could not save: ${(e as Error).message}`, 'err');
    } finally {
      setBusy(null);
    }
  };

  // Cmd/Ctrl+S anywhere in the app
  const stateRef = useRef({ sql, linked, saveDialogOpen });
  stateRef.current = { sql, linked, saveDialogOpen };
  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== 's') return;
      e.preventDefault();
      const { sql, linked, saveDialogOpen } = stateRef.current;
      if (saveDialogOpen) return;
      if (!sql.trim()) return toast('Nothing to save yet: write a query first.', 'info');
      if (!linked) return setSaveDialogOpen(true);
      if (sameSql(sql, linked.sql)) return toast(`“${linked.title}” is already saved.`, 'info');
      const previous = linked.sql;
      try {
        const item = await updateSaved(linked.id, { sql: sql.trimEnd() + '\n' });
        sonnerToast.success(`Saved changes to “${item.title}”`, {
          action: {
            label: 'Undo',
            onClick: () =>
              updateSaved(item.id, { sql: previous }).then(
                () => toast('Restored the previous version', 'info'),
                (err) => toast(`Could not undo: ${(err as Error).message}`, 'err'),
              ),
          },
        });
      } catch (err) {
        toast(`Could not save: ${(err as Error).message}`, 'err');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setSaveDialogOpen, toast, updateSaved]);

  const lines = sql.trimEnd().split('\n').length;
  const attachLesson = linked?.lessonId && linked.lessonId !== lesson.id ? null : lesson;

  return (
    <Dialog open={saveDialogOpen} onOpenChange={(o) => !busy && setSaveDialogOpen(o)}>
      <DialogContent className="sm:max-w-[560px]" data-testid="save-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {linked ? <Save className="size-4 text-primary" /> : <BookmarkPlus className="size-4 text-primary" />}
            {linked ? 'Save changes' : 'Save query to your notebook'}
          </DialogTitle>
          <DialogDescription>
            {linked
              ? `The editor is linked to “${linked.title}”. Update it, or keep it and save a new copy.`
              : 'Give it a name and jot down what it does or what you learned. Saved queries survive Reset DB.'}
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit(linked ? 'update' : 'new');
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="sq-title">Title</Label>
            <Input id="sq-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} autoFocus placeholder="e.g. Customers who never ordered" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sq-notes" className="justify-between">
              Notes <span className="text-xs font-normal text-muted-foreground">Markdown supported · {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+Enter to save</span>
            </Label>
            <Textarea
              id="sq-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  submit(linked ? 'update' : 'new');
                }
              }}
              placeholder={'What does this query do? Why does it work?\nTip: **bold**, `code` and ```sql blocks all work.'}
              className="max-h-56 min-h-28 text-[13.5px]"
            />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between text-sm font-medium">
              Query
              <span className="text-xs font-normal text-muted-foreground">
                {lines} line{lines === 1 ? '' : 's'} from the editor
              </span>
            </div>
            <pre className="max-h-36 overflow-auto rounded-md border bg-code px-3 py-2 text-[12px] leading-relaxed text-muted-foreground">{sql.trimEnd()}</pre>
          </div>
          {attachLesson && (
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted-foreground select-none">
              <input type="checkbox" checked={attach} onChange={(e) => setAttach(e.target.checked)} className="size-4 accent-[var(--primary)]" />
              Link it to the lesson <span className="font-medium text-foreground">“{attachLesson.title}”</span>
            </label>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="ghost" onClick={() => setSaveDialogOpen(false)} disabled={!!busy}>
              Cancel
            </Button>
            {linked && (
              <Button type="button" variant="outline" onClick={() => submit('new')} disabled={!!busy}>
                {busy === 'new' && <Loader2 className="animate-spin" />} Save as new
              </Button>
            )}
            <Button type="submit" disabled={!!busy || !sql.trim()} data-action="save-submit">
              {busy && busy !== 'new' ? <Loader2 className="animate-spin" /> : <Save />}
              {linked ? 'Update' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
