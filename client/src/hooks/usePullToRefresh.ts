import { useState, useRef, useEffect } from 'react';

interface UsePullToRefreshOptions {
  onRefresh: () => void | Promise<void>;
  threshold?: number;
}

export function usePullToRefresh({ onRefresh, threshold = 80 }: UsePullToRefreshOptions) {
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startYRef = useRef<number | null>(null);
  const isPullingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onRefreshRef = useRef(onRefresh);
  const pullingRef = useRef(false);
  const pullDistanceRef = useRef(0);
  const thresholdRef = useRef(threshold);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    thresholdRef.current = threshold;
  }, [threshold]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) {
        startYRef.current = e.touches[0].clientY;
        isPullingRef.current = true;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPullingRef.current || startYRef.current === null) return;

      const currentY = e.touches[0].clientY;
      const diff = currentY - startYRef.current;

      if (diff > 0) {
        e.preventDefault();
        const dist = Math.min(diff, thresholdRef.current * 1.5);
        pullDistanceRef.current = dist;
        pullingRef.current = diff > 20;
        setPullDistance(dist);
        setPulling(diff > 20);
      }
    };

    const handleTouchEnd = async () => {
      if (pullingRef.current && pullDistanceRef.current > thresholdRef.current) {
        await onRefreshRef.current();
      }
      setPulling(false);
      setPullDistance(0);
      isPullingRef.current = false;
      pullingRef.current = false;
      pullDistanceRef.current = 0;
      startYRef.current = null;
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  return {
    pulling,
    pullDistance,
    pullProgress: Math.min(pullDistance / threshold, 1),
    containerRef,
  };
}
