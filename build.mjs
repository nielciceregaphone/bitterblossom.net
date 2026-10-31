// static site generator: src/ (markdown + templates) + public/ (static files) -> dist/
// output is plain semantic html: no css, no js, no presentational markup (the browser does the styling)
import fs from 'node:fs'
import path from 'node:path'
import {micromark} from 'micromark'
import {gfmAutolinkLiteral, gfmAutolinkLiteralHtml} from 'micromark-extension-gfm-autolink-literal'
import {gfmStrikethrough, gfmStrikethroughHtml} from 'micromark-extension-gfm-strikethrough'
import {gfmTable, gfmTableHtml} from 'micromark-extension-gfm-table'
import {gfmTaskListItem, gfmTaskListItemHtml} from 'micromark-extension-gfm-task-list-item'

const BASE_URL = 'https://bitterblossom.net'
const SITE_DESC = "madeline's blog"
const WORDS_PER_MINUTE = 200
const IMG_WIDTH = 340 // widest photo that still fits a 360px phone next to the default body margin
const SRC = 'src'
const DIST = 'dist'
const NICHE_TAGS = {games: 'cool games', shows: 'cool shows', movies: 'cool movies', music: 'cool songs'}

// --- helpers ---

const htmlesc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const xmlesc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// github flavoured markdown, raw html allowed
const md = (text) =>
  micromark(text, {
    allowDangerousHtml: true,
    allowDangerousProtocol: true,
    extensions: [gfmTable(), gfmStrikethrough(), gfmAutolinkLiteral(), gfmTaskListItem()],
    htmlExtensions: [gfmTableHtml(), gfmStrikethroughHtml(), gfmAutolinkLiteralHtml(), gfmTaskListItemHtml()]
  })

// YYYY-MM-DD -> "Sat, 08 Aug 2026 00:00:00 +0000", or '' if it isn't a real date
const rfc822 = (s) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return ''
  const d = new Date(`${s}T00:00:00Z`)
  if (isNaN(d) || d.toISOString().slice(0, 10) !== s) return ''
  return d.toUTCString().replace('GMT', '+0000')
}

// a markdown file with an optional leading `---` frontmatter block of `key: value` lines
// (first value wins; an unclosed block swallows the whole file)
const readMd = (file) => {
  const lines = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').split('\n')
  if (lines.at(-1) === '') lines.pop()
  const meta = {}
  let start = 0
  if (lines[0] === '---') {
    const close = lines.indexOf('---', 1)
    const end = close === -1 ? lines.length : close
    start = close === -1 ? lines.length : close + 1
    for (const line of lines.slice(1, end)) {
      const i = line.indexOf(':')
      const key = line.slice(0, i).trim()
      if (i > 0 && !(key in meta)) meta[key] = line.slice(i + 1).trim()
    }
  }
  const body = lines.slice(start).map((l) => l + '\n').join('')
  return {slug: path.basename(file, '.md'), meta, body}
}

// every *.md in a dir, sorted by filename; [] if the dir is missing
const readDir = (dir) =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => f.endsWith('.md') && !f.startsWith('.')).sort().map((f) => readMd(path.join(dir, f)))
    : []

const write = (file, text) => {
  fs.mkdirSync(path.dirname(file), {recursive: true})
  fs.writeFileSync(file, text)
}

// --- text helpers ---

const stripTags = (html) => html.replace(/<[^>]*>/g, '')
const decode = (s) => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
const wordCount = (html) => (decode(stripTags(html)).match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []).length
const readingTime = (words) => `${Math.max(1, Math.round(words / WORDS_PER_MINUTE))} min read`
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
const num = (n) => n.toLocaleString('en-US')

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
const monthName = (m) => MONTHS[Number(m) - 1]

// rating out of 5 -> text stars, rounded to the nearest half
const stars = (rating) => {
  const halves = Math.min(10, Math.max(0, Math.round((parseFloat(rating) || 0) * 2)))
  const full = Math.floor(halves / 2)
  const half = halves % 2
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(5 - full - half)
}

// --- headings ---
// post headings get slug ids and a "#" permalink. the page title is already an h1 (site name) and
// h2 (post title), so headings written in markdown are pushed one level down to keep the outline honest

// one level down, h6 stays h6
const shiftHeadings = (html) => html.replace(/<(\/?)h([1-6])>/g, (_, slash, n) => `<${slash}h${Math.min(6, Number(n) + 1)}>`)

const slugify = (text) =>
  decode(text).toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'section'

