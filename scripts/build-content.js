#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BLOG_CONTENT_DIR = path.join(ROOT, 'content', 'blog');
const NOTES_CONTENT_DIR = path.join(ROOT, 'content', 'personal-notes');
const GENERATED_DIR = path.join(ROOT, 'generated');
const GENERATED_BLOG_DOCS_DIR = path.join(GENERATED_DIR, 'blog-docs');
const BLOG_OUTPUT_DIR = path.join(ROOT, 'blog');
const BLOG_CSS_SOURCE = path.join(ROOT, 'blog-assets', 'stylesheets', 'blog.css');
const BLOG_CSS_OUTPUT = path.join(GENERATED_BLOG_DOCS_DIR, 'stylesheets', 'blog.css');
const SITE_URL = 'https://sagnikdas.com';
const DEFAULT_OG_IMAGE = 'https://avatars.githubusercontent.com/u/73765575?v=4';
const BUILD_DATE = new Date().toISOString().slice(0, 10);
const BLOG_NAME = 'Simply ML';
const BLOG_TAGLINE = 'Machine Learning Made Clear';
const BLOG_DESCRIPTION = 'Exploring machine learning, LLM, and computer vision—practical insights from research and real-world AI systems. Curated by Sagnik Das.';

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function resetDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  ensureDir(dir);
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function writeText(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function parseFrontmatter(raw) {
  const trimmed = raw.replace(/^\uFEFF/, '');
  if (!trimmed.startsWith('---\n')) {
    return { data: {}, body: trimmed.trim() };
  }

  const endIndex = trimmed.indexOf('\n---\n', 4);
  if (endIndex === -1) {
    return { data: {}, body: trimmed.trim() };
  }

  const frontmatterBlock = trimmed.slice(4, endIndex).trim();
  const body = trimmed.slice(endIndex + 5).trim();
  const data = {};
  let currentArrayKey = null;

  for (const line of frontmatterBlock.split('\n')) {
    if (!line.trim()) continue;

    if (/^\s*-\s+/.test(line) && currentArrayKey) {
      data[currentArrayKey].push(parseScalar(line.replace(/^\s*-\s+/, '')));
      continue;
    }

    currentArrayKey = null;
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;

    const [, rawKey, rawValue] = match;
    const key = rawKey.trim();
    const value = rawValue.trim();

    if (value === '') {
      data[key] = [];
      currentArrayKey = key;
      continue;
    }

    data[key] = parseScalar(value);
  }

  return { data, body };
}

function parseScalar(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const inner = trimmed.slice(1, -1).trim();
    if (!inner) return [];
    return splitCsv(inner).map(part => parseScalar(part));
  }

  return trimmed;
}

function splitCsv(value) {
  const parts = [];
  let current = '';
  let quote = null;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if ((char === '"' || char === "'") && (!quote || quote === char)) {
      quote = quote ? null : char;
      current += char;
      continue;
    }
    if (char === ',' && !quote) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }

  if (current.trim()) parts.push(current.trim());
  return parts;
}

