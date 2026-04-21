import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './types';

// In a browser (no Electron bridge) install the in-memory mock so the full UI works
import { installMock } from './dojoMock';
if (!(window as unknown as { dojo?: unknown }).dojo) {
  installMock();
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
