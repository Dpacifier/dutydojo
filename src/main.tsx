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
  // Capture the URL state SYNCHRONOUSLY at mount time, before Supabase cleans it up.
  //
  // Password-reset links come in two forms depending on Supabase's flow setting:
  //   Implicit flow: dutydojo.com/#access_token=...&type=recovery  → hash contains "type=recovery"
  //   PKCE flow:     dutydojo.com?code=xxx                         → search contains "code="
  //
  // With PKCE, after Supabase exchanges the code it fires SIGNED_IN (not PASSWORD_RECOVERY)
  // and then calls history.replaceState to strip the ?code= from the URL. Capturing the
  // flag here ensures we still know it was a recovery link when SIGNED_IN arrives.
  const arrivedViaRecoveryLink = useRef(
    window.location.hash.includes('type=recovery') ||
    window.location.search.includes('code=')
  );

  const [state, setState] = useState<AppState>('loading');
  const inRecoveryMode    = useRef(false);

  useEffect(() => {
    import('./webApi').then(({ getClient, initWebApi }) => {
      const sb = getClient();

      sb.auth.onAuthStateChange((event, session) => {

        // ── Explicit recovery event (implicit-flow reset links) ──────────────
        if (event === 'PASSWORD_RECOVERY') {
          inRecoveryMode.current = true;
          setState('recovery');
          return;
        }

        // ── SIGNED_IN ────────────────────────────────────────────────────────
        if (event === 'SIGNED_IN') {
          if (arrivedViaRecoveryLink.current && !inRecoveryMode.current) {
            // PKCE recovery code was exchanged → show the set-new-password screen
            // instead of the app.  Clear the flag so subsequent sign-ins behave
            // normally (e.g. after the user resets their password and signs in again).
            inRecoveryMode.current      = true;
            arrivedViaRecoveryLink.current = false;
            setState('recovery');
          } else if (!inRecoveryMode.current) {
            // Normal sign-in.
            initWebApi(session!.user.id);
            setState('ready');
          }
          // If inRecoveryMode is true a SIGNED_IN can arrive; ignore it — the
          // user is still on the set-new-password screen.
          return;
        }

        // ── INITIAL_SESSION ──────────────────────────────────────────────────
        if (event === 'INITIAL_SESSION') {
          if (session && !arrivedViaRecoveryLink.current) {
            // Existing session on page refresh — go straight to the app.
            initWebApi(session.user.id);
            setState('ready');
          } else if (!session && !arrivedViaRecoveryLink.current) {
            // No session, no recovery link — show login.
            setState('login');
          }
          // If arrivedViaRecoveryLink is true, stay on 'loading' — the PKCE
          // exchange is in progress; SIGNED_IN / PASSWORD_RECOVERY will follow.
          return;
        }

        // ── SIGNED_OUT ───────────────────────────────────────────────────────
        if (event === 'SIGNED_OUT') {
          inRecoveryMode.current      = false;
          arrivedViaRecoveryLink.current = false;
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
          inRecoveryMode.current      = false;
          arrivedViaRecoveryLink.current = false;
          setState('login');
        }}
      />
    );
  }

  if (state === 'ready') return <App />;

  return <WebLoginLazy onSuccess={() => setState('ready')} />;
}

/** Lazy-loads WebLogin so it is never included in the Electron bundle. */
function WebLoginLazy({ onSuccess }: { onSuccess: () => void }) {
  const [Comp, setComp] = useState<React.ComponentType<{ onSuccess: () => void }> | null>(null);

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
  return <Comp onSuccess={onSuccess} />;
}

/** Lazy-loads SetNewPassword screen for the recovery flow. */
function SetNewPasswordLazy({ onDone }: { onDone: () => void }) {
  const [Comp, setComp] = useState<React.ComponentType<{ onDone: () => void }> | null>(null);

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
