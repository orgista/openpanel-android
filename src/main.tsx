import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App'
import { StartupAnimation } from './app/components/StartupAnimation'
import { installDiagnostics, recordDiagnostic } from './app/native/diagnostics'
import './styles/index.css'

installDiagnostics()
recordDiagnostic("info", "OpenPanel started")

function OpenPanelRoot() {
  const [appMounted, setAppMounted] = useState(false)
  const [startupComplete, setStartupComplete] = useState(false)

  // The app mounts beneath the splash before it fades, so the fade reveals the
  // home screen instead of a black frame.
  return (
    <>
      {appMounted && <App />}
      {!startupComplete && (
        <StartupAnimation
          onReveal={() => setAppMounted(true)}
          onComplete={() => setStartupComplete(true)}
        />
      )}
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <OpenPanelRoot />
  </React.StrictMode>,
)
