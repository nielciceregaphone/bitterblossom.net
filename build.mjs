// static site generator: src/ (markdown + templates) + public/ (static files) -> dist/
// output is plain html, no css and no js
import fs from 'node:fs'
import path from 'node:path'
import {micromark} from 'micromark'
import {gfmAutolinkLiteral, gfmAutolinkLiteralHtml} from 'micromark-extension-gfm-autolink-literal'
import {gfmStrikethrough, gfmStrikethroughHtml} from 'micromark-extension-gfm-strikethrough'
import {gfmTable, gfmTableHtml} from 'micromark-extension-gfm-table'
import {gfmTaskListItem, gfmTaskListItemHtml} from 'micromark-extension-gfm-task-list-item'

const BASE_URL = 'https://bitterblossom.net'
const SITE_DESC = "madeline's blog"
const MONO = 'Comic Mono, Consolas, Menlo, Monaco, Lucida Console, monospace'
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

// --- templates ---

const vars = {'@UPDATED@': new Date().toISOString().slice(0, 10), '@MONO@': MONO}
const template = (name) => fs.readFileSync(`${SRC}/templates/${name}.html`, 'utf8').replace(/\n?$/, '\n')
const header = template('header')
const footer = template('footer')
const fill = (t, title, desc) =>
  Object.entries({...vars, '@TITLE@': title, '@DESCRIPTION@': desc}).reduce((s, [k, v]) => s.replaceAll(k, v), t)

// code gets the monospace face via a <font> inside each <code>
const monoCode = (html) => html.replace(/<code([^>]*)>/g, `<code$1><font face="${MONO}">`).replace(/<\/code>/g, '</font></code>')

// title and desc are already html-escaped
const page = (file, title, desc, content) =>
  write(`${DIST}/${file}`, fill(header, title, desc) + monoCode(content) + fill(footer, title, desc))

const centeredH1 = (text) => `<center><h1>${text}</h1></center>\n`

// rating out of 5 -> text stars, rounded to the nearest half
const stars = (rating) => {
  const halves = Math.min(10, Math.max(0, Math.round((parseFloat(rating) || 0) * 2)))
  const full = Math.floor(halves / 2)
  const half = halves % 2
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(5 - full - half)
}

// --- build ---

fs.rmSync(DIST, {recursive: true, force: true})
fs.mkdirSync(DIST, {recursive: true})
if (fs.existsSync('public')) fs.cpSync('public', DIST, {recursive: true})

// free-standing pages: src/pages/<slug>.md -> /<slug>/, except about which is the homepage
for (const {slug, meta, body} of readDir(`${SRC}/pages`)) {
  const content = md(body).replace(/^<h1>(.*)<\/h1>\n/, centeredH1('$1'))
  page(slug === 'about' ? 'index.html' : `${slug}/index.html`, htmlesc(meta.title || slug), htmlesc(meta.description || SITE_DESC), content)
}

// niche page: a section per tag, a click-to-open <details> per entry
const niche = readDir(`${SRC}/niche`)
if (niche.length) {
  let content = centeredH1('niche')
  for (const [tag, label] of Object.entries(NICHE_TAGS)) {
    const entries = niche.filter(({meta}) => (meta.tag || '').toLowerCase().replace(/[^a-z]/g, '') === tag)
    if (!entries.length) continue
    content += `<h2>${label}</h2>\n`
    for (const {meta, body} of entries) {
      content += `<details>\n<summary>${htmlesc(meta.title || 'untitled')}</summary>\n`
      content += md(body).replaceAll('<img ', '<img width="128" ')
      if (meta.rating) {
        content += `<p>rating: <font color="#e0559a" size="4">${stars(meta.rating)}</font> <small>(${htmlesc(meta.rating)} / 5)</small></p>\n`
      }
      content += '</details>\n'
    }
  }
  page('niche/index.html', 'niche', SITE_DESC, content)
}

// blog posts: src/blog/posts/<slug>.md -> /blog/<slug>/
const posts = readDir(`${SRC}/blog/posts`).map(({slug, meta, body}) => ({
  slug,
  title: meta.title || slug,
  date: meta.date || '',
  desc: meta.description || SITE_DESC,
  html: md(body)
}))
for (const {slug, title, date, desc, html} of posts) {
  const content =
    '<article>\n' +
    `<center>\n<h1>${htmlesc(title)}</h1>\n` +
    (date ? `<p><small><time datetime="${date}">${date}</time></small></p>\n` : '') +
    '</center>\n' +
    html +
    '</article>\n' +
    '<hr>\n<p><a href="/blog/">&lt; all posts</a></p>\n'
  page(`blog/${slug}/index.html`, htmlesc(title), htmlesc(desc), content)
}

// newest first, ties broken by title then slug (all descending)
const sortKey = (p) => `${p.date || '0000-00-00'}\t${p.title}\t${p.slug}`
posts.sort((a, b) => (sortKey(a) < sortKey(b) ? 1 : -1))

// /blog/ index
let index = centeredH1('blog') + '<ul>\n'
for (const {slug, title, date} of posts) {
  const d = date || '0000-00-00'
  index += `<li><time datetime="${d}">${d}</time> - <a href="/blog/${slug}/">${htmlesc(title)}</a></li>\n`
}
page('blog/index.html', 'blog', SITE_DESC, index + '</ul>\n')

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
