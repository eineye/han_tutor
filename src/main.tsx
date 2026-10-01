import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './auth';
import { IS_DEMO } from './api';
import './styles.css';

if (IS_DEMO && window.self !== window.top) {
  // Embedded previews run in a sandboxed frame where confirm()/alert() are unavailable.
  window.confirm = () => true;
  window.alert = (msg?: unknown) => console.info(msg);
}

// The demo is a single page inside a frame, so routes live in memory instead of the URL.
const Router = IS_DEMO ? MemoryRouter : BrowserRouter;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <AuthProvider>
        <App />
      </AuthProvider>
    </Router>
  </StrictMode>,
);
