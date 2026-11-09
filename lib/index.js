// dsh-jules-atelier — host half: local ledger over session logs + atelier settings + Pocket Atelier LAN remote.
import { readdir, stat, readFile, writeFile, mkdir, rename, rm, cp } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname, sep } from 'node:path'
import { homedir, userInfo, networkInterfaces, hostname } from 'node:os'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { createServer } from 'node:http'
import zlib from 'node:zlib'

export const name = 'dsh-jules-atelier'
export const inject = ['connection']

const CHANNEL = '/jules-atelier'
const HOME = process.env.DSH_HOME || join(homedir(), '.dsh')
const ROOT = join(HOME, 'sessions')
const DATA = join(HOME, '.jules-atelier')
const SETTINGS = join(DATA, 'settings.json')
const INDEX_CACHE = join(DATA, 'index-cache.json')
const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])
const cache = new Map() // file -> { key, info }
const detailCache = new Map() // file -> { key, detail }
const sessionFiles = new Map() // sessionId -> file

// Load persisted index cache on startup for instant cold-start
try {
  if (existsSync(INDEX_CACHE)) {
    const raw = JSON.parse(readFileSync(INDEX_CACHE, 'utf8'))
    if (raw && raw.v === 2 && raw.entries) {
      for (const [k, v] of Object.entries(raw.entries)) if (v && v.key && v.info) cache.set(k, v)
    }
  }
} catch {}

let cacheDirty = false, cacheTimer = null
function scheduleCacheSave() {
  if (!cacheDirty || cacheTimer) return
  cacheTimer = setTimeout(async () => {
    cacheTimer = null
    if (!cacheDirty) return
    cacheDirty = false
    try {
      await mkdir(DATA, { recursive: true })
      const entries = {}
      for (const [k, v] of cache) entries[k] = v
      await writeFile(INDEX_CACHE, JSON.stringify({ v: 2, entries }))
    } catch {}
  }, 5000)
  cacheTimer.unref?.()
}

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
const thinkingOf = (c) => Array.isArray(c) ? c.filter((x) => x && (x.type === 'thinking' || x.type === 'reasoning') && typeof (x.thinking ?? x.text) === 'string').map((x) => x.thinking ?? x.text).join('\n').trim() : ''
const add = (bag, k, v) => { const r = (bag[k] ||= [0, 0, 0, 0]); r[0] += v[0]; r[1] += v[1]; r[2] += v[2]; r[3] += v[3] }

function summarizeToolArgs(name, rawArgs) {
  if (!rawArgs) return ''
  let a = rawArgs
  if (typeof a === 'string') { try { a = JSON.parse(a) } catch { return a.slice(0, 80) } }
  if (!a || typeof a !== 'object') return ''
  const path = a.file_path || a.path || a.filePath || a.TargetFile || a.DirectoryPath
  if (typeof path === 'string') return path.split(/[\\/]/).slice(-2).join('/')
  const cmd = a.command || a.cmd || a.CommandLine
  if (typeof cmd === 'string') return cmd.replace(/\s+/g, ' ').slice(0, 72)
  const q = a.query || a.pattern || a.Query || a.url
  if (typeof q === 'string') return q.slice(0, 64)
  if (typeof (a.patch ?? a.input) === 'string') {
    const m = String(a.patch ?? a.input).match(/\*\*\* (?:Update|Add) File: (.+)/)
    if (m) return m[1].trim().split(/[\\/]/).slice(-2).join('/')
  }
  return ''
}

async function parseFile(file, st, id) {
  const key = `${st.size}:${st.mtimeMs}:${TZ}`
  const hit = cache.get(file)
  if (hit && hit.key === key) return hit.info
  let text = ''
  try { text = decompress(await readFile(file)).toString('utf8') } catch { return hit?.info ?? null }
  // by: model -> [input(uncached+cacheWrite), cacheRead, output, calls]; days: day -> model -> same
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
        const v = [(u.inputTokens || 0) + (u.cacheWriteTokens || 0), u.cacheReadTokens || 0, u.outputTokens || 0, 1]
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
  cacheDirty = true
  return info
}

// Parse full conversation messages for a specific session ID (for Pocket Atelier mobile view)
async function sessionDetail(id) {
  if (!id) return null
  if (!sessionFiles.has(id)) await usage(false)
  const file = sessionFiles.get(id)
  if (!file) return null
  let st
  try { st = await stat(file) } catch { return null }
  const key = `${st.size}:${st.mtimeMs}`
  const hit = detailCache.get(file)
  if (hit && hit.key === key) return { ...hit.detail, running: Date.now() - st.mtimeMs < 90_000 }
  let text = ''
  try { text = decompress(await readFile(file)).toString('utf8') } catch { return hit?.detail ?? null }
  const info = await parseFile(file, st, id)
  const messages = []
  let curTurn = null
  for (const line of text.split('\n')) {
    if (!line) continue
    const t = line.slice(9, 40)
    if (!(t.startsWith('assistant/message') || t.startsWith('user/message') || t.startsWith('tool/call') || t.startsWith('turn/') || t.startsWith('compaction/end'))) continue
    let d
    try { d = JSON.parse(line) } catch { continue }
    switch (d?.type) {
      case 'user/message': {
        if (d.data?.source?.kind && d.data.source.kind !== 'user') break
        const x = textOf(d.data?.content)
        if (!x) break
        curTurn = null
        messages.push({ role: 'user', time: d.time || 0, text: x.slice(0, 4000) })
        break
      }
      case 'turn/start': {
        curTurn = null
        break
      }
      case 'turn/end': {
        curTurn = null
        break
      }
      case 'compaction/end': {
        curTurn = null
        messages.push({ role: 'compaction', time: d.time || 0 })
        break
      }
      case 'tool/call': {
        const n = d.data?.name; if (!n) break
        const sum = summarizeToolArgs(n, d.data?.arguments)
        if (!curTurn) {
          curTurn = { role: 'assistant', time: d.time || 0, model: info?.model || '', text: '', thinking: '', tools: [], tokens: 0 }
          messages.push(curTurn)
        }
        if (curTurn.tools.length < 24) curTurn.tools.push({ name: n, summary: sum })
        break
      }
      case 'assistant/message': {
        const msg = d.data?.message
        const u = d.data?.usage
        const m = msg?.source?.model || info?.model || ''
        const txt = textOf(msg?.content)
        const thk = thinkingOf(msg?.content)
        if (!txt && !thk && !u) break
        if (!curTurn) {
          curTurn = { role: 'assistant', time: d.time || 0, model: m, text: '', thinking: '', tools: [], tokens: 0 }
          messages.push(curTurn)
        }
        if (m) curTurn.model = m
        if (d.time) curTurn.time = d.time
        if (txt) curTurn.text = curTurn.text ? curTurn.text + '\n\n' + txt : txt
        if (thk) curTurn.thinking = curTurn.thinking ? curTurn.thinking + '\n' + thk : thk
        if (u) curTurn.tokens = (u.inputTokens || 0) + (u.cacheReadTokens || 0) + (u.outputTokens || 0)
        break
      }
    }
  }
  const trimmed = messages.slice(-60).map((m) => m.role === 'assistant' ? { ...m, text: m.text.slice(-8000), thinking: m.thinking.slice(-2400) } : m)
  const detail = {
    id, title: info?.title || '', cwd: info?.cwd || '', created: info?.created || 0, last: info?.last || st.mtimeMs,
    model: info?.model || '', ctxWin: info?.ctxWin || 0, ctxUsed: info?.ctxUsed || 0,
    turns: info?.turns || 0, compactions: info?.compactions || 0, by: info?.by || {},
    running: Date.now() - st.mtimeMs < 90_000, messages: trimmed,
  }
  detailCache.set(file, { key, detail })
  return detail
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
      sessionFiles.set(id, file)
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
  scheduleCacheSave()
  return { days, models, sessions, today: dayIso(now), at: now, user: osUser() }
}

const osUser = () => { try { return process.env.USER || process.env.USERNAME || userInfo().username || '' } catch { return '' } }
let inflight = null, last = null, lastInfos = []
async function usage(fresh) {
  if (!fresh && last && Date.now() - last.at < 10_000) return last
  inflight ??= summarize().then((v) => { last = v; return v }).finally(() => { inflight = null })
  return inflight
}

// Daily / weekly / monthly notes: everything that happened between two local days (inclusive).
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
  syncRemoteServer(value).catch(() => {})
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
  if (r.error) checkAt = 0
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
    const bdir = join(BACKUPS, before)
    await rm(bdir, { recursive: true, force: true })
    await mkdir(bdir, { recursive: true })
    for (const f of ['package.json', 'cordis.patch.yml', 'lib']) if (existsSync(join(PLUGIN_DIR, f))) await cp(join(PLUGIN_DIR, f), join(bdir, f), { recursive: true })
    try {
      const old = (await readdir(BACKUPS)).filter((v) => v !== before).sort((a, b) => (newer(a, b) ? -1 : 1))
      for (const v of old.slice(1)) await rm(join(BACKUPS, v), { recursive: true, force: true })
    } catch {}
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
    if (autoRetry++ < 4) setTimeout(autoTick, 10 * 60_000 * autoRetry).unref?.()
  }
}

