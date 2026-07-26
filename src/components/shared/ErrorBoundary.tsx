import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

/**
 * Root error boundary. Catches render errors anywhere below it so a single
 * unexpected value never leaves the PWA on a blank white screen — instead the
 * user gets a calm recovery screen and their local data stays intact (Dexie is
 * untouched by a render crash). Error boundaries must be class components.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Single choke point — a remote error reporter would hook in here later.
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  private reset = () => this.setState({ hasError: false, error: undefined })

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-surface border border-white/10 rounded-2xl p-6 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center">
              <AlertTriangle size={24} className="text-red-400" />
            </div>
          </div>

          <h1 className="text-ink font-semibold text-lg mb-1.5">Algo salió mal</h1>
          <p className="text-ink-muted text-sm mb-6">
            Tus datos están guardados en este dispositivo. No se perdió nada.
          </p>

          <div className="space-y-2">
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 rounded-xl bg-accent text-on-accent font-semibold text-sm"
            >
              Recargar app
            </button>
            <button
              onClick={this.reset}
              className="w-full py-3 rounded-xl bg-surface border border-white/10 text-ink-muted text-sm"
            >
              Reintentar
            </button>
          </div>

          {this.state.error?.message && (
            <details className="mt-5 text-left">
              <summary className="text-ink-faint text-xs cursor-pointer">Detalle técnico</summary>
              <pre className="mt-2 text-ink-faint text-[11px] whitespace-pre-wrap break-words">
                {this.state.error.message}
              </pre>
            </details>
          )}
        </div>
      </div>
    )
  }
}