// -> {html, headings: [{level, id, text}]}; text is already html-safe
const anchorHeadings = (html) => {
  const headings = []
  const seen = new Set()
  html = html.replace(/<h([1-6])>([\s\S]*?)<\/h\1>/g, (_, n, inner) => {
    const level = Math.min(6, Number(n) + 1)
    const text = stripTags(inner).trim()
    if (!text) return '' // a stray empty `#` in the markdown: an empty heading is noise for screen readers
    const base = slugify(text)
    let id = base
    for (let i = 2; seen.has(id); i++) id = `${base}-${i}`
    seen.add(id)
    headings.push({level, id, text})
    return `<h${level} id="${id}">${inner} <a href="#${id}" aria-label="link to this section" title="link to this section">#</a></h${level}>`
  })
  return {html, headings}
}

// nested <ol> from a flat heading list, a sub-list opens inside the still-open parent <li>
const tocList = (headings) => {
  let out = ''
  const open = [] // heading level of each open <ol>
  for (const {level, id, text} of headings) {
    if (!open.length || level > open.at(-1)) {
      out += '<ol>\n'
      open.push(level)
    } else {
      while (open.length > 1 && level < open.at(-1)) {
        out += '</li>\n</ol>\n'
        open.pop()
      }
      out += '</li>\n'
    }
    out += `<li><a href="#${id}">${text}</a>`
  }
  return out + '</li>\n</ol>\n'.repeat(open.length)
}

// the two things that can push a post wider than a phone, with no css to clip them:
// photos are remote and can be huge, so cap them (plain `width` is the only way) and link the full size;
// code lines can be long, so `wrap` (the old pre attribute, still honoured everywhere) lets <pre> wrap
const fitToScreen = (html) =>
  html
    .replace(/<img ([^>]*?) ?\/?>/g, (whole, attrs) => {
      const src = attrs.match(/src="([^"]*)"/)?.[1]
      if (!src || /\swidth=/.test(attrs)) return whole
      return `<a href="${src}"><img width="${IMG_WIDTH}" loading="lazy" decoding="async" ${attrs}></a>`
    })
    .replaceAll('<pre>', '<pre wrap>')

// --- navigation ---
// one list drives the menu, the shortcuts dialog and the accesskeys so they can't disagree

const KEYS = [
  {key: 'a', label: 'about', href: '/'},
  {key: 'b', label: 'blog', href: '/blog/'},
  {key: 'n', label: 'niche', href: '/niche/'},
  {key: 'r', label: 'rss', href: '/feed.xml', abbr: 'really simple syndication'},
  {key: 's', label: 'search', info: 'jumps to the search box on the blog page'},
  {key: 'k', label: 'keyboard shortcuts', info: 'opens this window'},
  {key: 'p', label: 'previous post', info: 'only on a blog post'},
  {key: 'x', label: 'next post', info: 'only on a blog post'}
]

// one line of links. `current` is the page being built: its own link (or its section's) goes bold
const navItems = (current) =>
  KEYS.filter((k) => k.href)
    .map(({key, label, href, abbr}) => {
      const text = abbr ? `<abbr title="${abbr}">${label}</abbr>` : label
      const here = href === current
      const within = !here && href !== '/' && current.startsWith(href)
      const mark = here ? ' aria-current="page"' : within ? ' aria-current="true"' : ''
      return `<a href="${href}" accesskey="${key}"${mark}>${here || within ? `<strong>${text}</strong>` : text}</a>`
    })
    .join(' &middot;\n')

const keyRows = () =>
  KEYS.map(({key, label, info}) => `<tr><th scope="row"><kbd>${key}</kbd></th><td>${info ? `${label}, ${info}` : `go to ${label}`}</td></tr>`).join('\n')

// --- templates ---

const vars = {'@UPDATED@': new Date().toISOString().slice(0, 10), '@TAGLINE@': htmlesc(SITE_DESC), '@KEYS@': keyRows()}
const template = (name) => fs.readFileSync(`${SRC}/templates/${name}.html`, 'utf8').replace(/\n?$/, '\n')
const header = template('header')
const footer = template('footer')
// replacement functions so a `$` in a title is never read as a special pattern
const fill = (t, extra) => Object.entries({...vars, ...extra}).reduce((s, [k, v]) => s.replaceAll(k, () => v), t)

// title, desc and head are html (title and desc already escaped); head is extra <link>s for the <head>
const page = (file, {title, desc, content, head = ''}) => {
  const url = '/' + file.replace(/index\.html$/, '')
  const extra = {'@TITLE@': title, '@DESCRIPTION@': desc, '@CANONICAL@': BASE_URL + url, '@HEAD@': head, '@NAV@': navItems(url)}
  write(`${DIST}/${file}`, fill(header, extra) + content + fill(footer, extra))
}

// <time> for a YYYY-MM-DD date: "aug 13", or the raw text if it isn't a plain date
const shortDate = (date) => {
  const m = date.match(/^\d{4}-(\d{2})-(\d{2})$/)
  return m ? `${monthName(m[1]).slice(0, 3)} ${Number(m[2])}` : date
}

// --- build ---