function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let paragraph = [];
  let listItems = [];
  let orderedListItems = [];
  let quoteLines = [];
  let codeFence = null;

  function flushParagraph() {
    if (!paragraph.length) return;
    html.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
    paragraph = [];
  }

  function flushList() {
    if (!listItems.length) return;
    html.push(`<ul>${listItems.map(item => `<li>${inlineMarkdown(item)}</li>`).join('')}</ul>`);
    listItems = [];
  }

  function flushOrderedList() {
    if (!orderedListItems.length) return;
    html.push(`<ol>${orderedListItems.map(item => `<li>${inlineMarkdown(item)}</li>`).join('')}</ol>`);
    orderedListItems = [];
  }

  function flushQuote() {
    if (!quoteLines.length) return;
    const quoteHtml = markdownToHtml(quoteLines.join('\n'));
    html.push(`<blockquote>${quoteHtml}</blockquote>`);
    quoteLines = [];
  }

  function flushCodeFence() {
    if (!codeFence) return;
    const languageClass = codeFence.lang ? ` class="language-${escapeHtml(codeFence.lang)}"` : '';
    html.push(`<pre><code${languageClass}>${escapeHtml(codeFence.lines.join('\n'))}</code></pre>`);
    codeFence = null;
  }

  for (const line of lines) {
    if (codeFence) {
      if (line.startsWith('```')) {
        flushCodeFence();
      } else {
        codeFence.lines.push(line);
      }
      continue;
    }

    if (line.startsWith('```')) {
      flushParagraph();
      flushList();
      flushOrderedList();
      flushQuote();
      codeFence = { lang: line.slice(3).trim(), lines: [] };
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      flushOrderedList();
      flushQuote();
      continue;
    }

    if (/^>\s?/.test(line)) {
      flushParagraph();
      flushList();
      flushOrderedList();
      quoteLines.push(line.replace(/^>\s?/, ''));
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      flushList();
      flushOrderedList();
      flushQuote();
      const level = heading[1].length;
      html.push(`<h${level}>${inlineMarkdown(heading[2].trim())}</h${level}>`);
      continue;
    }

    const unordered = line.match(/^[-*]\s+(.*)$/);
    if (unordered) {
      flushParagraph();
      flushOrderedList();
      flushQuote();
      listItems.push(unordered[1].trim());
      continue;
    }

    const ordered = line.match(/^\d+\.\s+(.*)$/);
    if (ordered) {
      flushParagraph();
      flushList();
      flushQuote();
      orderedListItems.push(ordered[1].trim());
      continue;
    }

    flushList();
    flushOrderedList();
    flushQuote();
    paragraph.push(line.trim());
  }

  flushParagraph();
  flushList();
  flushOrderedList();
  flushQuote();
  flushCodeFence();

  return html.join('\n');
}

function inlineMarkdown(text) {
  let html = escapeHtml(text);
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, url) => {
    const safeUrl = escapeAttribute(url);
    const external = /^https?:\/\//.test(url);
    const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `<a href="${safeUrl}"${attrs}>${label}</a>`;
  });
  return html;
}

function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function estimateReadingTime(text) {
  const words = stripHtml(markdownToHtml(text)).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 180));
}

function formatDate(date) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function yamlString(value) {
  return `"${String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function buildStandaloneSchema({ type, url, title, description, date, category, tags }) {
  if (type === 'blog-home') {
    return JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Blog',
      '@id': `${SITE_URL}/blog/#blog`,
      url,
      name: BLOG_NAME,
      description,
      publisher: {
        '@type': 'Person',
        '@id': `${SITE_URL}/#person`,
        name: 'Sagnik Das',
        url: `${SITE_URL}/`,
        image: DEFAULT_OG_IMAGE,
      },
      inLanguage: 'en',
    });
  }

  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${url}#post`,
    mainEntityOfPage: url,
    headline: title,
    description,
    url,
    datePublished: date,
    dateModified: date,
    articleSection: category || 'Writing',
    keywords: (tags || []).join(', '),
    author: {
      '@type': 'Person',
      '@id': `${SITE_URL}/#person`,
      name: 'Sagnik Das',
      url: `${SITE_URL}/`,
    },
    publisher: {
      '@type': 'Person',
      '@id': `${SITE_URL}/#person`,
      name: 'Sagnik Das',
      url: `${SITE_URL}/`,
      image: DEFAULT_OG_IMAGE,
    },
    image: DEFAULT_OG_IMAGE,
    inLanguage: 'en',
  });
}