/* ---------------- Pocket Atelier: Desktop Bridge & LAN Remote Server ---------------- */
let liveState = {
  sessionId: '', title: '', cwd: '', model: '', running: false,
  streamText: '', streamThinking: '', domMessages: [], approvals: [],
  models: [], workspaces: [], phase: 'auto', at: 0,
}
let cmdSeq = 0
const cmdQueue = []
const cmdWaiters = new Map() // id -> resolve
const remoteClients = new Map() // ip -> { ip, ua, at }

function queueDesktopCmd(type, payload = {}) {
  const id = ++cmdSeq
  const item = { id, type, payload, at: Date.now() }
  cmdQueue.push(item)
  if (cmdQueue.length > 30) cmdQueue.shift()
  return new Promise((resolve) => {
    const timer = setTimeout(() => { cmdWaiters.delete(id); resolve({ ok: true, queued: true, live: liveState }) }, 2200)
    timer.unref?.()
    cmdWaiters.set(id, (res) => { clearTimeout(timer); resolve(res) })
  })
}

function lanIps() {
  const out = []
  try {
    const nets = networkInterfaces()
    for (const [ifname, list] of Object.entries(nets || {})) {
      for (const n of list || []) {
        if (n.internal || (n.family !== 'IPv4' && n.family !== 4)) continue
        if (!n.address || n.address.startsWith('169.254.')) continue
        const pri = /^(en|wlan|eth|wi-?fi)/i.test(ifname) ? 0 : /^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[01])\./.test(n.address) ? 1 : 2
        out.push({ ip: n.address, ifname, pri })
      }
    }
  } catch {}
  out.sort((a, b) => a.pri - b.pri)
  const seen = new Set()
  return out.filter((x) => !seen.has(x.ip) && seen.add(x.ip)).map((x) => x.ip)
}

const genPin = () => String(Math.floor(100000 + Math.random() * 900000))
let httpServer = null, activePort = 0, currentPin = '', remoteError = null

async function ensureRemoteConfig(s) {
  s ||= await readSettings()
  let dirty = false
  if (!s.remotePin || !/^\d{6}$/.test(String(s.remotePin))) { s.remotePin = genPin(); dirty = true }
  if (!s.remotePort || !Number.isFinite(+s.remotePort) || +s.remotePort < 1024 || +s.remotePort > 65535) { s.remotePort = 7788; dirty = true }
  currentPin = String(s.remotePin)
  if (dirty) {
    await mkdir(DATA, { recursive: true })
    await writeFile(SETTINGS, JSON.stringify(s, null, 2))
  }
  return s
}

function parseCookies(hdr) {
  const out = {}
  if (!hdr) return out
  for (const part of hdr.split(';')) {
    const eq = part.indexOf('=')
    if (eq > 0) out[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim())
  }
  return out
}

function checkPin(req, urlObj) {
  if (!currentPin) return false
  const qPin = urlObj.searchParams.get('k') || urlObj.searchParams.get('pin')
  if (qPin && qPin === currentPin) return true
  const hPin = req.headers['x-atelier-pin']
  if (hPin && String(hPin) === currentPin) return true
  const cookies = parseCookies(req.headers.cookie)
  if (cookies.ja_pin === currentPin) return true
  return false
}

function readReqBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let len = 0
    req.on('data', (c) => { len += c.length; if (len > 1_000_000) { req.destroy(); reject(new Error('body too large')) } else chunks.push(c) })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

async function handleRemoteCommand(type, payload = {}) {
  switch (type) {
    case 'setSettings': {
      const cur = await readSettings()
      const next = { ...cur, ...(payload.patch || {}) }
      await writeSettings(next)
      queueDesktopCmd('syncSettings', { settings: next })
      return { settings: next }
    }
    case 'updateCheck': return updateInfo(true)
    case 'updateRun': await doUpdate(); return updateInfo(false)
    case 'send':
    case 'stop':
    case 'approve':
    case 'newSession':
    case 'selectSession':
    case 'setModel':
    case 'setWorkspace':
    case 'spout':
    case 'setPhase': {
      const res = await queueDesktopCmd(type, payload)
      if (type === 'send' || type === 'newSession' || type === 'stop') last = null
      return res
    }
    default:
      throw new Error('unknown command: ' + type)
  }
}

async function handleHttpRequest(req, res) {
  const urlObj = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  const p = urlObj.pathname
  const authed = checkPin(req, urlObj)
  const ip = String(req.socket?.remoteAddress || '').replace(/^::ffff:/, '')

  const sendJson = (code, obj, extraHeaders = {}) => {
    res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extraHeaders })
    res.end(JSON.stringify(obj))
  }

  try {
    if (req.method === 'GET' && (p === '/' || p === '/index.html')) {
      const headers = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }
      if (authed) {
        headers['set-cookie'] = `ja_pin=${encodeURIComponent(currentPin)}; Path=/; SameSite=Lax; Max-Age=2592000`
        if (ip) remoteClients.set(ip, { ip, ua: String(req.headers['user-agent'] || '').slice(0, 120), at: Date.now() })
      }
      res.writeHead(200, headers)
      res.end(POCKET_HTML.replace('__INIT_AUTH__', authed ? 'true' : 'false').replace('__VERSION__', VERSION))
      return
    }
    if (p === '/api/remote/auth') {
      if (req.method === 'POST') {
        const body = JSON.parse((await readReqBody(req)) || '{}')
        if (String(body.pin || '').trim() === currentPin) {
          if (ip) remoteClients.set(ip, { ip, ua: String(req.headers['user-agent'] || '').slice(0, 120), at: Date.now() })
          return sendJson(200, { ok: true, value: { authed: true } }, {
            'set-cookie': `ja_pin=${encodeURIComponent(currentPin)}; Path=/; SameSite=Lax; Max-Age=2592000`,
          })
        }
        return sendJson(401, { ok: false, error: 'PIN 码不正确' })
      }
      return sendJson(200, { ok: true, value: { authed } })
    }
    if (!authed) return sendJson(401, { ok: false, error: '需要输入 6 位配对码或重新扫码' })

    if (ip) remoteClients.set(ip, { ip, ua: String(req.headers['user-agent'] || '').slice(0, 120), at: Date.now() })

    if (req.method === 'GET' && p === '/api/remote/state') {
      setTz(urlObj.searchParams)
      const fresh = urlObj.searchParams.has('fresh')
      const [u, s, upd] = await Promise.all([usage(fresh), readSettings(), updateInfo(false)])
      const sid = urlObj.searchParams.get('sessionId') || liveState.sessionId || u.sessions[0]?.id || ''
      const detail = sid ? await sessionDetail(sid) : null
      return sendJson(200, {
        ok: true,
        value: {
          usage: u,
          settings: s,
          live: { ...liveState, desktopOnline: Date.now() - liveState.at < 8000 },
          detail,
          update: upd,
        },
      })
    }
    if (req.method === 'GET' && p === '/api/remote/report') {
      setTz(urlObj.searchParams)
      const rep = await report(urlObj.searchParams.get('from') || '', urlObj.searchParams.get('to') || '')
      return sendJson(200, { ok: true, value: rep })
    }
    if (req.method === 'POST' && p === '/api/remote/cmd') {
      const body = JSON.parse((await readReqBody(req)) || '{}')
      const out = await handleRemoteCommand(body.type, body.payload || {})
      return sendJson(200, { ok: true, value: out })
    }
    sendJson(404, { ok: false, error: 'Not found' })
  } catch (e) {
    sendJson(500, { ok: false, error: String(e?.message || e) })
  }
}

async function syncRemoteServer(s) {
  s = await ensureRemoteConfig(s)
  const wantEnabled = s.remote !== false
  const wantPort = +s.remotePort || 7788
  if (!wantEnabled) {
    if (httpServer) {
      try { httpServer.close() } catch {}
      httpServer = null; activePort = 0; remoteError = null
    }
    return
  }
  if (httpServer && activePort === wantPort) return
  if (httpServer) {
    try { httpServer.close() } catch {}
    httpServer = null; activePort = 0
  }
  const tryListen = (port, attemptsLeft) => new Promise((resolve) => {
    const srv = createServer((req, res) => { handleHttpRequest(req, res) })
    srv.on('error', (err) => {
      try { srv.close() } catch {}
      if (err.code === 'EADDRINUSE' && attemptsLeft > 0) resolve(tryListen(port + 1, attemptsLeft - 1))
      else { remoteError = String(err.message || err); resolve(false) }
    })
    srv.listen(port, '0.0.0.0', () => {
      httpServer = srv
      activePort = srv.address()?.port || port
      remoteError = null
      resolve(true)
    })
    srv.unref?.()
  })
  await tryListen(wantPort, 8)
}

