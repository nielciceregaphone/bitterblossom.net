// bitterblossom.net worker. every page is a static file from dist/, served straight from the asset store;
// only the homepage and /art/* come through here (run_worker_first in wrangler.jsonc). visitors still get plain html.
//
// - fetch /: keep one random nichepost and fill in the last played song in the header. the cover art waits behind
//   a "view" link so the page stays small; it reloads the homepage as /?n=<pick>&art=1
// - fetch /art/<id>: the last played song's cover, kept in KV so the page never links to navidrome itself
// - scheduled (every minute): ask navidrome what's playing; when the song changes, save it and its cover
//
// config: vars NAVIDROME_URL and LISTENER in wrangler.jsonc; secrets NAVIDROME_USER, NAVIDROME_TOKEN and
// NAVIDROME_SALT (subsonic token auth: token = md5(password + salt)); KV namespace bound as TRACKS

const SONG_KEY = 'last-song'
const ART_KEY = 'last-song-art'
const ART_SIZE = 128 // fetched at 2x, shown at 64 so it stays sharp on phones
const ART_BOX = 64 // as big as the logo on the other side of the header
const ART_GAP = 8 // between the cover and the text, same as between the logo and the name

const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// --- navidrome ---

const SECRETS = ['NAVIDROME_USER', 'NAVIDROME_TOKEN', 'NAVIDROME_SALT']

const subsonic = (env, endpoint, params = {}) => {
  // a missing secret would otherwise go out as the text "undefined" and look like a wrong password
  const missing = SECRETS.filter((k) => !env[k])
  if (missing.length) throw new Error(`secret not set on the worker: ${missing.join(', ')}`)
  const q = new URLSearchParams({
    // trimmed: a value pasted into the dashboard can pick up a stray space or newline
    u: env.NAVIDROME_USER.trim(),
    t: env.NAVIDROME_TOKEN.trim(),
    s: env.NAVIDROME_SALT.trim(),
    v: '1.16.1',
    c: 'bitterblossom.net',
    ...params
  })
  return fetch(`${env.NAVIDROME_URL}/rest/${endpoint}?${q}`)
}

// what LISTENER is playing right now according to navidrome, or null
async function nowPlaying(env) {
  const res = await subsonic(env, 'getNowPlaying', {f: 'json'})
  if (!res.ok) throw new Error(`navidrome answered ${res.status}`)
  const body = (await res.json())['subsonic-response']
  if (body?.status !== 'ok') throw new Error(`navidrome said ${body?.error?.message || 'no'}`)
  // entries come newest first; one per player session
  const entry = (body.nowPlaying?.entry || []).find((e) => e.username === env.LISTENER && e.state === 'playing')
  if (!entry) return null
  return {
    id: entry.id,
    title: entry.title || 'untitled',
    artist: entry.artist || '',
    album: entry.album || '',
    cover: entry.coverArt || '',
    duration: entry.duration || 0, // seconds
    started: Date.now() - (entry.minutesAgo || 0) * 60_000 // navidrome only gives whole minutes
  }
}

// the cover as {bytes, type}, or null if navidrome has none for it
async function coverArt(env, id) {
  const res = await subsonic(env, 'getCoverArt', {id, size: String(ART_SIZE), square: 'true'})
  const type = res.headers.get('content-type') || ''
  // errors come back as a subsonic xml/json body, not an image
  if (!res.ok || !type.startsWith('image/')) return null
  return {bytes: await res.arrayBuffer(), type}
}

// a song counts as new unless it's the same track that started within a couple of minutes of the saved one
// (minutesAgo is rounded, so the same play can drift by a minute between checks)
const samePlay = (a, b) => a && b && a.id === b.id && Math.abs(a.started - b.started) < 3 * 60_000

async function record(env) {
  const song = await nowPlaying(env)
  if (!song) return
  const last = await env.TRACKS.get(SONG_KEY, 'json')
  if (samePlay(song, last)) return // only write when the song changes, KV writes are the scarce part
  // songs off the same album share a cover, so only fetch and save one when it isn't already there
  song.hasArt = Boolean(song.cover && song.cover === last?.cover && last?.hasArt)
  if (song.cover && !song.hasArt) {
    const art = await coverArt(env, song.cover).catch(() => null)
    if (art) {
      await env.TRACKS.put(ART_KEY, art.bytes, {metadata: {id: song.cover, type: art.type}})
      song.hasArt = true
    }
  }
  await env.TRACKS.put(SONG_KEY, JSON.stringify(song))
}

// --- pages ---

