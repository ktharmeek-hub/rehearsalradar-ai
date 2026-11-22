
import { useState } from 'react'
import type { FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../services/supabaseClient'
import './ProfilePage.css'

type ProfilePageProps = {
  user: User
  onBack: () => void
  onUpdated: (user: User) => void
}

export default function ProfilePage({
  user,
  onBack,
  onUpdated,
}: ProfilePageProps) {
  const metadata = user.user_metadata

  const [username, setUsername] = useState(
    typeof metadata?.username === 'string'
      ? metadata.username
      : ''
  )

  const [displayName, setDisplayName] = useState(
    typeof metadata?.display_name === 'string'
      ? metadata.display_name
      : ''
  )

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [savingProfile, setSavingProfile] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)

  const [profileError, setProfileError] = useState('')
  const [profileSuccess, setProfileSuccess] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')

  const accountName =
    (typeof metadata?.display_name === 'string'
      && metadata.display_name.trim()) ||
    (typeof metadata?.username === 'string'
      && metadata.username.trim()) ||
    'Singer'

  const initials = accountName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')

  const joinedDate = new Date(user.created_at)
    .toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setProfileError('')
    setProfileSuccess('')

    const cleanUsername = username.trim()
    const cleanDisplayName = displayName.trim()

    if (!/^[A-Za-z0-9_]{3,20}$/.test(cleanUsername)) {
      setProfileError(
        'Username must contain 3–20 letters, numbers or underscores.'
      )
      return
    }

    if (
      cleanDisplayName.length < 2 ||
      cleanDisplayName.length > 40
    ) {
      setProfileError(
        'Display name must contain 2–40 characters.'
      )
      return
    }

    setSavingProfile(true)

    try {
      const { data, error } = await supabase.auth.updateUser({
        data: {
          username: cleanUsername,
          display_name: cleanDisplayName,
        },
      })

      if (error) {
        setProfileError(error.message)
        return
      }

      if (!data.user) {
        setProfileError('Profile could not be updated.')
        return
      }

      onUpdated(data.user)
      setUsername(cleanUsername)
      setDisplayName(cleanDisplayName)
      setProfileSuccess('Profile updated successfully!')
    } catch {
      setProfileError(
        'Unable to save profile. Check your connection.'
      )
    } finally {
      setSavingProfile(false)
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')

    if (!currentPassword) {
      setPasswordError('Enter your current password.')
      return
    }

    if (newPassword.length < 8) {
      setPasswordError(
        'New password must contain at least 8 characters.'
      )
      return
    }

    if (
      !/[A-Za-z]/.test(newPassword) ||
      !/[0-9]/.test(newPassword)
    ) {
      setPasswordError(
        'Password must contain at least one letter and one number.'
      )
      return
    }

    if (currentPassword === newPassword) {
      setPasswordError(
        'New password must be different from current password.'
      )
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.')
      return
    }

    setChangingPassword(true)

    try {
      const { error } = await supabase.auth.updateUser({
        current_password: currentPassword,
        password: newPassword,
      })

      if (error) {
        setPasswordError(error.message)
        return
      }

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordSuccess('Password changed successfully!')
    } catch {
      setPasswordError(
        'Unable to change password. Please try again.'
      )
    } finally {
      setChangingPassword(false)
    }
  }

  return (
    <main className="rr-profile">
      <div className="rr-profile-container">
        <header className="rr-profile-header">
          <button type="button" onClick={onBack}>
            ← Back to Dashboard
          </button>
          <span>RehearsalRadar AI</span>
        </header>

        <section className="rr-profile-intro">
          <div className="rr-profile-avatar">
            {initials}
          </div>
          <h1>My Profile</h1>
          <p>Manage your personal information and account security.</p>
        </section>

        <section className="rr-profile-card">
          <h2>Account Information</h2>

          <div className="rr-profile-info-grid">
            <div>
              <span>Email Address</span>
              <strong>{user.email ?? 'Not available'}</strong>
            </div>
            <div>
              <span>Email Status</span>
              <strong>
                {user.email_confirmed_at
                  ? 'Verified'
                  : 'Not verified'}
              </strong>
            </div>
            <div>
              <span>Member Since</span>
              <strong>{joinedDate}</strong>
            </div>
          </div>
        </section>

        <section className="rr-profile-card">
          <h2>Edit Profile</h2>

          <form onSubmit={saveProfile}>
            <label htmlFor="profile-username">Username</label>
            <input
              id="profile-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              minLength={3}
              maxLength={20}
              autoComplete="username"
              required
            />

            <label htmlFor="profile-displayname">
              Display Name
            </label>
            <input
              id="profile-displayname"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="How should we call you?"
              minLength={2}
              maxLength={40}
              required
            />

            {profileError && (
              <div className="rr-profile-error" role="alert">
                {profileError}
              </div>
            )}

            {profileSuccess && (
              <div className="rr-profile-success" role="status">
                {profileSuccess}
              </div>
            )}

            <button
              type="submit"
              disabled={savingProfile}
            >
              {savingProfile ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </section>

        <section className="rr-profile-card">
          <h2>Change Password</h2>

          <form onSubmit={changePassword}>
            <label htmlFor="current-password">
              Current Password
            </label>
            <input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) =>
                setCurrentPassword(e.target.value)}
              required
            />

            <label htmlFor="new-profile-password">
              New Password
            </label>
            <input
              id="new-profile-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) =>
                setNewPassword(e.target.value)}
              minLength={8}
              required
            />

            <label htmlFor="confirm-profile-password">
              Confirm New Password
            </label>
            <input
              id="confirm-profile-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) =>
                setConfirmPassword(e.target.value)}
              minLength={8}
              required
            />

            {passwordError && (
              <div className="rr-profile-error" role="alert">
                {passwordError}
              </div>
            )}

            {passwordSuccess && (
              <div className="rr-profile-success" role="status">
                {passwordSuccess}
              </div>
            )}

            <button
              type="submit"
              disabled={changingPassword}
            >
              {changingPassword
                ? 'Updating...'
                : 'Change Password'}
            </button>
          </form>
        </section>
      </div>
    </main>
  )
}