async function remoteInfo() {
  const s = await ensureRemoteConfig()
  if (s.remote !== false && !httpServer) await syncRemoteServer(s)
  const ips = lanIps()
  const port = activePort || +s.remotePort || 7788
  const pin = currentPin || s.remotePin
  const urls = ips.map((ip) => `http://${ip}:${port}/?k=${pin}`)
  const shortUrls = ips.map((ip) => `http://${ip}:${port}`)
  const now = Date.now()
  const clients = [...remoteClients.values()].filter((c) => now - c.at < 24 * 3600_000).sort((a, b) => b.at - a.at)
  return {
    enabled: s.remote !== false,
    listening: !!httpServer,
    port,
    pin,
    host: hostname(),
    ips,
    urls,
    shortUrls,
    primaryUrl: urls[0] || `http://127.0.0.1:${port}/?k=${pin}`,
    primaryShort: shortUrls[0] || `http://127.0.0.1:${port}`,
    clients,
    error: remoteError,
  }
}

/* ---------------- Pocket Atelier Mobile Web App (Self-Contained HTML) ---------------- */
const POCKET_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<title>Pocket Atelier · 纸与金</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root {
  --canvas:#F4EFE5; --paper:#FAF8F3; --paper-2:#EFEADF; --ink:#2E2A24; --ink-2:#69645A; --ink-3:#A29B8D;
  --line:#E2DACB; --line-2:#D5CAB6; --gold:#A48659; --gold-deep:#7E6440; --gold-soft:rgba(164,134,89,.13); --lamp:#E2A95B;
  --h0:#EAE3D5; --h1:#DDCDAF; --h2:#C9AE82; --h3:#A48659; --h4:#6E5536;
  --f-sans:'Manrope','PingFang SC','Hiragino Sans GB',system-ui,sans-serif;
  --f-serif:'Cormorant Garamond','Songti SC','STSong','Noto Serif SC',serif;
  --f-mono:'SF Mono',ui-monospace,Menlo,monospace;
  --shadow:0 1px 2px rgba(60,45,25,.05),0 10px 26px -14px rgba(60,45,25,.2);
}
@media (prefers-color-scheme: dark) {
  body:not([data-theme="light"]) {
    --canvas:#1C1B19; --paper:#22211E; --paper-2:#282622; --ink:#ECE5D6; --ink-2:#B3AB9B; --ink-3:#7E776A;
    --line:#2E2C28; --line-2:#3A3732; --gold:#C3A574; --gold-deep:#D9BE8E; --gold-soft:rgba(195,165,116,.14); --lamp:#F0C987;
    --h0:#2C2924; --h1:#4A4030; --h2:#6B5A3E; --h3:#A48659; --h4:#E2C690;
    --shadow:0 1px 2px rgba(0,0,0,.35),0 12px 30px -14px rgba(0,0,0,.65);
  }
}
body[data-theme="dark"] {
  --canvas:#1C1B19; --paper:#22211E; --paper-2:#282622; --ink:#ECE5D6; --ink-2:#B3AB9B; --ink-3:#7E776A;
  --line:#2E2C28; --line-2:#3A3732; --gold:#C3A574; --gold-deep:#D9BE8E; --gold-soft:rgba(195,165,116,.14); --lamp:#F0C987;
  --h0:#2C2924; --h1:#4A4030; --h2:#6B5A3E; --h3:#A48659; --h4:#E2C690;
  --shadow:0 1px 2px rgba(0,0,0,.35),0 12px 30px -14px rgba(0,0,0,.65);
}
body[data-pal="ink"] {
  --canvas:#ECF0F1; --paper:#F6F9FA; --paper-2:#E4EBEC; --ink:#222A2D; --ink-2:#5B666A; --ink-3:#8E9A9E;
  --line:#D5E0E2; --line-2:#C0CFD2; --gold:#528B88; --gold-deep:#3B6D6A; --gold-soft:rgba(82,139,136,.13);
  --h0:#DEE7E8; --h1:#BDD1D0; --h2:#8CB4B2; --h3:#528B88; --h4:#325B59;
}
body[data-pal="ink"][data-theme="dark"] {
  --canvas:#181C1E; --paper:#1E2325; --paper-2:#23292C; --ink:#DCE7E9; --ink-2:#9FB0B4; --ink-3:#6B7A7E;
  --line:#293134; --line-2:#343E42; --gold:#73ADA9; --gold-deep:#93C7C3; --gold-soft:rgba(115,173,169,.14);
  --h0:#242C2E; --h1:#314648; --h2:#45686A; --h3:#73ADA9; --h4:#A8D8D4;
}
body[data-pal="cinnabar"] {
  --canvas:#F3ECE6; --paper:#F9F6F4; --paper-2:#EDE4DC; --ink:#2D2825; --ink-2:#685E58; --ink-3:#A0948C;
  --line:#E2D7CE; --line-2:#D4C4B8; --gold:#9C5343; --gold-deep:#783C2F; --gold-soft:rgba(156,83,67,.12);
  --h0:#E8DDD4; --h1:#DABEB4; --h2:#C39284; --h3:#9C5343; --h4:#683125;
}
body[data-pal="cinnabar"][data-theme="dark"] {
  --canvas:#1C1A19; --paper:#22201E; --paper-2:#282422; --ink:#ECE3DC; --ink-2:#B3A69E; --ink-3:#7E726B;
  --line:#2F2B28; --line-2:#3C3632; --gold:#CE715D; --gold-deep:#DC8E7C; --gold-soft:rgba(206,113,93,.14);
  --h0:#2C2624; --h1:#4D3732; --h2:#764D44; --h3:#CE715D; --h4:#E8A596;
}
* { box-sizing:border-box; -webkit-tap-highlight-color:transparent; font-synthesis-style:none; font-variant-numeric:lining-nums tabular-nums; }
html, body { margin:0; padding:0; height:100%; background:var(--canvas); color:var(--ink); font:400 14px/1.55 var(--f-sans); overflow:hidden; -webkit-font-smoothing:antialiased; }
button, input, textarea, select { font:inherit; color:inherit; }
.app { display:flex; flex-direction:column; height:100%; max-width:600px; margin:0 auto; position:relative; }
/* Masthead */
.mast { flex:none; display:flex; align-items:center; justify-content:space-between; gap:10px; padding:calc(env(safe-area-inset-top, 0px) + 10px) 16px 10px; border-bottom:1px solid var(--line); background:var(--canvas); z-index:10; }
.brand { display:flex; align-items:center; gap:9px; }
.mark { width:26px; height:26px; border-radius:50%; border:1px solid var(--gold); display:grid; place-items:center; font:italic 600 15px/1 var(--f-serif); color:var(--gold-deep); }
.bname { display:flex; align-items:baseline; gap:5px; }
.bname b { font:600 18px/1 var(--f-serif); }
.bname span { font:italic 500 13px/1 var(--f-serif); color:var(--ink-3); }
.status-pill { display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border:1px solid var(--line-2); border-radius:999px; background:var(--paper); font:600 10px/1 var(--f-sans); letter-spacing:.12em; text-transform:uppercase; color:var(--ink-2); }
.dot { width:6px; height:6px; border-radius:50%; background:var(--ink-3); }
.dot.on { background:var(--gold); box-shadow:0 0 0 3px var(--gold-soft); }
.dot.run { background:var(--lamp); animation:pulse 1.5s infinite; }
@keyframes pulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.3);opacity:.65} }

/* Content area */
.main { flex:1; overflow-y:auto; overflow-x:hidden; -webkit-overflow-scrolling:touch; padding:12px 16px 20px; display:flex; flex-direction:column; gap:12px; }
.caps { font:600 9.5px/1 var(--f-sans); letter-spacing:.2em; text-transform:uppercase; color:var(--ink-3); }
.rule { flex:1; height:1px; background:var(--line-2); }
.card { background:var(--paper); border:1px solid var(--line-2); border-radius:12px; padding:13px 15px; box-shadow:var(--shadow); }
.btn { display:inline-flex; align-items:center; justify-content:center; gap:6px; border:1px solid var(--line-2); border-radius:999px; background:var(--paper); padding:7px 13px; font:600 12px/1 var(--f-sans); color:var(--ink); cursor:pointer; white-space:nowrap; transition:border-color .2s, background .2s; }
.btn:active { background:var(--gold-soft); border-color:var(--gold); }
.btn-ink { background:var(--ink); color:var(--paper); border-color:var(--ink); }
.btn-ink:active { background:var(--gold-deep); border-color:var(--gold-deep); }
.btn-gold { background:var(--gold-soft); color:var(--gold-deep); border-color:var(--gold); }

