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
  // Check the URL hash SYNCHRONOUSLY before any async work.
  // When a user clicks a password-reset link the URL contains #type=recovery.
  // Supabase processes this hash immediately on client init, so by the time our
  // dynamic import resolves the onAuthStateChange event has already fired.
  // Detecting the hash here lets us render the correct screen without relying
  // on catching that first event.
  const isRecoveryLink = window.location.hash.includes('type=recovery');

  const [state, setState]   = useState<AppState>(isRecoveryLink ? 'recovery' : 'loading');
  const recoveryMode        = useRef(isRecoveryLink);

  useEffect(() => {
    import('./webApi').then(({ getClient, initWebApi }) => {
      const sb = getClient();

      sb.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          // Supabase detected the recovery token — stay on the reset screen.
          recoveryMode.current = true;
          setState('recovery');
        } else if (session && !recoveryMode.current) {
          // Normal sign-in or page refresh with existing session.
          initWebApi(session.user.id);
          setState('ready');
        } else if (!session) {
          // Signed out (including after password reset completes).
          recoveryMode.current = false;
          setState('login');
        }
        // If session exists but recoveryMode is true, the user is authenticated
        // via the recovery token — keep showing SetNewPassword, don't go to App.
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
          recoveryMode.current = false;
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
