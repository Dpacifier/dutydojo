import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    import('./webApi').then(({ getClient, initWebApi }) => {
      const sb = getClient();

      // onAuthStateChange fires with INITIAL_SESSION on page load AND on sign-in/sign-out.
      // PASSWORD_RECOVERY fires when the user lands via a reset-password email link.
      sb.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          // Don't call initWebApi yet — just show the set-new-password form.
          setState('recovery');
        } else if (session) {
          initWebApi(session.user.id);
          setState('ready');
        } else {
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
    return <SetNewPasswordLazy onDone={() => setState('login')} />;
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
