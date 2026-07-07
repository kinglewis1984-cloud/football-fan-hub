import { useEffect, useState } from 'react'
import Community from './Community'
import './App.css'

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, '').trim()
}

function formatKickoff(utcDate) {
  return new Date(utcDate).toLocaleString(undefined, {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function MatchRow({ match }) {
  const isLive = match.status === 'IN_PLAY' || match.status === 'PAUSED'
  const isFinished = match.status === 'FINISHED'
  return (
    <div className={'match-row' + (isLive ? ' live' : '')}>
      <span className="match-team home">{match.homeTeam}</span>
      <span className="match-score">
        {isFinished || isLive ? `${match.homeScore ?? 0} - ${match.awayScore ?? 0}` : 'vs'}
      </span>
      <span className="match-team away">{match.awayTeam}</span>
      <span className="match-status">
        {isLive ? `${match.minute ?? ''}'` : isFinished ? 'FT' : formatKickoff(match.utcDate)}
      </span>
    </div>
  )
}

function StandingsTable({ standings }) {
  return (
    <table className="standings-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Team</th>
          <th>P</th>
          <th>W</th>
          <th>D</th>
          <th>L</th>
          <th>GD</th>
          <th>Pts</th>
        </tr>
      </thead>
      <tbody>
        {standings.map((row) => (
          <tr key={row.team}>
            <td>{row.position}</td>
            <td className="team-name">{row.team}</td>
            <td>{row.played}</td>
            <td>{row.won}</td>
            <td>{row.draw}</td>
            <td>{row.lost}</td>
            <td>{row.goalDifference}</td>
            <td className="pts">{row.points}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function App() {
  const [news, setNews] = useState({ loading: true, items: [], error: null })
  const [scores, setScores] = useState({ loading: true, matches: [], standings: [] })

  useEffect(() => {
    fetch('/api/news')
      .then((r) => r.json())
      .then((data) => setNews({ loading: false, items: data.items || [], error: data.error || null }))
      .catch(() => setNews({ loading: false, items: [], error: 'Could not load news' }))

    fetch('/api/scores')
      .then((r) => r.json())
      .then((data) =>
        setScores({ loading: false, matches: data.matches || [], standings: data.standings || [] })
      )
      .catch(() => setScores({ loading: false, matches: [], standings: [] }))
  }, [])

  return (
    <div className="app-root">
      <header className="site-header">
        <h1>FOOTBALL FAN HUB</h1>
        <p className="tagline">Scores, tables, and news — all in one place</p>
      </header>

      <main className="layout">
        <section className="panel matches-panel">
          <h2>Premier League Matches</h2>
          {scores.loading && <p className="hint-text">Loading matches…</p>}
          {!scores.loading && scores.matches.length === 0 && (
            <p className="hint-text">No matches found right now.</p>
          )}
          {scores.matches.map((m) => (
            <MatchRow key={m.id} match={m} />
          ))}
        </section>

        <section className="panel table-panel">
          <h2>Premier League Table</h2>
          {scores.loading && <p className="hint-text">Loading table…</p>}
          {!scores.loading && scores.standings.length > 0 && (
            <StandingsTable standings={scores.standings} />
          )}
        </section>

        <section className="panel news-panel">
          <h2>Latest News</h2>
          {news.loading && <p className="hint-text">Loading news…</p>}
          {news.error && <p className="hint-text">{news.error}</p>}
          {news.items.map((item) => (
            <a className="news-item" key={item.link} href={item.link} target="_blank" rel="noreferrer">
              <h3>{item.title}</h3>
              <p>{stripHtml(item.description)}</p>
            </a>
          ))}
        </section>

        {scores.standings.length > 0 && (
          <Community teams={scores.standings.map((row) => row.team)} />
        )}
      </main>
    </div>
  )
}
