import * as React from 'react'
import { createRoot } from 'react-dom/client'
// TEMP: comment heavy imports to isolate import-time errors
import GeneratorPage from './pages/generator'
import { initializeThemeOnStart } from './helpers/themeRuntime'
import { GlobalContextProviders } from './components/_globalContextProviders'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'

console.log('[floot] main.tsx booting')
initializeThemeOnStart()
const rootEl = document.getElementById('root')!
if (!rootEl) {
  console.error('[floot] #root not found')
}

// Global error handlers for non-render errors (optional but helpful)
try {
  if (typeof window !== 'undefined') {
    window.onerror = (message, source, lineno, colno, error) => {
      if (import.meta?.env?.MODE !== 'production') {
        console.error('[floot] window.onerror', { message, source, lineno, colno, error })
      }
    }
    window.onunhandledrejection = (event) => {
      if (import.meta?.env?.MODE !== 'production') {
        console.error('[floot] window.onunhandledrejection', event?.reason)
      }
    }
  }
} catch { }

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error; info?: { componentStack?: string } }
> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }
  override componentDidCatch(error: Error, info: { componentStack?: string }) {
    try {
      if (import.meta?.env?.MODE !== 'production') {
        console.groupCollapsed('[floot] RootErrorBoundary caught')
        console.error(error)
        if (info?.componentStack) console.log(info.componentStack)
        console.groupEnd()
      }
      // Hook in telemetry here if desired (e.g., Sentry)
    } catch { }
    this.setState({ info })
  }
  override render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 16 }}>
          <h1>Something went wrong</h1>
          {import.meta?.env?.MODE !== 'production' ? (
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>
              {(this.state.error?.message || String(this.state.error))}
              {'\n'}
              {this.state.info?.componentStack || ''}
            </pre>
          ) : null}
        </div>
      )
    }
    return this.props.children as any
  }
}

createRoot(rootEl).render(
  <React.StrictMode>
    <BrowserRouter>
      <GlobalContextProviders>
        <RootErrorBoundary>
          <HelmetProvider>
            <GeneratorPage />
          </HelmetProvider>
        </RootErrorBoundary>
      </GlobalContextProviders>
    </BrowserRouter>
  </React.StrictMode>,
)
console.log('[floot] main.tsx rendered')
