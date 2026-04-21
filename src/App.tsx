import { useEffect, useState } from 'react';
import { useApp } from './store';
import { Onboarding } from './components/Onboarding';
import { KidView } from './components/KidView';
import { ParentLogin } from './components/ParentLogin';
import { ParentPortal } from './components/ParentPortal';
import { LegalModal } from './components/LegalModal';

type LegalTab = 'terms' | 'privacy' | 'data';

export default function App() {
  const view = useApp((s) => s.view);
  const bootstrap = useApp((s) => s.bootstrap);
  const darkMode = useApp((s) => s.darkMode);
  const [legalTab, setLegalTab] = useState<LegalTab | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const isBrowser = !(window as unknown as { __electron__?: boolean }).__electron__;

  return (
    <div className="min-h-screen flex flex-col text-dojo-ink dark:text-slate-100">
      {isBrowser && view.name !== 'loading' && (
        <div className="bg-amber-400 text-amber-900 text-xs font-semibold text-center py-1.5 px-4">
          Demo mode — data is temporary and resets on refresh. Run the desktop app for real data.
        </div>
      )}

      <div className="flex-1">
        {view.name === 'loading' && <LoadingScreen />}
        {view.name === 'onboarding' && <Onboarding />}
        {view.name === 'kid' && <KidView />}
        {view.name === 'parent-login' && <ParentLogin />}
        {view.name === 'parent-portal' && <ParentPortal />}
      </div>

      {view.name !== 'loading' && (
        <footer className="border-t border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm px-6 py-2 flex items-center justify-between text-xs text-dojo-muted">
          <span>
            {String.fromCharCode(169)} {new Date().getFullYear()} Switch IT Global Limited
            {' '}· Co. No. 11001626
          </span>
          <nav className="flex gap-4">
            <button
              onClick={() => setLegalTab('terms')}
              className="hover:text-dojo-primary transition underline-offset-2 hover:underline"
            >
              Terms &amp; Conditions
            </button>
            <button
              onClick={() => setLegalTab('privacy')}
              className="hover:text-dojo-primary transition underline-offset-2 hover:underline"
            >
              Privacy Policy
            </button>
            <button
              onClick={() => setLegalTab('data')}
              className="hover:text-dojo-primary transition underline-offset-2 hover:underline"
            >
              Data &amp; GDPR
            </button>
          </nav>
        </footer>
      )}

      {legalTab && (
        <LegalModal initialTab={legalTab} onClose={() => setLegalTab(null)} />
      )}
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-4">🥋</div>
        <div className="font-display text-2xl font-semibold">DutyDojo</div>
        <div className="text-dojo-muted mt-1">Loading…</div>
      </div>
    </div>
  );
}
