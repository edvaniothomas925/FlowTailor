import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Intercept and silence sandbox WebSocket compile-time or live-reload warning errors
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason?.message || String(event.reason);
    if (reason && (reason.includes('WebSocket') || reason.includes('websocket') || reason.includes('HMR'))) {
      event.preventDefault();
      console.warn('Silenced benign sandbox WebSocket rejection:', reason);
    }
  });

  window.addEventListener('error', (event) => {
    const msg = event.message || '';
    if (msg.includes('WebSocket') || msg.includes('websocket') || msg.includes('HMR')) {
      event.preventDefault();
      console.warn('Silenced benign sandbox WebSocket progress error.');
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register Progressive Web App (PWA) Service Worker with automatic update reload capabilities
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('FlowTailor PWA Service Worker registrado com sucesso:', registration.scope);
        
        // Check for updates to the service worker in the background
        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.addEventListener('statechange', () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('SW: Nova versão instalada e pronta. Atualizando página automaticamente...');
                // Trigger a page reload to apply the new code immediately
                window.location.reload();
              }
            });
          }
        });
      })
      .catch((error) => {
        console.error('Falha ao registrar PWA Service Worker:', error);
      });

    // Detect when the updated service worker takes over control
    let isReloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!isReloading) {
        isReloading = true;
        window.location.reload();
      }
    });
  });
}
