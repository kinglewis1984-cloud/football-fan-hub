const BASE_URL = 'https://api.football-data.org/v4'
const COMPETITION = 'PL' // Premier League to start

export default async function handler(req, res) {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY

  if (!apiKey) {
    res.status(200).json({
      configured: false,
      message: 'No FOOTBALL_DATA_API_KEY set yet — showing placeholder data.',
      matches: [],
      standings: [],
    })
    return
  }

  try {
    const headers = { 'X-Auth-Token': apiKey }
    const [matchesRes, standingsRes] = await Promise.all([
      fetch(`${BASE_URL}/competitions/${COMPETITION}/matches?status=LIVE,SCHEDULED,FINISHED`, { headers }),
      fetch(`${BASE_URL}/competitions/${COMPETITION}/standings`, { headers }),
    ])

    if (!matchesRes.ok || !standingsRes.ok) {
      throw new Error('Upstream football-data.org request failed')
    }

    const matchesData = await matchesRes.json()
    const standingsData = await standingsRes.json()

    const matches = (matchesData.matches || []).slice(0, 15).map((m) => ({
      id: m.id,
      status: m.status,
      utcDate: m.utcDate,
      homeTeam: m.homeTeam.shortName || m.homeTeam.name,
      awayTeam: m.awayTeam.shortName || m.awayTeam.name,
      homeScore: m.score.fullTime.home,
      awayScore: m.score.fullTime.away,
      minute: m.minute,
    }))

    const table = standingsData.standings?.[0]?.table || []
    const standings = table.map((row) => ({
      position: row.position,
      team: row.team.shortName || row.team.name,
      played: row.playedGames,
      won: row.won,
      draw: row.draw,
      lost: row.lost,
      points: row.points,
      goalDifference: row.goalDifference,
    }))

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120')
    res.status(200).json({ configured: true, matches, standings })
  } catch (err) {
    res.status(500).json({ configured: true, error: 'Failed to fetch scores/standings' })
  }
}
