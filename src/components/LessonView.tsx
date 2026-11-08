import { useEffect, useRef } from 'react';
import type { Lesson } from '../content/types';
import { Markdown, CodeBlock } from './Markdown';
import { JoinViz } from './JoinViz';
import { ExerciseCard } from './ExerciseCard';

export function LessonView({ lesson, index, total, prev, next, go }: { lesson: Lesson; index: number; total: number; prev?: Lesson; next?: Lesson; go: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.parentElement?.scrollTo({ top: 0 });
  }, [lesson.id]);
  return (
    <div className="lesson" ref={ref}>
      <div className="crumb">
        {lesson.section} · Lesson {index + 1} of {total}
      </div>
      <h1>{lesson.title}</h1>
      <p className="summary">{lesson.summary}</p>
      {lesson.blocks.map((b, i) => (typeof b === 'string' ? <Markdown key={i} md={b} /> : <JoinViz key={`${lesson.id}-${i}`} config={b.viz} />))}

      {lesson.examples.length > 0 && (
        <>
          <h2 className="section-title">
            Examples <span className="count">{lesson.examples.length} queries to run and tweak</span>
          </h2>
          {lesson.examples.map((ex, i) => (
            <div className="card example" key={i}>
              <div className="card-head">
                <h3>{ex.title}</h3>
              </div>
              {ex.note && (
                <div className="note">
                  <Markdown md={ex.note} />
                </div>
              )}
              <div className="card-body">
                <CodeBlock sql={ex.sql} />
              </div>
            </div>
          ))}
        </>
      )}

      {lesson.exercises.length > 0 && (
        <>
          <h2 className="section-title">
            Practice <span className="count">{lesson.exercises.length} exercises · checked automatically</span>
          </h2>
          {lesson.exercises.map((ex, i) => (
            <ExerciseCard key={ex.id} ex={ex} n={i + 1} />
          ))}
        </>
      )}

      <div className="next-lesson">
        {prev ? (
          <button className="btn" onClick={() => go(prev.id)}>
            ← {prev.title}
          </button>
        ) : (
          <span />
        )}
        {next && (
          <button className="btn primary" onClick={() => go(next.id)}>
            Next: {next.title} →
          </button>
        )}
      </div>
    </div>
  );
}
