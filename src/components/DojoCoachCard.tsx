/**
 * DojoCoachCard
 *
 * Displays a personalised daily motivational message from "Dojo Coach"
 * (powered by Claude via the dojo-coach Supabase Edge Function).
 *
 * The message is cached in localStorage per child per calendar day, so the
 * Edge Function is only called once per child per day.
 *
 * Renders nothing for:
 *  - Electron users (SUPABASE_URL is empty → getCoachMessage returns null)
 *  - Any network / API failure
 *  - While waiting to discover if a message is available
 */
import { useEffect, useState } from 'react';
import { getCoachMessage } from '../webApi';

interface Props {
  childId:   number;
  childName: string;
  points:    number;
  goal:      number;
  streak:    number;
  themeColor: string;
}

type State = 'loading' | 'ready' | 'none';

export function DojoCoachCard({ childId, childName, points, goal, streak, themeColor }: Props) {
  const [state,   setState]   = useState<State>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setMessage('');

    getCoachMessage({ childId, childName, points, goal, streak })
      .then((msg) => {
        if (cancelled) return;
        if (msg) { setMessage(msg); setState('ready'); }
        else     { setState('none'); }
      })
      .catch(() => { if (!cancelled) setState('none'); });

    return () => { cancelled = true; };
  }, [childId]); // re-fetch only when the active child changes (not on every point change)

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (state === 'loading') {
    return (
      <div className="dojo-card mt-4 animate-pulse" aria-hidden>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 rounded bg-slate-200 dark:bg-slate-700 w-2/3" />
            <div className="h-3 rounded bg-slate-200 dark:bg-slate-700 w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  // ── No message (Electron / error / feature not available) ──────────────────
  if (state === 'none') return null;

  // ── Coach message card ─────────────────────────────────────────────────────
  return (
    <div
      className="dojo-card mt-4"
      style={{ borderColor: `${themeColor}50`, background: `${themeColor}08` }}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0"
          style={{ background: `${themeColor}20` }}
          aria-hidden
        >
          🥷
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div
            className="text-xs font-bold uppercase tracking-widest mb-1.5"
            style={{ color: themeColor }}
          >
            Dojo Coach · Today
          </div>
          <p className="text-sm text-dojo-ink dark:text-white leading-relaxed">
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}