function buildContentEntry(filePath, kind) {
  const raw = readText(filePath);
  const { data, body } = parseFrontmatter(raw);
  const sourceSlug = slugify(path.basename(filePath, path.extname(filePath)));
  const title = data.title || path.basename(filePath, path.extname(filePath));
  const slug = sourceSlug;
  const html = markdownToHtml(body);
  const text = stripHtml(html);
  const summary = data.summary || data.description || text.slice(0, 180).trim();
  const tags = Array.isArray(data.tags) ? data.tags : [];

  return {
    title,
    slug,
    date: data.date || '2026-06-27',
    tags,
    category: data.category || '',
    summary,
    description: data.description || summary,
    location: data.location || '',
    visibility: data.visibility || 'public',
    draft: Boolean(data.draft),
    canonical: data.canonical || `${SITE_URL}/${kind === 'blog' ? `blog/${slug}/` : `personal#note-${slug}`}`,
    html,
    markdown: body,
    readingTime: estimateReadingTime(body),
    wordCount: text.split(/\s+/).filter(Boolean).length,
    url: kind === 'blog' ? `/blog/${slug}/` : `/personal#note-${slug}`,
    anchorId: kind === 'blog' ? '' : `note-${slug}`,
  };
}

function collectEntries(dir, kind) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(file => file.endsWith('.md'))
    .map(file => buildContentEntry(path.join(dir, file), kind))
    .filter(entry => entry.visibility !== 'private')
    .filter(entry => !(kind === 'blog' && entry.draft))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

function renderBlogIndexMarkdown(posts) {
  const cards = posts.length
    ? posts.map(post => `
<article class="blog-card">
  <div class="blog-card-meta">
    <span class="blog-card-category">${escapeHtml(post.category || 'Writing')}</span>
    <span>${escapeHtml(formatDate(post.date))}</span>
    <span>${post.readingTime} min read</span>
  </div>
  <h2><a href="${post.slug}/">${escapeHtml(post.title)}</a></h2>
  <p>${escapeHtml(post.description)}</p>
  <div class="blog-tag-row">
    ${post.tags.map(tag => `<span class="blog-tag">${escapeHtml(tag)}</span>`).join('')}
  </div>
  <a class="blog-card-link" href="${post.slug}/">Read post</a>
</article>`)
      .join('\n')
    : '<p>No blog posts have been published yet.</p>';

  return `---
title: ${yamlString(BLOG_TAGLINE)}
description: ${yamlString(BLOG_DESCRIPTION)}
---
# ${BLOG_NAME}

## ${BLOG_TAGLINE}

${BLOG_DESCRIPTION}

<div class="blog-actions">
  <a class="blog-action-button" href="/">Back to portfolio</a>
  <a class="blog-action-button blog-action-button--secondary" href="/personal">Visit personal archive</a>
</div>

<div class="blog-card-grid">
${cards}
</div>
`;
}

function renderBlogPostMarkdown(post) {
  const tagRow = post.tags.length
    ? `<div class="blog-tag-row">${post.tags.map(tag => `<span class="blog-tag">${escapeHtml(tag)}</span>`).join('')}</div>`
    : '';

  return `---
title: ${yamlString(post.title)}
description: ${yamlString(post.description)}
category: ${yamlString(post.category || 'Writing')}
date: ${yamlString(post.date)}
tags:
${post.tags.map(tag => `  - ${yamlString(tag)}`).join('\n')}
---
<a class="blog-back-link" href="../">← Back to blog</a>

<div class="blog-post-meta">
  <span class="blog-post-category">${escapeHtml(post.category || 'Writing')}</span>
  <span>${escapeHtml(formatDate(post.date))}</span>
  <span>${post.readingTime} min read</span>
</div>

# ${post.title}

${tagRow}

${post.markdown}
`;
}