fs.rmSync(DIST, {recursive: true, force: true})
fs.mkdirSync(DIST, {recursive: true})
if (fs.existsSync('public')) fs.cpSync('public', DIST, {recursive: true})

// blog posts first: the header's search suggestions, the homepage and the index all need them
const posts = readDir(`${SRC}/blog/posts`).map(({slug, meta, body}) => {
  const html = md(body)
  const words = wordCount(html)
  return {slug, title: meta.title || slug, date: meta.date || '', blurb: meta.description || '', desc: meta.description || SITE_DESC, html, words, minutes: readingTime(words)}
})

// newest first, ties broken by title then slug (all descending)
const sortKey = (p) => `${p.date || '0000-00-00'}\t${p.title}\t${p.slug}`
posts.sort((a, b) => (sortKey(a) < sortKey(b) ? 1 : -1))

// no-js site search for the blog page: duckduckgo limited to this site, post titles as <datalist> suggestions
const search =
  '<search>\n<form action="https://duckduckgo.com/" method="get">\n' +
  '<label for="q">search posts</label>\n' +
  '<input id="q" type="search" name="q" list="titles" accesskey="s" placeholder="try a post title" required>\n' +
  '<input type="hidden" name="sites" value="bitterblossom.net">\n' +
  '<button type="submit">search</button>\n' +
  `<datalist id="titles">\n${posts.map((p) => `<option value="${htmlesc(p.title)}"></option>`).join('\n')}\n</datalist>\n` +
  '</form>\n</search>\n'

const postUrl = (p) => `/blog/${p.slug}/`
const dateTag = (date) => (date ? `<time datetime="${date}">${shortDate(date)}</time>` : '')

// one <li> per post: date, link, reading time, description. `peek` ties the link to its hover preview
const postItem = (p, peek) =>
  `<li><p>${dateTag(p.date)} <a href="${postUrl(p)}"${peek ? ` interestfor="peek-${p.slug}"` : ''}>${htmlesc(p.title)}</a> <small>(${p.minutes})</small>` +
  (p.blurb ? `<br>\n<small>${htmlesc(p.blurb)}</small>` : '') +
  '</p></li>\n'

// a numbered <ol reversed> so the newest post carries the biggest number
const postList = (list, peek = false) =>
  `<ol reversed start="${posts.length - posts.indexOf(list[0])}">\n${list.map((p) => postItem(p, peek)).join('')}</ol>\n`

// free-standing pages: src/pages/<slug>.md -> /<slug>/, except about which is the homepage
for (const {slug, meta, body} of readDir(`${SRC}/pages`)) {
  const home = slug === 'about'
  let content = shiftHeadings(md(body))
  if (home && posts.length) {
    const totalWords = posts.reduce((sum, p) => sum + p.words, 0)
    content +=
      '<section>\n<h3>latest posts</h3>\n' +
      postList(posts.slice(0, 3)) +
      `<p><a href="/blog/">all ${posts.length} posts</a></p>\n</section>\n` +
      '<section>\n<h3>around here</h3>\n<dl>\n' +
      `<dt>posts</dt>\n<dd>${posts.length}</dd>\n` +
      `<dt>words written</dt>\n<dd>${num(totalWords)}</dd>\n` +
      `<dt>reading time</dt>\n<dd>${readingTime(totalWords).replace(' read', '')} start to finish</dd>\n` +
      '</dl>\n</section>\n'
  }
  page(home ? 'index.html' : `${slug}/index.html`, {title: htmlesc(meta.title || slug), desc: htmlesc(meta.description || SITE_DESC), content})
}

// one niche entry: an exclusive (one open at a time) <details>, title plus a rating <meter> in the summary
const nicheEntry = ({meta, body}, open) => {
  const title = htmlesc(meta.title || 'untitled')
  const rating = Math.min(5, Math.max(0, parseFloat(meta.rating) || 0))
  // a leading image paragraph is the cover art: lift it into a <figure>
  const text = md(body).replace(/^<p>(<img [^>]*?) ?\/?><\/p>\n/, (_, img) => {
    const art = img.replace(/ alt="[^"]*"/, ' alt=""').replace('<img ', '<img width="128" ')
    return `<figure>\n${art}>\n<figcaption>cover art</figcaption>\n</figure>\n`
  })
  // the text inside <meter> is what browsers without meter support show
  const meter = meta.rating
    ? ` <meter min="0" max="5" low="2" high="4" optimum="5" value="${rating}" title="${rating} out of 5">${stars(meta.rating)} ${rating} / 5</meter>`
    : ''
  return (
    `<details name="niche"${open ? ' open' : ''}>\n<summary>${title}${meter}</summary>\n` +
    text +
    (meta.rating ? `<p>rating: ${stars(meta.rating)} <small>(${htmlesc(meta.rating)} / 5)</small></p>\n` : '') +
    '</details>\n'
  )
}

