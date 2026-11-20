
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { User } from '@supabase/supabase-js'
import ResetPasswordPage from './components/ResetPasswordPage'

import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from 'react-router'

import './index.css'

import App from './App.tsx'
import LandingPage from './components/LandingPage'
import RegisterPage from './components/RegisterPage'
import LoginPage from './components/LoginPage'
import { supabase } from './services/supabaseClient'

function Root() {
  const navigate = useNavigate()

  const [user, setUser] = useState<User | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [logoutError, setLogoutError] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)

  // Check the existing login session after page refresh.
  useEffect(() => {
    let active = true

    const { data: { subscription } } =
      supabase.auth.onAuthStateChange((event, session) => {
        if (!active) return

        if (event === 'SIGNED_OUT') {
          setUser(null)
        }

        if (
          event === 'SIGNED_IN' ||
          event === 'TOKEN_REFRESHED' ||
          event === 'USER_UPDATED'
        ) {
          setUser(session?.user ?? null)
        }
      })

    // Verify the existing user with Supabase.
    supabase.auth.getUser()
      .then(({ data, error }) => {
        if (active) {
          setUser(error ? null : data.user)
        }
      })
      .catch(() => {
        if (active) {
          setUser(null)
        }
      })
      .finally(() => {
        if (active) {
          setCheckingAuth(false)
        }
      })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  function handleLoginSuccess(signedInUser: User) {
    setUser(signedInUser)
    navigate('/app', { replace: true })
  }

  async function handleLogout() {
    setLogoutError('')
    setLoggingOut(true)

    try {
      const { error } = await supabase.auth.signOut({
        scope: 'local',
      })

      if (error) {
        // A local sign-out may clear the device session
        // even if server-side token revocation fails.
        console.warn('Sign-out warning:', error.message)
      }

      setUser(null)
      navigate('/', { replace: true })
    } catch {
      setLogoutError(
        'Logout could not be completed. Please try again.'
      )
    } finally {
      setLoggingOut(false)
    }
  }

  // Prevent protected content flashing before auth check.
  if (checkingAuth) {
    return (
      <main style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: '#090e1d',
        color: '#ffffff',
        fontFamily: 'Arial, sans-serif',
      }}>
        <p role="status">Checking your login session...</p>
      </main>
    )
  }

  return (
    <Routes>
      <Route
  path="/reset-password"
  element={<ResetPasswordPage />}
/>
      <Route
        path="/"
        element={
          <LandingPage
            onLogin={() => navigate('/login')}
            onRegister={() => navigate('/register')}
            onGetStarted={() =>
              navigate(user ? '/app' : '/login')
            }
          />
        }
      />

      <Route
        path="/register"
        element={
          user ? (
            <Navigate to="/app" replace />
          ) : (
            <RegisterPage
              onBack={() => navigate('/')}
              onLogin={() => navigate('/login')}
            />
          )
        }
      />

      <Route
        path="/login"
        element={
          user ? (
            <Navigate to="/app" replace />
          ) : (
            <LoginPage
              onBack={() => navigate('/')}
              onRegister={() => navigate('/register')}
              onLoginSuccess={handleLoginSuccess}
            />
          )
        }
      />

      <Route
        path="/app"
        element={
          user ? (
            <>
              <header style={{
                padding: '12px 22px',
                background: '#111a2d',
                color: '#ffffff',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}>
                <div>
                  <strong>RehearsalRadar AI</strong>
                  <div style={{ fontSize: '13px' }}>
                    Signed in as {user.email}
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  gap: '10px',
                }}>
                  <button
                    type="button"
                    onClick={() => navigate('/')}
                  >
                    Home
                  </button>

                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={loggingOut}
                    style={{
                      padding: '9px 16px',
                      background: '#7c3aed',
                      color: '#ffffff',
                      border: 0,
                      borderRadius: '8px',
                      cursor: 'pointer',
                    }}
                  >
                    {loggingOut ? 'Logging out...' : 'Logout'}
                  </button>
                </div>

                {logoutError && (
                  <p role="alert">{logoutError}</p>
                )}
              </header>

              <App />
            </>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      <Route
        path="*"
        element={<Navigate to="/" replace />}
      />
    </Routes>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Root />
    </BrowserRouter>
  </StrictMode>,
)