/* Chat Tab */
.sbar { display:flex; flex-direction:column; gap:8px; padding:10px 13px; background:var(--paper); border:1px solid var(--line-2); border-radius:11px; box-shadow:var(--shadow); }
.sbar-top { display:flex; align-items:center; justify-content:space-between; gap:8px; }
.sbar-title { font:600 16px/1.25 var(--f-serif); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; }
.sbar-meta { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.pill { display:inline-flex; align-items:center; gap:4px; padding:4px 9px; border:1px solid var(--line); border-radius:999px; background:var(--canvas); font:500 11px/1 var(--f-sans); color:var(--ink-2); cursor:pointer; max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.pill b { color:var(--gold-deep); font-weight:600; }

.chat-flow { display:flex; flex-direction:column; gap:12px; padding-bottom:8px; }
.msg-u { align-self:flex-end; max-width:88%; background:var(--paper); border:1px solid var(--line-2); border-radius:12px; padding:10px 13px; box-shadow:var(--shadow); position:relative; white-space:pre-wrap; word-break:break-word; font-size:13.5px; }
.msg-u::after { content:""; position:absolute; right:-3px; bottom:-3px; width:8px; height:8px; border-right:1px solid var(--gold); border-bottom:1px solid var(--gold); opacity:.7; }
.msg-a { align-self:stretch; display:flex; flex-direction:column; gap:6px; padding:4px 2px; }
.msg-head { display:flex; align-items:center; gap:8px; }
.msg-model { font:italic 600 13px/1 var(--f-serif); color:var(--gold-deep); }
.msg-time { font-size:10.5px; color:var(--ink-3); margin-left:auto; }
.think-box { border-left:1.5px solid var(--gold); padding:2px 0 2px 10px; margin:2px 0; color:var(--ink-3); font-size:12px; line-height:1.5; }
.think-box summary { cursor:pointer; font:600 10.5px/1.4 var(--f-sans); letter-spacing:.12em; text-transform:uppercase; color:var(--gold-deep); list-style:none; }
.tool-list { display:flex; flex-wrap:wrap; gap:5px; margin:2px 0; }
.tool-chip { display:inline-flex; align-items:center; gap:5px; padding:3px 8px; border:1px solid var(--line); border-radius:6px; background:var(--paper-2); font:500 11px/1.2 var(--f-mono); color:var(--ink-2); max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.tool-chip i { font-style:normal; color:var(--gold-deep); font-weight:600; }
.md { font-size:14px; line-height:1.65; color:var(--ink); word-break:break-word; }
.md p { margin:0 0 8px; }
.md p:last-child { margin-bottom:0; }
.md h1, .md h2, .md h3 { font-family:var(--f-serif); font-weight:600; margin:10px 0 4px; line-height:1.25; }
.md pre { margin:8px 0; padding:10px 12px; border:1px solid var(--line-2); border-radius:6px; background:var(--paper); box-shadow:inset 2px 0 0 var(--gold); overflow-x:auto; font:12px/1.5 var(--f-mono); }
.md code { font:12px/1.4 var(--f-mono); background:var(--gold-soft); color:var(--gold-deep); padding:1px 5px; border-radius:4px; }
.md pre code { background:none; color:inherit; padding:0; }
.compaction-sep { display:flex; align-items:center; gap:10px; margin:6px 0; color:var(--ink-3); font:italic 500 12px/1 var(--f-serif); }

/* Approvals banner */
.approve-card { border:1px solid var(--gold); background:var(--paper); border-radius:11px; padding:11px 13px; margin:0 16px 8px; box-shadow:var(--shadow); display:flex; flex-direction:column; gap:8px; }
.approve-btns { display:flex; flex-wrap:wrap; gap:8px; }

/* Composer */
.composer { flex:none; padding:8px 16px 10px; background:var(--canvas); border-top:1px solid var(--line); display:flex; align-items:flex-end; gap:8px; }
.composer textarea { flex:1; min-height:38px; max-height:110px; padding:9px 13px; border:1px solid var(--line-2); border-radius:18px; background:var(--paper); resize:none; outline:none; font-size:14px; line-height:1.4; box-shadow:var(--shadow); }
.composer textarea:focus { border-color:var(--gold); }
.send-btn { width:38px; height:38px; border-radius:50%; border:0; background:var(--ink); color:var(--paper); display:grid; place-items:center; font-size:16px; cursor:pointer; flex:none; }
.send-btn:disabled { opacity:.35; }
.stop-btn { background:#9A4A3C; color:#FAF8F3; }

/* Bottom Nav */
.tabs { flex:none; display:grid; grid-template-columns:repeat(4,1fr); padding:6px 8px calc(env(safe-area-inset-bottom, 0px) + 6px); border-top:1px solid var(--line-2); background:var(--paper); }
.tab { border:0; background:none; padding:6px 4px; display:flex; flex-direction:column; align-items:center; gap:3px; color:var(--ink-3); cursor:pointer; }
.tab b { font:500 14px/1 var(--f-serif); }
.tab small { font:600 9.5px/1 var(--f-sans); letter-spacing:.12em; }
.tab.active { color:var(--gold-deep); }
.tab.active b { font-weight:600; color:var(--ink); }

/* Ledger & Charts */
.stats-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; }
.stat-box { background:var(--paper); border:1px solid var(--line); border-radius:10px; padding:11px 13px; }
.stat-box b { display:block; margin-top:5px; font:500 28px/1 var(--f-serif); color:var(--ink); }
.stat-box b.gold { color:var(--gold-deep); }
.bar-track { height:5px; border-radius:999px; background:var(--h0); overflow:hidden; margin:8px 0 5px; position:relative; }
.bar-fill { position:absolute; inset:0 auto 0 0; background:linear-gradient(90deg,var(--h2),var(--gold)); border-radius:inherit; }
.bar-track.warn .bar-fill { background:linear-gradient(90deg,var(--lamp),#B4573F); }
.spark-hatch { display:flex; align-items:flex-end; gap:4px; height:58px; padding-top:8px; border-bottom:1px solid var(--line-2); }
.spark-hatch i { flex:1; min-height:2px; background:repeating-linear-gradient(-55deg,var(--gold) 0 1px,transparent 1px 3.5px); border-top:1.5px solid var(--gold-deep); cursor:pointer; opacity:.75; transition:opacity .15s; }
.spark-hatch i.active, .spark-hatch i:hover { opacity:1; }
.row-list { display:flex; flex-direction:column; gap:7px; }
.row-item { display:grid; grid-template-columns:minmax(0,1.2fr) 1fr auto; align-items:center; gap:10px; font-size:12.5px; }
.row-item span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:500; }
.hatch-bar { height:7px; border-bottom:1px solid var(--line-2); }
.hatch-bar b { display:block; height:100%; background:repeating-linear-gradient(-55deg,var(--gold) 0 1px,transparent 1px 3.5px); border-right:1px solid var(--gold-deep); }

/* Segmented */
.seg { display:inline-flex; padding:2px; border:1px solid var(--line-2); border-radius:999px; background:var(--canvas); }
.seg button { border:0; background:none; padding:5px 12px; border-radius:999px; font:600 11.5px/1 var(--f-sans); color:var(--ink-3); cursor:pointer; }
.seg button.on { background:var(--ink); color:var(--paper); }

/* Settings / Remote Rows */
.opt-row { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:11px 0; border-bottom:1px solid var(--line); }
.opt-row:last-child { border-bottom:0; }
.opt-row strong { display:block; font:500 16px/1.2 var(--f-serif); }
.opt-row small { display:block; color:var(--ink-3); font-size:11.5px; margin-top:2px; }
.sw { position:relative; width:36px; height:20px; border:1px solid var(--line-2); border-radius:999px; background:transparent; flex:none; cursor:pointer; }
.sw::after { content:""; position:absolute; top:2px; left:2px; width:14px; height:14px; border-radius:50%; background:var(--ink-3); transition:transform .25s; }
.sw.on { background:var(--gold); border-color:var(--gold); }
.sw.on::after { transform:translateX(16px); background:var(--paper); }

/* Lock Screen */
.lock { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; padding:24px; text-align:center; }
.pin-in { width:180px; height:44px; border:0; border-bottom:2px solid var(--gold); background:transparent; font:500 28px/1 var(--f-serif); letter-spacing:.25em; text-align:center; outline:none; margin:16px 0; }
.toast { position:fixed; top:16px; left:50%; transform:translateX(-50%); z-index:999; background:var(--ink); color:var(--paper); padding:8px 16px; border-radius:999px; border:1px solid var(--gold); font-size:12.5px; box-shadow:var(--shadow); pointer-events:none; }
</style>
</head>
<body>
<div id="app" class="app"></div>
<script>
const PRICE_BOOK = [
  [/deepseek.*(flash|chat)/i, [0.3, 0.006, 1.2], "DeepSeek Flash"],
  [/deepseek.*(pro|reason)/i, [0.55, 0.055, 2.2], "DeepSeek Pro"],
  [/claude.*opus/i, [4, 0.2, 20], "Claude Opus"],
  [/claude.*sonnet/i, [2, 0.2, 10], "Claude Sonnet"],
  [/claude.*haiku/i, [0.8, 0.08, 4], "Claude Haiku"],
  [/gpt-6/i, [2, 0.1, 10], "GPT-6"],
  [/gpt/i, [1.25, 0.125, 10], "GPT"],
  [/gemini.*flash/i, [0.75, 0.075, 3.75], "Gemini Flash"],
  [/gemini/i, [2.5, 0.25, 15], "Gemini Pro"],
  [/minimax/i, [0.3, 0.03, 1.2], "MiniMax"],
  [/mimo.*pro/i, [0.435, 0.0036, 0.87], "MiMo Pro"],
  [/mimo/i, [0.2, 0.002, 0.6], "MiMo"],
  [/swe/i, [1.25, 0.125, 10], "SWE"],
  [/kimi|moonshot/i, [0.6, 0.15, 2.5], "Kimi"],
  [/qwen/i, [0.4, 0.08, 1.6], "Qwen"],
];
function priceOf(m, s) {
  const o = s && s.prices && s.prices[m];
  if (Array.isArray(o) && o.length === 3) return o.map(Number);
  for (const [re, p] of PRICE_BOOK) if (re.test(m)) return p;
  return [1, 0.1, 4];
}
const costOf = (m, v, s) => { const p = priceOf(m, s); return (v[0]*p[0] + v[1]*p[1] + v[2]*p[2]) / 1e6; };
const bagCost = (b, s) => Object.entries(b || {}).reduce((a, [m, v]) => a + costOf(m, v, s), 0);
const bagSaved = (b, s) => Object.entries(b || {}).reduce((a, [m, v]) => { const p = priceOf(m, s); return a + (v[1] * Math.max(0, p[0] - p[1])) / 1e6; }, 0);
const bagTokens = (b) => Object.values(b || {}).reduce((a, v) => a + v[0] + v[1] + v[2], 0);
const fmt = (n) => n >= 1e9 ? (n/1e9).toFixed(1)+"B" : n >= 1e6 ? (n >= 1e8 ? Math.round(n/1e6) : (n/1e6).toFixed(1))+"M" : n >= 1e3 ? Math.round(n/1e3)+"K" : String(Math.round(n || 0));
function money(usd, s) {
  const cny = !s || s.currency !== "USD", v = usd * (cny ? +(s?.rate || 7.1) : 1), sym = cny ? "¥" : "$";
  if (v > 0 && v < 0.005) return "<" + sym + "0.01";
  return sym + (v >= 1000 ? Math.round(v).toLocaleString("en-US") : v >= 100 ? v.toFixed(0) : v.toFixed(2));
}
const iso = (d) => d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
const addDays = (k, n) => { const d = new Date(k + "T12:00:00"); d.setDate(d.getDate() + n); return iso(d); };
const monday = (k) => { const d = new Date(k + "T12:00:00"); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return iso(d); };
const monthSpan = (k) => { const d = new Date(k + "T12:00:00"), y = d.getFullYear(), m = d.getMonth(); return [iso(new Date(y, m, 1)), iso(new Date(y, m + 1, 0))]; };
const spanOf = (kind, day) => kind === "month" ? monthSpan(day) : kind === "week" ? [monday(day), addDays(monday(day), 6)] : [day, day];
const base = (p) => (p || "").split(/[\\\\/]/).filter(Boolean).pop() || "—";
const hm = (ms) => { const d = new Date(ms); return String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0"); };
const esc = (s) => String(s || "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

function renderMd(text) {
  if (!text) return "";
  const blocks = String(text).split(/(^\`\`\`[\\s\\S]*?^\`\`\`)/gm);
  return blocks.map((b) => {
    if (b.startsWith("\`\`\`")) {
      const lines = b.split("\\n");
      const code = lines.slice(1, lines[lines.length-1].startsWith("\`\`\`") ? -1 : undefined).join("\\n");
      return "<pre><code>" + esc(code) + "</code></pre>";
    }
    return b.split(/\\n{2,}/).map((p) => {
      p = p.trim(); if (!p) return "";
      if (/^#{1,3}\\s+/.test(p)) { const l = p.match(/^#+/)[0].length; return "<h"+l+">" + esc(p.replace(/^#+\\s+/, "")) + "</h"+l+">"; }
      let html = esc(p).replace(/\`([^\`]+)\`/g, "<code>$1</code>").replace(/\\*\\*([^*]+)\\*\\*/g, "<strong>$1</strong>");
      return "<p>" + html.replace(/\\n/g, "<br>") + "</p>";
    }).join("");
  }).join("");
}

const S = {
  authed: __INIT_AUTH__,
  pin: localStorage.getItem("ja_pin") || "",
  tab: "chat",
  ledgerSub: "ledger",
  sessionId: "",
  wsFilter: "",
  search: "",
  draft: "",
  sparkDay: "",
  noteKind: "day",
  noteDay: iso(new Date()),
  report: null,
  data: null,
  sending: false,
  toastMsg: "",
};

try {
  const u = new URL(location.href);
  const k = u.searchParams.get("k") || u.searchParams.get("pin");
  if (k) { S.pin = k; localStorage.setItem("ja_pin", k); S.authed = true; u.searchParams.delete("k"); u.searchParams.delete("pin"); history.replaceState(null, "", u.pathname + u.search); }
} catch {}

function showToast(msg) {
  S.toastMsg = msg; render();
  setTimeout(() => { if (S.toastMsg === msg) { S.toastMsg = ""; render(); } }, 2600);
}

async function apiFetch(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (S.pin) headers["x-atelier-pin"] = S.pin;
  const r = await fetch(path, { ...opts, headers, cache: "no-store" });
  const j = await r.json().catch(() => null);
  if (r.status === 401) { S.authed = false; render(); throw new Error((j && j.error) || "需要配对码"); }
  if (!j || !j.ok) throw new Error((j && j.error) || ("HTTP " + r.status));
  return j.value;
}

async function pollState(fresh) {
  if (!S.authed) return;
  try {
    const q = new URLSearchParams({ tz: String(new Date().getTimezoneOffset()) });
    if (S.sessionId) q.set("sessionId", S.sessionId);
    if (fresh) q.set("fresh", "1");
    const v = await apiFetch("/api/remote/state?" + q.toString());
    S.data = v;
    if (!S.sessionId && (v.live?.sessionId || v.detail?.id)) S.sessionId = v.live?.sessionId || v.detail?.id;
    const pal = v.settings?.palette || "atelier";
    if (document.body.dataset.pal !== pal) document.body.dataset.pal = pal;
    render();
  } catch (e) { console.warn(e); }
}

async function loadReport() {
  if (!S.authed) return;
  const [from, to] = spanOf(S.noteKind, S.noteDay);
  try {
    S.report = await apiFetch("/api/remote/report?from=" + from + "&to=" + to + "&tz=" + new Date().getTimezoneOffset());
    render();
  } catch (e) { showToast(e.message); }
}

async function sendCmd(type, payload = {}, msg = "") {
  try {
    S.sending = true; render();
    await apiFetch("/api/remote/cmd", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type, payload }) });
    if (msg) showToast(msg);
    await pollState(true);
  } catch (e) { showToast(e.message || "发送失败"); }
  finally { S.sending = false; render(); }
}

window.__act = {
  login: async (e) => {
    e.preventDefault();
    const inp = document.getElementById("pin-in");
    const pin = (inp ? inp.value : "").trim();
    if (!pin) return;
    try {
      await apiFetch("/api/remote/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pin }) });
      S.pin = pin; localStorage.setItem("ja_pin", pin); S.authed = true;
      pollState(true);
    } catch (err) { showToast(err.message || "配对码错误"); }
  },
  setTab: (t) => { S.tab = t; if (t === "ledger" && S.ledgerSub === "gazette" && !S.report) loadReport(); render(); },
  setLedgerSub: (sub) => { S.ledgerSub = sub; if (sub === "gazette" && !S.report) loadReport(); render(); },
  selectSession: async (id, title) => {
    S.sessionId = id; S.tab = "chat"; render();
    await sendCmd("selectSession", { sessionId: id, title }, "已切换至「" + (title || "会话") + "」");
  },
  newSession: async () => {
    const cwd = S.wsFilter || S.data?.live?.cwd || "";
    await sendCmd("newSession", { cwd }, "已在桌面端开启新会话");
    S.sessionId = "";
    setTimeout(() => pollState(true), 400);
  },
  sendChat: async () => {
    const ta = document.getElementById("chat-in");
    const text = (ta ? ta.value : S.draft).trim();
    if (!text) return;
    S.draft = ""; if (ta) ta.value = "";
    await sendCmd("send", { sessionId: S.sessionId, text }, "已发送至桌面端");
    setTimeout(() => { const m = document.querySelector(".main"); if (m) m.scrollTop = m.scrollHeight; }, 100);
  },
  stopChat: () => sendCmd("stop", {}, "已发送停止指令"),
  approve: (index, label) => sendCmd("approve", { index, label }, "已执行：" + label),
  pickModel: async () => {
    const models = S.data?.live?.models?.length ? S.data.live.models : Object.keys(S.data?.usage?.models || {});
    if (!models.length) return showToast("暂无可选模型列表");
    const m = prompt("输入或选择要切换的模型：\\n" + models.join(" / "), S.data?.live?.model || models[0]);
    if (m && m.trim()) await sendCmd("setModel", { model: m.trim() }, "已请求切换模型：" + m.trim());
  },
  pickWs: async () => {
    const wss = [...new Set((S.data?.usage?.sessions || []).map((x) => x.cwd).filter(Boolean))];
    if (!wss.length) return;
    const list = wss.map((w, i) => (i + 1) + ". " + base(w) + " (" + w + ")").join("\\n");
    const pick = prompt("输入序号切换工作区或新建会话：\\n" + list, "1");
    const idx = parseInt(pick, 10) - 1;
    if (wss[idx]) { S.wsFilter = wss[idx]; await sendCmd("setWorkspace", { cwd: wss[idx], name: base(wss[idx]) }, "工作区：" + base(wss[idx])); }
  },
  setNoteKind: (k) => { S.noteKind = k; loadReport(); },
  stepNote: (dir) => {
    const step = S.noteKind === "month" ? 30 : S.noteKind === "week" ? 7 : 1;
    const next = addDays(S.noteDay, dir * step);
    const today = iso(new Date());
    S.noteDay = next > today ? today : next;
    loadReport();
  },
  openDayNote: (k) => { S.tab = "ledger"; S.ledgerSub = "gazette"; S.noteKind = "day"; S.noteDay = k; loadReport(); },
  setPalette: (p) => { document.body.dataset.pal = p; sendCmd("setSettings", { patch: { palette: p } }, "主题已切换"); },
  toggleOpt: (k) => { const cur = S.data?.settings?.[k] !== false; sendCmd("setSettings", { patch: { [k]: !cur } }); },
  setPhase: (ph) => sendCmd("setPhase", { phase: ph }, "铜版天象：" + ph),
  spout: () => sendCmd("spout", {}, "🐋 桌面端鲸鱼已喷水！"),
  setBudget: (v) => { const n = Number(v); if (Number.isFinite(n) && n >= 0) sendCmd("setSettings", { patch: { budget: n } }, "预算已保存"); },
  setCurrency: (c) => sendCmd("setSettings", { patch: { currency: c } }, "币种：" + c),
  updCheck: () => sendCmd("updateCheck", {}, "已检查更新"),
  updRun: () => sendCmd("updateRun", {}, "正在后台下载更新…"),
};

function render() {
  const root = document.getElementById("app");
  if (!root) return;
  const activeEl = document.activeElement;
  if (activeEl && activeEl.id === "chat-in") S.draft = activeEl.value;

  if (!S.authed) {
    root.innerHTML = \`
      <div class="lock">
        <div class="mark" style="width:48px;height:48px;font-size:26px;margin-bottom:14px">J</div>
        <div class="caps">Pocket Atelier · 局域网遥控</div>
        <h2 style="font:500 32px/1.15 var(--f-serif);margin:8px 0 4px">Paper, ink & <em>gold.</em></h2>
        <p style="color:var(--ink-2);font-size:13px;max-width:260px;margin:0">请输入电脑端「设置 › Atelier › Pocket Atelier」中显示的 6 位配对码，或直接用手机相机扫描二维码。</p>
        <form onsubmit="__act.login(event)">
          <input id="pin-in" class="pin-in" inputmode="numeric" maxlength="6" placeholder="••••••" autofocus>
          <div><button type="submit" class="btn btn-ink" style="padding:10px 28px;font-size:13px">连接桌面端 ›</button></div>
        </form>
      </div>
      \${S.toastMsg ? \`<div class="toast">\${esc(S.toastMsg)}</div>\` : ""}\`;
    return;
  }

  const d = S.data || {}, u = d.usage || {}, s = d.settings || {}, live = d.live || {}, det = d.detail || null, upd = d.update || {};
  const dispName = (s.name || u.user || "Jules").trim();
  const initial = Array.from(dispName)[0]?.toUpperCase() || "J";
  const todayIso = u.today || iso(new Date()), monthPrefix = todayIso.slice(0, 7);
  const daysRaw = u.days || {}, dayCost = {}, dayTok = {};
  for (const [k, bag] of Object.entries(daysRaw)) { dayCost[k] = bagCost(bag, s); dayTok[k] = bagTokens(bag); }
  const todayCost = dayCost[todayIso] || 0, todayTok = dayTok[todayIso] || 0;
  const monthCost = Object.entries(dayCost).filter(([k]) => k.startsWith(monthPrefix)).reduce((a, [, v]) => a + v, 0);
  const totalCost = bagCost(u.models || {}, s), totalSaved = bagSaved(u.models || {}, s), totalTok = bagTokens(u.models || {});
  const running = !!(live.running || det?.running);

  let bodyHtml = "";
  if (S.tab === "chat") {
    const curTitle = det?.title || live.title || "新会话 · Fresh Sheet";
    const curCwd = base(det?.cwd || live.cwd || S.wsFilter);
    const curModel = det?.model || live.model || "Model";
    const curCost = det ? bagCost(det.by, s) : 0;
    const ctxPct = det?.ctxWin ? Math.min(100, Math.round((det.ctxUsed / det.ctxWin) * 100)) : 0;
    const msgs = det?.messages?.length ? det.messages : (live.domMessages || []);
    const streamTxt = live.sessionId && (!det || live.sessionId === det.id) ? live.streamText : "";
    const approvals = live.approvals || [];

    bodyHtml = \`
      <div class="sbar">
        <div class="sbar-top">
          <div class="sbar-title" onclick="__act.setTab('sessions')">\${esc(curTitle)} <span style="color:var(--ink-3);font-size:13px">▾</span></div>
          <button class="btn btn-gold" style="padding:5px 11px;font-size:11.5px" onclick="__act.newSession()">+ 新会话</button>
        </div>
        <div class="sbar-meta">
          <span class="pill" onclick="__act.pickWs()">📁 <b>\${esc(curCwd)}</b></span>
          <span class="pill" onclick="__act.pickModel()">◆ <b>\${esc(curModel)}</b></span>
          <span class="pill" onclick="__act.setTab('ledger')">账本 <b>\${money(curCost, s)}</b>\${ctxPct ? \` · \${ctxPct}%\` : ""}</span>
        </div>
      </div>
      <div class="chat-flow">
        \${msgs.length === 0 ? \`
          <div class="card" style="text-align:center;padding:28px 16px;color:var(--ink-2)">
            <div class="caps" style="color:var(--gold-deep);margin-bottom:6px">A Fresh Sheet</div>
            <div style="font:italic 500 20px/1.3 var(--f-serif);color:var(--ink)">一张新纸，从手机端落笔。</div>
            <p style="font-size:12.5px;color:var(--ink-3);margin:6px 0 0">在下方输入内容并发送，桌面端 DeepSeek Harness 会立即开始执行并实时回传进度。</p>
          </div>
        \` : msgs.map((m) => {
          if (m.role === "compaction") return \`<div class="compaction-sep"><i class="rule"></i><span>上下文已压缩 · Context Compacted</span><i class="rule"></i></div>\`;
          if (m.role === "user") return \`<div class="msg-u">\${esc(m.text)}</div>\`;
          return \`
            <div class="msg-a">
              <div class="msg-head">
                <span class="msg-model">\${esc(m.model || "Assistant")}</span>
                \${m.tokens ? \`<span class="caps">\${fmt(m.tokens)} tok</span>\` : ""}
                \${m.time ? \`<span class="msg-time">\${hm(m.time)}</span>\` : ""}
              </div>
              \${m.thinking ? \`<details class="think-box"><summary>Thinking · 思考过程</summary><div>\${esc(m.thinking)}</div></details>\` : ""}
              \${m.tools && m.tools.length ? \`<div class="tool-list">\${m.tools.map((t) => \`<span class="tool-chip"><i>\${esc(t.name)}</i> \${esc(t.summary || "")}</span>\`).join("")}</div>\` : ""}
              <div class="md">\${renderMd(m.text)}</div>
            </div>\`;
        }).join("")}
        \${running ? \`
          <div class="card" style="border-color:var(--gold);padding:10px 13px">
            <div style="display:flex;align-items:center;gap:8px;color:var(--gold-deep);font:600 11px/1 var(--f-sans);letter-spacing:.14em;text-transform:uppercase">
              <span class="dot run"></span> 桌面端正在思考与执行…
            </div>
            \${streamTxt ? \`<div class="md" style="margin-top:8px">\${renderMd(streamTxt)}</div>\` : ""}
          </div>
        \` : ""}
      </div>\`;
  } else if (S.tab === "sessions") {
    const allSessions = u.sessions || [];
    const wss = [...new Set(allSessions.map((x) => x.cwd).filter(Boolean))];
    const filtered = allSessions.filter((x) => (!S.wsFilter || x.cwd === S.wsFilter) && (!S.search || (x.title + " " + x.ask + " " + x.cwd).toLowerCase().includes(S.search.toLowerCase())));
    bodyHtml = \`
      <div style="display:flex;gap:8px;align-items:center">
        <input style="flex:1;height:34px;padding:0 12px;border:1px solid var(--line-2);border-radius:999px;background:var(--paper);outline:none" placeholder="搜索会话标题、提问或目录…" value="\${esc(S.search)}" oninput="S.search=this.value;render()">
        <button class="btn btn-ink" onclick="__act.newSession()">+ 新建</button>
      </div>
      <div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:4px">
        <button class="btn \${!S.wsFilter ? 'btn-gold' : ''}" style="padding:5px 11px;font-size:11px" onclick="S.wsFilter='';render()">全部 (\${allSessions.length})</button>
        \${wss.map((w) => \`<button class="btn \${S.wsFilter === w ? 'btn-gold' : ''}" style="padding:5px 11px;font-size:11px" onclick="S.wsFilter=\${JSON.stringify(w).replace(/"/g, '&quot;')};render()">📁 \${esc(base(w))}</button>\`).join("")}
      </div>
      <div style="display:flex;flex-direction:column;gap:9px">
        \${filtered.slice(0, 40).map((x) => {
          const active = x.id === S.sessionId, c = bagCost(x.by, s), tok = bagTokens(x.by);
          return \`
            <div class="card" style="cursor:pointer;\${active ? 'border-color:var(--gold);box-shadow:0 0 0 2px var(--gold-soft)' : ''}" onclick="__act.selectSession('\${esc(x.id)}', \${JSON.stringify(x.title || '会话').replace(/"/g, '&quot;')})">
              <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">
                <b style="font:600 16px/1.25 var(--f-serif);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">\${x.running ? '🟢 ' : ''}\${esc(x.title || "Untitled")}</b>
                <span style="font:600 12.5px/1 var(--f-serif);color:var(--gold-deep)">\${money(c, s)}</span>
              </div>
              \${x.ask ? \`<p style="margin:5px 0;font-size:12.5px;color:var(--ink-2);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">\${esc(x.ask)}</p>\` : ""}
              <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px;font-size:11px;color:var(--ink-3)">
                <span>📁 \${esc(base(x.cwd))}</span>
                \${x.model ? \`<span>· \${esc(x.model)}</span>\` : ""}
                <span>· \${x.turns || 0} 轮</span>
                \${x.files ? \`<span>· 改 \${x.files} 文件</span>\` : ""}
                <span>· \${fmt(tok)} tok</span>
              </div>
            </div>\`;
        }).join("")}
      </div>\`;
  } else if (S.tab === "ledger") {
    const last14 = [];
    for (let i = 13; i >= 0; i--) { const k = addDays(todayIso, -i); last14.push([k, dayCost[k] || 0, dayTok[k] || 0]); }
    const max14 = Math.max(1e-9, ...last14.map((x) => x[1]));
    const selDay = S.sparkDay || todayIso;
    const budgetRef = s.budget > 0 ? s.budget / (s.currency === "CNY" ? +(s.rate || 7.1) : 1) : (totalCost / Math.max(1, Object.keys(daysRaw).length)) * 1.5;
    const budgetRatio = budgetRef > 0 ? todayCost / budgetRef : 0;

    if (S.ledgerSub === "gazette") {
      const rep = S.report;
      const [from, to] = spanOf(S.noteKind, S.noteDay);
      const repTok = rep ? bagTokens(rep.models) : 0, repCost = rep ? bagCost(rep.models, s) : 0;
      const repTurns = rep ? (rep.sessions || []).reduce((a, x) => a + (x.turns || 0), 0) : 0;
      bodyHtml = \`
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div class="seg">
            <button class="\${S.ledgerSub==='ledger'?'on':''}" onclick="__act.setLedgerSub('ledger')">账本 · Ledger</button>
            <button class="\${S.ledgerSub==='gazette'?'on':''}" onclick="__act.setLedgerSub('gazette')">小记 · Gazette</button>
          </div>
          <div class="seg">
            <button class="\${S.noteKind==='day'?'on':''}" onclick="__act.setNoteKind('day')">日报</button>
            <button class="\${S.noteKind==='week'?'on':''}" onclick="__act.setNoteKind('week')">周报</button>
            <button class="\${S.noteKind==='month'?'on':''}" onclick="__act.setNoteKind('month')">月报</button>
          </div>
        </div>
        <div class="card" style="padding:18px 16px">
          <div style="text-align:center">
            <div class="caps">The \${S.noteKind === "month" ? "Monthly" : S.noteKind === "week" ? "Weekly" : "Daily"} Note</div>
            <div style="display:flex;align-items:center;justify-content:center;gap:14px;margin:8px 0">
              <button class="btn" style="padding:4px 10px" onclick="__act.stepNote(-1)">‹</button>
              <h3 style="margin:0;font:500 24px/1.15 var(--f-serif)">\${from === to ? from : from + " – " + to}</h3>
              <button class="btn" style="padding:4px 10px" onclick="__act.stepNote(1)">›</button>
            </div>
          </div>
          \${!rep ? \`<p style="text-align:center;color:var(--ink-3)">正在翻阅小记…</p>\` : \`
            <div style="display:grid;grid-template-columns:repeat(4,1fr);text-align:center;border-top:1px solid var(--line-2);border-bottom:1px solid var(--line-2);padding:8px 0;margin:10px 0">
              <div><small class="caps">会话</small><div style="font:500 20px var(--f-serif);margin-top:3px">\${rep.sessions.length}</div></div>
              <div><small class="caps">轮次</small><div style="font:500 20px var(--f-serif);margin-top:3px">\${repTurns}</div></div>
              <div><small class="caps">Tokens</small><div style="font:500 20px var(--f-serif);margin-top:3px">\${fmt(repTok)}</div></div>
              <div><small class="caps">花费</small><div style="font:500 20px var(--f-serif);margin-top:3px;color:var(--gold-deep)">\${money(repCost, s)}</div></div>
            </div>
            \${rep.sessions.length === 0 ? \`<p style="text-align:center;font:italic 15px var(--f-serif);color:var(--ink-2)">这一期很安静，没有留下记录。</p>\` : \`
              <div class="caps" style="color:var(--gold-deep);margin:12px 0 6px">What Got Done · 工作总结</div>
              <div style="display:flex;flex-direction:column;gap:8px">
                \${rep.sessions.slice(0, 8).map((x) => \`
                  <div style="padding:8px 0;border-bottom:1px dotted var(--line-2);cursor:pointer" onclick="__act.selectSession('\${esc(x.id)}', \${JSON.stringify(x.title||'会话').replace(/"/g,'&quot;')})">
                    <div style="display:flex;justify-content:space-between;gap:8px">
                      <b style="font:500 15px var(--f-serif)">\${esc(x.title || "Untitled")}</b>
                      <small style="color:var(--ink-3)">\${esc(base(x.cwd))} · \${x.turns} 轮</small>
                    </div>
                    \${x.w?.asks?.[0] ? \`<div style="font-size:12px;color:var(--ink-2);margin-top:3px"><b style="color:var(--gold)">问</b> \${esc(x.w.asks[0][1].slice(0, 80))}</div>\` : ""}
                    \${x.w?.files?.length ? \`<div style="font-size:11.5px;color:var(--ink-3);margin-top:2px"><b style="color:var(--gold)">改</b> \${x.w.files.length} 个文件</div>\` : ""}
                  </div>\`).join("")}
              </div>
            \`}
          \`}
        </div>\`;
    } else {
      const models = Object.entries(u.models || {}).sort((a, b) => costOf(b[0], b[1], s) - costOf(a[0], a[1], s));
      const maxMod = models[0] ? costOf(models[0][0], models[0][1], s) : 1;
      bodyHtml = \`
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div class="seg">
            <button class="on" onclick="__act.setLedgerSub('ledger')">账本 · Ledger</button>
            <button onclick="__act.setLedgerSub('gazette')">小记 · Gazette</button>
          </div>
          <span class="caps">缓存已省 \${money(totalSaved, s)}</span>
        </div>
        <div class="stats-grid">
          <div class="stat-box"><span class="caps">Today · 今日</span><b class="gold">\${money(todayCost, s)}</b><small style="color:var(--ink-3);font-size:11px">\${fmt(todayTok)} tokens</small></div>
          <div class="stat-box"><span class="caps">Month · 本月</span><b>\${money(monthCost, s)}</b><small style="color:var(--ink-3);font-size:11px">累计 \${money(totalCost, s)}</small></div>
        </div>
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:baseline">
            <span class="caps">14-Day Ledger · \${selDay}</span>
            <b style="font:600 13px var(--f-serif);color:var(--gold-deep)" onclick="__act.openDayNote('\${selDay}')">\${money(dayCost[selDay] || 0, s)} · \${fmt(dayTok[selDay] || 0)} tok · 读日报 ›</b>
          </div>
          <div class="spark-hatch">
            \${last14.map(([k, v]) => \`<i class="\${k === selDay ? 'active' : ''}" style="height:\${Math.max(5, (v / max14) * 100)}%" onclick="S.sparkDay='\${k}';render()"></i>\`).join("")}
          </div>
          <div class="bar-track \${s.budget > 0 && budgetRatio > 1 ? 'warn' : ''}">
            <div class="bar-fill" style="width:\${Math.min(100, budgetRatio * 100)}%"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--ink-3)">
            <span>今日 \${money(todayCost, s)}</span>
            <span>\${s.budget > 0 ? "每日预算 " + money(budgetRef, s) : "对比日均"}</span>
          </div>
        </div>
        <div class="card">
          <div class="caps" style="margin-bottom:10px">By Model · 模型花费排行</div>
          <div class="row-list">
            \${models.slice(0, 8).map(([m, v]) => {
              const c = costOf(m, v, s);
              return \`<div class="row-item"><span>\${esc(m)}</span><div class="hatch-bar"><b style="width:\${Math.max(3, (c / (maxMod || 1)) * 100)}%"></b></div><b>\${money(c, s)}</b></div>\`;
            }).join("")}
          </div>
        </div>\`;
    }
  } else if (S.tab === "atelier") {
    const pal = s.palette || "atelier";
    const ph = live.phase || "auto";
    bodyHtml = \`
      <div class="card">
        <div class="caps" style="color:var(--gold-deep);margin-bottom:8px">Whale Plate Remote · 桌面铜版遥控</div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:6px 0 12px;border-bottom:1px solid var(--line)">
          <div>
            <strong style="font:500 17px var(--f-serif)">呼唤鲸鱼喷水</strong>
            <small style="display:block;color:var(--ink-3);font-size:11.5px">立即让电脑屏幕上的铜版鲸鱼喷起水柱</small>
          </div>
          <button class="btn btn-ink" onclick="__act.spout()">🐋 喷水</button>
        </div>
        <div style="padding-top:10px">
          <div class="caps" style="margin-bottom:8px">Time of Day · 铜版天象</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            \${[["auto","随时间"],["dawn","清晨"],["day","白昼"],["dusk","傍晚"],["night","深夜"],["snow","落雪"]].map(([k, l]) => \`
              <button class="btn \${ph === k ? 'btn-gold' : ''}" style="padding:6px 11px;font-size:11.5px" onclick="__act.setPhase('\${k}')">\${l}</button>
            \`).join("")}
          </div>
        </div>
      </div>
      <div class="card">
        <div class="caps" style="color:var(--gold-deep);margin-bottom:4px">Appearance · 纸色与外观</div>
        <div class="opt-row">
          <div><strong>Palette · 纸色</strong><small>桌面与手机端同步切换</small></div>
          <div class="seg">
            \${[["atelier","纸与金"],["ink","墨与青"],["cinnabar","楮与朱"]].map(([k, l]) => \`
              <button class="\${pal === k ? 'on' : ''}" onclick="__act.setPalette('\${k}')">\${l}</button>
            \`).join("")}
          </div>
        </div>
        \${[
          ["skin", "Atelier Skin", "全局纸色、金线与衬线排版"],
          ["sea", "Conversation Sea", "会话背景里的木刻海面、海鸥与游鲸"],
          ["icons", "Engraved Icons", "38 枚手绘细线描金图标"],
          ["paper", "Paper Grain", "极淡的宣纸纹理衬底"],
          ["timeOfDay", "Time of Day", "首页铜版随时间与节气变化"],
        ].map(([k, t, desc]) => \`
          <div class="opt-row">
            <div><strong>\${t}</strong><small>\${desc}</small></div>
            <button class="sw \${s[k] !== false ? 'on' : ''}" onclick="__act.toggleOpt('\${k}')"></button>
          </div>
        \`).join("")}
      </div>
      <div class="card">
        <div class="caps" style="color:var(--gold-deep);margin-bottom:4px">Budget & Updates · 预算与更新</div>
        <div class="opt-row">
          <div><strong>Currency · 币种</strong><small>当前汇率 $1 = ¥\${s.rate || 7.1}</small></div>
          <div class="seg">
            \${["CNY", "USD"].map((c) => \`<button class="\${s.currency === c ? 'on' : ''}" onclick="__act.setCurrency('\${c}')">\${c}</button>\`).join("")}
          </div>
        </div>
        <div class="opt-row">
          <div><strong>Daily Budget · 每日预算</strong><small>0 表示不设上限（对比日均）</small></div>
          <input style="width:80px;height:30px;border:1px solid var(--line-2);border-radius:6px;background:var(--canvas);text-align:right;padding:0 8px" type="number" value="\${s.budget || 0}" onchange="__act.setBudget(this.value)">
        </div>
        <div class="opt-row">
          <div><strong>Version · v\${upd.current || "__VERSION__"}</strong><small>\${upd.pending ? "已下载 v" + upd.pending + "，重启生效" : upd.available ? "发现新版本 v" + upd.latest : "已是最新版本"}</small></div>
          \${upd.available && !upd.pending
            ? \`<button class="btn btn-ink" onclick="__act.updRun()">更新 v\${upd.latest}</button>\`
            : \`<button class="btn" onclick="__act.updCheck()">检查更新</button>\`}
        </div>
      </div>\`;
  }

  const approvals = live.approvals || [];
  const approvalHtml = S.tab === "chat" && approvals.length ? \`
    <div class="approve-card">
      <div class="caps" style="color:var(--gold-deep)">Approval Required · 桌面端等待确认</div>
      <div class="approve-btns">
        \${approvals.map((a) => \`<button class="btn btn-ink" onclick="__act.approve(\${a.index}, \${JSON.stringify(a.label).replace(/"/g, '&quot;')})">\${esc(a.label)}</button>\`).join("")}
      </div>
    </div>\` : "";

  const composerHtml = S.tab === "chat" ? \`
    <div class="composer">
      <textarea id="chat-in" rows="1" placeholder="在手机上输入指令，发送至桌面端…" oninput="S.draft=this.value" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();__act.sendChat();}">\${esc(S.draft)}</textarea>
      \${running ? \`<button class="send-btn stop-btn" title="停止生成" onclick="__act.stopChat()">■</button>\` : ""}
      <button class="send-btn" title="发送" onclick="__act.sendChat()">↑</button>
    </div>\` : "";

  root.innerHTML = \`
    <header class="mast">
      <div class="brand">
        <span class="mark">\${esc(initial)}</span>
        <span class="bname"><b>\${esc(dispName)}</b><span>Atelier · Pocket</span></span>
      </div>
      <div class="status-pill" onclick="pollState(true)">
        <span class="dot \${running ? 'run' : live.desktopOnline ? 'on' : ''}"></span>
        <span>\${running ? "思考中" : live.desktopOnline ? "桌面在线" : "本地账本"}</span>
      </div>
    </header>
    <main class="main">\${bodyHtml}</main>
    \${approvalHtml}
    \${composerHtml}
    <nav class="tabs">
      <button class="tab \${S.tab==='chat'?'active':''}" onclick="__act.setTab('chat')"><b>对话</b><small>CHAT</small></button>
      <button class="tab \${S.tab==='sessions'?'active':''}" onclick="__act.setTab('sessions')"><b>会话</b><small>SESSIONS</small></button>
      <button class="tab \${S.tab==='ledger'?'active':''}" onclick="__act.setTab('ledger')"><b>账本</b><small>LEDGER</small></button>
      <button class="tab \${S.tab==='atelier'?'active':''}" onclick="__act.setTab('atelier')"><b>工坊</b><small>ATELIER</small></button>
    </nav>
    \${S.toastMsg ? \`<div class="toast">\${esc(S.toastMsg)}</div>\` : ""}\`;
}

render();
if (S.authed) pollState(false);
setInterval(() => { if (!document.hidden && S.authed) pollState(false); }, 2200);
</script>
</body>
</html>`

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
      path: '/api/jules-atelier.session', methods: ['GET'], requestBody: 'buffered',
      fetch: (req) => wrap(() => { const q = new URL(req.url).searchParams; setTz(q); return sessionDetail(q.get('id') || '') }),
    }), 'jules-atelier: /api/jules-atelier.session')
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
    ctx.effect(() => ctx.connection.fetch.register({
      path: '/api/jules-atelier.bridge', methods: ['POST'], requestBody: 'buffered',
      fetch: (req) => wrap(async () => {
        const body = (await req.json().catch(() => null)) || {}
        if (body.live && typeof body.live === 'object') {
          liveState = { ...liveState, ...body.live, at: Date.now() }
        }
        if (Array.isArray(body.ack)) {
          for (const id of body.ack) {
            const fn = cmdWaiters.get(id)
            if (fn) { cmdWaiters.delete(id); fn({ ok: true, executed: true, live: liveState }) }
          }
        }
        const cmds = cmdQueue.splice(0, cmdQueue.length)
        return { cmds, at: Date.now() }
      }),
    }), 'jules-atelier: /api/jules-atelier.bridge')
    ctx.effect(() => ctx.connection.fetch.register({
      path: '/api/jules-atelier.remote', methods: ['GET', 'POST'], requestBody: 'buffered',
      fetch: (req) => wrap(async () => {
        if (req.method === 'GET') return remoteInfo()
        const body = (await req.json().catch(() => null)) || {}
        if (body.action === 'resetPin' || body.resetPin) {
          const s = await readSettings()
          s.remotePin = genPin()
          currentPin = s.remotePin
          await writeSettings(s)
          remoteClients.clear()
        } else if (body.action === 'toggle' || typeof body.enabled === 'boolean') {
          const s = await readSettings()
          s.remote = !!body.enabled
          await writeSettings(s)
        } else if (body.action === 'setPort' || body.port !== undefined) {
          const p = +body.port
          if (Number.isFinite(p) && (p === 0 || (p >= 1024 && p <= 65535))) {
            const s = await readSettings()
            s.remotePort = p || 7788
            await writeSettings(s)
          }
        }
        return remoteInfo()
      }),
    }), 'jules-atelier: /api/jules-atelier.remote')
    ctx.effect(() => {
      syncRemoteServer().catch((e) => console.warn('[jules-atelier] remote server failed:', e?.message || e))
      const first = setTimeout(autoTick, 30_000), every = setInterval(autoTick, 12 * 3600_000)
      first.unref?.(); every.unref?.()
      return () => {
        clearTimeout(first); clearInterval(every)
        if (httpServer) { try { httpServer.close() } catch {}; httpServer = null; activePort = 0 }
      }
    }, 'jules-atelier: auto-update & remote')
  })
}
