import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * Captura erros de renderização para evitar a "tela branca" (Requisito 4.8).
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // Em produção, enviar para um serviço de telemetria (Sentry, etc.).
    console.error('ErrorBoundary capturou:', error, info.componentStack);
  }

  override render() {
    if (this.state.error) {
      return (
        <div className="flex h-full min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
          <div className="text-5xl">⚠️</div>
          <h1 className="text-xl font-bold text-slate-800">Algo deu errado</h1>
          <p className="max-w-md text-slate-500">
            A aplicação encontrou um erro inesperado. Suas vendas offline pendentes estão
            seguras na fila local.
          </p>
          <pre className="max-w-md overflow-auto rounded-lg bg-slate-100 p-3 text-left text-xs text-rose-600">
            {this.state.error.message}
          </pre>
          <button className="btn-primary" onClick={() => window.location.reload()}>
            Recarregar aplicação
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
