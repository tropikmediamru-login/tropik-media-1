// Vercel serverless function — reads published Wix Blog posts and serves them to the
// static site (blog.html + post.html). The Wix admin API key stays server-side here;
// the browser only ever talks to /api/posts.
//
//   GET /api/posts                -> { posts: [ { title, slug, excerpt, date, minutesToRead, coverImage } ] }
//   GET /api/posts?slug=<slug>    -> { post:  { title, slug, excerpt, date, minutesToRead, coverImage, html } }
//
// Wix Headless setup (see backend/backend-spec.md):
//   WIX_API_KEY  — API key with the "Read Blog" permission (manage.wix.com/account/api-keys)
//   WIX_SITE_ID  — a895c48f-6677-4005-994f-aa58f23d2206 (the "Tropik Media" project)
// Set both in the Vercel project's Environment Variables, then redeploy.
//
// Docs:
//   https://dev.wix.com/docs/api-reference/business-solutions/blog/posts-stats/list-posts
//   https://dev.wix.com/docs/api-reference/business-solutions/blog/posts-stats/get-post-by-slug

const WIX_BASE = 'https://www.wixapis.com/blog/v3';

// ---- helpers ----------------------------------------------------------------

const esc = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Resolve a Wix media reference (wix:image://, bare media id, or full URL) to an https URL.
function wixImageUrl(ref) {
  if (!ref) return null;
  let u = typeof ref === 'string' ? ref : ref.url || (ref.src && (ref.src.url || ref.src.id)) || ref.id;
  if (!u || typeof u !== 'string') return null;
  if (u.startsWith('http')) return u;
  if (u.startsWith('wix:image://')) {
    const m = u.match(/wix:image:\/\/v1\/([^/#?]+)/);
    if (m) return `https://static.wixstatic.com/media/${m[1]}`;
  }
  // bare media id like "abc123~mv2.jpg"
  if (/^[\w.~-]+$/.test(u)) return `https://static.wixstatic.com/media/${u}`;
  return null;
}

// Cover image for a post object (list or single).
function coverImage(post) {
  const m = post && post.media;
  if (!m) return null;
  const img = (m.wixMedia && m.wixMedia.image) || m.image || null;
  return wixImageUrl(img);
}

// ---- Ricos (rich content) -> HTML -------------------------------------------

function wrapDecorations(text, decorations = []) {
  let html = esc(text);
  for (const d of decorations) {
    switch (d.type) {
      case 'BOLD': html = `<strong>${html}</strong>`; break;
      case 'ITALIC': html = `<em>${html}</em>`; break;
      case 'UNDERLINE': html = `<u>${html}</u>`; break;
      case 'LINK': {
        const link = (d.linkData && d.linkData.link) || {};
        const href = esc(link.url || '#');
        const tgt = link.target === 'BLANK' || link.target === '_blank' ? ' target="_blank" rel="noopener"' : '';
        html = `<a href="${href}"${tgt}>${html}</a>`;
        break;
      }
      default: break; // COLOR / FONT_SIZE / etc. — ignore, keep text
    }
  }
  return html;
}

function renderInline(nodes = []) {
  return nodes
    .map((n) => {
      if (n.type === 'TEXT') return wrapDecorations((n.textData && n.textData.text) || '', (n.textData && n.textData.decorations) || []);
      // nested formatting containers
      return renderInline(n.nodes || []);
    })
    .join('');
}

function renderNodes(nodes = []) {
  let out = '';
  for (const node of nodes) {
    switch (node.type) {
      case 'PARAGRAPH': {
        const inner = renderInline(node.nodes || []);
        out += inner.trim() ? `<p>${inner}</p>` : '<p>&nbsp;</p>';
        break;
      }
      case 'HEADING': {
        const lvl = Math.min(Math.max((node.headingData && node.headingData.level) || 2, 2), 4);
        out += `<h${lvl}>${renderInline(node.nodes || [])}</h${lvl}>`;
        break;
      }
      case 'BLOCKQUOTE':
        out += `<blockquote>${renderNodes(node.nodes || [])}</blockquote>`;
        break;
      case 'BULLETED_LIST':
        out += `<ul>${renderNodes(node.nodes || [])}</ul>`;
        break;
      case 'ORDERED_LIST':
        out += `<ol>${renderNodes(node.nodes || [])}</ol>`;
        break;
      case 'LIST_ITEM':
        out += `<li>${renderNodes(node.nodes || [])}</li>`;
        break;
      case 'CODE_BLOCK':
        out += `<pre><code>${renderInline(node.nodes || [])}</code></pre>`;
        break;
      case 'DIVIDER':
        out += '<hr>';
        break;
      case 'IMAGE': {
        const img = node.imageData && node.imageData.image;
        const url = wixImageUrl(img && (img.src || img));
        const alt = esc((node.imageData && node.imageData.altText) || '');
        if (url) out += `<figure><img src="${esc(url)}" alt="${alt}" loading="lazy"></figure>`;
        break;
      }
      default:
        // unknown block — recurse into children so we don't drop content
        if (node.nodes && node.nodes.length) out += renderNodes(node.nodes);
        break;
    }
  }
  return out;
}

function richContentToHtml(richContent) {
  if (!richContent || !Array.isArray(richContent.nodes)) return '';
  return renderNodes(richContent.nodes);
}

// ---- Wix fetch --------------------------------------------------------------

async function wixGet(path) {
  const { WIX_API_KEY, WIX_SITE_ID } = process.env;
  const res = await fetch(`${WIX_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: WIX_API_KEY,
      'wix-site-id': WIX_SITE_ID,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`Wix Blog API ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return res.json();
}

function shapeListPost(p) {
  return {
    title: p.title || '',
    slug: (p.slug || (p.slugs && p.slugs[0]) || '').toString(),
    excerpt: p.excerpt || '',
    date: p.firstPublishedDate || p.lastPublishedDate || null,
    minutesToRead: p.minutesToRead || null,
    coverImage: coverImage(p),
  };
}

// ---- handler ----------------------------------------------------------------

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const { WIX_API_KEY, WIX_SITE_ID } = process.env;
  // Not configured yet — return an empty/clear result so the page shows its empty state
  // instead of erroring (matches api/lead.js's graceful behaviour).
  if (!WIX_API_KEY || !WIX_SITE_ID) {
    const slug = req.query && req.query.slug;
    if (slug) return res.status(404).json({ error: 'Blog is not connected yet.' });
    return res.status(200).json({ posts: [], notConfigured: true });
  }

  // light edge cache so the blog stays fast and we don't hammer Wix
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  try {
    const slug = req.query && req.query.slug;

    if (slug) {
      const data = await wixGet(`/posts/slugs/${encodeURIComponent(slug)}?fieldsets=URL&fieldsets=RICH_CONTENT`);
      const p = data.post;
      if (!p) return res.status(404).json({ error: 'Post not found.' });
      return res.status(200).json({
        post: {
          ...shapeListPost(p),
          html: richContentToHtml(p.richContent),
        },
      });
    }

    const data = await wixGet('/posts?paging.limit=50&fieldsets=URL');
    const posts = (data.posts || []).map(shapeListPost);
    return res.status(200).json({ posts });
  } catch (err) {
    console.error('Wix Blog read failed:', err.status, err.body || err.message);
    return res.status(502).json({ error: 'Could not load posts right now. Please try again shortly.' });
  }
};
