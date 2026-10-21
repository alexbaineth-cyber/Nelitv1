import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { setupStreamProtection } from './utils/security.ts';

// Enable anti-theft stream security & disable inspect element shortcuts
setupStreamProtection();

// Register PWA service worker for app installation
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('PWA service worker registration notice:', err);
    });
  });
}

createRoot(document.getElementById('root')!).render(<App />);
