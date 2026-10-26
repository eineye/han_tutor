import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter, MemoryRouter } from 'react-router-dom';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider } from './auth';
import { IS_DEMO } from './api';
import { LangProvider } from './i18n';
import { initNativeApp, registerServiceWorker } from './lib/native';
import { loadRecordings } from './lib/recordings';
import { loadTtsSettings } from './lib/speech';
import './styles.css';

if (IS_DEMO && window.self !== window.top) {
  // Embedded previews run in a sandboxed frame where confirm()/alert() are unavailable.
  window.confirm = () => true;
  window.alert = (msg?: unknown) => console.info(msg);
}

// Teacher recordings replace the browser voice wherever the same text is spoken
loadRecordings();
loadTtsSettings();

initNativeApp();
// Demo build = one static page (GitHub Pages, Android app): routes live in the #hash so the back button works.
// Inside a frame (embedded preview) they live in memory instead.
registerServiceWorker(IS_DEMO ? 'sw.js' : '/sw.js');
const Router = !IS_DEMO ? BrowserRouter : window.self !== window.top ? MemoryRouter : HashRouter;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <LangProvider>
        <Router>
          <AuthProvider>
            <App />
          </AuthProvider>
        </Router>
      </LangProvider>
    </ErrorBoundary>
  </StrictMode>,
);