const ago = (ms) => {
  const min = Math.floor(ms / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} hr ago`
  const days = Math.floor(hr / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

// a blank ART_BOX square with a "view" link where the cover goes. it goes back to the homepage:
// art=1 shows the cover, n keeps the same random nichepost on the reload
const viewLink = (label, roll) =>
  '<table border="1" cellspacing="0" cellpadding="0" role="presentation"><tr>' +
  // the table's border and the cell's border take 2px a side, so the square comes out ART_BOX wide
  `<td width="${ART_BOX - 4}" height="${ART_BOX - 4}" align="center" valign="middle">` +
  `<a href="/?n=${roll}&amp;art=1" title="show the cover: ${esc(label)}">view</a>` +
  '</td></tr></table>'

// how far into the song, as a line under the text and the cover, as wide as both: two <hr>s side by side in a
// full-width table, the played part (in bar.played) and the rest (in bar.rest), split by percent. an <hr> stretches
// to its cell, which text can't. it's where the song was when the page loaded (no js, so it doesn't move), and
// navidrome only says which minute the song started in, so it can be up to a minute off
const progressBar = (song, now, bar) => {
  const done = Math.round(Math.min(1, Math.max(0, (now - song.started) / (song.duration * 1000))) * 100)
  const part = (width, color) => `<td width="${width}%"><hr color="${color}" size="2"></td>`
  return (
    `<table role="presentation" aria-hidden="true" title="about ${done}% through" width="100%" cellspacing="0" cellpadding="0"><tr>` +
    (done > 0 ? part(done, bar.played) : '') +
    (done < 100 ? part(100 - done, bar.rest) : '') +
    '</tr></table>'
  )
}

// the header box, a mirror of the logo and name on the left: the text lined up towards the cover on the far right.
// "listening via navidrome" and a progress bar while the song plays, otherwise how long ago it was
const songCells = (song, now, {showArt, roll, bar}) => {
  const playing = song.duration && now < song.started + song.duration * 1000
  const when = playing ? 'listening via navidrome' : `last played <time datetime="${new Date(song.started).toISOString()}">${ago(now - song.started)}</time>`
  const label = [song.title, song.artist, song.album].filter(Boolean).join(', ')
  const cover = !song.hasArt
    ? ''
    : showArt
      ? // align="left" takes the cover out of the text line, so no gap opens under it for letters like g and y
        `<td valign="top"><img src="/art/${encodeURIComponent(song.cover)}" width="${ART_BOX}" height="${ART_BOX}" alt="" title="${esc(label)}" align="left"></td>\n`
      : `<td valign="top">${viewLink(label, roll)}</td>\n`
  return (
    '<tr>\n' +
    `<td valign="top" align="right"><small>${when}</small><br>\n<cite>${esc(song.title)}</cite>` +
    (song.artist ? `<br>\n<small>${esc(song.artist)}</small>` : '') +
    '</td>\n' +
    (cover && `<td width="${ART_GAP}"></td>\n` + cover) +
    '</tr>\n' +
    (playing ? `<tr><td colspan="${cover ? 3 : 1}">${progressBar(song, now, bar)}</td></tr>\n` : '')
  )
}

// opts.showArt: the view link was clicked. opts.roll: the nichepost dice roll to reuse, or null for a fresh one.
// the roll is a big number taken modulo the review count, because the song box (and its link, which has to
// carry the roll) comes before the reviews in the page, so the count isn't known yet when the link is written
async function homepage(res, env, {showArt = false, roll = null} = {}) {
  const song = await env.TRACKS.get(SONG_KEY, 'json').catch(() => null)
  const now = Date.now()
  if (roll === null) roll = Math.floor(Math.random() * 1_000_000)
  let pick = 0
  let seen = 0
  const out = new HTMLRewriter()
    .on('[data-reviews]', {
      element(el) {
        pick = roll % (Number(el.getAttribute('data-reviews')) || 1)
      }
    })
    .on('[data-review]', {
      element(el) {
        if (seen++ === pick) el.removeAttribute('hidden')
        else el.remove()
      }
    })
    .on('#now-playing', {
      element(el) {
        // the bar colours come from build.mjs on the table itself, so they aren't repeated here
        const bar = {played: el.getAttribute('data-played') || '', rest: el.getAttribute('data-rest') || ''}
        el.removeAttribute('data-played')
        el.removeAttribute('data-rest')
        if (song) el.setInnerContent('\n' + songCells(song, now, {showArt, roll, bar}), {html: true})
      }
    })
    .transform(res)
  // the body changes per visit, so the asset's etag no longer describes it
  const headers = new Headers(out.headers)
  headers.delete('etag')
  headers.set('cache-control', 'no-cache')
  return new Response(out.body, {status: out.status, headers})
}

// only the saved cover is served, so this can't be used to browse the rest of the library
async function art(id, env) {
  const {value, metadata} = await env.TRACKS.getWithMetadata(ART_KEY, 'arrayBuffer')
  if (!value || metadata?.id !== id) return new Response('not found', {status: 404})
  // the url carries the cover id, so a given url always means the same picture
  return new Response(value, {headers: {'content-type': metadata.type, 'cache-control': 'public, max-age=86400'}})
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const {pathname, searchParams} = url
    if (pathname.startsWith('/art/')) return art(decodeURIComponent(pathname.slice(5)), env)
    // the view link's ?n=..&art=1 is only for the worker, the asset store gets the bare path
    const bare = url.search ? new Request(url.origin + pathname, request) : request
    const res = await env.ASSETS.fetch(bare)
    const html = (res.headers.get('content-type') || '').includes('text/html')
    if (pathname !== '/' || res.status !== 200 || !html) return res
    const n = searchParams.get('n') || ''
    return homepage(res, env, {showArt: searchParams.get('art') === '1', roll: /^\d{1,6}$/.test(n) ? Number(n) : null})
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(record(env).catch((err) => console.error('last played:', err.message)))
  }
}
