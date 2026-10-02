import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider } from './auth';
import { IS_DEMO } from './api';
import { LangProvider } from './i18n';
import { loadRecordings } from './lib/recordings';
import './styles.css';

if (IS_DEMO && window.self !== window.top) {
  // Embedded previews run in a sandboxed frame where confirm()/alert() are unavailable.
  window.confirm = () => true;
  window.alert = (msg?: unknown) => console.info(msg);
}

// Teacher recordings replace the browser voice wherever the same text is spoken
loadRecordings();

// The demo is a single page inside a frame, so routes live in memory instead of the URL.
const Router = IS_DEMO ? MemoryRouter : BrowserRouter;

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
