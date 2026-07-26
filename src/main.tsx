import React from 'react'
import ReactDOM from 'react-dom/client'
// Self-hosted brand fonts (cached by the PWA service worker → work offline).
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/700.css'
import App from './App'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
