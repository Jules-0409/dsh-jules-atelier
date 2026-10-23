// dsh-jules-atelier — host half: local ledger over session logs + atelier settings.
import { readdir, stat, readFile, writeFile, mkdir, rename, rm, cp } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname, sep } from 'node:path'
import { homedir, userInfo } from 'node:os'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
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

// The host process may run in a different time zone than the UI (seen on macOS), so the
// client sends its getTimezoneOffset() and days / hours are bucketed in the user's zone.
let TZ = null
const setTz = (q) => { const v = q.get('tz'); if (v != null && /^-?\d{1,4}$/.test(v) && +v !== TZ) { TZ = +v; last = null } }
const parts = (ms) => {
  if (TZ == null) { const d = new Date(ms); return [d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()] }
  const d = new Date(ms - TZ * 60000); return [d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours()]
}
const dayIso = (ms) => { const [y, m, d] = parts(ms); return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` }

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

const textOf = (c) => typeof c === 'string' ? c.trim() : Array.isArray(c) ? c.filter((x) => x && x.type === 'text' && typeof x.text === 'string').map((x) => x.text).join('').trim() : ''
const add = (bag, k, v) => { const r = (bag[k] ||= [0, 0, 0, 0]); r[0] += v[0]; r[1] += v[1]; r[2] += v[2]; r[3] += v[3] }

async function parseFile(file, st, id) {
  const key = `${st.size}:${st.mtimeMs}:${TZ}`
  const hit = cache.get(file)
  if (hit && hit.key === key) return hit.info
  let text = ''
  try { text = decompress(await readFile(file)).toString('utf8') } catch { return hit?.info ?? null }
  // by: model -> [input(uncached), cacheRead, output, calls]; days: day -> model -> same
  // dm: day -> [firstMs, lastMs, turns, ...24 hourly call counts]
  const info = { id, title: '', cwd: '', created: 0, last: 0, model: '', ctxWin: 0, ctxUsed: 0, turns: 0, compactions: 0, by: {}, days: {}, dm: {}, dw: {} }
  // dw: day -> { asks: [[ms, text]], outs: [[ms, text]], files: [path], tools: { name: n } } — what the work was
  const work = (ms) => (info.dw[dayIso(ms)] ||= { asks: [], outs: [], files: [], tools: {} })
  let said = ''
  const meta = (ms) => { const k = dayIso(ms); const r = (info.dm[k] ||= [ms, ms, 0, ...new Array(24).fill(0)]); if (ms < r[0]) r[0] = ms; if (ms > r[1]) r[1] = ms; return r }
  for (const line of text.split('\n')) {
    if (!line) continue
    const t = line.slice(9, 40)
    if (!(t.startsWith('assistant/message') || t.startsWith('session') || t.startsWith('request/context') || t.startsWith('turn/') || t.startsWith('compaction/end') || t.startsWith('user/message') || t.startsWith('tool/call'))) continue
    let d
    try { d = JSON.parse(line) } catch { continue }
    switch (d?.type) {
      case 'session': info.cwd = d.cwd || ''; info.created = d.createdAt || 0; break
      case 'session/title': if (d.data?.title) info.title = d.data.title; break
      case 'request/context': info.ctxWin = d.data?.contextWindow || info.ctxWin; break
      case 'turn/start': info.turns++; if (d.time) meta(d.time)[2]++; break
      case 'compaction/end': info.compactions++; break
      case 'user/message': {
        if (!d.time || (d.data?.source?.kind && d.data.source.kind !== 'user')) break
        const x = textOf(d.data?.content)
        const w = work(d.time); if (x && w.asks.length < 6) w.asks.push([d.time, x.slice(0, 240)])
        break
      }
      case 'turn/end': {
        if (said && d.time) { const w = work(d.time); w.outs.push([d.time, said.slice(0, 600)]); if (w.outs.length > 6) w.outs.shift() }
        said = ''
        break
      }
      case 'tool/call': {
        const n = d.data?.name; if (!n || !d.time) break
        const w = work(d.time); w.tools[n] = (w.tools[n] || 0) + 1
        if (/^(edit|write|multi_?edit|create_file|str_replace|apply_patch|notebook_edit)$/i.test(n) && w.files.length < 120) {
          let a = d.data.arguments; if (typeof a === 'string') { try { a = JSON.parse(a) } catch { a = { patch: a } } }
          const paths = [a?.file_path, a?.path, a?.filePath].filter((v) => typeof v === 'string')
          if (typeof (a?.patch ?? a?.input) === 'string') for (const m of String(a.patch ?? a.input).matchAll(/\*\*\* (?:Update|Add) File: (.+)/g)) paths.push(m[1].trim())
          for (const f of paths) if (!w.files.includes(f)) w.files.push(f)
        }
        break
      }
      case 'assistant/message': {
        const u = d.data?.usage
        if (!u) break
        const m = d.data?.message?.source?.model || 'other'
        const v = [u.inputTokens || 0, u.cacheReadTokens || 0, u.outputTokens || 0, 1]
        add(info.by, m, v)
        add((info.days[dayIso(d.time)] ||= {}), m, v)
        if (d.time) meta(d.time)[3 + parts(d.time)[3]]++
        info.model = m; info.last = d.time || info.last
        { const x = textOf(d.data?.message?.content); if (x) said = x }
        info.ctxUsed = (u.inputTokens || 0) + (u.cacheReadTokens || 0) + (u.cacheWriteTokens || 0)
        break
      }
    }
  }
  cache.set(file, { key, info })
  return info
}

async function summarize() {
  const days = {}, models = {}, sessions = [], infos = []
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
      infos.push(info)
      const { days: _d, dm: _m, dw: _w, ...rest } = info
      let ask = null, nf = new Set(), calls = 0
      for (const w of Object.values(info.dw)) { for (const a of w.asks) if (!ask || a[0] > ask[0]) ask = a; for (const p of w.files) nf.add(p); for (const n of Object.values(w.tools)) calls += n }
      sessions.push({ ...rest, ask: ask ? ask[1].replace(/\s+/g, ' ').slice(0, 160) : '', files: nf.size, tools: calls, mtime: st.mtimeMs, running: now - st.mtimeMs < 90_000 })
    }
  }
  sessions.sort((a, b) => (b.last || b.mtime) - (a.last || a.mtime))
  lastInfos = infos
  return { days, models, sessions, today: dayIso(now), at: now, user: osUser() }
}

const osUser = () => { try { return process.env.USER || process.env.USERNAME || userInfo().username || '' } catch { return '' } }
let inflight = null, last = null, lastInfos = []
async function usage(fresh) {
  if (!fresh && last && Date.now() - last.at < 10_000) return last
  inflight ??= summarize().then((v) => { last = v; return v }).finally(() => { inflight = null })
  return inflight
}

// Daily / weekly notes: everything that happened between two local days (inclusive).
async function report(from, to) {
  const re = /^\d{4}-\d{2}-\d{2}$/
  if (!re.test(from) || !re.test(to || from)) throw new Error('from/to must be YYYY-MM-DD')
  to ||= from
  await usage(false)
  const hours = new Array(24).fill(0), days = {}, models = {}, sessions = []
  for (const info of lastInfos) {
    const by = {}, d = { turns: 0, first: 0, last: 0, active: 0 }, w = { asks: [], outs: [], files: [], tools: {} }
    for (const [day, x] of Object.entries(info.dw || {})) {
      if (day < from || day > to) continue
      w.asks.push(...x.asks); w.outs.push(...x.outs)
      for (const f of x.files) if (!w.files.includes(f)) w.files.push(f)
      for (const [k, n] of Object.entries(x.tools)) w.tools[k] = (w.tools[k] || 0) + n
    }
    w.asks.sort((a, b) => a[0] - b[0]); w.outs.sort((a, b) => a[0] - b[0]); w.asks = w.asks.slice(0, 4); w.outs = w.outs.slice(-3)
    for (const [day, bag] of Object.entries(info.days)) {
      if (day < from || day > to) continue
      for (const [m, v] of Object.entries(bag)) { add(by, m, v); add(models, m, v); add((days[day] ||= {}), m, v) }
    }
    for (const [day, r] of Object.entries(info.dm)) {
      if (day < from || day > to) continue
      d.turns += r[2]; d.active++
      d.first = d.first ? Math.min(d.first, r[0]) : r[0]; d.last = Math.max(d.last, r[1])
      for (let i = 0; i < 24; i++) hours[i] += r[3 + i]
    }
    if (!Object.keys(by).length && !d.turns) continue
    sessions.push({ id: info.id, title: info.title, cwd: info.cwd, created: info.created, by, ...d, w })
  }
  return { from, to, hours, days, models, sessions, at: Date.now() }
}

async function readSettings() {
  try { return JSON.parse(await readFile(SETTINGS, 'utf8')) } catch { return {} }
}
async function writeSettings(value) {
  await mkdir(DATA, { recursive: true })
  await writeFile(SETTINGS, JSON.stringify(value, null, 2))
  return value
}
/* ---------------- self-update from GitHub ----------------
 * The plugin is installed as a plain folder (link install). Updating means replacing the
 * files in that folder with the latest main branch, then the user restarts Harness. */
const REPO = 'Jules-0409/dsh-jules-atelier'
const BRANCH = 'main'
const PLUGIN_DIR = fileURLToPath(new URL('..', import.meta.url))
const UPDATE_STATE = join(DATA, 'update.json')
const BACKUPS = join(DATA, 'backup')
const SKIP = /^(\.git|\.github|docs|node_modules)(\/|$)/
const readJson = async (f) => { try { return JSON.parse(await readFile(f, 'utf8')) } catch { return null } }
const VERSION = (() => { try { return JSON.parse(readFileSync(join(PLUGIN_DIR, 'package.json'), 'utf8')).version } catch { return '0.0.0' } })()
const vparts = (v) => String(v || '0').replace(/^v/, '').split(/[.+-]/).slice(0, 3).map((x) => parseInt(x, 10) || 0)
const newer = (a, b) => { const x = vparts(a), y = vparts(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false }
const UA = { 'user-agent': `dsh-jules-atelier/${VERSION}` }

async function get(url, accept) {
  const r = await fetch(url, { headers: { ...UA, ...(accept ? { accept } : {}) }, redirect: 'follow', signal: AbortSignal.timeout(/tar|zip/.test(url) ? 180_000 : 20_000) })
  if (!r.ok) throw new Error(`${new URL(url).host}: HTTP ${r.status}`)
  return Buffer.from(await r.arrayBuffer())
}
async function firstOk(urls, accept) {
  let err
  for (const u of urls) { try { return await get(u, accept) } catch (e) { err = e } }
  throw err
}
async function remoteManifest() {
  const buf = await firstOk([
    `https://raw.githubusercontent.com/${REPO}/${BRANCH}/package.json?t=${Date.now()}`,
    `https://api.github.com/repos/${REPO}/contents/package.json?ref=${BRANCH}`,
  ], 'application/vnd.github.raw')
  const pkg = JSON.parse(buf.toString('utf8'))
  if (pkg?.name !== name || !pkg.version) throw new Error('unexpected manifest')
  return pkg
}

