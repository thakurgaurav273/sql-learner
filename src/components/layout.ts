import { useCallback, useEffect, useRef, useState } from 'react';

// Small helpers for resizable panels (no layout library needed).

export function useStoredNumber(key: string, initial: number): [number, (n: number) => void] {
  const [value, setValue] = useState<number>(() => {
    try {
      const v = Number(localStorage.getItem(key));
      return Number.isFinite(v) && v > 0 ? v : initial;
    } catch {
      return initial;
    }
  });
  const set = useCallback(
    (n: number) => {
      setValue(n);
      try {
        localStorage.setItem(key, String(Math.round(n)));
      } catch {
        /* ignore */
      }
    },
    [key],
  );
  return [value, set];
}

// Returns a mousedown handler for a splitter. onMove(delta, startValue) is called while dragging.
export function useDrag(onMove: (delta: number, start: number) => void, current: number, axis: 'x' | 'y' = 'x') {
  const [dragging, setDragging] = useState(false);
  const state = useRef({ startPos: 0, startValue: 0 });
  const moveRef = useRef(onMove);
  moveRef.current = onMove;

  useEffect(() => {
    if (!dragging) return;
    const move = (e: MouseEvent) => {
      const pos = axis === 'x' ? e.clientX : e.clientY;
      moveRef.current(pos - state.current.startPos, state.current.startValue);
    };
    const up = () => setDragging(false);
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    document.body.style.cursor = axis === 'x' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [dragging, axis]);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    state.current = { startPos: axis === 'x' ? e.clientX : e.clientY, startValue: current };
    setDragging(true);
  };
  return { dragging, onMouseDown };
}
