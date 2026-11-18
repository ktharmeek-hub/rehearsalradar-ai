
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { User } from '@supabase/supabase-js'

import './index.css'
import App from './App.tsx'
import LandingPage from './components/LandingPage'
import RegisterPage from './components/RegisterPage'
import LoginPage from './components/LoginPage'
import { supabase } from './services/supabaseClient'

type Page = 'landing' | 'register' | 'login' | 'app'

function Root() {
  const [page, setPage] = useState<Page>('landing')
  const [user, setUser] = useState<User | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [logoutError, setLogoutError] = useState('')

  useEffect(() => {
    let active = true

    // Verify any existing Supabase login on page load.
    supabase.auth.getUser()
      .then(({ data, error }) => {
        if (active) {
          setUser(error ? null : data.user)
        }
      })
      .catch(() => {
        if (active) setUser(null)
      })
      .finally(() => {
        if (active) setCheckingAuth(false)
      })

    // Keep the UI updated when the login state changes.
    const { data: { subscription } } =
      supabase.auth.onAuthStateChange((_event, session) => {
        if (active) {
          setUser(session?.user ?? null)
        }
      })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  function navigate(nextPage: Page) {
    setPage(nextPage)
    setLogoutError('')
    window.scrollTo(0, 0)
  }

  function handleLoginSuccess(signedInUser: User) {
    setUser(signedInUser)
    navigate('app')
  }

  async function handleLogout() {
    setLogoutError('')

    const { error } = await supabase.auth.signOut({
      scope: 'local',
    })

    if (error) {
      setLogoutError(error.message)
      return
    }

    setUser(null)
    navigate('landing')
  }

  if (checkingAuth) {
    return (
      <main style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: '#090e1d',
        color: 'white',
      }}>
        Checking login...
      </main>
    )
  }

  if (page === 'register') {
    return (
      <RegisterPage
        onBack={() => navigate('landing')}
        onLogin={() => navigate('login')}
      />
    )
  }

  if (page === 'login' || (page === 'app' && !user)) {
    return (
      <LoginPage
        onBack={() => navigate('landing')}
        onRegister={() => navigate('register')}
        onLoginSuccess={handleLoginSuccess}
      />
    )
  }

  if (page === 'app' && user) {
    return (
      <>
        <header style={{
          padding: '12px 22px',
          background: '#111a2d',
          color: 'white',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span>
            Signed in as {user.email}
          </span>
          <button
            type="button"
            onClick={handleLogout}
            style={{
              padding: '9px 16px',
              background: '#7c3aed',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            Logout
          </button>
          {logoutError && (
            <p role="alert">{logoutError}</p>
          )}
        </header>

        <App />
      </>
    )
  }

  return (
    <LandingPage
      onLogin={() => navigate('login')}
      onRegister={() => navigate('register')}
      onGetStarted={() => navigate(user ? 'app' : 'login')}
    />
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