// Minimal tar reader (ustar + pax + GNU long names). Returns [{ path, data }] for regular files,
// with the archive's top-level folder ("owner-repo-sha/") stripped.
function untar(buf) {
  const out = []
  let off = 0, longName = null, pax = null
  const str = (a, b) => { const s = buf.subarray(a, b); const z = s.indexOf(0); return s.subarray(0, z < 0 ? s.length : z).toString('utf8') }
  while (off + 512 <= buf.length) {
    if (buf.subarray(off, off + 512).every((x) => x === 0)) break
    const size = parseInt(str(off + 124, off + 136).trim() || '0', 8)
    const type = String.fromCharCode(buf[off + 156] || 48)
    const prefix = str(off + 345, off + 500)
    let path = (prefix ? prefix + '/' : '') + str(off, off + 100)
    const data = buf.subarray(off + 512, off + 512 + size)
    off += 512 + Math.ceil(size / 512) * 512
    if (type === 'x' || type === 'g') {
      if (type === 'x') {
        pax = {}
        const t = data.toString('utf8'); let i = 0
        while (i < t.length) { const sp = t.indexOf(' ', i); const len = parseInt(t.slice(i, sp), 10); if (!len) break; const kv = t.slice(sp + 1, i + len - 1); const eq = kv.indexOf('='); pax[kv.slice(0, eq)] = kv.slice(eq + 1); i += len }
      }
      continue
    }
    if (type === 'L') { longName = data.toString('utf8').replace(/\0[\s\S]*$/, ''); continue }
    if (longName) { path = longName; longName = null }
    if (pax?.path) path = pax.path
    pax = null
    if (type !== '0' && type !== '\0' && type !== '7') continue
    const rel = path.split('/').slice(1).join('/')
    if (!rel || rel.split('/').some((p) => p === '..' || p === '') || SKIP.test(rel)) continue
    out.push({ path: rel, data: Buffer.from(data) })
  }
  return out
}

