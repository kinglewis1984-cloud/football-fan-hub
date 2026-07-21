import { XMLParser } from 'fast-xml-parser'

const FEEDS = [
  { source: 'BBC Sport', url: 'https://feeds.bbci.co.uk/sport/football/rss.xml' },
  { source: 'Sky Sports', url: 'https://www.skysports.com/rss/11095' },
]

const parser = new XMLParser()

async function fetchFeed({ source, url }) {
  const response = await fetch(url)
  const xml = await response.text()
  const data = parser.parse(xml)
  const rawItems = data.rss.channel.item || []

  return rawItems.map((item) => ({
    source,
    title: item.title,
    link: item.link,
    description: typeof item.description === 'string' ? item.description : '',
    pubDate: item.pubDate,
  }))
}

export default async function handler(req, res) {
  try {
    const results = await Promise.allSettled(FEEDS.map(fetchFeed))
    const items = results
      .filter((r) => r.status === 'fulfilled')
      .flatMap((r) => r.value)
      .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
      .slice(0, 30)

    if (items.length === 0) {
      throw new Error('All news feeds failed')
    }

    const failed = results
      .map((r, i) => ({ r, source: FEEDS[i].source }))
      .filter(({ r }) => r.status === 'rejected')
      .map(({ r, source }) => ({ source, error: String(r.reason) }))

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    res.status(200).json({ items, ...(failed.length ? { _debugFailed: failed } : {}) })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch news feed' })
  }
}
