
import { useEffect, useState } from 'react'
import {
  listHistory,
  type HistorySummary,
} from '../services/historyApi'
import './SingingProgressTracker.css'

function dateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export default function SingingProgressTracker() {
  const [records, setRecords] = useState<HistorySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    let active = true

    listHistory()
      .then((items) => {
        if (!active) return
        setRecords(items)
        setError('')
      })
      .catch((err: unknown) => {
        if (!active) return
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load progress.'
        )
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [refresh])

  const totalSessions = records.length

  const totalSeconds = Math.round(
    records.reduce((sum, record) => {
      const duration = record.duration_seconds
      return sum + (
        Number.isFinite(duration) && duration > 0
          ? duration
          : 0
      )
    }, 0)
  )

  const practiceTime =
    `${Math.floor(totalSeconds / 60)}m ${totalSeconds % 60}s`

  const activeDays = new Set(
    records
      .map((record) => new Date(record.created_at))
      .filter((date) => !Number.isNaN(date.getTime()))
      .map(dateKey)
  ).size

  // Build a seven-day activity chart.
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const weeklyActivity = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (6 - index))

    const key = dateKey(date)

    const count = records.filter((record) => {
      const recordedAt = new Date(record.created_at)
      return !Number.isNaN(recordedAt.getTime()) &&
        dateKey(recordedAt) === key
    }).length

    return {
      key,
      label: date.toLocaleDateString('en-US', {
        weekday: 'short',
      }),
      count,
    }
  })

  const maxCount = Math.max(
    1,
    ...weeklyActivity.map((day) => day.count)
  )


  // Use up to 8 recent sessions with valid pitch data.
  const pitchSessions = records
    .filter(
      (record) =>
        typeof record.median_pitch_hz === 'number' &&
        Number.isFinite(record.median_pitch_hz) &&
        record.median_pitch_hz > 0
    )
    .slice(0, 8)
    .reverse()

  const pitchValues = pitchSessions.map(
    (record) => record.median_pitch_hz as number
  )

  const lowestPitch = pitchValues.length
    ? Math.min(...pitchValues)
    : 0

  const highestPitch = pitchValues.length
    ? Math.max(...pitchValues)
    : 0

  const pitchRange = Math.max(1, highestPitch - lowestPitch)

  const pitchPoints = pitchSessions.map((record, index) => {
    const hz = record.median_pitch_hz as number

    const x =
      pitchSessions.length === 1
        ? 300
        : 40 + (index * 520) / (pitchSessions.length - 1)

    const y =
      highestPitch === lowestPitch
        ? 105
        : 160 - ((hz - lowestPitch) / pitchRange) * 110

    return {
      id: record.id,
      x,
      y,
      hz,
      label: new Date(record.created_at).toLocaleDateString(
        'en-US',
        { month: 'short', day: 'numeric' }
      ),
    }
  })


  function refreshProgress() {
    setLoading(true)
    setRefresh((previous) => previous + 1)
  }

  return (
    <section className="rr-progress">
      <div className="rr-progress-heading">
        <div>
          <span className="rr-progress-eyebrow">
            YOUR SINGING JOURNEY
          </span>
          <h2>Your Singing Progress</h2>
          <p>
            Practice insights from your recent saved analyses.
          </p>
        </div>

        <button
          type="button"
          onClick={refreshProgress}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Refresh Progress'}
        </button>
      </div>

      {error && (
        <p className="rr-progress-error" role="alert">
          {error}
        </p>
      )}

      {loading && (
        <p role="status">Loading your practice statistics...</p>
      )}

      {!loading && !error && records.length === 0 && (
        <p className="rr-progress-empty">
          No practice history yet. Complete a singing analysis
          to start tracking your progress.
        </p>
      )}

      {!loading && records.length > 0 && (
        <>
          <div className="rr-progress-stats">
            <article className="rr-progress-stat">
              <span>🎤 Recent Sessions</span>
              <strong>{totalSessions}</strong>
              <small>Saved analyses</small>
            </article>

            <article className="rr-progress-stat">
              <span>⏱️ Practice Time</span>
              <strong>{practiceTime}</strong>
              <small>Total analyzed duration</small>
            </article>

            <article className="rr-progress-stat">
              <span>📅 Active Days</span>
              <strong>{activeDays}</strong>
              <small>Unique days with analyses</small>
            </article>
          </div>

          <div className="rr-progress-activity">
            <h3>Last 7 Days Activity</h3>
            <p>Number of saved analyses per day</p>

            <div className="rr-progress-chart">
              {weeklyActivity.map((day) => (
                <div className="rr-progress-day" key={day.key}>
                  <span className="rr-progress-count">
                    {day.count}
                  </span>

                  <div className="rr-progress-bar-track">
                    <div
                      className="rr-progress-bar"
                      style={{
                        height: day.count === 0
                          ? '3px'
                          : `${Math.max(
                              12,
                              (day.count / maxCount) * 100
                            )}%`,
                      }}
                      title={`${day.count} sessions on ${day.key}`}
                    />
                  </div>

                  <span className="rr-progress-day-label">
                    {day.label}
                  </span>
                </div>
              ))}
            </div>
          </div>


          <div className="rr-progress-activity">
            <h3>Median Pitch by Session</h3>
            <p>
              Track how your typical singing pitch changes
              across recent analyses.
            </p>

            {pitchPoints.length === 0 ? (
              <p>No valid pitch data available yet.</p>
            ) : (
              <div className="rr-progress-pitch-scroll">
                <svg
                  className="rr-progress-pitch-svg"
                  viewBox="0 0 600 220"
                  role="img"
                  aria-label="Median pitch trend across recent singing sessions"
                >
                  <line
                    x1="20"
                    y1="180"
                    x2="580"
                    y2="180"
                    stroke="#475569"
                  />

                  {pitchPoints.length > 1 && (
                    <polyline
                      points={pitchPoints
                        .map((point) => `${point.x},${point.y}`)
                        .join(' ')}
                      fill="none"
                      stroke="#a78bfa"
                      strokeWidth="3"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  )}

                  {pitchPoints.map((point) => (
                    <g key={point.id}>
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r="6"
                        fill="#c4b5fd"
                      >
                        <title>
                          {`${point.label}: ${point.hz.toFixed(1)} Hz`}
                        </title>
                      </circle>

                      <text
                        x={point.x}
                        y={point.y - 14}
                        textAnchor="middle"
                        fill="#ddd6fe"
                        fontSize="13"
                      >
                        {Math.round(point.hz)} Hz
                      </text>

                      <text
                        x={point.x}
                        y="204"
                        textAnchor="middle"
                        fill="#94a3b8"
                        fontSize="12"
                      >
                        {point.label}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            )}

            <p>
              Higher pitch does not necessarily mean
              better singing performance.
            </p>
          </div>


          <p className="rr-progress-footnote">
            Statistics are calculated from up to 50 recent
            saved analyses. Practice time represents analyzed
            recording duration, not total rehearsal time.
          </p>
        </>
      )}
    </section>
  )
}