function renderSiteChrome({ title, description, canonical, ogType, content, activeNav, schema, articleMeta }) {
  const navLinks = [
    { label: 'Home', href: '/' },
    { label: 'Blog', href: '/blog/' },
    { label: 'Personal', href: '/personal' },
    { label: 'Meet', href: '/meet' },
  ];

  const navHtml = navLinks.map(link => {
    const active = activeNav === link.label ? ' blog-nav-link active' : ' blog-nav-link';
    return `<a href="${link.href}" class="${active}">${link.label}</a>`;
  }).join('');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" href="/public/favicon.png" type="image/png" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeAttribute(description)}" />
    <meta name="author" content="Sagnik Das" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${escapeAttribute(canonical)}" />
    <meta property="og:title" content="${escapeAttribute(title)}" />
    <meta property="og:description" content="${escapeAttribute(description)}" />
    <meta property="og:type" content="${escapeAttribute(ogType)}" />
    <meta property="og:url" content="${escapeAttribute(canonical)}" />
    <meta property="og:image" content="${escapeAttribute(DEFAULT_OG_IMAGE)}" />
    <meta property="og:site_name" content="${escapeAttribute(BLOG_NAME)}" />
    ${articleMeta?.publishedTime ? `<meta property="article:published_time" content="${escapeAttribute(articleMeta.publishedTime)}" />` : ''}
    ${articleMeta?.modifiedTime ? `<meta property="article:modified_time" content="${escapeAttribute(articleMeta.modifiedTime)}" />` : ''}
    ${articleMeta?.tags?.map(tag => `<meta property="article:tag" content="${escapeAttribute(tag)}" />`).join('\n    ') || ''}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeAttribute(title)}" />
    <meta name="twitter:description" content="${escapeAttribute(description)}" />
    <meta name="twitter:image" content="${escapeAttribute(DEFAULT_OG_IMAGE)}" />
    <script type="application/ld+json">${schema}</script>
    <link rel="stylesheet" href="/blog/stylesheets/blog.css" />
  </head>
  <body class="blog-standalone-body">
    <nav class="blog-nav">
      <div class="blog-nav-inner">
        <a href="/" class="blog-nav-brand">${escapeHtml(BLOG_NAME)}</a>
        <div class="blog-nav-links">${navHtml}</div>
      </div>
    </nav>
    <main class="blog-page">
      <div class="blog-page-inner">
        ${content}
      </div>
    </main>
    <footer class="blog-footer">
      <div class="blog-footer-inner">
        <span>© 2025 – ${new Date().getFullYear()} Sagnik Das</span>
        <span>
          <a href="/">Home</a> ·
          <a href="/blog/">Blog</a> ·
          <a href="/personal">Personal Corner</a> ·
          <a href="/meet">Book a Meeting</a>
        </span>
      </div>
    </footer>
  </body>
</html>`;
}

function renderStandaloneBlogIndex(posts) {
  const cards = posts.length
    ? posts.map(post => `
        <article class="blog-card">
          <div class="blog-card-meta">
            <span class="blog-card-category">${escapeHtml(post.category || 'Writing')}</span>
            <span>${escapeHtml(formatDate(post.date))}</span>
            <span>${post.readingTime} min read</span>
          </div>
          <h2><a href="/blog/${post.slug}/">${escapeHtml(post.title)}</a></h2>
          <p>${escapeHtml(post.description)}</p>
          <div class="blog-tag-row">
            ${post.tags.map(tag => `<span class="blog-tag">${escapeHtml(tag)}</span>`).join('')}
          </div>
          <a class="blog-card-link" href="/blog/${post.slug}/">Read post</a>
        </article>
      `).join('')
    : '<p>No blog posts have been published yet.</p>';

  const content = `
    <section class="blog-hero">
      <p class="blog-kicker">${BLOG_NAME}</p>
      <h1>${BLOG_TAGLINE}</h1>
      <p class="blog-hero-copy">${BLOG_DESCRIPTION}</p>
      <div class="blog-actions">
        <a class="blog-action-button" href="/">Back to portfolio</a>
        <a class="blog-action-button blog-action-button--secondary" href="/personal">Visit personal archive</a>
      </div>
    </section>
    <section class="blog-card-grid">
      ${cards}
    </section>
  `;

  return renderSiteChrome({
    title: `${BLOG_NAME} | ${BLOG_TAGLINE}`,
    description: BLOG_DESCRIPTION,
    canonical: `${SITE_URL}/blog/`,
    ogType: 'website',
    activeNav: 'Blog',
    content,
    schema: buildStandaloneSchema({
      type: 'blog-home',
      url: `${SITE_URL}/blog/`,
      description: BLOG_DESCRIPTION,
    }),
  });
}

function renderStandaloneBlogPost(post) {
  const tagHtml = post.tags.length
    ? `<div class="blog-tag-row">${post.tags.map(tag => `<span class="blog-tag">${escapeHtml(tag)}</span>`).join('')}</div>`
    : '';

  const content = `
    <article class="blog-post-shell">
      <a class="blog-back-link" href="/blog/">← Back to blog</a>
      <div class="blog-post-meta">
        <span class="blog-post-category">${escapeHtml(post.category || 'Writing')}</span>
        <span>${escapeHtml(formatDate(post.date))}</span>
        <span>${post.readingTime} min read</span>
      </div>
      <h1>${escapeHtml(post.title)}</h1>
      <p class="blog-post-description">${escapeHtml(post.description)}</p>
      ${tagHtml}
      <div class="blog-post-content">${post.html}</div>
    </article>
  `;

  return renderSiteChrome({
    title: `${post.title} | Sagnik Das`,
    description: post.description,
    canonical: `${SITE_URL}/blog/${post.slug}/`,
    ogType: 'article',
    activeNav: 'Blog',
    content,
    schema: buildStandaloneSchema({
      type: 'blog-post',
      url: `${SITE_URL}/blog/${post.slug}/`,
      title: post.title,
      description: post.description,
      date: post.date,
      category: post.category,
      tags: post.tags,
    }),
    articleMeta: {
      publishedTime: post.date,
      modifiedTime: post.date,
      tags: post.tags,
    },
  });
}

function buildSitemap(posts) {
  const pages = [
    { loc: `${SITE_URL}/`, lastmod: BUILD_DATE, priority: '1.00' },
    { loc: `${SITE_URL}/personal`, lastmod: BUILD_DATE, priority: '0.90' },
    { loc: `${SITE_URL}/blog/`, lastmod: BUILD_DATE, priority: '0.90' },
    { loc: `${SITE_URL}/meet`, lastmod: BUILD_DATE, priority: '0.80' },
    ...posts.map(post => ({
      loc: `${SITE_URL}/blog/${post.slug}/`,
      lastmod: post.date,
      priority: '0.75',
    })),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(page => `  <url>
    <loc>${page.loc}</loc>
    <lastmod>${page.lastmod}</lastmod>
    <priority>${page.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;
}

