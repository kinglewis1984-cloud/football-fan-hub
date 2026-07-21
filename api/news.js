import { XMLParser } from 'fast-xml-parser'

const FEEDS = [
  { source: 'BBC Sport', url: 'https://feeds.bbci.co.uk/sport/football/rss.xml' },
  { source: 'Sky Sports', url: 'https://www.skysports.com/rss/11095' },
]

const parser = new XMLParser()

// Date.parse doesn't understand the "BST" abbreviation Sky Sports uses (only
// GMT/UTC are reliably recognised), so it silently returns Invalid Date and
// those items sink to the bottom of the sort.
function parsePubDate(str) {
  if (!str) return 0
  const fixed = str.replace(/\bBST\b/, '+0100').replace(/\bGMT\b/, '+0000')
  const time = new Date(fixed).getTime()
  return Number.isNaN(time) ? 0 : time
}

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
      .sort((a, b) => parsePubDate(b.pubDate) - parsePubDate(a.pubDate))
      .slice(0, 30)

    if (items.length === 0) {
      throw new Error('All news feeds failed')
    }

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    res.status(200).json({ items })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch news feed' })
  }
}