// niche page: a section per tag, the first entry open
const niche = readDir(`${SRC}/niche`)
if (niche.length) {
  let content = '<h2>niche</h2>\n'
  let first = true
  for (const [tag, label] of Object.entries(NICHE_TAGS)) {
    const entries = niche.filter(({meta}) => (meta.tag || '').toLowerCase().replace(/[^a-z]/g, '') === tag)
    if (!entries.length) continue
    content += `<section>\n<h3>${label}</h3>\n`
    for (const entry of entries) {
      content += nicheEntry(entry, first)
      first = false
    }
    content += '</section>\n'
  }
  page('niche/index.html', {title: 'niche', desc: htmlesc(SITE_DESC), content})
}

// one page per post. posts[] is newest first, so the next index is the older post (rel="prev")
posts.forEach((p, i) => {
  const older = posts[i + 1]
  const newer = posts[i - 1]
  const {html, headings} = anchorHeadings(p.html)
  const toc =
    headings.length >= 2
      ? `<nav aria-label="contents">\n<details open>\n<summary>contents</summary>\n${tocList(headings)}</details>\n</nav>\n`
      : ''
  const sibling = (post, rel, key, label) =>
    post ? `<li>${label}: <a href="${postUrl(post)}" rel="${rel}" accesskey="${key}">${htmlesc(post.title)}</a> <kbd>${key}</kbd></li>\n` : ''
  const when = p.date ? `<time datetime="${p.date}">${p.date}</time> &middot; ` : ''
  const content =
    `<article>\n<hgroup>\n<h2>${htmlesc(p.title)}</h2>\n<p>${when}${p.minutes}</p>\n</hgroup>\n` +
    toc +
    fitToScreen(html) +
    '</article>\n' +
    '<nav aria-label="more posts">\n<ul>\n' +
    sibling(older, 'prev', 'p', 'previous') +
    sibling(newer, 'next', 'x', 'next') +
    '<li><a href="/blog/">all posts</a></li>\n</ul>\n</nav>\n'
  const head = (older ? `  <link rel="prev" href="${postUrl(older)}">\n` : '') + (newer ? `  <link rel="next" href="${postUrl(newer)}">\n` : '')
  page(`blog/${p.slug}/index.html`, {title: htmlesc(p.title), desc: htmlesc(p.desc), content, head})
})

// /blog/ index: a section per month, and a hover preview per post (chrome's interestfor, inert elsewhere)
const months = Map.groupBy(posts, (p) => p.date.match(/^\d{4}-\d{2}/)?.[0] || '')
let index = '<h2>blog</h2>\n' + search
for (const [month, list] of months) {
  const label = month ? `${monthName(month.slice(5))} ${month.slice(0, 4)}` : 'undated'
  index += `<section>\n<h3>${month ? `<time datetime="${month}">${label}</time>` : label}</h3>\n${postList(list, true)}</section>\n`
}
for (const p of posts) {
  index += `<div id="peek-${p.slug}" popover="hint">\n<p><strong>${htmlesc(p.title)}</strong></p>\n`
  index += `<p>${htmlesc(p.blurb || 'no description, just read it')}</p>\n<p><small>${p.minutes} &middot; ${num(p.words)} words</small></p>\n</div>\n`
}
page('blog/index.html', {title: 'blog', desc: htmlesc(SITE_DESC), content: index})

// RSS 2.0 feed
let feed =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">\n' +
  '<channel>\n' +
  `<title>${xmlesc(SITE_DESC)}</title>\n` +
  `<link>${BASE_URL}/</link>\n` +
  `<description>${xmlesc(SITE_DESC)}</description>\n` +
  '<language>en</language>\n' +
  `<lastBuildDate>${rfc822(posts[0]?.date || '') || rfc822('1970-01-01')}</lastBuildDate>\n` +
  `<atom:link href="${BASE_URL}/feed.xml" rel="self" type="application/rss+xml"/>\n`
for (const {slug, title, date, desc, html} of posts) {
  const link = `${BASE_URL}/blog/${slug}/`
  const pubDate = rfc822(date)
  // split any ]]> so the CDATA can't end early
  const cdata = html.replace(/\n+$/, '').replace(/]]>/g, ']]]]><![CDATA[>')
  feed +=
    '<item>\n' +
    `<title>${xmlesc(title)}</title>\n` +
    `<link>${link}</link>\n` +
    `<guid isPermaLink="true">${link}</guid>\n` +
    (pubDate ? `<pubDate>${pubDate}</pubDate>\n` : '') +
    `<description>${xmlesc(desc)}</description>\n` +
    `<content:encoded><![CDATA[${cdata}]]></content:encoded>\n` +
    '</item>\n'
}
write(`${DIST}/feed.xml`, feed + '</channel>\n</rss>\n')
