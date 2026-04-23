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

    const handleTouchStart = (e: TouchEvent) => {
      stateRef.current = {
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY,
        currentX: e.touches[0].clientX,
        currentY: e.touches[0].clientY,
        isDragging: true,
      };
      setIsDragging(true);
    };

    const handleTouchMove = (e: TouchEvent) => {
      const state = stateRef.current;
      if (!state.isDragging) return;

      const clientX = e.touches[0].clientX;
      const clientY = e.touches[0].clientY;
      const deltaX = clientX - state.startX;
      const deltaY = clientY - state.startY;

      // Only handle horizontal swipes if dominant
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        state.currentX = clientX;
        state.currentY = clientY;
        setOffset(deltaX);
      }
    };

    const handleTouchEnd = () => {
      const state = stateRef.current;
      if (!state.isDragging) return;

      const deltaX = state.currentX - state.startX;
      const absDelta = Math.abs(deltaX);

      state.isDragging = false;
      setIsDragging(false);

      if (absDelta >= threshold) {
        if (deltaX < 0 && cbRef.current.onSwipeLeft) {
          cbRef.current.onSwipeLeft();
        } else if (deltaX > 0 && cbRef.current.onSwipeRight) {
          cbRef.current.onSwipeRight();
        }
      }

      setOffset(0);
    };

    const handleMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      stateRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        currentX: e.clientX,
        currentY: e.clientY,
        isDragging: true,
      };
      setIsDragging(true);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const state = stateRef.current;
      if (!state.isDragging) return;
      state.currentX = e.clientX;
      state.currentY = e.clientY;
      const deltaX = e.clientX - state.startX;
      setOffset(deltaX);
    };

    const handleMouseUp = () => {
      const state = stateRef.current;
      if (!state.isDragging) return;

      const deltaX = state.currentX - state.startX;
      const absDelta = Math.abs(deltaX);

      state.isDragging = false;
      setIsDragging(false);

      if (absDelta >= threshold) {
        if (deltaX < 0 && cbRef.current.onSwipeLeft) {
          cbRef.current.onSwipeLeft();
        } else if (deltaX > 0 && cbRef.current.onSwipeRight) {
          cbRef.current.onSwipeRight();
        }
      }

      setOffset(0);
    };

    const handleMouseLeave = () => {
      if (stateRef.current.isDragging) {
        handleMouseUp();
      }
    };

    // Attach native listeners — all passive, no preventDefault needed
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: true });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    el.addEventListener('mousedown', handleMouseDown);
    el.addEventListener('mousemove', handleMouseMove);
    el.addEventListener('mouseup', handleMouseUp);
    el.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('mousedown', handleMouseDown);
      el.removeEventListener('mousemove', handleMouseMove);
      el.removeEventListener('mouseup', handleMouseUp);
      el.removeEventListener('mouseleave', handleMouseLeave);
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
