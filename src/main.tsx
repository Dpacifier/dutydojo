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
  const [state, setState] = useState<AppState>('loading');
  const recoveryMode      = useRef(false);

  useEffect(() => {
    import('./webApi').then(({ getClient, initWebApi }) => {
      const sb = getClient();

      sb.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          // User arrived via a password-reset link (PKCE or implicit flow).
          recoveryMode.current = true;
          setState('recovery');

        } else if (event === 'SIGNED_IN' && !recoveryMode.current) {
          // Normal sign-in.
          initWebApi(session!.user.id);
          setState('ready');

        } else if (event === 'INITIAL_SESSION') {
          if (session && !recoveryMode.current) {
            // Existing session on page load/refresh.
            initWebApi(session.user.id);
            setState('ready');
          } else if (!session) {
            // No session yet. If the URL has ?code= Supabase is still exchanging
            // a PKCE token — keep showing the loading spinner until PASSWORD_RECOVERY
            // or SIGNED_IN fires. If there is no code, go straight to login.
            const hasPkceCode = window.location.search.includes('code=');
            if (!hasPkceCode) setState('login');
            // else: stay 'loading' — the next event will resolve the state.
          }

        } else if (event === 'SIGNED_OUT') {
          recoveryMode.current = false;
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
