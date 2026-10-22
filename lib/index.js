// dsh-jules-atelier — host half: local ledger over session logs + atelier settings.
import { readdir, stat, readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir, userInfo } from 'node:os'
import zlib from 'node:zlib'

export const name = 'dsh-jules-atelier'
export const inject = ['connection']

const CHANNEL = '/jules-atelier'
const HOME = process.env.DSH_HOME || join(homedir(), '.dsh')
const ROOT = join(HOME, 'sessions')
const DATA = join(HOME, '.jules-atelier')
const SETTINGS = join(DATA, 'settings.json')
const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])
const cache = new Map() // file -> { key, info }

const dayIso = (ms) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Session logs are appended as concatenated zstd frames; node decodes one frame per call.
function decompress(buf) {
  if (typeof zlib.zstdDecompressSync !== 'function') throw new Error('zstd unsupported')
  const starts = []
  for (let i = buf.indexOf(MAGIC); i !== -1; i = buf.indexOf(MAGIC, i + 4)) starts.push(i)
  starts.push(buf.length)
  const out = []
  let a = 0
  while (a < starts.length - 1) {
    let ok = false
    for (let b = a + 1; b < starts.length; b++) {
      try { out.push(zlib.zstdDecompressSync(buf.subarray(starts[a], starts[b]))); a = b; ok = true; break } catch {}
    }
    if (!ok) break
  }
  return Buffer.concat(out)
}

const add = (bag, k, v) => { const r = (bag[k] ||= [0, 0, 0, 0]); r[0] += v[0]; r[1] += v[1]; r[2] += v[2]; r[3] += v[3] }

async function parseFile(file, st, id) {
  const key = `${st.size}:${st.mtimeMs}`
  const hit = cache.get(file)
  if (hit && hit.key === key) return hit.info
  let text = ''
  try { text = decompress(await readFile(file)).toString('utf8') } catch { return hit?.info ?? null }
  // by: model -> [input(uncached), cacheRead, output, calls]; days: day -> model -> same
  const info = { id, title: '', cwd: '', created: 0, last: 0, model: '', ctxWin: 0, ctxUsed: 0, turns: 0, compactions: 0, by: {}, days: {} }
  for (const line of text.split('\n')) {
    if (!line) continue
    const t = line.slice(9, 40)
    if (!(t.startsWith('assistant/message') || t.startsWith('session') || t.startsWith('request/context') || t.startsWith('turn/start') || t.startsWith('compaction/end'))) continue
    let d
    try { d = JSON.parse(line) } catch { continue }
    switch (d?.type) {
      case 'session': info.cwd = d.cwd || ''; info.created = d.createdAt || 0; break
      case 'session/title': if (d.data?.title) info.title = d.data.title; break
      case 'request/context': info.ctxWin = d.data?.contextWindow || info.ctxWin; break
      case 'turn/start': info.turns++; break
      case 'compaction/end': info.compactions++; break
      case 'assistant/message': {
        const u = d.data?.usage
        if (!u) break
        const m = d.data?.message?.source?.model || 'other'
        const v = [u.inputTokens || 0, u.cacheReadTokens || 0, u.outputTokens || 0, 1]
        add(info.by, m, v)
        add((info.days[dayIso(d.time)] ||= {}), m, v)
        info.model = m; info.last = d.time || info.last
        info.ctxUsed = (u.inputTokens || 0) + (u.cacheReadTokens || 0) + (u.cacheWriteTokens || 0)
        break
      }
    }
  }
  cache.set(file, { key, info })
  return info
}

async function summarize() {
  const days = {}, models = {}, sessions = []
  const now = Date.now()
  let groups = []
  try { groups = await readdir(ROOT) } catch {}
  for (const g of groups) {
    let ids = []
    try { ids = await readdir(join(ROOT, g)) } catch { continue }
    for (const id of ids) {
      const file = join(ROOT, g, id, 'session.v4.jsonl.zstd')
      let st
      try { st = await stat(file) } catch { continue }
      const info = await parseFile(file, st, id)
      if (!info || !Object.keys(info.by).length) continue
      for (const [day, bag] of Object.entries(info.days)) for (const [m, v] of Object.entries(bag)) add((days[day] ||= {}), m, v)
      for (const [m, v] of Object.entries(info.by)) add(models, m, v)
      const { days: _d, ...rest } = info
      sessions.push({ ...rest, mtime: st.mtimeMs, running: now - st.mtimeMs < 90_000 })
    }
  }
  sessions.sort((a, b) => (b.last || b.mtime) - (a.last || a.mtime))
  return { days, models, sessions, today: dayIso(now), at: now, user: osUser() }
}

const osUser = () => { try { return process.env.USER || process.env.USERNAME || userInfo().username || '' } catch { return '' } }
let inflight = null, last = null
async function usage(fresh) {
  if (!fresh && last && Date.now() - last.at < 10_000) return last
  inflight ??= summarize().then((v) => { last = v; return v }).finally(() => { inflight = null })
  return inflight
}

async function readSettings() {
  try { return JSON.parse(await readFile(SETTINGS, 'utf8')) } catch { return {} }
}
async function writeSettings(value) {
  await mkdir(DATA, { recursive: true })
  await writeFile(SETTINGS, JSON.stringify(value, null, 2))
  return value
}
const json = (body, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } })
const wrap = async (fn) => { try { return json({ ok: true, value: await fn() }) } catch (e) { return json({ ok: false, error: String(e?.message || e) }, 500) } }

// Same pattern as built-in plugins: exact routes on the authenticated /api channel,
// reached from the client with document-relative fetch('api/...') in both desktop and web.
export function apply(root) {
  root.inject(['connection'], (ctx) => {
    ctx.effect(() => ctx.connection.fetch.register({
      path: '/api/jules-atelier.usage', methods: ['GET'], requestBody: 'buffered',
      fetch: (req) => wrap(() => usage(new URL(req.url).searchParams.has('fresh'))),
    }), 'jules-atelier: /api/jules-atelier.usage')
    ctx.effect(() => ctx.connection.fetch.register({
      path: '/api/jules-atelier.settings', methods: ['GET', 'POST'], requestBody: 'buffered',
      fetch: (req) => wrap(async () => {
        if (req.method === 'GET') return readSettings()
        const value = await req.json()
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('settings must be an object')
        return writeSettings(value)
      }),
    }), 'jules-atelier: /api/jules-atelier.settings')
  })
}
