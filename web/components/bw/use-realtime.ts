'use client';
// Client-side opt-in for the realtime monitor (live map pins, raid watcher,
// Events tab). Per-browser preference in localStorage — no server flag, so any
// viewer can enable it without a redeploy. Default OFF: a plain save-based
// install shows none of the reader-dependent UI.
import { useCallback, useEffect, useState } from 'react';

const KEY = 'bw:realtime';

export const useRealtime = (): [boolean, (v: boolean) => void] => {
  const [on, setOn] = useState(false);
  useEffect(() => {
    try { setOn(localStorage.getItem(KEY) === '1'); } catch { /* no storage */ }
  }, []);
  const set = useCallback((v: boolean) => {
    setOn(v);
    try { localStorage.setItem(KEY, v ? '1' : '0'); } catch { /* no storage */ }
  }, []);
  return [on, set];
};
