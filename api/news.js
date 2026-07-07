import { XMLParser } from 'fast-xml-parser'

const FEED_URL = 'https://feeds.bbci.co.uk/sport/football/rss.xml'

export default async function handler(req, res) {
  try {
    const response = await fetch(FEED_URL)
    const xml = await response.text()
    const parser = new XMLParser()
    const data = parser.parse(xml)
    const rawItems = data.rss.channel.item || []

    const items = rawItems.slice(0, 20).map((item) => ({
      title: item.title,
      link: item.link,
      description: typeof item.description === 'string' ? item.description : '',
      pubDate: item.pubDate,
    }))

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    res.status(200).json({ items })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch news feed' })
  }
}
