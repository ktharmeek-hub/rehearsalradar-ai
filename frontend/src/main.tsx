
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import LandingPage from './components/LandingPage'

function Root() {
  const [showApp, setShowApp] = useState(false)

  function openApp() {
    setShowApp(true)
    window.scrollTo(0, 0)
  }

  return showApp ? (
    <App />
  ) : (
    <LandingPage onGetStarted={openApp} />
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
