
import type { User } from '@supabase/supabase-js'
import './DashboardPage.css'

type Section = 'studio' | 'karaoke-maker' | 'history'

type DashboardPageProps = {
  user: User
  onHome: () => void
  onProfile: () => void
  onLogout: () => void
  onOpenSection: (section: Section) => void
}

const tools: {
  icon: string
  title: string
  description: string
  action: string
  section: Section
}[] = [
  {
    icon: '🎤',
    title: 'Singing Analysis',
    description:
      'Upload your voice, explore your pitch and compare recordings.',
    action: 'Open Singing Studio',
    section: 'studio',
  },
  {
    icon: '🎧',
    title: 'AI Karaoke Maker',
    description:
      'Separate vocals and instrumentals for karaoke practice.',
    action: 'Open Karaoke Studio',
    section: 'karaoke-maker',
  },
  {
    icon: '📊',
    title: 'Analysis History',
    description:
      'Review saved local analyses. Private history is coming later.',
    action: 'View Local History',
    section: 'history',
  },
]

export default function DashboardPage({
  user,
  onHome,
  onProfile,
  onLogout,
  onOpenSection,
}: DashboardPageProps) {
  const username = user.user_metadata?.username

  const displayName =
    typeof username === 'string' && username.trim()
      ? username.trim()
      : 'Singer'

  const joinedDate = user.created_at
    ? new Date(user.created_at).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'Not available'

  const emailStatus = user.email_confirmed_at
    ? 'Verified'
    : 'Not verified'

  return (
    <main className="rr-dashboard">
      <header className="rr-dashboard-header">
        <div className="rr-dashboard-brand">
          RehearsalRadar <span>AI</span>
        </div>

        <div className="rr-dashboard-nav">
  <button type="button" onClick={onHome}>
    Home
  </button>

  <button type="button" onClick={onProfile}>
    My Profile
  </button>

  <button
    type="button"
    className="rr-dashboard-logout"
    onClick={onLogout}
  >
    Logout
  </button>
</div>
      </header>

      <div className="rr-dashboard-container">
        <section className="rr-dashboard-hero">
          <span className="rr-dashboard-eyebrow">
            YOUR PERSONAL SINGING SPACE
          </span>

          <h1>Welcome, {displayName}! 👋</h1>

          <p>
            Ready for your next singing session?
            Choose a tool below and keep practising.
          </p>

          <button
            type="button"
            className="rr-dashboard-primary"
            onClick={() => onOpenSection('studio')}
          >
            Start Singing Analysis →
          </button>
        </section>

        <section className="rr-dashboard-account">
          <div className="rr-dashboard-section-heading">
            <h2>My Account</h2>
            <p>Your registration information</p>
          </div>

          <div className="rr-dashboard-account-grid">
            <div className="rr-dashboard-info">
              <span>Username</span>
              <strong>{displayName}</strong>
            </div>

            <div className="rr-dashboard-info">
              <span>Email Address</span>
              <strong>{user.email ?? 'Not available'}</strong>
            </div>

            <div className="rr-dashboard-info">
              <span>Member Since</span>
              <strong>{joinedDate}</strong>
            </div>

            <div className="rr-dashboard-info">
              <span>Email Status</span>
              <strong>{emailStatus}</strong>
            </div>
          </div>
        </section>

        <section className="rr-dashboard-tools">
          <div className="rr-dashboard-section-heading">
            <h2>Explore Your Singing Tools</h2>
            <p>Select a feature to start practising</p>
          </div>

          <div className="rr-dashboard-tool-grid">
            {tools.map((tool) => (
              <article
                key={tool.section}
                className="rr-dashboard-tool-card"
              >
                <div className="rr-dashboard-icon">
                  {tool.icon}
                </div>

                <h3>{tool.title}</h3>
                <p>{tool.description}</p>

                <button
                  type="button"
                  onClick={() => onOpenSection(tool.section)}
                >
                  {tool.action} →
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="rr-dashboard-note">
          <h2>Your singing journey starts here</h2>
          <p>
            Personalized practice statistics and private
            analysis history will become available after
            secure per-user data storage is implemented.
          </p>
        </section>
      </div>

      <footer className="rr-dashboard-footer">
        RehearsalRadar AI — Sing. Analyze. Practice. Improve.
      </footer>
    </main>
  )
}
