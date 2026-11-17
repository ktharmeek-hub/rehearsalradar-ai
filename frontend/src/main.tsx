
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

import App from './App.tsx'
import LandingPage from './components/LandingPage'
import RegisterPage from './components/RegisterPage'

type Page = 'landing' | 'register' | 'app'

function Root() {
  const [page, setPage] = useState<Page>('landing')

  function navigate(nextPage: Page) {
    setPage(nextPage)
    window.scrollTo(0, 0)
  }

  if (page === 'register') {
    return (
      <RegisterPage
        onBack={() => navigate('landing')}
      />
    )
  }

  if (page === 'app') {
    return <App />
  }

  return (
    <LandingPage
      onGetStarted={() => navigate('app')}
      onRegister={() => navigate('register')}
    />
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
