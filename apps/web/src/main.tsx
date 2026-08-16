import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { startSyncEngine } from './lib/sync';
import { queryClient } from './lib/queryClient';
import './index.css';

function Root() {
  // Liga o motor de sincronização da fila offline (Requisito 4.4).
  useEffect(() => startSyncEngine(), []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
