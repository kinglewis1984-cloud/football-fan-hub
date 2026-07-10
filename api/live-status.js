// Checks whether the HnLkicinit YouTube channel is currently live, using
// the public /live shorthand URL — no API key needed, no quota limits.
const CHANNEL_ID = 'UC2cYvrlkdVz75R483UnxaKA'

export default async function handler(req, res) {
  try {
    const response = await fetch(`https://www.youtube.com/channel/${CHANNEL_ID}/live`, {
      headers: { 'User-Agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)' },
    })
    const html = await response.text()

    const isLive = html.includes('"isLiveNow":true')
    const match = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/)

    if (isLive && match) {
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30')
      res.status(200).json({ live: true, videoId: match[1] })
    } else {
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30')
      res.status(200).json({ live: false })
    }
  } catch (err) {
    res.status(200).json({ live: false })
  }
}
