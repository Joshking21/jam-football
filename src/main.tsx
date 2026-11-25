// Implements SPEC §11.1 and §19.2 Entry point & font loader
import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@/ui/styles/global.css';

import { App } from './App';
import { ErrorBoundary } from './ui/components/ErrorBoundary';
import { initAssetRegistry } from './assets/registry';

// Initialize asset registry immediately
initAssetRegistry();

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>,
  );
}
