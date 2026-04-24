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

/** Browser/PWA root — manages Supabase auth state before mounting App. */
function WebAppRoot() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    import('./webApi').then(({ getClient, initWebApi }) => {
      const sb = getClient();

      // onAuthStateChange fires with INITIAL_SESSION on page load (restoring an existing
      // session) AND on every subsequent sign-in/sign-out — so we only need this one listener.
      // A separate getSession() call would cause a double initWebApi → seeding race → duplicates.
      sb.auth.onAuthStateChange((_event, session) => {
        if (session) {
          initWebApi(session.user.id);
          setReady(true);
        } else {
          setReady(false);
        }
      });
    });
  }, []);

  if (!ready) return <WebLoginLazy onSuccess={() => setReady(true)} />;
  return <App />;
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