const run = (cmd, args, cwd) => new Promise((res, rej) => execFile(cmd, args, { cwd, timeout: 60_000, windowsHide: true }, (e, so, se) => e ? rej(new Error(String(se || e.message).trim())) : res(String(so))))

let check = null, checkAt = 0, busy = null
async function state() { return (await readJson(UPDATE_STATE)) || {} }
async function saveState(patch) {
  const next = { ...(await state()), ...patch }
  await mkdir(DATA, { recursive: true })
  await writeFile(UPDATE_STATE, JSON.stringify(next, null, 2))
  return next
}
async function installedVersion() { return (await readJson(join(PLUGIN_DIR, 'package.json')))?.version || VERSION }

async function updateInfo(fresh) {
  if (fresh || !check || Date.now() - checkAt > 6 * 3600_000) {
    checkAt = Date.now()
    check = remoteManifest().then((p) => ({ latest: p.version, error: null }), (e) => ({ latest: null, error: String(e?.message || e) }))
  }
  const [r, installed, st, s] = await Promise.all([check, installedVersion(), state(), readSettings()])
  if (r.error) checkAt = 0 // retry next time
  return {
    current: VERSION, installed, latest: r.latest, error: r.error, mode: s.update || 'auto',
    available: !!r.latest && newer(r.latest, installed),
    pending: newer(installed, VERSION) ? installed : null,
    git: existsSync(join(PLUGIN_DIR, '.git')), dir: PLUGIN_DIR, checkedAt: checkAt || Date.now(), last: st.last || null,
  }
}

