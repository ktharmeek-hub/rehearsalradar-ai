
import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../services/supabaseClient'
import './RegisterPage.css'

type Props = {
  onBack: () => void
  onLogin: () => void
}
export default function RegisterPage({
  onBack,
  onLogin,
}: Props) {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setSuccess('')

    const name = username.trim()
    const userEmail = email.trim().toLowerCase()

    if (!/^[A-Za-z0-9_]{3,20}$/.test(name)) {
      setError('Username must have 3–20 letters, numbers or underscores.')
      return
    }

    if (password.length < 8) {
      setError('Password must have at least 8 characters.')
      return
    }

    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Password must contain a letter and a number.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    try {
      const { error: signupError } = await supabase.auth.signUp({
        email: userEmail,
        password,
        options: {
          data: { username: name },
          emailRedirectTo: window.location.origin + '/',
        },
      })

      if (signupError) {
        setError(signupError.message)
        return
      }

      setSuccess(
        'Registration request submitted. If eligible, please check your email for a confirmation link.'
      )
      setPassword('')
      setConfirmPassword('')
    } catch {
      setError('Connection failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="rr-register-page">
      <div className="rr-register-card">
        <button
          type="button"
          className="rr-back"
          onClick={onBack}
        >
          ← Back to Home
        </button>

        <h1>Create Your Account</h1>
        <p>Join RehearsalRadar AI for free.</p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="reg-username">Username</label>
          <input
            id="reg-username"
            type="text"
            placeholder="Enter username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            minLength={3}
            maxLength={20}
          />

          <label htmlFor="reg-email">Email Address</label>
          <input
            id="reg-email"
            type="email"
            placeholder="Enter email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />

          <label htmlFor="reg-password">Password</label>
          <input
            id="reg-password"
            type="password"
            placeholder="Create password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />

          <label htmlFor="reg-confirm">Confirm Password</label>
          <input
            id="reg-confirm"
            type="password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
          />

          {error && <div className="rr-error" role="alert">{error}</div>}
          {success && <div className="rr-success" role="status">{success}</div>}

          <button type="submit" disabled={loading}>
            {loading ? 'Creating Account...' : 'Create Free Account'}
          </button>
        </form>

        <p className="rr-register-note">
  Already have an account?{' '}
  <button
    type="button"
    onClick={onLogin}
    style={{
      background: 'transparent',
      border: 'none',
      color: '#c4b5fd',
      cursor: 'pointer',
      fontWeight: 600,
    }}
  >
    Login
  </button>
</p>
      </div>
    </main>
  )
}
