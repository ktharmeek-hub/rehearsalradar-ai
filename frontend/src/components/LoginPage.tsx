
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

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

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
          <label htmlFor="login-email">Email Address</label>
          <input
            id="login-email"
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />

          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />

          {error && (
            <div className="rr-login-error" role="alert">
              {error}
            </div>
          )}

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
