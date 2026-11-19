
import { useState } from 'react'
import type { FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../services/supabaseClient'
import './LoginPage.css'

type LoginPageProps = {
  onBack: () => void
  onRegister: () => void
  onLoginSuccess: (user: User) => void
}

export default function LoginPage({
  onBack,
  onRegister,
  onLoginSuccess,
}: LoginPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resetMessage, setResetMessage] = useState('')

  // Login using Supabase Authentication
  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setError('')
    setResetMessage('')

    const cleanEmail = email.trim().toLowerCase()

    if (!cleanEmail || !password) {
      setError('Please enter your email and password.')
      return
    }

    setLoading(true)

    try {
      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        })

      if (loginError) {
        setError(loginError.message)
        return
      }

      if (!data.user || !data.session) {
        setError('Login could not be completed. Please try again.')
        return
      }

      setPassword('')
      onLoginSuccess(data.user)
    } catch {
      setError('Unable to connect. Check your internet connection.')
    } finally {
      setLoading(false)
    }
  }

  // Send a password recovery email
  async function handleForgotPassword() {
    const userEmail = email.trim().toLowerCase()

    setError('')
    setResetMessage('')

    if (!userEmail) {
      setError('Please enter your registered email first.')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)) {
      setError('Please enter a valid email address.')
      return
    }

    setLoading(true)

    try {
      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(userEmail, {
          redirectTo: `${window.location.origin}/reset-password`,
        })

      if (resetError) {
        setError(resetError.message)
        return
      }

      setResetMessage(
        'If an account exists for this email, check your inbox for a password reset link.'
      )
    } catch {
      setError(
        'Unable to send the password reset request. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="rr-login-page">
      <section className="rr-login-card">

        <button
          type="button"
          className="rr-login-back"
          onClick={onBack}
        >
          ← Back to Home
        </button>

        <h1>Welcome Back!</h1>

        <p className="rr-login-description">
          Login to continue your singing journey.
        </p>

        <form onSubmit={handleLogin}>

          {/* Email field */}
          <label htmlFor="login-email">
            Email Address
          </label>

          <input
            id="login-email"
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />

          {/* Password field */}
          <label htmlFor="login-password">
            Password
          </label>

          <input
            id="login-password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />

          {/* Forgot Password button */}
          <button
            type="button"
            onClick={handleForgotPassword}
            disabled={loading}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#c4b5fd',
              cursor: loading ? 'not-allowed' : 'pointer',
              textAlign: 'right',
              padding: '8px 0',
              fontSize: '14px',
              alignSelf: 'flex-end',
            }}
          >
            Forgot Password?
          </button>

          {/* Error message */}
          {error && (
            <div
              className="rr-login-error"
              role="alert"
            >
              {error}
            </div>
          )}

          {/* Password reset request message */}
          {resetMessage && (
            <div
              role="status"
              style={{
                padding: '12px',
                borderRadius: '10px',
                background: '#14532d55',
                color: '#bbf7d0',
                border: '1px solid #22c55e',
                fontSize: '14px',
                lineHeight: '1.5',
              }}
            >
              {resetMessage}
            </div>
          )}

          {/* Login button */}
          <button
            type="submit"
            className="rr-login-submit"
            disabled={loading}
          >
            {loading ? 'Logging In...' : 'Login'}
          </button>

        </form>

        <p className="rr-login-footer">
          Don't have an account?{' '}

          <button
            type="button"
            onClick={onRegister}
          >
            Create Free Account
          </button>
        </p>

      </section>
    </main>
  )
}
