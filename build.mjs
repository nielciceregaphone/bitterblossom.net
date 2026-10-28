// static site generator: a node port of the old render-blog.sh
// src/ (markdown + templates) + public/ (static files) -> dist/
import fs from 'node:fs'
import path from 'node:path'
import {micromark} from 'micromark'
import {gfmAutolinkLiteral, gfmAutolinkLiteralHtml} from 'micromark-extension-gfm-autolink-literal'
import {gfmStrikethrough, gfmStrikethroughHtml} from 'micromark-extension-gfm-strikethrough'
import {gfmTable, gfmTableHtml} from 'micromark-extension-gfm-table'
import {gfmTaskListItem, gfmTaskListItemHtml} from 'micromark-extension-gfm-task-list-item'

const baseurl = 'https://bitterblossom.net'
const feed_title = "madeline's blog"
const default_desc = "madeline's blog"

const src = 'src'
const dist = 'dist'
const hdr = fs.readFileSync(`${src}/templates/header.html`, 'utf8')
const ftr = fs.readFileSync(`${src}/templates/footer.html`, 'utf8')

// same as `cmark-gfm --unsafe -e table -e strikethrough -e autolink -e tasklist`
const md = (text) =>
  micromark(text, {
    allowDangerousHtml: true,
    allowDangerousProtocol: true,
    extensions: [gfmTable(), gfmStrikethrough(), gfmAutolinkLiteral(), gfmTaskListItem()],
    htmlExtensions: [gfmTableHtml(), gfmStrikethroughHtml(), gfmAutolinkLiteralHtml(), gfmTaskListItemHtml()]
  })

const htmlesc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const xmlesc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// YYYY-MM-DD -> "Sat, 08 Aug 2026 00:00:00 +0000"; '' if not a real date
const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const rfc822 = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return ''
  const [y, mo, d] = [+m[1], +m[2], +m[3]]
  const t = new Date(0)
  t.setUTCFullYear(y, mo - 1, d)
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return ''
  return `${days[t.getUTCDay()]}, ${String(d).padStart(2, '0')} ${months[mo - 1]} ${m[1]} 00:00:00 +0000`
}

// files are read as lines (CRLF tolerated, no trailing empty line)
const readLines = (file) => {
  const lines = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').split('\n')
  if (lines[lines.length - 1] === '') lines.pop()
  return lines
}
const trim = (s) => s.replace(/^[ \t]+|[ \t]+$/g, '')

// value of `key: value` in a leading --- block (first match wins, split on first ':')
const frontmatter = (lines, k) => {
  if (lines[0] !== '---') return ''
  for (const line of lines.slice(1)) {
    if (line === '---') break
    const i = line.indexOf(':')
    if (i > 0 && trim(line.slice(0, i)) === k) return trim(line.slice(i + 1))
  }
  return ''
}
// everything except the frontmatter block
const body = (lines) => {
  const out = []
  let fm = false
  lines.forEach((line, n) => {
    if (n === 0 && line === '---') fm = true
    else if (fm && line === '---') fm = false
    else if (!fm) out.push(line)
  })
  return out.map((l) => l + '\n').join('')
}

// literal @TITLE@/@DESCRIPTION@ substitution in a template
const tmpl = (t, title, desc) => {
  const s = t.split('@TITLE@').join(title).split('@DESCRIPTION@').join(desc)
  return s.endsWith('\n') ? s : s + '\n'
}
const write = (outfile, text) => {
  fs.mkdirSync(path.dirname(outfile), {recursive: true})
  fs.writeFileSync(outfile, text)
}
const emit = (title, desc, content, outfile) =>
  write(outfile, tmpl(hdr, title, desc) + content + tmpl(ftr, title, desc))

// *.md files in a dir, sorted by name; [] if the dir is missing
const mdFiles = (dir) =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => f.endsWith('.md') && !f.startsWith('.')).sort().map((f) => path.join(dir, f))
    : []
const slugOf = (f) => path.basename(f, '.md')

fs.rmSync(dist, {recursive: true, force: true})
fs.mkdirSync(dist, {recursive: true})
if (fs.existsSync('public')) fs.cpSync('public', dist, {recursive: true})

// free-standing pages: src/pages/<slug>.md -> /<slug>/index.html (about -> /)
for (const f of mdFiles(`${src}/pages`)) {
  const slug = slugOf(f)
  const lines = readLines(f)
  const title = frontmatter(lines, 'title') || slug
  const desc = frontmatter(lines, 'description') || default_desc
  const content = `<section class="box">\n${md(body(lines))}</section>\n`
  emit(htmlesc(title), htmlesc(desc), content, `${dist}/${slug === 'about' ? '' : slug + '/'}index.html`)
}

