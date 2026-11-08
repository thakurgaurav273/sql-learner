import { useEffect, useMemo, useState } from 'react';
import { PlaygroundProvider, usePlayground } from './state';
import { lessons } from './content';
import { LessonView } from './components/LessonView';
import { Workspace } from './components/Workspace';
import { SchemaPanel } from './components/SchemaPanel';
import { useDrag, useStoredNumber } from './components/layout';
import { api } from './api';

export function App() {
  return (
    <PlaygroundProvider>
      <Shell />
    </PlaygroundProvider>
  );
}

function Shell() {
  const { toastMsg } = usePlayground();
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
  const [lessonW, setLessonW] = useStoredNumber('sqlpg.lessonW', Math.round(Math.max(420, window.innerWidth * 0.36)));
  const [schemaW, setSchemaW] = useStoredNumber('sqlpg.schemaW', 290);
  // keep at least ~380px for the editor whatever the stored widths are
  const sideW = (navOpen ? 230 : 30) + (schemaOpen ? schemaW + 5 : 30) + 5;
  const lessonWidth = Math.max(280, Math.min(lessonW, winW - sideW - 380));
  const lessonDrag = useDrag((dx, start) => setLessonW(Math.max(300, Math.min(start + dx, window.innerWidth - sideW - 380))), lessonWidth);
  const schemaDrag = useDrag((dx, start) => setSchemaW(Math.max(200, Math.min(start - dx, 560))), schemaW);

  return (
    <div className="app">
      <TopBar />
      <div className="columns">
        {navOpen ? (
          <div className="col nav" style={{ width: 230, flex: 'none', borderRight: '1px solid var(--border)' }}>
            <div className="col-head">
              Lessons
              <span className="spacer" />
              <button className="btn small ghost" onClick={() => setNavOpen(false)} title="Hide lesson list">
                «
              </button>
            </div>
            <div className="scroll">
              <LessonNav current={lesson.id} go={go} />
            </div>
          </div>
        ) : (
          <div className="collapsed-rail">
            <button className="btn small ghost" onClick={() => setNavOpen(true)} title="Show lesson list">
              »
            </button>
            <span className="rail-label" onClick={() => setNavOpen(true)}>
              Lessons
            </span>
          </div>
        )}
        <div className="col" style={{ width: lessonWidth, flex: 'none' }}>
          <div className="scroll">
            <LessonView lesson={lesson} index={idx} total={lessons.length} prev={lessons[idx - 1]} next={lessons[idx + 1]} go={go} />
          </div>
        </div>
        <div className={`gutter ${lessonDrag.dragging ? 'dragging' : ''}`} onMouseDown={lessonDrag.onMouseDown} />
        <div className="col" style={{ flex: 1 }}>
          <Workspace />
        </div>
        {schemaOpen ? (
          <>
            <div className={`gutter ${schemaDrag.dragging ? 'dragging' : ''}`} onMouseDown={schemaDrag.onMouseDown} />
            <div className="col" style={{ width: schemaW, flex: 'none' }}>
              <SchemaPanel onHide={() => setSchemaOpen(false)} />
            </div>
          </>
        ) : (
          <div className="collapsed-rail">
            <button className="btn small ghost" onClick={() => setSchemaOpen(true)} title="Show schema">
              «
            </button>
            <span className="rail-label" onClick={() => setSchemaOpen(true)}>
              Schema
            </span>
          </div>
        )}
      </div>
      {toastMsg && <div className={`toast ${toastMsg.kind === 'err' ? 'err' : ''}`}>{toastMsg.msg}</div>}
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
    <>
      {sections.map((s) => (
        <div className="nav-section" key={s.name}>
          <h4>{s.name}</h4>
          {s.items.map(({ l, i }) => {
            const done = l.exercises.filter((e) => solved.has(e.id)).length;
            const all = l.exercises.length;
            return (
              <button key={l.id} className={`nav-item ${l.id === current ? 'active' : ''}`} onClick={() => go(l.id)}>
                <span className="num">{i + 1}</span>
                <span className="title">{l.title}</span>
                {all > 0 && <span className={`badge ${done === all ? 'done' : ''}`}>{done === all ? '✓' : `${done}/${all}`}</span>}
              </button>
            );
          })}
        </div>
      ))}
    </>
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
      toast(`Database restored to its original seeded state (${(r.durationMs / 1000).toFixed(1)}s).`);
    } catch (e) {
      toast(`Reset failed: ${(e as Error).message}`, 'err');
    } finally {
      setResetting(false);
      setConfirming(false);
    }
  };

  return (
    <>
      <div className="topbar">
        <div className="brand">
          <svg viewBox="0 0 32 32" aria-hidden>
            <ellipse cx="16" cy="7" rx="11" ry="4" fill="#3b82f6" />
            <path d="M5 7v18c0 2.2 4.9 4 11 4s11-1.8 11-4V7c0 2.2-4.9 4-11 4S5 9.2 5 7z" fill="#2563eb" />
            <path d="M5 13c0 2.2 4.9 4 11 4s11-1.8 11-4M5 19c0 2.2 4.9 4 11 4s11-1.8 11-4" stroke="#93c5fd" strokeWidth="1.2" fill="none" />
          </svg>
          SQL Playground <small>learn SQL by running it</small>
        </div>
        <span className="spacer" />
        <span className="chip progress-chip" title="Exercises solved (stored in this browser)">
          <b>{solvedCount}</b>/{total} exercises solved
        </span>
        {status ? (
          <span className="chip" title={`Connected as ${status.user} to database "${status.database}" at ${status.host}:${status.port}`}>
            <span className="dot ok" /> PostgreSQL {status.serverVersion.split(' ')[0]} · {status.database}@localhost:{status.port}
          </span>
        ) : (
          <span className="chip">
            <span className={`dot ${statusError ? 'bad' : ''}`} /> {statusError ? 'Database unreachable' : 'Connecting…'}
          </span>
        )}
        <button className="btn danger" onClick={() => setConfirming(true)} disabled={resetting} title="Restore the practice database to its original seeded state">
          ⟲ Reset DB
        </button>
      </div>
      {statusError && <div className="banner-err">{statusError} Retrying…</div>}
      {confirming && (
        <div className="overlay" onClick={() => !resetting && setConfirming(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Reset the practice database?</h3>
            <p>
              This drops the <code>learn</code> database and recreates it from the original seed: every table, row, index and constraint goes back to exactly how it
              started. Anything you created, changed or deleted is lost, and open transactions in Session A/B are closed.
            </p>
            <p>Your editor contents and exercise progress are kept.</p>
            <div className="actions">
              <button className="btn" onClick={() => setConfirming(false)} disabled={resetting}>
                Cancel
              </button>
              <button className="btn danger solid" onClick={reset} disabled={resetting} autoFocus>
                {resetting ? (
                  <>
                    <span className="spinner" /> Resetting…
                  </>
                ) : (
                  'Reset database'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
