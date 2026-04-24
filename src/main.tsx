import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './types';

// Mount the application
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);

/**
 * Top-level root:
 *  - Electron: window.dojo already exists (injected by preload) → render App directly.
 *  - Browser/PWA: check Supabase session → show WebLogin or App.
 */
function Root() {
  const hasElectronBridge = !!(window as unknown as Record<string, unknown>).dojo;
  if (hasElectronBridge) return <App />;
  return <WebAppRoot />;
}

type AppState = 'loading' | 'login' | 'ready' | 'recovery';

/** Browser/PWA root — manages Supabase auth state before mounting App. */
function WebAppRoot() {
  const [state, setState]       = useState<AppState>('loading');
  const [linkError, setLinkError] = useState('');
  const inRecoveryMode          = useRef(false);

  useEffect(() => {
    // Capture ?code= SYNCHRONOUSLY before the dynamic import, because Supabase or
    // history.replaceState may strip query params before the module resolves.
    const urlParams   = new URLSearchParams(window.location.search);
    const pkceCode    = urlParams.get('code');
    const isHashRecov = window.location.hash.includes('type=recovery');

    import('./webApi').then(({ getClient, initWebApi, exchangeCodeForSession }) => {

      // ── PKCE code in URL → exchange it manually ───────────────────────────
      // detectSessionInUrl is false so Supabase will NOT auto-exchange it.
      // We do it ourselves so we can show a friendly "link expired" message.
      if (pkceCode) {
        // Strip ?code= from the address bar immediately so a refresh won't
        // try to reuse an already-consumed code.
        const clean = window.location.pathname + window.location.hash;
        window.history.replaceState({}, '', clean);

        exchangeCodeForSession(pkceCode).then((result) => {
          if (result.error || !result.userId) {
            setLinkError(
              result.error ?? 'This reset link has expired. Please request a new one.',
            );
            setState('login');
          } else {
            // A ?code= in the URL always means a password-reset link.
            inRecoveryMode.current = true;
            setState('recovery');
          }
        });
      }

      // ── Implicit-flow recovery hash (legacy / fallback) ───────────────────
      if (isHashRecov) {
        inRecoveryMode.current = true;
        setState('recovery');
      }

      const sb = getClient();

      sb.auth.onAuthStateChange((event, session) => {

        // ── PASSWORD_RECOVERY (implicit-flow reset links) ─────────────────
        if (event === 'PASSWORD_RECOVERY') {
          inRecoveryMode.current = true;
          setState('recovery');
          return;
        }

        // ── SIGNED_IN ─────────────────────────────────────────────────────
        if (event === 'SIGNED_IN') {
          if (!inRecoveryMode.current) {
            // Normal sign-in — not a recovery flow.
            initWebApi(session!.user.id);
            setState('ready');
          }
          // If recovery mode is active the user is on the set-new-password
          // screen; ignore this event.
          return;
        }

        // ── INITIAL_SESSION ───────────────────────────────────────────────
        if (event === 'INITIAL_SESSION') {
          if (pkceCode || isHashRecov) {
            // Being handled above — skip.
            return;
          }
          if (session) {
            initWebApi(session.user.id);
            setState('ready');
          } else {
            setState('login');
          }
          return;
        }

        // ── SIGNED_OUT ────────────────────────────────────────────────────
        if (event === 'SIGNED_OUT') {
          inRecoveryMode.current = false;
          setState('login');
        }
      });
    });
  }, []);

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">{'🥋'}</div>
          <div className="text-dojo-muted">Loading...</div>
        </div>
      </div>
    );
  }

  if (state === 'recovery') {
    return (
      <SetNewPasswordLazy
        onDone={() => {
          inRecoveryMode.current = false;
          setState('login');
        }}
      />
    );
  }

  if (state === 'ready') return <App />;

  return <WebLoginLazy onSuccess={() => setState('ready')} initialError={linkError} />;
}

// ── Type aliases keep the generic parameters out of JSX so the TSX parser ──
// ── doesn't try to interpret them as JSX elements.                         ──
type WebLoginCompType      = React.ComponentType<{ onSuccess: () => void; initialError?: string }>;
type SetNewPasswordCompType = React.ComponentType<{ onDone: () => void }>;

/** Lazy-loads WebLogin so it is never included in the Electron bundle. */
function WebLoginLazy({ onSuccess, initialError }: { onSuccess: () => void; initialError?: string }) {
  const [Comp, setComp] = useState<WebLoginCompType | null>(null);

  useEffect(() => {
    import('./components/WebLogin').then((m) => setComp(() => m.WebLogin));
  }, []);

  if (!Comp) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">{'🥋'}</div>
          <div className="text-dojo-muted">Loading...</div>
        </div>
      </div>
    );
  }
  return <Comp onSuccess={onSuccess} initialError={initialError} />;
}

/** Lazy-loads SetNewPassword screen for the recovery flow. */
function SetNewPasswordLazy({ onDone }: { onDone: () => void }) {
  const [Comp, setComp] = useState<SetNewPasswordCompType | null>(null);

  useEffect(() => {
    import('./components/SetNewPassword').then((m) => setComp(() => m.SetNewPassword));
  }, []);

  if (!Comp) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">{'🔑'}</div>
          <div className="text-dojo-muted">Loading...</div>
        </div>
      </div>
    );
  }
  return <Comp onDone={onDone} />;
}