// niche page: one section per tag, a click-to-open <details> per entry
const niche = mdFiles(`${src}/niche`).map(readLines)
if (niche.length > 0) {
  let nc = '<h1>niche</h1>\n'
  for (const tag of ['games', 'shows', 'movies', 'music']) {
    const label = tag === 'music' ? 'cool songs' : `cool ${tag}`
    const entries = niche.filter((l) => frontmatter(l, 'tag').replace(/[A-Z]/g, (c) => c.toLowerCase()).replace(/[^a-z]/g, '') === tag)
    if (entries.length === 0) continue
    nc += `<section class="niche-card">\n<h2 class="niche-tag">${label}</h2>\n`
    for (const l of entries) {
      const title = frontmatter(l, 'title') || 'untitled'
      nc += `<details class="niche-item">\n<summary class="niche-label">${htmlesc(title)}</summary>\n`
      // cap cover art size with the plain html width attribute
      nc += md(body(l)).replaceAll('<img ', '<img width="128" ')
      const rating = frontmatter(l, 'rating')
      if (rating) nc += `<p class="rating">rating: <b>${htmlesc(rating)} / 5</b></p>\n`
      nc += '</details>\n'
    }
    nc += '</section>\n'
  }
  emit('niche', default_desc, nc, `${dist}/niche/index.html`)
}

// blog posts: src/blog/posts/<slug>.md -> /blog/<slug>/index.html
const items = [] // "date\ttitle\tslug" rows, like the old items file
for (const f of mdFiles(`${src}/blog/posts`)) {
  const slug = slugOf(f)
  const lines = readLines(f)
  const title = frontmatter(lines, 'title') || slug
  const date = frontmatter(lines, 'date')
  const desc = frontmatter(lines, 'description') || default_desc
  const etitle = htmlesc(title)
  const content =
    '<article class="box post">\n' +
    `<h1>${etitle}</h1>\n` +
    (date ? `<p class="post-date"><small><time datetime="${date}">${date}</time></small></p>\n` : '') +
    md(body(lines)) +
    '</article>\n' +
    '<hr>\n<p class="back"><a href="/blog/">&lt; all posts</a></p>\n'
  emit(etitle, htmlesc(desc), content, `${dist}/blog/${slug}/index.html`)
  items.push(`${date || '0000-00-00'}\t${title}\t${slug}`)
}
// newest first: plain byte-order descending, like `sort -r`
items.sort((a, b) => (a < b ? 1 : -1))
const rows = items.map((r) => r.split('\t'))

// /blog/ index
let bc = '<section class="box">\n<h1>blog</h1>\n<ul class="post-list">\n'
for (const [date, title, slug] of rows) {
  bc += `<li><time datetime="${date}">${date}</time> - <a href="/blog/${slug}/">${htmlesc(title)}</a></li>\n`
}
bc += '</ul>\n</section>\n'
emit('blog', default_desc, bc, `${dist}/blog/index.html`)

// RSS 2.0 feed
const buildDate = rfc822(rows.length ? rows[0][0] : '') || rfc822('1970-01-01')
let feed =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">\n' +
  '<channel>\n' +
  `<title>${xmlesc(feed_title)}</title>\n` +
  `<link>${baseurl}/</link>\n` +
  `<description>${xmlesc(default_desc)}</description>\n` +
  '<language>en</language>\n' +
  `<lastBuildDate>${buildDate}</lastBuildDate>\n` +
  `<atom:link href="${baseurl}/feed.xml" rel="self" type="application/rss+xml"/>\n`
for (const [date, title, slug] of rows) {
  const lines = readLines(`${src}/blog/posts/${slug}.md`)
  const desc = frontmatter(lines, 'description') || default_desc
  const link = `${baseurl}/blog/${slug}/`
  // trailing newlines dropped (old `$(...)`), and ]]> split so CDATA can't end early
  const html = md(body(lines)).replace(/\n+$/, '').replace(/]]>/g, ']]]]><![CDATA[>')
  const pd = rfc822(date)
  feed +=
    '<item>\n' +
    `<title>${xmlesc(title)}</title>\n` +
    `<link>${link}</link>\n` +
    `<guid isPermaLink="true">${link}</guid>\n` +
    (pd ? `<pubDate>${pd}</pubDate>\n` : '') +
    `<description>${xmlesc(desc)}</description>\n` +
    `<content:encoded><![CDATA[${html}]]></content:encoded>\n` +
    '</item>\n'
}
feed += '</channel>\n</rss>\n'
write(`${dist}/feed.xml`, feed)