async function installUpdate() {
  const before = await installedVersion()
  let via
  if (existsSync(join(PLUGIN_DIR, '.git'))) {
    try { await run('git', ['pull', '--ff-only', '--quiet'], PLUGIN_DIR); via = 'git' } catch (e) { console.warn('[jules-atelier] git pull failed, falling back to tarball:', e.message) }
  }
  if (!via) {
    const tgz = await firstOk([
      `https://codeload.github.com/${REPO}/tar.gz/refs/heads/${BRANCH}`,
      `https://api.github.com/repos/${REPO}/tarball/${BRANCH}`,
    ])
    const files = untar(zlib.gunzipSync(tgz))
    const byPath = new Map(files.map((f) => [f.path, f.data]))
    const pkg = JSON.parse(byPath.get('package.json')?.toString('utf8') || 'null')
    if (pkg?.name !== name) throw new Error('downloaded archive is not dsh-jules-atelier')
    if (!newer(pkg.version, before)) return saveState({ last: { at: Date.now(), from: before, to: before, via: 'none', note: 'already up to date' } })
    for (const f of ['lib/index.js', 'lib/client.js']) if (!byPath.get(f)?.length) throw new Error(`archive is missing ${f}`)
    if (!byPath.get('lib/client.js').includes('__ModuleLoader__')) throw new Error('lib/client.js looks invalid')
    // back up what is running now (keep the two most recent)
    const bdir = join(BACKUPS, before)
    await rm(bdir, { recursive: true, force: true })
    await mkdir(bdir, { recursive: true })
    for (const f of ['package.json', 'cordis.patch.yml', 'lib']) if (existsSync(join(PLUGIN_DIR, f))) await cp(join(PLUGIN_DIR, f), join(bdir, f), { recursive: true })
    try {
      const old = (await readdir(BACKUPS)).filter((v) => v !== before).sort((a, b) => (newer(a, b) ? -1 : 1))
      for (const v of old.slice(1)) await rm(join(BACKUPS, v), { recursive: true, force: true })
    } catch {}
    // stage every file first, then swap them in; package.json goes last
    const order = files.map((f) => f.path).sort((a, b) => (a === 'package.json') - (b === 'package.json'))
    for (const p of order) {
      const dst = join(PLUGIN_DIR, ...p.split('/'))
      if (!dst.startsWith(PLUGIN_DIR.endsWith(sep) ? PLUGIN_DIR : PLUGIN_DIR + sep)) continue
      await mkdir(dirname(dst), { recursive: true })
      await writeFile(dst + '.ja-new', byPath.get(p))
    }
    for (const p of order) { const dst = join(PLUGIN_DIR, ...p.split('/')); await rename(dst + '.ja-new', dst) }
    via = 'github'
  }
  const after = await installedVersion()
  check = null
  console.info(`[jules-atelier] updated ${before} -> ${after} via ${via}; restart Harness to load it`)
  return saveState({ last: { at: Date.now(), from: before, to: after, via } })
}
function doUpdate() {
  busy ??= installUpdate().finally(() => { busy = null })
  return busy
}
let autoRetry = 0
async function autoTick() {
  try {
    const s = await readSettings()
    if ((s.update || 'auto') !== 'auto') return
    const info = await updateInfo(true)
    if (info.available) await doUpdate()
    autoRetry = 0
  } catch (e) {
    console.warn('[jules-atelier] auto-update failed:', e?.message || e)
    // slow or flaky networks: try again a few times before waiting for the 12-hour tick
    if (autoRetry++ < 4) setTimeout(autoTick, 10 * 60_000 * autoRetry).unref?.()
  }
}

