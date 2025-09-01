import * as React from 'react'
import { createRoot } from 'react-dom/client'
// TEMP: comment heavy imports to isolate import-time errors
import GeneratorPage from './pages/generator'
import { GlobalContextProviders } from './components/_globalContextProviders'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'

console.log('[floot] main.tsx booting')
const rootEl = document.getElementById('root')!
if (!rootEl) {
  console.error('[floot] #root not found')
}

class RootErrorBoundary extends React.Component<{ children: React.ReactNode }, { error?: any }> {
  constructor(props: any) {
    super(props);
    this.state = { error: undefined };
  }
  static getDerivedStateFromError(error: any) {
    return { error };
  }
  componentDidCatch(error: any, info: any) {
    console.error('[floot] RootErrorBoundary caught', { error, info });
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 16, color: 'red' }}>
          <h1>App crashed</h1>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{String(this.state.error?.message || this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children as any;
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
