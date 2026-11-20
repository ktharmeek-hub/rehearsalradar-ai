
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../services/supabaseClient'
import './LoginPage.css'

type ResetStatus = 'checking' | 'ready' | 'invalid' | 'done'

// Detect the recovery redirect before Supabase processes the URL.
const callbackParams = new URLSearchParams(
  window.location.hash.replace(/^#/, '')
)

const arrivedFromRecoveryEmail =
  callbackParams.get('type') === 'recovery' &&
  callbackParams.has('access_token')

export default function ResetPasswordPage() {
  const [status, setStatus] = useState<ResetStatus>('checking')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    const { data: { subscription } } =
      supabase.auth.onAuthStateChange((event, session) => {
        if (!active) return

        if (event === 'PASSWORD_RECOVERY' && session) {
          setStatus('ready')
        }
      })

    // Check whether Supabase established a recovery session.
    supabase.auth.getUser()
      .then(({ data, error: userError }) => {
        if (!active) return

        setStatus((previous) => {
          if (previous === 'ready') return previous

          if (
            arrivedFromRecoveryEmail &&
            !userError &&
            data.user
          ) {
            return 'ready'
          }

          return 'invalid'
        })
      })
      .catch(() => {
        if (active) {
          setStatus((previous) =>
            previous === 'ready' ? previous : 'invalid'
          )
        }
      })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  async function handleReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must contain at least 8 characters.')
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
      const { error: updateError } =
        await supabase.auth.updateUser({
          password,
        })

      if (updateError) {
        setError(updateError.message)
        return
      }

      setPassword('')
      setConfirmPassword('')
      setStatus('done')

      // End the recovery session on this device.
      const { error: signOutError } =
        await supabase.auth.signOut({ scope: 'local' })

      if (signOutError) {
        console.warn('Sign out after reset:', signOutError.message)
      }
    } catch {
      setError('Unable to reset password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="rr-login-page">
      <section className="rr-login-card">
        <h1>Reset Password</h1>

        {status === 'checking' && (
          <p role="status">Checking recovery link...</p>
        )}

        {status === 'invalid' && (
          <>
            <p role="alert">
              Recovery link is invalid or expired.
              Please request a new link from Login.
            </p>
            <a href="/login">Back to Login</a>
          </>
        )}

        {status === 'done' && (
          <>
            <p role="status" style={{ color: '#86efac' }}>
              Password updated successfully.
            </p>
            <a href="/login">Go to Login</a>
          </>
        )}

        {status === 'ready' && (
          <form onSubmit={handleReset}>
            <p className="rr-login-description">
              Enter your new password below.
            </p>

            <label htmlFor="new-password">
              New Password
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />

            <label htmlFor="confirm-new-password">
              Confirm New Password
            </label>
            <input
              id="confirm-new-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
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
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        )}
      </section>
    </main>
  )
}
