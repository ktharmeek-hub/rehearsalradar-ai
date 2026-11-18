
import './LandingPage.css'

type LandingPageProps = {
  onGetStarted: () => void
  onRegister: () => void
  onLogin: () => void
}

const features = [
  {
    icon: '🎤',
    title: 'AI Singing Analysis',
    description:
      'Understand your vocal pitch, range and stability with clear visual feedback.',
  },
  {
    icon: '🎵',
    title: 'Reference Comparison',
    description:
      'Compare your singing with a reference recording and identify pitch differences.',
  },
  {
    icon: '🎧',
    title: 'AI Karaoke Maker',
    description:
      'Separate vocals and instrumentals to create your own karaoke tracks.',
  },
  {
    icon: '🎹',
    title: 'Practice Coach',
    description:
      'Practise musical notes and receive pitch-based feedback.',
  },
  {
    icon: '🎙️',
    title: 'Karaoke Practice',
    description:
      'Sing along with backing tracks, record your voice and review your practice.',
  },
  {
    icon: '📊',
    title: 'Analysis History',
    description:
      'Revisit saved singing analyses and review your previous results.',
  },
]

export default function LandingPage({
  onGetStarted,
  onRegister,
  onLogin,
}: LandingPageProps) {
  return (
    <div className="rr-landing">
      <header className="rr-navbar">
        <a className="rr-logo" href="#home">
          Rehearsal<span>Radar</span> AI
        </a>

        <nav className="rr-nav">
          <a href="#features">Features</a>
          <a href="#how-it-works">How It Works</a>

          <button
            className="rr-button rr-secondary"
            onClick={onLogin}
          >
            Login
           </button>

          <button
          className="rr-button rr-secondary"
          onClick={onRegister}
          >
          Register
          </button>
          </nav>
          </header>

      <main id="home">
        <section className="rr-hero">
          <span className="rr-eyebrow">
            YOUR PERSONAL SINGING COACH
          </span>

          <h1>
            Find Your Voice.
            <br />
            <span>Sing With Confidence.</span>
          </h1>

          <p>
            Analyze your singing, create karaoke tracks
            and practise your favourite songs with
            intelligent audio tools — all in one place.
          </p>

          <button
            className="rr-button rr-primary"
            onClick={onGetStarted}
          >
            Get Started — Free
          </button>

          <p className="rr-small">
            Free to use. No payment required.
          </p>

          <div className="rr-wave" aria-hidden="true">
            {[24, 45, 70, 110, 65, 95, 140, 85, 115,
              55, 90, 130, 75, 45, 65, 30].map(
              (height, index) => (
                <span
                  key={index}
                  style={{ height: `${height}px` }}
                />
              )
            )}
          </div>
        </section>

        <section id="features" className="rr-section">
          <span className="rr-eyebrow">
            EXPLORE THE PLATFORM
          </span>
          <h2>Everything you need to practise</h2>

          <div className="rr-feature-grid">
            {features.map((feature) => (
              <article
                className="rr-feature-card"
                key={feature.title}
              >
                <div className="rr-feature-icon">
                  {feature.icon}
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          id="how-it-works"
          className="rr-section"
        >
          <span className="rr-eyebrow">SIMPLE PROCESS</span>
          <h2>How It Works</h2>

          <div className="rr-steps">
            <article>
              <span>01</span>
              <h3>Record or Upload</h3>
              <p>Choose a singing recording or use your microphone.</p>
            </article>

            <article>
              <span>02</span>
              <h3>Analyze</h3>
              <p>Explore your pitch, vocal range and singing feedback.</p>
            </article>

            <article>
              <span>03</span>
              <h3>Practice & Improve</h3>
              <p>Use practice tools and review your results over time.</p>
            </article>
          </div>
        </section>

        <section className="rr-cta">
          <h2>Ready to start singing?</h2>
          <p>Take the next step in your musical journey.</p>
          <button
            className="rr-button rr-primary"
            onClick={onGetStarted}
          >
            Start Practising
          </button>
        </section>
      </main>

      <footer className="rr-footer">
        <p>RehearsalRadar AI</p>
        <p>Sing. Analyze. Practice. Improve.</p>
      </footer>
    </div>
  )
}