function main() {
  ensureDir(GENERATED_DIR);
  resetDir(GENERATED_BLOG_DOCS_DIR);
  resetDir(BLOG_OUTPUT_DIR);

  const posts = collectEntries(BLOG_CONTENT_DIR, 'blog');
  const notes = collectEntries(NOTES_CONTENT_DIR, 'personal-notes');

  writeText(path.join(GENERATED_DIR, 'blog-posts.json'), JSON.stringify(posts, null, 2));
  writeText(path.join(GENERATED_DIR, 'personal-notes.json'), JSON.stringify(notes, null, 2));
  writeText(path.join(GENERATED_BLOG_DOCS_DIR, 'index.md'), renderBlogIndexMarkdown(posts));
  writeText(path.join(BLOG_OUTPUT_DIR, 'index.html'), renderStandaloneBlogIndex(posts));

  posts.forEach(post => {
    writeText(path.join(GENERATED_BLOG_DOCS_DIR, `${post.slug}.md`), renderBlogPostMarkdown(post));
    writeText(path.join(BLOG_OUTPUT_DIR, post.slug, 'index.html'), renderStandaloneBlogPost(post));
  });

  if (!fs.existsSync(BLOG_CSS_SOURCE)) {
    throw new Error(`Missing blog stylesheet at ${BLOG_CSS_SOURCE}`);
  }
  ensureDir(path.dirname(BLOG_CSS_OUTPUT));
  fs.copyFileSync(BLOG_CSS_SOURCE, BLOG_CSS_OUTPUT);
  ensureDir(path.join(BLOG_OUTPUT_DIR, 'stylesheets'));
  fs.copyFileSync(BLOG_CSS_SOURCE, path.join(BLOG_OUTPUT_DIR, 'stylesheets', 'blog.css'));

  writeText(path.join(ROOT, 'sitemap.xml'), buildSitemap(posts));
  console.log(`Prepared ${posts.length} blog posts and ${notes.length} personal notes.`);
}

main();
