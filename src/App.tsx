import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTheme, type Theme } from '@/lib/theme';
import {
  BookOpen,
  Check,
  CircleAlert,
  Database,
  Laptop,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightOpen,
  RotateCcw,
  Sun,
  Trophy,
} from 'lucide-react';
import { PlaygroundProvider, usePlayground } from './state';
import { lessons } from './content';
import { LessonView } from './components/LessonView';
import { Workspace } from './components/Workspace';
import { SchemaPanel } from './components/SchemaPanel';
import { PanelHeader, IconButton } from './components/PanelHeader';
import { useDrag, useStoredNumber } from './components/layout';
import { api } from './api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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

export function App() {
  return (
    <PlaygroundProvider>
      <Shell />
    </PlaygroundProvider>
  );
}

const NAV_W = 256;

function Shell() {
  const [lessonId, setLessonId] = useState<string>(() => {
    const fromHash = location.hash.slice(1);
    if (lessons.some((l) => l.id === fromHash)) return fromHash;
    try {
      return localStorage.getItem('sqlpg.lesson') || lessons[0].id;
    } catch {
      return lessons[0].id;
    }
  });
  const go = (id: string) => {
    setLessonId(id);
    try {
      localStorage.setItem('sqlpg.lesson', id);
    } catch {
      /* ignore */
    }
    history.replaceState(null, '', `#${id}`);
  };
  useEffect(() => {
    const onHash = () => {
      const id = location.hash.slice(1);
      if (lessons.some((l) => l.id === id)) setLessonId(id);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const idx = Math.max(0, lessons.findIndex((l) => l.id === lessonId));
  const lesson = lessons[idx];

  // On narrow windows start with the side panels collapsed so the editor keeps enough room.
  const [navOpen, setNavOpen] = useState(() => window.innerWidth >= 1280);
  const [schemaOpen, setSchemaOpen] = useState(() => window.innerWidth >= 1000);
  const [winW, setWinW] = useState(window.innerWidth);
  useEffect(() => {
    const onResize = () => setWinW(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const [lessonW, setLessonW] = useStoredNumber('sqlpg.lessonW', Math.round(Math.max(440, window.innerWidth * 0.36)));
  const [schemaW, setSchemaW] = useStoredNumber('sqlpg.schemaW', 300);
  // keep at least ~400px for the editor whatever the stored widths are
  const sideW = (navOpen ? NAV_W : 44) + (schemaOpen ? schemaW + 1 : 44) + 1;
  const lessonWidth = Math.max(300, Math.min(lessonW, winW - sideW - 400));
  const lessonDrag = useDrag((dx, start) => setLessonW(Math.max(320, Math.min(start + dx, window.innerWidth - sideW - 400))), lessonWidth);
  const schemaDrag = useDrag((dx, start) => setSchemaW(Math.max(220, Math.min(start - dx, 560))), schemaW);

  return (
    <div className="flex h-full flex-col bg-background">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        {navOpen ? (
          <aside className="flex flex-none flex-col border-r bg-surface" style={{ width: NAV_W }} data-panel="nav">
            <PanelHeader icon={<BookOpen />} title="Lessons" actions={<IconButton label="Hide lessons" onClick={() => setNavOpen(false)} icon={<PanelLeftClose />} />} />
            <ScrollArea className="min-h-0 flex-1">
              <LessonNav current={lesson.id} go={go} />
            </ScrollArea>
          </aside>
        ) : (
          <Rail side="left" label="Lessons" icon={<PanelLeftOpen />} onOpen={() => setNavOpen(true)} />
        )}
        <section className="flex min-w-0 flex-none flex-col bg-card" style={{ width: lessonWidth }} data-panel="lesson">
          <LessonView lesson={lesson} index={idx} total={lessons.length} prev={lessons[idx - 1]} next={lessons[idx + 1]} go={go} />
        </section>
        <div className={cn('gutter', lessonDrag.dragging && 'dragging')} onMouseDown={lessonDrag.onMouseDown} />
        <main className="flex min-w-0 flex-1 flex-col bg-card" data-panel="workspace">
          <Workspace />
        </main>
        {schemaOpen ? (
          <>
            <div className={cn('gutter', schemaDrag.dragging && 'dragging')} onMouseDown={schemaDrag.onMouseDown} />
            <aside className="flex flex-none flex-col bg-surface" style={{ width: schemaW }} data-panel="schema">
              <SchemaPanel onHide={() => setSchemaOpen(false)} />
            </aside>
          </>
        ) : (
          <Rail side="right" label="Schema" icon={<PanelRightOpen />} onOpen={() => setSchemaOpen(true)} />
        )}
      </div>
    </div>
  );
}

function Rail({ side, label, icon, onOpen }: { side: 'left' | 'right'; label: string; icon: ReactNode; onOpen: () => void }) {
  return (
    <div className={cn('flex w-11 flex-none flex-col items-center gap-3 bg-surface pt-2', side === 'left' ? 'border-r' : 'border-l')}>
      <IconButton label={`Show ${label.toLowerCase()}`} onClick={onOpen} icon={icon} side={side === 'left' ? 'right' : 'left'} />
      <button
        onClick={onOpen}
        className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase transition-colors [writing-mode:vertical-rl] hover:text-foreground"
      >
        {label}
      </button>
    </div>
  );
}

function LessonNav({ current, go }: { current: string; go: (id: string) => void }) {
  const { solved } = usePlayground();
  const sections = useMemo(() => {
    const out: { name: string; items: { l: (typeof lessons)[number]; i: number }[] }[] = [];
    lessons.forEach((l, i) => {
      let s = out.find((x) => x.name === l.section);
      if (!s) out.push((s = { name: l.section, items: [] }));
      s.items.push({ l, i });
    });
    return out;
  }, []);
  return (
    <nav className="px-2.5 pt-2 pb-6">
      {sections.map((s) => (
        <div key={s.name} className="mt-3 first:mt-1">
          <div className="px-2.5 pb-1.5 text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">{s.name}</div>
          <div className="flex flex-col gap-px">
            {s.items.map(({ l, i }) => {
              const done = l.exercises.filter((e) => solved.has(e.id)).length;
              const all = l.exercises.length;
              const complete = all > 0 && done === all;
              const active = l.id === current;
              return (
                <button
                  key={l.id}
                  onClick={() => go(l.id)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'group flex w-full items-center gap-2.5 rounded-md px-2.5 py-[7px] text-left text-[13px] leading-snug transition-colors',
                    active ? 'bg-brand-soft font-medium text-primary' : 'text-foreground/80 hover:bg-accent hover:text-foreground',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-5 flex-none items-center justify-center rounded-full border text-[10px] font-semibold tabular-nums',
                      complete
                        ? 'border-success bg-success text-white dark:text-background'
                        : active
                          ? 'border-primary/40 text-primary'
                          : 'border-border text-muted-foreground group-hover:border-foreground/20',
                    )}
                  >
                    {complete ? <Check className="size-3" strokeWidth={3} /> : i + 1}
                  </span>
                  <span className="min-w-0 flex-1">{l.title}</span>
                  {all > 0 && !complete && (
                    <span className={cn('text-[11px] tabular-nums', done > 0 ? 'text-primary' : 'text-muted-foreground/70')}>
                      {done}/{all}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Theme">
              {resolvedTheme === 'dark' ? <Moon /> : <Sun />}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Theme</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as Theme)}>
          <DropdownMenuRadioItem value="light">
            <Sun /> Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon /> Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Laptop /> System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TopBar() {
  const { status, statusError, solved, toast, afterReset, refreshStatus } = usePlayground();
  const [confirming, setConfirming] = useState(false);
  const [resetting, setResetting] = useState(false);
  const total = lessons.reduce((s, l) => s + l.exercises.length, 0);
  const solvedCount = lessons.reduce((s, l) => s + l.exercises.filter((e) => solved.has(e.id)).length, 0);

  useEffect(() => {
    if (!statusError) return;
    const t = setInterval(refreshStatus, 4000);
    return () => clearInterval(t);
  }, [statusError, refreshStatus]);

  const reset = async () => {
    setResetting(true);
    try {
      const r = await api.reset();
      await afterReset();
      toast(`Database restored to its original state in ${(r.durationMs / 1000).toFixed(1)}s`);
    } catch (e) {
      toast(`Reset failed: ${(e as Error).message}`, 'err');
    } finally {
      setResetting(false);
      setConfirming(false);
    }
  };

  return (
    <>
      <header className="flex h-14 flex-none items-center gap-3 border-b bg-card/80 px-4 backdrop-blur" data-panel="topbar">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-[oklch(0.5_0.22_290)] text-white shadow-sm ring-1 ring-black/5">
            <Database className="size-4" strokeWidth={2.4} />
          </div>
          <div className="leading-tight">
            <div className="text-[15px] font-semibold tracking-tight">SQL Playground</div>
            <div className="text-[11.5px] text-muted-foreground">Learn SQL by running it</div>
          </div>
        </div>
        <div className="flex-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <div className="hidden items-center gap-2.5 rounded-full border bg-background px-3 py-1.5 sm:flex" data-testid="progress">
              <Trophy className="size-3.5 text-pk" />
              <span className="text-[12.5px] whitespace-nowrap text-muted-foreground">
                <b className="font-semibold text-foreground tabular-nums">{solvedCount}</b> / {total} solved
              </span>
              <Progress value={(solvedCount / total) * 100} className="h-1.5 w-20" />
            </div>
          </TooltipTrigger>
          <TooltipContent>Exercises solved (saved in this browser)</TooltipContent>
        </Tooltip>

        {status ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="hidden items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-[12.5px] md:flex">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-40" />
                  <span className="relative inline-flex size-2 rounded-full bg-success" />
                </span>
                <span className="font-medium">PostgreSQL {status.serverVersion.split(' ')[0]}</span>
                <span className="text-muted-foreground">
                  {status.database}@localhost:{status.port}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              Connected as <b>{status.user}</b> to database "{status.database}" at {status.host}:{status.port}
            </TooltipContent>
          </Tooltip>
        ) : (
          <div className="flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-[12.5px]">
            <span className={cn('size-2 rounded-full', statusError ? 'bg-destructive' : 'animate-pulse bg-muted-foreground')} />
            {statusError ? 'Database unreachable' : 'Connecting…'}
          </div>
        )}

        <ThemeToggle />

        <Button
          variant="outline"
          size="sm"
          onClick={() => setConfirming(true)}
          disabled={resetting}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/15"
        >
          <RotateCcw /> Reset DB
        </Button>
      </header>

      {statusError && (
        <div className="flex items-center gap-2 border-b border-destructive/20 bg-danger-soft px-4 py-2 text-[13px] text-destructive">
          <CircleAlert className="size-4" />
          {statusError} Retrying…
        </div>
      )}

      <AlertDialog open={confirming} onOpenChange={(o) => !resetting && setConfirming(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset the practice database?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  This drops the <code className="rounded bg-muted px-1 py-0.5 text-[0.85em] text-foreground">learn</code> database and recreates it from the
                  original seed. Every table, row, index and constraint goes back to exactly how it started; anything you created, changed or deleted is lost, and
                  open transactions in Session A/B are closed.
                </p>
                <p>Your editor contents and exercise progress are kept.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                reset();
              }}
              disabled={resetting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {resetting ? <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <RotateCcw />}
              {resetting ? 'Resetting…' : 'Reset database'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