const json = (body, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } })
const wrap = async (fn) => { try { return json({ ok: true, value: await fn() }) } catch (e) { return json({ ok: false, error: String(e?.message || e) }, 500) } }

// Same pattern as built-in plugins: exact routes on the authenticated /api channel,
// reached from the client with document-relative fetch('api/...') in both desktop and web.
export function apply(root) {
  root.inject(['connection'], (ctx) => {
    ctx.effect(() => ctx.connection.fetch.register({
      path: '/api/jules-atelier.usage', methods: ['GET'], requestBody: 'buffered',
      fetch: (req) => wrap(() => { const q = new URL(req.url).searchParams; setTz(q); return usage(q.has('fresh')) }),
    }), 'jules-atelier: /api/jules-atelier.usage')
    ctx.effect(() => ctx.connection.fetch.register({
      path: '/api/jules-atelier.report', methods: ['GET'], requestBody: 'buffered',
      fetch: (req) => wrap(() => { const q = new URL(req.url).searchParams; setTz(q); return report(q.get('from') || '', q.get('to') || '') }),
    }), 'jules-atelier: /api/jules-atelier.report')
    ctx.effect(() => ctx.connection.fetch.register({
      path: '/api/jules-atelier.settings', methods: ['GET', 'POST'], requestBody: 'buffered',
      fetch: (req) => wrap(async () => {
        if (req.method === 'GET') return readSettings()
        const value = await req.json()
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('settings must be an object')
        return writeSettings(value)
      }),
    }), 'jules-atelier: /api/jules-atelier.settings')
    ctx.effect(() => ctx.connection.fetch.register({
      path: '/api/jules-atelier.update', methods: ['GET', 'POST'], requestBody: 'buffered',
      fetch: (req) => wrap(async () => {
        if (req.method === 'GET') return updateInfo(new URL(req.url).searchParams.has('fresh'))
        await doUpdate()
        return updateInfo(false)
      }),
    }), 'jules-atelier: /api/jules-atelier.update')
    ctx.effect(() => {
      const first = setTimeout(autoTick, 30_000), every = setInterval(autoTick, 12 * 3600_000)
      first.unref?.(); every.unref?.()
      return () => { clearTimeout(first); clearInterval(every) }
    }, 'jules-atelier: auto-update')
  })
}
