'use client';

import { useEffect, useRef, useState } from 'react';

interface CountdownResult {
  remainingSeconds: number; // negative once overdue
  label: string;
  isNearEnd: boolean; // within the warning window, still running
  isOverdue: boolean;
}

const WARNING_WINDOW_SECONDS = 10 * 60;

function formatDuration(totalSeconds: number): string {
  const sign = totalSeconds < 0 ? '-' : '';
  const abs = Math.abs(totalSeconds);
  const m = Math.floor(abs / 60);
  const s = Math.floor(abs % 60);
  return `${sign}${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Ticks every second toward `expectedEndAt`. Calls `onWarning` once when the
 * countdown first enters the warning window, and `onOverdue` once when it
 * first crosses zero — used to play the "time is almost up" alert sound.
 */
export function useCountdown(
  expectedEndAt: string | null,
  onWarning?: () => void,
  onOverdue?: () => void
): CountdownResult {
  const [remainingSeconds, setRemainingSeconds] = useState<number>(() =>
    expectedEndAt ? Math.round((new Date(expectedEndAt).getTime() - Date.now()) / 1000) : 0
  );
  const warnedRef = useRef(false);
  const overdueRef = useRef(false);

  useEffect(() => {
    warnedRef.current = false;
    overdueRef.current = false;
    if (!expectedEndAt) return;

    const tick = () => {
      const remaining = Math.round((new Date(expectedEndAt).getTime() - Date.now()) / 1000);
      setRemainingSeconds(remaining);

      if (remaining <= WARNING_WINDOW_SECONDS && remaining > 0 && !warnedRef.current) {
        warnedRef.current = true;
        onWarning?.();
      }
      if (remaining <= 0 && !overdueRef.current) {
        overdueRef.current = true;
        onOverdue?.();
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expectedEndAt]);

  return {
    remainingSeconds,
    label: formatDuration(remainingSeconds),
    isNearEnd: remainingSeconds <= WARNING_WINDOW_SECONDS && remainingSeconds > 0,
    isOverdue: remainingSeconds <= 0,
  };
}
