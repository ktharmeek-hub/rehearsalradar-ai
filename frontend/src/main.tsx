
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { User } from '@supabase/supabase-js'

import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useLocation,
} from 'react-router'

import './index.css'

import App from './App.tsx'
import LandingPage from './components/LandingPage'
import RegisterPage from './components/RegisterPage'
import LoginPage from './components/LoginPage'
import ResetPasswordPage from './components/ResetPasswordPage'
import DashboardPage from './components/DashboardPage'
import { supabase } from './services/supabaseClient'

function Root() {
  const navigate = useNavigate()
  const location = useLocation()

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

  // Scroll to the selected singing tool after navigation.
  useEffect(() => {
    if (
      checkingAuth ||
      !user ||
      location.pathname !== '/app' ||
      !location.hash
    ) {
      return
    }

    const sectionId = location.hash.slice(1)

    const frame = window.requestAnimationFrame(() => {
      document
        .getElementById(sectionId)
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [
    checkingAuth,
    user,
    location.pathname,
    location.hash,
  ])

  // Open the personal dashboard after successful login.
  function handleLoginSuccess(signedInUser: User) {
    setUser(signedInUser)
    navigate('/dashboard', { replace: true })
  }

  // Logout functionality.
  async function handleLogout() {
    if (loggingOut) return

    setLogoutError('')
    setLoggingOut(true)

    try {
      const { error } = await supabase.auth.signOut({
        scope: 'local',
      })

      if (error) {
        setLogoutError(error.message)
        return
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

  // Wait until authentication checking is complete.
  if (checkingAuth) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#090e1d',
          color: '#ffffff',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <p role="status">
          Checking your login session...
        </p>
      </main>
    )
  }

  return (
    <Routes>

      {/* Reset Password Page */}
      <Route
        path="/reset-password"
        element={<ResetPasswordPage />}
      />

      {/* Public Landing Page */}
      <Route
        path="/"
        element={
          <LandingPage
            onLogin={() => navigate('/login')}
            onRegister={() => navigate('/register')}
            onGetStarted={() =>
              navigate(user ? '/dashboard' : '/login')
            }
          />
        }
      />

      {/* Registration Page */}
      <Route
        path="/register"
        element={
          user ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <RegisterPage
              onBack={() => navigate('/')}
              onLogin={() => navigate('/login')}
            />
          )
        }
      />

      {/* Login Page */}
      <Route
        path="/login"
        element={
          user ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <LoginPage
              onBack={() => navigate('/')}
              onRegister={() => navigate('/register')}
              onLoginSuccess={handleLoginSuccess}
            />
          )
        }
      />

      {/* Protected Personal Dashboard */}
      <Route
        path="/dashboard"
        element={
          user ? (
            <>
              {logoutError && (
                <p
                  role="alert"
                  style={{
                    padding: '12px',
                    background: '#7f1d1d',
                    color: '#ffffff',
                  }}
                >
                  {logoutError}
                </p>
              )}

              <DashboardPage
                user={user}
                onHome={() => navigate('/')}
                onLogout={handleLogout}
                onOpenSection={(section) =>
                  navigate(`/app#${section}`)
                }
              />
            </>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* Protected Singing Application */}
      <Route
        path="/app"
        element={
          user ? (
            <>
              <header
                style={{
                  padding: '12px 22px',
                  background: '#111a2d',
                  color: '#ffffff',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <div>
                  <strong>RehearsalRadar AI</strong>

                  <div style={{ fontSize: '13px' }}>
                    Signed in as {user.email}
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '10px',
                  }}
                >

                  {/* Dashboard Button - Correct Location */}
                  <button
                    type="button"
                    onClick={() => navigate('/dashboard')}
                    style={{
                      padding: '9px 16px',
                      background: '#334155',
                      color: '#ffffff',
                      border: 0,
                      borderRadius: '8px',
                      cursor: 'pointer',
                    }}
                  >
                    Dashboard
                  </button>

                  {/* Home Button */}
                  <button
                    type="button"
                    onClick={() => navigate('/')}
                    style={{
                      padding: '9px 16px',
                      background: '#334155',
                      color: '#ffffff',
                      border: 0,
                      borderRadius: '8px',
                      cursor: 'pointer',
                    }}
                  >
                    Home
                  </button>

                  {/* Logout Button */}
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

      {/* Redirect unknown URLs to Home */}
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
