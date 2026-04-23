import { useEffect, useRef, useState } from 'react';

interface UseSwipeGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
  enabled?: boolean;
}

export function useSwipeGesture({
  onSwipeLeft,
  onSwipeRight,
  threshold = 80,
  enabled = true,
}: UseSwipeGestureOptions) {
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const elRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef({
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    isDragging: false,
  });
  const cbRef = useRef({ onSwipeLeft, onSwipeRight });
  cbRef.current = { onSwipeLeft, onSwipeRight };

  useEffect(() => {
    const el = elRef.current;
    if (!el || !enabled) return;

    let activePointerId: number | null = null;

    const finish = (commit: boolean) => {
      const state = stateRef.current;
      if (!state.isDragging) return;
      const deltaX = state.currentX - state.startX;
      const absDelta = Math.abs(deltaX);
      state.isDragging = false;
      setIsDragging(false);
      activePointerId = null;
      if (commit && absDelta >= threshold) {
        if (deltaX < 0 && cbRef.current.onSwipeLeft) cbRef.current.onSwipeLeft();
        else if (deltaX > 0 && cbRef.current.onSwipeRight) cbRef.current.onSwipeRight();
      }
      setOffset(0);
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (activePointerId !== null) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      activePointerId = e.pointerId;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      stateRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        currentX: e.clientX,
        currentY: e.clientY,
        isDragging: true,
      };
      setIsDragging(true);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerId !== activePointerId) return;
      const state = stateRef.current;
      if (!state.isDragging) return;
      const deltaX = e.clientX - state.startX;
      const deltaY = e.clientY - state.startY;
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        state.currentX = e.clientX;
        state.currentY = e.clientY;
        setOffset(deltaX);
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (e.pointerId !== activePointerId) return;
      finish(true);
    };

    const handlePointerCancel = (e: PointerEvent) => {
      if (e.pointerId !== activePointerId) return;
      finish(false);
    };

    el.addEventListener('pointerdown', handlePointerDown);
    el.addEventListener('pointermove', handlePointerMove);
    el.addEventListener('pointerup', handlePointerUp);
    el.addEventListener('pointercancel', handlePointerCancel);

    return () => {
      el.removeEventListener('pointerdown', handlePointerDown);
      el.removeEventListener('pointermove', handlePointerMove);
      el.removeEventListener('pointerup', handlePointerUp);
      el.removeEventListener('pointercancel', handlePointerCancel);
    };
  }, [enabled, threshold]);

  // Keyboard support
  useEffect(() => {
    if (!enabled) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && cbRef.current.onSwipeLeft) {
        cbRef.current.onSwipeLeft();
      } else if (e.key === 'ArrowRight' && cbRef.current.onSwipeRight) {
        cbRef.current.onSwipeRight();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [enabled]);

  return { offset, isDragging, elRef };
}
