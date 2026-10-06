import { useEffect, useRef } from 'react';

interface UseSwipeToOpenOptions {
  onOpen: () => void;
  enabled: boolean;
}

// iOS owns both screen edges (left = back, right = forward), so a swipe that
// starts this close to either edge is left to the system.
const EDGE_GUARD_PX = 32;
// A deliberate flick, not a scroll that drifted sideways or a slow drag.
const MIN_DISTANCE_PX = 60;
const MAX_DURATION_MS = 400;
const MIN_VELOCITY_PX_PER_MS = 0.3;
// Horizontal travel must clearly dominate: |dy| at most half of dx.
const MAX_SLOPE = 0.5;
// Vertical travel before the gesture is treated as a scroll and dropped.
const SCROLL_CANCEL_PX = 12;

/** Inside something that scrolls sideways (a carousel, a wide table, a code block)? */
function inHorizontalScroller(el: Element | null): boolean {
  for (let node = el; node && node !== document.body; node = node.parentElement) {
    if (node.scrollWidth > node.clientWidth + 1) {
      const overflowX = getComputedStyle(node).overflowX;
      if (overflowX === 'auto' || overflowX === 'scroll') return true;
    }
  }
  return false;
}

function ignoredTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return true;
  if (target.closest('input, textarea, select, [contenteditable="true"], [data-no-swipe]')) return true;
  // Another sheet, dialog or drawer is already open.
  if (document.querySelector('[role="dialog"]')) return true;
  return inHorizontalScroller(target);
}

/**
 * A quick rightward flick that starts away from the screen edges calls
 * `onOpen` — used to open the mobile menu without fighting iOS's edge swipes.
 * Listeners are passive, so scrolling is never blocked.
 */
export function useSwipeToOpen({ onOpen, enabled }: UseSwipeToOpenOptions) {
  const onOpenRef = useRef(onOpen);
  useEffect(() => {
    onOpenRef.current = onOpen;
  }, [onOpen]);

  useEffect(() => {
    if (!enabled) return;

    let start: { x: number; y: number; t: number } | null = null;

    const onStart = (e: TouchEvent) => {
      start = null;
      if (e.touches.length !== 1) return;
      const { clientX: x, clientY: y } = e.touches[0];
      if (x < EDGE_GUARD_PX || x > window.innerWidth - EDGE_GUARD_PX) return;
      if (ignoredTarget(e.target)) return;
      start = { x, y, t: performance.now() };
    };

    const onMove = (e: TouchEvent) => {
      if (!start) return;
      const { clientX, clientY } = e.touches[0];
      const dx = clientX - start.x;
      const dy = Math.abs(clientY - start.y);
      // Scrolling vertically, or moving left: not this gesture.
      if ((dy > SCROLL_CANCEL_PX && dy > Math.abs(dx)) || dx < -SCROLL_CANCEL_PX) start = null;
    };

    const onEnd = (e: TouchEvent) => {
      if (!start) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - start.x;
      const dy = Math.abs(touch.clientY - start.y);
      const dt = performance.now() - start.t;
      start = null;
      if (dx < MIN_DISTANCE_PX || dy > dx * MAX_SLOPE || dt > MAX_DURATION_MS) return;
      if (dx / dt < MIN_VELOCITY_PX_PER_MS) return;
      // Selecting text with a drag is not a request for the menu.
      if (window.getSelection()?.toString()) return;
      onOpenRef.current();
    };

    const onCancel = () => { start = null; };

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('touchend', onEnd, { passive: true });
    document.addEventListener('touchcancel', onCancel, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onCancel);
    };
  }, [enabled]);
}
