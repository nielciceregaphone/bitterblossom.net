// bitterblossom.net worker. every page is a static file from dist/, served straight from the asset store;
// only the homepage comes through here (run_worker_first in wrangler.jsonc). visitors still get plain html.
//
// - fetch: on the homepage, keep one random review and fill in the recently played list
// - scheduled (every minute): ask navidrome what's playing and log new songs to KV
//
// config: vars NAVIDROME_URL and LISTENER in wrangler.jsonc; secrets NAVIDROME_USER, NAVIDROME_TOKEN and
// NAVIDROME_SALT (subsonic token auth: token = md5(password + salt)); KV namespace bound as TRACKS

const LIST_KEY = 'recent-tracks'
const KEEP = 5

const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// --- logging songs ---

// what LISTENER is playing right now according to navidrome, or null
async function nowPlaying(env) {
  const q = new URLSearchParams({
    u: env.NAVIDROME_USER,
    t: env.NAVIDROME_TOKEN,
    s: env.NAVIDROME_SALT,
    v: '1.16.1',
    c: 'bitterblossom.net',
    f: 'json'
  })
  const res = await fetch(`${env.NAVIDROME_URL}/rest/getNowPlaying?${q}`)
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
    duration: entry.duration || 0, // seconds
    started: Date.now() - (entry.minutesAgo || 0) * 60_000 // navidrome only gives whole minutes
  }
}

// a song counts as new unless it's the same track that started within a couple of minutes of the logged one
// (minutesAgo is rounded, so the same play can drift by a minute between checks)
const samePlay = (a, b) => a && b && a.id === b.id && Math.abs(a.started - b.started) < 3 * 60_000

async function record(env) {
  const song = await nowPlaying(env)
  if (!song) return
  const list = (await env.TRACKS.get(LIST_KEY, 'json')) || []
  if (samePlay(song, list[0])) return // only write when the song changes, KV writes are the scarce part
  await env.TRACKS.put(LIST_KEY, JSON.stringify([song, ...list].slice(0, KEEP)))
}

// --- homepage ---

const ago = (ms) => {
  const min = Math.floor(ms / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} hr ago`
  const days = Math.floor(hr / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

// only the newest song can still be playing: anything older was cut off by the next one
const trackItem = (t, i, now) => {
  const playing = i === 0 && t.duration && now < t.started + t.duration * 1000
  const when = playing
    ? 'playing now'
    : `<time datetime="${new Date(t.started).toISOString()}">${ago(now - t.started)}</time>`
  return (
    `<li><cite>${esc(t.title)}</cite>` +
    (t.artist ? ` by ${esc(t.artist)}` : '') +
    (t.album ? ` <small>(${esc(t.album)})</small>` : '') +
    ` <small>${when}</small></li>\n`
  )
}

async function homepage(res, env) {
  const tracks = (await env.TRACKS.get(LIST_KEY, 'json').catch(() => null)) || []
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
    .on('#recent-tracks', {
      element(el) {
        if (tracks.length) el.setInnerContent('\n' + tracks.map((t, i) => trackItem(t, i, now)).join(''), {html: true})
      }
    })
    .transform(res)
  // the body changed per visit, so the asset's etag no longer describes it
  const headers = new Headers(out.headers)
  headers.delete('etag')
  headers.set('cache-control', 'no-cache')
  return new Response(out.body, {status: out.status, headers})
}

export default {
  async fetch(request, env) {
    const res = await env.ASSETS.fetch(request)
    const {pathname} = new URL(request.url)
    const html = (res.headers.get('content-type') || '').includes('text/html')
    if (pathname !== '/' || res.status !== 200 || !html) return res
    return homepage(res, env)
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(record(env).catch((err) => console.error('recently played:', err.message)))
  }
}
