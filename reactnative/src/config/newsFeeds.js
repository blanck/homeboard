// Publisher RSS feeds: free, keyless and minutes old (API free tiers lag 12-24h).
// Feeds without images (TechCrunch, Hacker News) get the article's og:image.
export const RSS_PRESETS = [
  {label: 'TechCrunch', url: 'https://techcrunch.com/feed/'},
  {label: 'The Verge', url: 'https://www.theverge.com/rss/index.xml'},
  {label: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index'},
  {label: 'Wired', url: 'https://www.wired.com/feed/rss'},
  {label: 'Engadget', url: 'https://www.engadget.com/rss.xml'},
  {label: 'Electrek', url: 'https://electrek.co/feed/'},
  {label: '9to5Mac', url: 'https://9to5mac.com/feed/'},
  {label: 'MIT Tech Review', url: 'https://www.technologyreview.com/feed/'},
  {label: 'Gizmodo', url: 'https://gizmodo.com/rss'},
  {label: "Tom's Hardware", url: 'https://www.tomshardware.com/feeds/all'},
  {label: 'Hacker News', url: 'https://hnrss.org/frontpage'},
  {label: 'Techmeme', url: 'https://techmeme.com/feed.xml'},
];

export const DEFAULT_RSS_FEEDS = RSS_PRESETS.slice(0, 6)
  .map((p) => p.url)
  .join(',');
