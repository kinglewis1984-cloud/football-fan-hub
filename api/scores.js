// Uses ESPN's public soccer API — no signup, no API key, no account needed.
const SCOREBOARD_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard'
const STANDINGS_URL = 'https://site.api.espn.com/apis/v2/sports/soccer/eng.1/standings'

function statValue(stats, name) {
  return stats.find((s) => s.name === name)?.value ?? 0
}

export default async function handler(req, res) {
  try {
    const [scoreboardRes, standingsRes] = await Promise.all([
      fetch(SCOREBOARD_URL),
      fetch(STANDINGS_URL),
    ])

    if (!scoreboardRes.ok || !standingsRes.ok) {
      throw new Error('Upstream ESPN request failed')
    }

    const scoreboardData = await scoreboardRes.json()
    const standingsData = await standingsRes.json()

    const matches = (scoreboardData.events || []).map((event) => {
      const comp = event.competitions[0]
      const home = comp.competitors.find((c) => c.homeAway === 'home')
      const away = comp.competitors.find((c) => c.homeAway === 'away')
      const state = comp.status.type.state
      const status = state === 'in' ? 'IN_PLAY' : state === 'post' ? 'FINISHED' : 'SCHEDULED'

      return {
        id: event.id,
        status,
        utcDate: event.date,
        homeTeam: home?.team.shortDisplayName || home?.team.displayName,
        awayTeam: away?.team.shortDisplayName || away?.team.displayName,
        homeScore: home ? Number(home.score) : null,
        awayScore: away ? Number(away.score) : null,
        minute: comp.status.displayClock,
      }
    })

    const entries = standingsData.children?.[0]?.standings?.entries || []
    const standings = entries
      .map((entry) => ({
        position: statValue(entry.stats, 'rank'),
        team: entry.team.shortDisplayName || entry.team.displayName,
        played: statValue(entry.stats, 'gamesPlayed'),
        won: statValue(entry.stats, 'wins'),
        draw: statValue(entry.stats, 'ties'),
        lost: statValue(entry.stats, 'losses'),
        points: statValue(entry.stats, 'points'),
        goalDifference: statValue(entry.stats, 'pointDifferential'),
      }))
      .sort((a, b) => a.position - b.position)

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120')
    res.status(200).json({ configured: true, matches, standings })
  } catch (err) {
    res.status(500).json({ configured: true, error: 'Failed to fetch scores/standings' })
  }
}
