// bitterblossom.net worker. every page is a static file from dist/, served straight from the asset store;
// only the homepage and /art/* come through here (run_worker_first in wrangler.jsonc). visitors still get plain html.
//
// - fetch /: keep one random nichepost and fill in the last played song (cover art included) in the header
// - fetch /art/<id>: the last played song's cover, kept in KV so the page never links to navidrome itself
// - scheduled (every minute): ask navidrome what's playing; when the song changes, save it and its cover
//
// config: vars NAVIDROME_URL and LISTENER in wrangler.jsonc; secrets NAVIDROME_USER, NAVIDROME_TOKEN and
// NAVIDROME_SALT (subsonic token auth: token = md5(password + salt)); KV namespace bound as TRACKS

const SONG_KEY = 'last-song'
const ART_KEY = 'last-song-art'
const ART_SIZE = 96 // fetched at 2x, shown at 48 so it stays sharp on phones

const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// --- navidrome ---

const subsonic = (env, endpoint, params = {}) => {
  const q = new URLSearchParams({
    u: env.NAVIDROME_USER,
    t: env.NAVIDROME_TOKEN,
    s: env.NAVIDROME_SALT,
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

// the header box: cover on the left, then "playing now" or how long ago, the title and the artist
const songCells = (song, now) => {
  const playing = song.duration && now < song.started + song.duration * 1000
  const when = playing ? 'playing now' : `last played <time datetime="${new Date(song.started).toISOString()}">${ago(now - song.started)}</time>`
  const label = [song.title, song.artist, song.album].filter(Boolean).join(', ')
  const cover = song.hasArt
    ? `<td valign="top"><img src="/art/${encodeURIComponent(song.cover)}" width="48" height="48" alt="" title="${esc(label)}"></td>\n`
    : ''
  return (
    '<tr>\n' +
    cover +
    `<td valign="top"><small>${when}</small><br>\n<cite>${esc(song.title)}</cite>` +
    (song.artist ? `<br>\n<small>${esc(song.artist)}</small>` : '') +
    '</td>\n</tr>\n'
  )
}

async function homepage(res, env) {
  const song = await env.TRACKS.get(SONG_KEY, 'json').catch(() => null)
  const now = Date.now()
  let pick = 0
  let seen = 0
  const out = new HTMLRewriter()
    .on('[data-reviews]', {
      element(el) {
        pick = Math.floor(Math.random() * (Number(el.getAttribute('data-reviews')) || 1))
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
        if (song) el.setInnerContent('\n' + songCells(song, now), {html: true})
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
    const {pathname} = new URL(request.url)
    if (pathname.startsWith('/art/')) return art(decodeURIComponent(pathname.slice(5)), env)
    const res = await env.ASSETS.fetch(request)
    const html = (res.headers.get('content-type') || '').includes('text/html')
    if (pathname !== '/' || res.status !== 200 || !html) return res
    return homepage(res, env)
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(record(env).catch((err) => console.error('last played:', err.message)))
  }
}
