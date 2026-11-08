import { useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, FlaskConical, Target } from 'lucide-react';
import type { Lesson } from '../content/types';
import { Markdown, CodeBlock } from './Markdown';
import { JoinViz } from './JoinViz';
import { ExerciseCard } from './ExerciseCard';
import { usePlayground } from '../state';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';

export function LessonView({ lesson, index, total, prev, next, go }: { lesson: Lesson; index: number; total: number; prev?: Lesson; next?: Lesson; go: (id: string) => void }) {
  const { solved } = usePlayground();
  const viewport = useRef<HTMLDivElement>(null);
  useEffect(() => {
    viewport.current?.scrollTo({ top: 0 });
  }, [lesson.id]);
  const done = lesson.exercises.filter((e) => solved.has(e.id)).length;

  return (
    <ScrollArea className="min-h-0 flex-1" viewportRef={viewport}>
      <article className="mx-auto max-w-[860px] px-7 pt-7 pb-16" data-testid="lesson">
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <Badge variant="secondary" className="font-medium">
            {lesson.section}
          </Badge>
          <span>
            Lesson {index + 1} of {total}
          </span>
        </div>
        <h1 className="mt-3 text-[28px] leading-tight font-semibold tracking-tight">{lesson.title}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{lesson.summary}</p>
        {lesson.exercises.length > 0 && (
          <div className="mt-4 flex items-center gap-3 text-[12px] text-muted-foreground">
            <Progress value={(done / lesson.exercises.length) * 100} className="h-1.5 max-w-40" />
            <span className="tabular-nums">
              {done}/{lesson.exercises.length} exercises solved
            </span>
          </div>
        )}
        <div className="mt-6 h-px bg-border" />

        <div className="mt-2">
          {lesson.blocks.map((b, i) => (typeof b === 'string' ? <Markdown key={i} md={b} /> : <JoinViz key={`${lesson.id}-${i}`} config={b.viz} />))}
        </div>

        {lesson.examples.length > 0 && (
          <section className="mt-10">
            <SectionTitle icon={<FlaskConical />} title="Examples" note={`${lesson.examples.length} queries to run and tweak`} />
            <div className="space-y-3">
              {lesson.examples.map((ex, i) => (
                <div className="overflow-hidden rounded-xl border bg-card shadow-[var(--shadow-card)]" key={i} data-testid="example">
                  <div className="px-4 pt-3 pb-2.5">
                    <h3 className="text-[14px] font-semibold">{ex.title}</h3>
                    {ex.note && <Markdown md={ex.note} className="md mt-1 text-[13px] text-muted-foreground [&_p]:m-0" />}
                  </div>
                  <CodeBlock sql={ex.sql} bare className="border-t" />
                </div>
              ))}
            </div>
          </section>
        )}

        {lesson.exercises.length > 0 && (
          <section className="mt-10">
            <SectionTitle icon={<Target />} title="Practice" note={`${lesson.exercises.length} exercises · checked automatically`} />
            <div className="space-y-4">
              {lesson.exercises.map((ex, i) => (
                <ExerciseCard key={ex.id} ex={ex} n={i + 1} />
              ))}
            </div>
          </section>
        )}

        <div className="mt-12 grid grid-cols-2 gap-3">
          {prev && <NavCard dir="prev" title={prev.title} onClick={() => go(prev.id)} full={!next} />}
          {next && <NavCard dir="next" title={next.title} onClick={() => go(next.id)} full={!prev} />}
        </div>
      </article>
    </ScrollArea>
  );
}

function SectionTitle({ icon, title, note }: { icon: React.ReactNode; title: string; note: string }) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <span className="flex size-7 items-center justify-center rounded-lg bg-brand-soft text-primary [&>svg]:size-4">{icon}</span>
      <h2 className="text-[18px] font-semibold tracking-tight">{title}</h2>
      <span className="text-[12.5px] text-muted-foreground">{note}</span>
    </div>
  );
}

// Previous / next lesson card. When it is the only one (first or last lesson) it spans the full width.
function NavCard({ dir, title, onClick, full }: { dir: 'prev' | 'next'; title: string; onClick: () => void; full?: boolean }) {
  return (
    <button
      onClick={onClick}
      data-testid={`nav-${dir}`}
      className={cn(
        'group flex flex-col gap-1 rounded-xl border bg-card p-4 text-left shadow-[var(--shadow-card)] transition-colors hover:border-primary/40 hover:bg-brand-soft/40',
        dir === 'next' && 'items-end text-right',
        full ? 'col-span-2' : dir === 'next' && 'col-start-2',
      )}
    >
      <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
        {dir === 'prev' && <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />}
        {dir === 'prev' ? 'Previous' : 'Next lesson'}
        {dir === 'next' && <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />}
      </span>
      <span className="text-[14px] font-medium text-foreground group-hover:text-primary">{title}</span>
    </button>
  );
}
