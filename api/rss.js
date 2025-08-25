// api/rss.js - RSS Feed Generator for Beehiiv to Squarespace
export default async function handler(req, res) {
  // Environment variables - these will be set in Vercel
  const API_KEY = process.env.BEEHIIV_API_KEY;
  const PUBLICATION_ID = process.env.BEEHIIV_PUBLICATION_ID;
  
  // RSS feed configuration
  const FEED_TITLE = process.env.FEED_TITLE || 'Your Newsletter';
  const FEED_DESCRIPTION = process.env.FEED_DESCRIPTION || 'Latest posts from your newsletter';
  const FEED_URL = process.env.FEED_URL || 'https://your-site.com';
  const AUTHOR_EMAIL = process.env.AUTHOR_EMAIL || 'your-email@domain.com';

  // Check if required environment variables are set
  if (!API_KEY || !PUBLICATION_ID) {
    return res.status(500).json({ 
      error: 'Missing required environment variables',
      details: 'BEEHIIV_API_KEY and BEEHIIV_PUBLICATION_ID must be set in Vercel dashboard' 
    });
  }

  const BEEHIIV_API_URL = `https://api.beehiiv.com/v2/publications/${PUBLICATION_ID}/posts`;

  try {
    console.log('Fetching posts from Beehiiv API...');
    
    // Fetch posts from Beehiiv
    const beehiivResponse = await fetch(BEEHIIV_API_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
    });

    if (!beehiivResponse.ok) {
      const errorText = await beehiivResponse.text();
      console.error('Beehiiv API Error:', errorText);
      throw new Error(`Beehiiv API responded with status: ${beehiivResponse.status} - ${errorText}`);
    }

    const data = await beehiivResponse.json();
    console.log(`Successfully fetched ${data.data?.length || 0} posts`);

    // Generate RSS XML
    const rssXml = generateRSSFeed(data.data || [], {
      title: FEED_TITLE,
      description: FEED_DESCRIPTION,
      feedUrl: FEED_URL,
      authorEmail: AUTHOR_EMAIL
    });

    // Set proper headers for RSS feed
    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    
    return res.status(200).send(rssXml);

  } catch (error) {
    console.error('Error generating RSS feed:', error);
    
    return res.status(500).json({
      error: 'Failed to generate RSS feed',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// Function to generate RSS XML from Beehiiv posts
function generateRSSFeed(posts, config) {
  const { title, description, feedUrl, authorEmail } = config;
  const currentDate = new Date().toUTCString();
  
  // Helper to escape XML content
  const escapeXml = (str) => {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  // Helper to clean HTML content
  const cleanHtmlContent = (html) => {
    if (!html) return '';
    let cleaned = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    cleaned = cleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    return cleaned;
  };

  // Generate RSS items from posts
  const rssItems = posts
    .filter(post => post.status === 'confirmed') // Only published posts
    .slice(0, 20) // Limit to 20 most recent
    .map(post => {
      const pubDate = post.publish_date ? new Date(post.publish_date).toUTCString() : currentDate;
      const postUrl = post.web_url || `${feedUrl}/post/${post.id}`;
      const content = cleanHtmlContent(post.content?.free?.web || post.subtitle || '');
      const title = escapeXml(post.title || 'Untitled Post');
      
      return `
    <item>
      <title>${title}</title>
      <link>${postUrl}</link>
      <guid>${postUrl}</guid>
      <pubDate>${pubDate}</pubDate>
      <author>${authorEmail}</author>
      <description><![CDATA[${content}]]></description>
    </item>`;
    }).join('');

  // Complete RSS feed XML
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${feedUrl}</link>
    <description>${escapeXml(description)}</description>
    <language>en-us</language>
    <lastBuildDate>${currentDate}</lastBuildDate>
    <managingEditor>${authorEmail}</managingEditor>
    <webMaster>${authorEmail}</webMaster>
    <generator>Beehiiv to Squarespace RSS Generator</generator>
    <ttl>60</ttl>${rssItems}
  </channel>
</rss>`;
}
