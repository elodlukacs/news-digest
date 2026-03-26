import { useState, useRef, useCallback } from 'react';

interface UsePullToRefreshOptions {
  onRefresh: () => void | Promise<void>;
  threshold?: number;
}

export function usePullToRefresh({ onRefresh, threshold = 80 }: UsePullToRefreshOptions) {
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startYRef = useRef<number | null>(null);
  const isPullingRef = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      startYRef.current = e.touches[0].clientY;
      isPullingRef.current = true;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPullingRef.current || startYRef.current === null) return;
    
    const currentY = e.touches[0].clientY;
    const diff = currentY - startYRef.current;
    
    if (diff > 0) {
      e.preventDefault();
      setPullDistance(Math.min(diff, threshold * 1.5));
      setPulling(diff > 20);
    }
  }, [threshold]);

  const handleTouchEnd = useCallback(() => {
    if (pulling && pullDistance > threshold) {
      setPulling(false);
      setPullDistance(0);
      isPullingRef.current = false;
      startYRef.current = null;
      onRefresh();
    } else {
      setPulling(false);
      setPullDistance(0);
      isPullingRef.current = false;
      startYRef.current = null;
    }
  }, [pulling, pullDistance, threshold, onRefresh]);

  return {
    pulling,
    pullDistance,
    pullProgress: Math.min(pullDistance / threshold, 1),
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  };
}
