import { useState } from 'react';
import { Check, ChevronsUpDown, Database, DatabaseZap, GraduationCap, HardDrive, Loader2, Plus, RotateCcw, Settings2, SquareTerminal, Trash2 } from 'lucide-react';
import { api, type DatabaseInfo } from '../api';
import { usePlayground } from '../state';
import { timeAgo } from '@/lib/time';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  const units = ['kB', 'MB', 'GB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

export function describeDb(d: DatabaseInfo) {
  if (d.kind === 'practice') return 'Practice data · used by the lessons';
  if (d.kind === 'other') return `Created outside the menu · owner ${d.owner}`;
  return d.origin === 'sample' ? 'Started as a copy of the sample data' : 'Started empty';
}

export function DbIcon({ d, className }: { d: Pick<DatabaseInfo, 'kind'>; className?: string }) {
  const Icon = d.kind === 'practice' ? GraduationCap : d.kind === 'other' ? HardDrive : Database;
  return <Icon className={cn('size-4', d.kind === 'practice' ? 'text-primary' : d.kind === 'other' ? 'text-warning' : 'text-muted-foreground', className)} />;
}

/** Switch the editor to another database. Asks first if a session has an open transaction. */
export function useSwitch() {
  const { txStatus, applyDatabases, toast } = usePlayground();
  const [pending, setPending] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const doSwitch = async (name: string) => {
    setBusy(true);
    try {
      await applyDatabases(await api.databases.use(name));
      toast(`Now using the database “${name}”`);
    } catch (e) {
      toast(`Could not switch: ${(e as Error).message}`, 'err');
    } finally {
      setBusy(false);
      setPending(null);
    }
  };
  const request = (name: string) => (Object.values(txStatus).some((s) => s !== 'idle') ? setPending(name) : doSwitch(name));
  const confirm = (
    <AlertDialog open={!!pending} onOpenChange={(o) => !o && !busy && setPending(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Switch to “{pending}”?</AlertDialogTitle>
          <AlertDialogDescription>A session has an open transaction. Switching databases closes Session A and B, so anything not committed is rolled back.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={(e) => {
              e.preventDefault();
              if (pending) doSwitch(pending);
            }}
          >
            {busy && <Loader2 className="animate-spin" />} Switch anyway
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
  return { request, confirm, busy };
}

// ---------------------------------------------------------------------------
// Top-bar switcher
// ---------------------------------------------------------------------------
export function DatabaseSwitcher() {
  const { status, statusError, databases, setTerminalOpen, applyDatabases } = usePlayground();
  // pick up databases created or dropped elsewhere (root terminal, psql...) every time the menu opens
  const refresh = () => api.databases.list().then(applyDatabases).catch(() => {});
  const [createOpen, setCreateOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const sw = useSwitch();
  const active = databases?.databases.find((d) => d.name === databases.active);

  if (!status) {
    return (
      <div className="flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-[12.5px]">
        <span className={cn('size-2 rounded-full', statusError ? 'bg-destructive' : 'animate-pulse bg-muted-foreground')} />
        {statusError ? 'Database unreachable' : 'Connecting…'}
      </div>
    );
  }

  return (
    <>
      <DropdownMenu onOpenChange={(o) => o && refresh()}>
        <DropdownMenuTrigger asChild>
          <button
            className="flex max-w-[340px] items-center gap-2 rounded-full border bg-background py-1.5 pr-2.5 pl-3 text-[12.5px] transition-colors hover:bg-accent data-[state=open]:bg-accent"
            data-testid="db-switcher"
          >
            <span className="relative flex size-2 flex-none">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-40" />
              <span className="relative inline-flex size-2 rounded-full bg-success" />
            </span>
            {active ? <DbIcon d={active} className="size-3.5" /> : <Database className="size-3.5 text-muted-foreground" />}
            <span className="truncate font-mono font-medium">{status.database}</span>
            <span className="hidden truncate text-muted-foreground xl:inline">
              {status.database === (status.practiceDatabase ?? 'learn') ? 'practice data' : active?.origin === 'sample' ? 'sample copy' : active?.kind === 'other' ? 'other' : 'your database'}
            </span>
            <ChevronsUpDown className="size-3.5 flex-none text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Databases · PostgreSQL {status.serverVersion.split(' ')[0]}</DropdownMenuLabel>
          <div className="max-h-72 overflow-y-auto">
            {databases?.databases.map((d) => (
              <DropdownMenuItem key={d.name} onSelect={() => d.name !== databases.active && sw.request(d.name)} className="items-start gap-2.5 py-2" data-db={d.name}>
                <DbIcon d={d} className="mt-0.5" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-[13px] font-medium">{d.name}</span>
                  <span className="block truncate text-[11.5px] text-muted-foreground">
                    {describeDb(d)} · {formatBytes(d.sizeBytes)}
                  </span>
                </span>
                {d.name === databases.active && <Check className="mt-0.5 size-4 text-primary" />}
              </DropdownMenuItem>
            ))}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setCreateOpen(true)} data-action="new-db">
            <Plus /> New database…
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              refresh();
              setManageOpen(true);
            }}
            data-action="manage-dbs"
          >
            <Settings2 /> Manage databases…
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setTerminalOpen(true)}>
            <SquareTerminal /> Open root terminal
            <span className="ml-auto text-[11px] text-muted-foreground">Ctrl+`</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <CreateDatabaseDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ManageDatabasesDialog open={manageOpen} onOpenChange={setManageOpen} onNew={() => setCreateOpen(true)} switchTo={sw.request} />
      {sw.confirm}
    </>
  );
}

// ---------------------------------------------------------------------------
// New database
// ---------------------------------------------------------------------------
const NAME_RE = /^[a-z][a-z0-9_]{0,39}$/;

export function CreateDatabaseDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { databases, applyDatabases, toast } = usePlayground();
  const [name, setName] = useState('');
  const [origin, setOrigin] = useState<'empty' | 'sample'>('empty');
  const [use, setUse] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const taken = databases?.databases.some((d) => d.name === name);
  const invalid = name && !NAME_RE.test(name) ? 'Use lowercase letters, digits and _, starting with a letter (max 40).' : taken ? 'A database with this name already exists.' : null;

  const submit = async () => {
    if (!name || invalid) return;
    setBusy(true);
    setError(null);
    try {
      await applyDatabases(await api.databases.create({ name, origin, use }));
      toast(use ? `Created “${name}”, and the editor now uses it` : `Created the database “${name}”`);
      onOpenChange(false);
      setName('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const Option = ({ value, title, text, icon }: { value: 'empty' | 'sample'; title: string; text: string; icon: React.ReactNode }) => (
    <button
      type="button"
      onClick={() => setOrigin(value)}
      aria-pressed={origin === value}
      data-origin={value}
      className={cn(
        'flex flex-1 flex-col gap-1.5 rounded-lg border p-3.5 text-left transition-colors',
        origin === value ? 'border-primary bg-brand-soft ring-1 ring-primary' : 'hover:bg-accent',
      )}
    >
      <span className="flex items-center gap-2 text-[13.5px] font-medium">
        {icon} {title}
      </span>
      <span className="text-[12px] leading-snug text-muted-foreground">{text}</span>
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-[520px]" data-testid="create-db-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DatabaseZap className="size-4 text-primary" /> New database
          </DialogTitle>
          <DialogDescription>A separate database of your own on the same local PostgreSQL. Your lessons, progress and saved notes stay as they are.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="db-name">Name</Label>
            <Input
              id="db-name"
              value={name}
              autoFocus
              placeholder="e.g. my_shop"
              className="font-mono"
              aria-invalid={!!invalid}
              onChange={(e) => setName(e.target.value.toLowerCase().replace(/[\s-]+/g, '_'))}
            />
            <p className={cn('text-[12px]', invalid ? 'text-destructive' : 'text-muted-foreground')}>{invalid ?? 'Lowercase letters, digits and underscores.'}</p>
          </div>
          <div className="grid gap-2">
            <Label>Start with</Label>
            <div className="flex gap-2.5">
              <Option value="empty" title="An empty database" text="No tables at all. Design your own schema with CREATE TABLE." icon={<Database className="size-4 text-muted-foreground" />} />
              <Option value="sample" title="A copy of the sample data" text="All 14 Mishti & More tables, yours to change without touching the lessons' database." icon={<GraduationCap className="size-4 text-primary" />} />
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted-foreground select-none">
            <input type="checkbox" checked={use} onChange={(e) => setUse(e.target.checked)} className="size-4 accent-[var(--primary)]" />
            Switch the editor to it now
          </label>
          {error && <div className="rounded-md border border-destructive/25 bg-danger-soft px-3 py-2 text-[12.5px] text-destructive">{error}</div>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !name || !!invalid} data-action="create-db">
              {busy ? <Loader2 className="animate-spin" /> : <Plus />} Create database
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Manage: switch, reset, delete
// ---------------------------------------------------------------------------
export function ManageDatabasesDialog({ open, onOpenChange, onNew, switchTo }: { open: boolean; onOpenChange: (o: boolean) => void; onNew: () => void; switchTo: (name: string) => void }) {
  const { databases, applyDatabases, afterReset, toast } = usePlayground();
  const [confirm, setConfirm] = useState<{ kind: 'reset' | 'delete'; db: DatabaseInfo } | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!confirm) return;
    const { kind, db } = confirm;
    setBusy(true);
    try {
      if (kind === 'reset') {
        const r = await api.reset(db.name);
        if (db.name === databases?.active) await afterReset();
        else await applyDatabases(await api.databases.list());
        toast(`Reset “${db.name}” in ${(r.durationMs / 1000).toFixed(1)}s`);
      } else {
        await applyDatabases(await api.databases.remove(db.name));
        toast(`Deleted the database “${db.name}”`);
      }
      setConfirm(null);
    } catch (e) {
      toast(`${kind === 'reset' ? 'Reset' : 'Delete'} failed: ${(e as Error).message}`, 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[640px]" data-testid="manage-dbs-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="size-4 text-primary" /> Databases
            </DialogTitle>
            <DialogDescription>The editor, both sessions and the schema panel work in the active database. Exercises are always checked against the practice data.</DialogDescription>
          </DialogHeader>
          <div className="-mx-2 max-h-[55vh] overflow-y-auto">
            {databases?.databases.map((d) => {
              const isActive = d.name === databases.active;
              return (
                <div key={d.name} className={cn('flex items-center gap-3 rounded-lg px-3 py-2.5', isActive && 'bg-brand-soft/60')} data-db-row={d.name}>
                  <DbIcon d={d} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-mono text-[13.5px] font-medium">{d.name}</span>
                      {isActive && <Badge className="h-5 px-1.5 text-[10.5px]">active</Badge>}
                    </div>
                    <div className="truncate text-[12px] text-muted-foreground">
                      {describeDb(d)} · {formatBytes(d.sizeBytes)}
                      {d.createdAt ? ` · created ${timeAgo(d.createdAt)}` : ''}
                    </div>
                  </div>
                  {!isActive && (
                    <Button size="xs" variant="outline" onClick={() => switchTo(d.name)}>
                      Use
                    </Button>
                  )}
                  {d.kind !== 'other' && (
                    <Button size="icon-xs" variant="ghost" aria-label={`Reset ${d.name}`} title="Reset to how it started" className="text-muted-foreground" onClick={() => setConfirm({ kind: 'reset', db: d })}>
                      <RotateCcw />
                    </Button>
                  )}
                  {d.kind !== 'practice' && (
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label={`Delete ${d.name}`}
                      title="Delete"
                      className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setConfirm({ kind: 'delete', db: d })}
                    >
                      <Trash2 />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
          <DialogFooter className="sm:justify-between">
            <span className="self-center text-[12px] text-muted-foreground">Tip: the root terminal (Ctrl+`) can do anything else, as the superuser.</span>
            <Button
              onClick={() => {
                onOpenChange(false);
                onNew();
              }}
            >
              <Plus /> New database
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && !busy && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === 'reset' ? 'Reset' : 'Delete'} “{confirm?.db.name}”?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === 'delete'
                ? 'The database and everything in it are deleted for good. Saved queries in your notebook are kept.'
                : confirm?.db.kind === 'practice'
                  ? 'Everything goes back to the original sample data. Anything you created or changed in it is lost.'
                  : confirm?.db.origin === 'sample'
                    ? 'It goes back to a fresh copy of the sample data. Everything you created or changed in it is lost.'
                    : 'It goes back to an empty database: every table and row in it is deleted.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              className="bg-destructive text-white hover:bg-destructive/90"
              data-action="confirm-db-action"
              onClick={(e) => {
                e.preventDefault();
                run();
              }}
            >
              {busy ? <Loader2 className="animate-spin" /> : confirm?.kind === 'reset' ? <RotateCcw /> : <Trash2 />}
              {confirm?.kind === 'reset' ? 'Reset' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
