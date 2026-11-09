// dsh-jules-atelier — host half: local ledger over session logs + atelier settings + Pocket Atelier LAN remote.
import { readdir, stat, readFile, writeFile, mkdir, rename, rm, cp } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname, sep } from 'node:path'
import { homedir, userInfo, networkInterfaces, hostname } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
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
  try {
    if (liveRootCtx) {
      const mod = await import(pathToFileURL(join(PLUGIN_DIR, 'lib/index.js')).href + '?t=' + Date.now())
      mod.apply?.(liveRootCtx)
    }
  } catch {}
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
    case 'openSplit':
    case 'closeSplit':
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
    if (p === '/favicon.ico' || p.startsWith('/apple-touch-icon')) {
      res.writeHead(204)
      res.end()
      return
    }
    if (req.method === 'GET' && !p.startsWith('/api/')) {
      const headers = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }
      if (authed) {
        headers['set-cookie'] = `ja_pin=${encodeURIComponent(currentPin)}; Path=/; SameSite=Lax; Max-Age=2592000`
        if (ip) remoteClients.set(ip, { ip, ua: String(req.headers['user-agent'] || '').slice(0, 120), at: Date.now() })
      }
      res.writeHead(200, headers)
      res.end(POCKET_HTML.replace('__INIT_AUTH__', authed ? 'true' : 'false').replace('__VERSION__', VERSION))
      return
    }
    if (p === '/api/remote/auth' || p === '/api/auth') {
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

    if (req.method === 'GET' && (p === '/api/remote/state' || p === '/api/state')) {
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
    if (req.method === 'GET' && (p === '/api/remote/report' || p === '/api/report')) {
      setTz(urlObj.searchParams)
      const rep = await report(urlObj.searchParams.get('from') || '', urlObj.searchParams.get('to') || '')
      return sendJson(200, { ok: true, value: rep })
    }
    if (req.method === 'POST' && (p === '/api/remote/cmd' || p === '/api/cmd')) {
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
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500;1,600&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root {
  --canvas:#F4EFE5; --paper:#FAF8F3; --paper-2:#EFEADF; --ink:#2E2A24; --ink-2:#69645A; --ink-3:#A29B8D;
  --line:#E2DACB; --line-2:#D5CAB6; --gold:#A48659; --gold-deep:#7E6440; --gold-soft:rgba(164,134,89,.13); --lamp:#E2A95B;
  --h0:#EAE3D5; --h1:#DDCDAF; --h2:#C9AE82; --h3:#A48659; --h4:#6E5536;
  --f-sans:'Manrope','PingFang SC','Hiragino Sans GB',system-ui,sans-serif;
  --f-serif:'Cormorant Garamond','Songti SC','STSong','Noto Serif SC',serif;
  --f-mono:'SF Mono',ui-monospace,Menlo,monospace;
  --shadow:0 1px 2px rgba(60,45,25,.05),0 10px 26px -14px rgba(60,45,25,.2);
  --whale:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 23.16 17.04'><path d='M22.9168 1.43018C22.6713 1.31018 22.5658 1.53918 22.4223 1.65519C22.3733 1.69269 22.3318 1.74169 22.2903 1.78669C21.9317 2.1697 21.5127 2.42121 20.9657 2.39121C20.1657 2.34621 19.4827 2.59771 18.8787 3.20973C18.7502 2.45521 18.3236 2.0047 17.6746 1.71569C17.3351 1.56568 16.9916 1.41518 16.7536 1.08867C16.5876 0.856163 16.5421 0.597155 16.4591 0.341647C16.4061 0.187643 16.3536 0.0301382 16.1761 0.00363739C15.9836 -0.0263635 15.9081 0.135141 15.8326 0.270145C15.5306 0.822162 15.4136 1.43018 15.4251 2.0462C15.4516 3.43174 16.0366 4.53527 17.1991 5.3203C17.3311 5.4103 17.3651 5.5003 17.3236 5.63181C17.2441 5.90231 17.1501 6.16482 17.0671 6.43533C17.0141 6.60784 16.9351 6.64584 16.7501 6.57033C16.1121 6.30383 15.5611 5.90931 15.074 5.4328C14.2475 4.63328 13.5 3.75075 12.568 3.05973C12.349 2.89822 12.13 2.74822 11.9034 2.60522C10.9524 1.68169 12.028 0.923165 12.277 0.833162C12.5375 0.739159 12.3675 0.41615 11.5259 0.42015C10.6844 0.42365 9.91439 0.705658 8.93286 1.08117C8.78935 1.13767 8.63835 1.17867 8.48384 1.21267C7.59332 1.04367 6.66829 1.00617 5.70226 1.11517C3.88321 1.31768 2.43016 2.1777 1.36213 3.64575C0.0790928 5.4103 -0.222916 7.41536 0.146595 9.50642C0.535106 11.7105 1.66014 13.535 3.38869 14.9616C5.18125 16.4406 7.24581 17.1657 9.60138 17.0266C11.0319 16.9441 12.6245 16.7526 14.421 15.2321C14.874 15.4576 15.3496 15.5476 16.1381 15.6151C16.7456 15.6716 17.3306 15.5851 17.7836 15.4911C18.4931 15.3411 18.4441 14.6841 18.1876 14.5636C16.1081 13.595 16.5646 13.9891 16.1496 13.67C17.2061 12.42 18.8202 10.1979 19.3182 7.17235C19.3672 6.83834 19.4297 6.36783 19.4222 6.09732C19.4182 5.93231 19.4562 5.86831 19.6447 5.84931C20.1657 5.78931 20.6712 5.64681 21.1357 5.3913C22.4833 4.65528 23.0268 3.44624 23.1548 1.9972C23.1738 1.77569 23.1508 1.54668 22.9168 1.43018Z'/></svg>");
  --grain:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .35  0 0 0 0 .27  0 0 0 0 .16  0 0 0 .028 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
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
html, body { margin:0; padding:0; height:100%; background-color:var(--canvas); background-image:var(--grain); color:var(--ink); font:400 13.5px/1.6 var(--f-sans); overflow:hidden; -webkit-font-smoothing:antialiased; }
button, input, textarea, select { font:inherit; color:inherit; }
.app { display:flex; flex-direction:column; height:100%; max-width:620px; margin:0 auto; position:relative; }
.caps { font:600 9.5px/1 var(--f-sans); letter-spacing:.2em; text-transform:uppercase; color:var(--ink-3); }
.rule { flex:1; height:1px; background:var(--line-2); }

/* Editorial Masthead */
.mast { flex:none; padding:calc(env(safe-area-inset-top, 0px) + 8px) 16px 8px; background:var(--canvas); border-bottom:1px solid var(--line-2); box-shadow:inset 0 -3px 0 var(--canvas), inset 0 -4px 0 var(--line); z-index:10; }
.dl { display:flex; align-items:center; gap:8px; margin-bottom:6px; }
.dl-btn { border:0; background:none; padding:0; font:italic 500 12.5px/1 var(--f-serif); color:var(--gold-deep); cursor:pointer; }
.mast-row { display:flex; align-items:center; justify-content:space-between; gap:10px; }
.brand { display:flex; align-items:center; gap:9px; min-width:0; }
.mark { flex:none; width:26px; height:26px; border-radius:50%; border:1px solid var(--gold); display:grid; place-items:center; font:italic 600 15px/1 var(--f-serif); color:var(--gold-deep); position:relative; }
.mark::after { content:""; position:absolute; inset:2px; border-radius:50%; border:1px solid var(--line-2); opacity:.55; }
.bname { display:flex; align-items:baseline; gap:6px; min-width:0; }
.bname b { font:600 19px/1 var(--f-serif); letter-spacing:-.01em; color:var(--ink); }
.bname span { font:italic 400 13.5px/1 var(--f-serif); color:var(--ink-3); }
.status-chip { display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border:1px solid var(--line-2); border-radius:999px; background:var(--paper); font:600 9.5px/1 var(--f-sans); letter-spacing:.14em; text-transform:uppercase; color:var(--ink-2); cursor:pointer; }
.dot { width:6px; height:6px; border-radius:50%; background:var(--ink-3); flex:none; }
.dot.on { background:var(--gold); box-shadow:0 0 0 3px var(--gold-soft); }
.dot.run { background:var(--lamp); animation:pulse 1.5s infinite; }
@keyframes pulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.35);opacity:.6} }

/* Ornate Whale Divider */
.orn { display:flex; align-items:center; gap:10px; margin:6px auto; width:56%; color:var(--gold); }
.orn i { flex:1; height:0; border-top:1px solid var(--line-2); position:relative; }
.orn i::after { content:""; position:absolute; left:0; right:0; top:2px; border-top:1px solid var(--line); }
.orn-whale { flex:none; width:14px; height:11px; background:currentColor; -webkit-mask:var(--whale) center/contain no-repeat; mask:var(--whale) center/contain no-repeat; }

/* Copperplate Whale Plate */
.plate { position:relative; width:100%; height:136px; border-top:1px solid var(--line-2); border-bottom:1px solid var(--line-2); margin:2px 0 6px; overflow:hidden; cursor:pointer; }
.plate::before, .plate::after { content:""; position:absolute; left:0; right:0; height:1px; background:var(--line); pointer-events:none; }
.plate::before { top:3px; }
.plate::after { bottom:3px; }
.plate canvas { display:block; width:100%; height:100%; }
.plate-tag { position:absolute; top:7px; left:2px; font:italic 400 11.5px/1 var(--f-serif); color:var(--ink-3); background:rgba(244,239,229,.7); padding:2px 6px; border-radius:3px; }
body[data-theme="dark"] .plate-tag { background:rgba(28,27,25,.7); }
.plate-tag b { font-weight:600; color:var(--gold-deep); font-style:normal; }
.hero-line { margin:2px 0 8px; text-align:center; font:400 21px/1.2 var(--f-serif); color:var(--ink); }
.hero-line em { font-style:italic; color:var(--gold-deep); }

/* Main Scrollable Folio */
.main { flex:1; overflow-y:auto; overflow-x:hidden; -webkit-overflow-scrolling:touch; padding:10px 16px 18px; display:flex; flex-direction:column; gap:10px; }

/* Broadsheet & Bookplate Containers */
.sheet { position:relative; padding:16px 18px 14px; border:1px solid var(--line-2); border-radius:4px; background:var(--paper); box-shadow:inset 0 0 0 4px var(--paper), inset 0 0 0 5px var(--line), var(--shadow); }
.sh { display:flex; align-items:baseline; gap:10px; margin:14px 0 2px; padding-bottom:6px; border-bottom:1px solid var(--line-2); }
.sh:first-child { margin-top:2px; }
.sh-no { font:italic 500 13px/1 var(--f-serif); color:var(--gold-deep); min-width:16px; }
.sh h5 { margin:0; font:600 10px/1 var(--f-sans); letter-spacing:.2em; text-transform:uppercase; color:var(--ink-2); }
.sh small { font:400 11.5px/1 var(--f-sans); color:var(--ink-3); }

/* Buttons & Controls */
.btn { display:inline-flex; align-items:center; justify-content:center; gap:5px; border:1px solid var(--line-2); border-radius:999px; background:var(--paper); padding:6px 12px; font:600 11.5px/1 var(--f-sans); color:var(--ink); cursor:pointer; white-space:nowrap; transition:border-color .2s, background .2s; }
.btn:active { background:var(--gold-soft); border-color:var(--gold); }
.btn-ink { background:var(--ink); color:var(--paper); border-color:var(--ink); }
.btn-ink:active { background:var(--gold-deep); border-color:var(--gold-deep); }
.btn-gold { background:var(--gold-soft); color:var(--gold-deep); border-color:var(--gold); }
.seg { display:inline-flex; padding:2px; border:1px solid var(--line-2); border-radius:999px; background:transparent; }
.seg button { border:0; background:none; padding:4px 10px; border-radius:999px; font:600 11px/1 var(--f-sans); color:var(--ink-3); cursor:pointer; }
.seg button.on { background:var(--ink); color:var(--paper); }

/* Rubric Session Header in Folio I */
.rubric { display:flex; flex-direction:column; gap:6px; padding:8px 0 9px; border-bottom:1px solid var(--line-2); position:relative; }
.rubric::after { content:""; position:absolute; left:0; right:0; bottom:2px; border-bottom:1px solid var(--line); pointer-events:none; }
.rubric-top { display:flex; align-items:baseline; justify-content:space-between; gap:8px; }
.rubric-title { font:500 19px/1.2 var(--f-serif); color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; cursor:pointer; }
.rubric-meta { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.r-pill { display:inline-flex; align-items:center; gap:4px; padding:3px 9px; border:1px solid var(--line-2); border-radius:999px; background:var(--paper); font:500 11px/1 var(--f-sans); color:var(--ink-2); cursor:pointer; max-width:155px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.r-pill b { color:var(--gold-deep); font-weight:600; }

/* Manuscript Dialogue */
.chat-flow { display:flex; flex-direction:column; gap:14px; padding:4px 0 8px; }
.msg-u { align-self:flex-end; max-width:88%; background:var(--paper); border:1px solid var(--line-2); border-radius:4px 12px 12px 12px; padding:10px 14px; box-shadow:var(--shadow); position:relative; white-space:pre-wrap; word-break:break-word; font-size:13.5px; color:var(--ink); }
.msg-u::before, .msg-u::after { content:""; position:absolute; width:6px; height:6px; border-color:var(--gold); border-style:solid; pointer-events:none; opacity:.75; }
.msg-u::before { top:3px; left:3px; border-width:1px 0 0 1px; }
.msg-u::after { bottom:3px; right:3px; border-width:0 1px 1px 0; }
.msg-a { align-self:stretch; display:flex; flex-direction:column; gap:6px; padding:2px 0 10px; border-bottom:1px dotted var(--line-2); }
.msg-a:last-child { border-bottom:0; }
.msg-head { display:flex; align-items:baseline; gap:8px; }
.msg-model { font:italic 600 14px/1 var(--f-serif); color:var(--gold-deep); }
.msg-time { font-size:10px; color:var(--ink-3); margin-left:auto; }
.think-box { border-left:1.5px solid var(--gold); padding:2px 0 2px 10px; margin:2px 0; color:var(--ink-3); font-size:12px; line-height:1.55; }
.think-box summary { cursor:pointer; font:600 9.5px/1.4 var(--f-sans); letter-spacing:.16em; text-transform:uppercase; color:var(--gold-deep); list-style:none; }
.tool-list { display:flex; flex-wrap:wrap; gap:5px; margin:2px 0; }
.tool-chip { display:inline-flex; align-items:center; gap:5px; padding:2px 8px; border:1px solid var(--line-2); border-radius:3px; background:var(--paper); font:500 10.5px/1.3 var(--f-mono); color:var(--ink-2); max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.tool-chip i { font-style:normal; color:var(--gold-deep); font-weight:600; }
.md { font-size:14px; line-height:1.68; color:var(--ink); word-break:break-word; }
.md p { margin:0 0 8px; }
.md p:last-child { margin-bottom:0; }
.md h1, .md h2, .md h3 { font-family:var(--f-serif); font-weight:600; margin:10px 0 4px; line-height:1.25; }
.md pre { margin:8px 0; padding:10px 12px; border:1px solid var(--line-2); border-radius:4px; background:var(--paper); box-shadow:inset 2px 0 0 var(--gold); overflow-x:auto; font:11.5px/1.5 var(--f-mono); }
.md code { font:12px/1.4 var(--f-mono); background:var(--gold-soft); color:var(--gold-deep); padding:1px 5px; border-radius:3px; }
.md pre code { background:none; color:inherit; padding:0; }
.compaction-sep { display:flex; align-items:center; gap:10px; margin:6px 0; color:var(--ink-3); font:italic 500 12px/1 var(--f-serif); }

/* Approvals Banner */
.approve-card { border:1px solid var(--gold); background:var(--paper); border-radius:4px; padding:10px 14px; margin:0 16px 8px; box-shadow:inset 0 0 0 3px var(--paper), inset 0 0 0 4px var(--line), var(--shadow); display:flex; flex-direction:column; gap:8px; }
.approve-btns { display:flex; flex-wrap:wrap; gap:8px; }

/* Atelier Composer Dock */
.composer-wrap { flex:none; padding:6px 16px 8px; background:var(--canvas); border-top:1px solid var(--line-2); }
.composer-box { display:flex; flex-direction:column; gap:6px; padding:8px 10px 7px 12px; border:1px solid var(--line-2); border-radius:12px; background:var(--paper); box-shadow:var(--shadow); }
.composer-box:focus-within { border-color:var(--gold); box-shadow:0 0 0 3px var(--gold-soft), var(--shadow); }
.composer-box textarea { width:100%; min-height:24px; max-height:96px; padding:0; border:0; background:transparent; resize:none; outline:none; font:400 14px/1.45 var(--f-sans); color:var(--ink); }
.composer-dock { display:flex; align-items:center; justify-content:space-between; gap:8px; padding-top:2px; }
.chip { display:inline-flex; align-items:center; gap:5px; height:22px; padding:0 8px 0 6px; border:1px solid var(--line); border-radius:999px; background:var(--canvas); font:500 11px/1 var(--f-sans); color:var(--ink-2); cursor:pointer; }
.coin { width:13px; height:13px; border-radius:50%; border:1px solid var(--gold); display:grid; place-items:center; font:italic 600 9px/1 var(--f-serif); color:var(--gold-deep); }
.send-btn { height:26px; padding:0 12px; border-radius:999px; border:1px solid var(--ink); background:var(--ink); color:var(--paper); font:600 11px/1 var(--f-sans); letter-spacing:.06em; cursor:pointer; display:inline-flex; align-items:center; gap:4px; }
.stop-btn { background:#8E4436; border-color:#8E4436; color:#FAF8F3; }

/* Figures, Spark, Heatmap & Roman Lists */
.figs { display:grid; grid-template-columns:repeat(4,1fr); border-top:1px solid var(--line-2); border-bottom:1px solid var(--line-2); margin:8px 0; }
.figs > div { display:flex; flex-direction:column; align-items:center; gap:4px; padding:8px 4px; text-align:center; }
.figs > div + div { border-left:1px solid var(--line); }
.figs b { font:500 20px/1 var(--f-serif); color:var(--ink); }
.figs b.gold { color:var(--gold-deep); }
.figs small { font-size:8.5px; }
.lede { margin:8px auto; text-align:center; font:italic 500 15px/1.55 var(--f-serif); color:var(--ink); }
.spark { display:flex; align-items:flex-end; gap:3px; height:52px; padding-top:6px; border-bottom:1px solid var(--line-2); }
.spark i { flex:1; min-height:2px; background:repeating-linear-gradient(-55deg,var(--gold) 0 1px,transparent 1px 3.5px); border-top:1.5px solid var(--gold-deep); cursor:pointer; opacity:.72; }
.spark i.active { opacity:1; background:var(--gold); }
.bar { position:relative; height:5px; border-radius:999px; background:var(--h0); overflow:hidden; margin:8px 0 4px; }
.bar i { position:absolute; inset:0 auto 0 0; background:linear-gradient(90deg,var(--h2),var(--gold)); border-radius:inherit; }
.bar.warn i { background:linear-gradient(90deg,var(--lamp),#B4573F); }
.hb { display:block; height:7px; border-bottom:1px solid var(--line-2); }
.hb b { display:block; height:100%; background:repeating-linear-gradient(-55deg,var(--gold) 0 1px,transparent 1px 3.5px); border-right:1px solid var(--gold-deep); }
.ws-list { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:7px; }
.ws-list li { display:grid; grid-template-columns:minmax(0,1.2fr) 1fr auto; align-items:center; gap:10px; font-size:12px; }
.ws-list span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:600; }
.ws-list small { color:var(--ink-3); font-size:11px; white-space:nowrap; }
.heat-grid { display:grid; grid-auto-flow:column; grid-template-rows:repeat(7,1fr); grid-auto-columns:1fr; gap:2.5px; width:100%; margin:6px 0 2px; }
.heat-grid i { aspect-ratio:1; border-radius:1.5px; background:var(--h0); }
.done { list-style:none; margin:0; padding:0; counter-reset:dn; }
.done li { counter-increment:dn; position:relative; padding:9px 0 10px 26px; border-bottom:1px dotted var(--line-2); }
.done li:last-child { border-bottom:0; }
.done li::before { content:counter(dn,upper-roman); position:absolute; left:0; top:10px; font:italic 500 13px/1.2 var(--f-serif); color:var(--gold-deep); }
.dh { display:flex; align-items:baseline; justify-content:space-between; gap:8px; margin-bottom:3px; }
.dh b { font:500 15.5px/1.25 var(--f-serif); color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dh small { flex:none; font-size:10.5px; color:var(--ink-3); }
.done p { display:flex; gap:7px; margin:2px 0 0; font-size:12px; line-height:1.5; color:var(--ink-2); }
.done p i { flex:none; font:600 9.5px/1.8 var(--f-sans); font-style:normal; color:var(--gold); }

/* Hairline Options (Folio IV) */
.opt { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:11px 0 11px 24px; border-bottom:1px solid var(--line); }
.opt:last-child { border-bottom:0; }
.opt strong { display:block; font:500 16px/1.2 var(--f-serif); color:var(--ink); }
.opt small { display:block; margin-top:2px; color:var(--ink-3); font-size:11.5px; line-height:1.45; }
.sw { position:relative; width:34px; height:18px; border:1px solid var(--line-2); border-radius:999px; background:transparent; flex:none; cursor:pointer; }
.sw::after { content:""; position:absolute; top:2px; left:2px; width:12px; height:12px; border-radius:50%; background:var(--ink-3); transition:transform .25s; }
.sw.on { background:var(--gold); border-color:var(--gold); }
.sw.on::after { transform:translateX(16px); background:var(--paper); }

/* Bottom Editorial Folio Navigation */
.tabs { flex:none; display:grid; grid-template-columns:repeat(4,1fr); padding:4px 8px calc(env(safe-area-inset-bottom, 0px) + 5px); border-top:1px solid var(--line-2); background:var(--paper); box-shadow:inset 0 2px 0 var(--paper), inset 0 3px 0 var(--line); }
.tab { border:0; background:none; padding:6px 4px; display:flex; flex-direction:column; align-items:center; gap:2px; color:var(--ink-3); cursor:pointer; position:relative; }
.tab em { font:italic 500 10.5px/1 var(--f-serif); color:var(--gold-deep); opacity:.7; }
.tab b { font:500 14.5px/1.1 var(--f-serif); color:var(--ink-2); }
.tab small { font:600 8.5px/1 var(--f-sans); letter-spacing:.16em; }
.tab.active b { font-weight:600; color:var(--ink); }
.tab.active em { opacity:1; }
.tab.active::before { content:""; position:absolute; top:-4px; left:24%; right:24%; height:2px; background:var(--gold); }

/* Ex Libris Lock Screen */
.lock { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; padding:24px; text-align:center; }
.pin-in { width:180px; height:42px; border:0; border-bottom:1.5px solid var(--gold); background:transparent; font:500 28px/1 var(--f-serif); letter-spacing:.25em; text-align:center; outline:none; margin:14px 0; color:var(--ink); }
.toast { position:fixed; top:14px; left:50%; transform:translateX(-50%); z-index:999; background:var(--paper); color:var(--ink); padding:8px 16px; border-radius:4px; border:1px solid var(--line-2); border-left:3px solid var(--gold-deep); font:500 12.5px/1.4 var(--f-sans); box-shadow:var(--shadow); pointer-events:none; }
</style>
</head>
<body>
<div id="app" class="app"></div>
<script>
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const WEEK = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const ROMAN = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"];
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
  theme: localStorage.getItem("ja_theme") || "auto",
  tab: "chat",
  ledgerSub: "gazette",
  showPlate: false,
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
  spoutAt: 0,
};

function applyTheme() {
  if (S.theme === "light" || S.theme === "dark") document.body.dataset.theme = S.theme;
  else delete document.body.dataset.theme;
}
applyTheme();

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

/* Copperplate ASCII Whale & Sea Engine for Mobile */
const WHALE_ART = [
  "          .---~~~~---.          ",
  "       .-~   _...._   ~-.    .. ",
  "     .~   .-~      ~-.   ~..~  ~",
  "    /   .~            ~.   \\/  /",
  "   /   /   (o)          \\     / ",
  "  ;   ;   _..---.._      ;---~  ",
  "   \\   \\~          ~-.__/       ",
  "    ~-._~-..________..-~        ",
];
function drawPlate() {
  const cv = document.getElementById("whale-cv");
  if (!cv) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = cv.clientWidth || 320, H = cv.clientHeight || 136;
  if (cv.width !== W * dpr || cv.height !== H * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
  const ctx = cv.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const cs = getComputedStyle(document.body);
  const ink = cs.getPropertyValue("--ink").trim() || "#2E2A24";
  const gold = cs.getPropertyValue("--gold").trim() || "#A48659";
  const mono = cs.getPropertyValue("--f-mono").trim() || "monospace";
  ctx.font = "600 8px " + mono;
  ctx.textBaseline = "top";
  const cw = ctx.measureText("M").width || 4.8, ch = 9;
  const cols = Math.floor(W / cw), rows = Math.floor(H / ch);
  const t = performance.now() / 1000;
  const hz = Math.floor(rows * 0.56);
  // Sun / Moon disc on right
  const sx = Math.floor(cols * 0.8), sy = Math.floor(hz * 0.45);
  ctx.fillStyle = gold; ctx.globalAlpha = 0.55;
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -6; dx <= 6; dx++) {
      const dist = Math.hypot(dx * 0.55, dy);
      if (dist <= 3.1) ctx.fillText(dist < 1.8 ? "#" : "=", (sx + dx) * cw, (sy + dy) * ch);
    }
  }
  // Horizon & woodcut waves
  for (let y = hz; y < rows; y++) {
    const yy = (y - hz) / Math.max(1, rows - hz);
    for (let x = 0; x < cols; x++) {
      const wv = Math.sin(x * 0.22 + t * 1.6 + y * 0.7) + Math.cos(x * 0.11 - t * 1.1);
      if (y === hz || wv > 0.75) {
        const glint = Math.abs(x - sx) < 8;
        ctx.fillStyle = glint ? gold : ink;
        ctx.globalAlpha = glint ? 0.55 : (0.14 + yy * 0.22);
        ctx.fillText(wv > 1.2 ? "~" : "-", x * cw, y * ch);
      }
    }
  }
  // Whale silhouette in center
  const wx = Math.floor(cols * 0.5 - 16), wy = Math.floor(hz - 5 + Math.sin(t * 1.5) * 0.6);
  for (let r = 0; r < WHALE_ART.length; r++) {
    const line = WHALE_ART[r];
    for (let c = 0; c < line.length; c++) {
      const chr = line[c];
      if (chr === " ") continue;
      ctx.fillStyle = chr === "o" ? gold : ink;
      ctx.globalAlpha = chr === "o" ? 0.95 : 0.78;
      ctx.fillText(chr, (wx + c) * cw, (wy + r) * ch);
    }
  }
  // Spout mist when active or tapped
  const spouting = (Date.now() - S.spoutAt < 3500) || !!(S.data?.live?.running) || (Math.sin(t * 0.7) > 0.65);
  if (spouting) {
    ctx.fillStyle = gold; ctx.globalAlpha = 0.78;
    const bx = wx + 12, by = wy - 1;
    const phase = (t * 4) % 3;
    ctx.fillText(":", bx * cw, by * ch);
    ctx.fillText("'", (bx - 1) * cw, (by - 1 - Math.floor(phase * 0.5)) * ch);
    ctx.fillText(".", (bx + 1) * cw, (by - 1 - Math.floor(phase * 0.5)) * ch);
    ctx.fillText("*", (bx - 2) * cw, (by - 2) * ch);
    ctx.fillText("*", (bx + 2) * cw, (by - 2) * ch);
  }
  ctx.globalAlpha = 1;
}
setInterval(() => { if (!document.hidden && document.getElementById("whale-cv")) drawPlate(); }, 120);

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
  togglePlate: () => { S.showPlate = !S.showPlate; render(); },
  selectSession: async (id, title) => {
    S.sessionId = id; S.tab = "chat"; render();
    await sendCmd("selectSession", { sessionId: id, title }, "已展卷「" + (title || "会话") + "」");
  },
  openInSplit: async (id, cwd) => {
    await sendCmd("openSplit", { sessionId: id || S.sessionId, cwd: cwd || S.wsFilter }, "已在桌面端并置展开多卷分屏");
  },
  closeSplit: async () => {
    await sendCmd("closeSplit", {}, "桌面端已收回单屏独览");
  },
  newSession: async (cwdOverride) => {
    const cwd = cwdOverride !== undefined ? cwdOverride : (S.wsFilter || S.data?.live?.cwd || "");
    await sendCmd("newSession", { cwd }, "已在桌面端展新纸");
    S.sessionId = "";
    setTimeout(() => pollState(true), 450);
  },
  sendChat: async () => {
    const ta = document.getElementById("chat-in");
    const text = (ta ? ta.value : S.draft).trim();
    if (!text) return;
    S.draft = ""; if (ta) ta.value = "";
    await sendCmd("send", { sessionId: S.sessionId, text }, "已落笔传至桌面端");
    setTimeout(() => { const m = document.querySelector(".main"); if (m) m.scrollTop = m.scrollHeight; }, 100);
  },
  stopChat: () => sendCmd("stop", {}, "已发送收笔中断指令"),
  approve: (index, label) => sendCmd("approve", { index, label }, "已批阅：" + label),
  pickModel: async () => {
    const models = S.data?.live?.models?.length ? S.data.live.models : Object.keys(S.data?.usage?.models || {});
    if (!models.length) return showToast("暂无可选模型列表");
    const m = prompt("输入或选择要切换的模型：\\n" + models.join(" / "), S.data?.live?.model || models[0]);
    if (m && m.trim()) await sendCmd("setModel", { model: m.trim() }, "模型：" + m.trim());
  },
  pickWs: async () => {
    const wss = [...new Set((S.data?.usage?.sessions || []).map((x) => x.cwd).filter(Boolean))];
    if (!wss.length) return;
    const list = wss.map((w, i) => ROMAN[i] + ". " + base(w) + " (" + w + ")").join("\\n");
    const pick = prompt("输入序号切换项目（Workspace）：\\n" + list, "1");
    const idx = parseInt(pick, 10) - 1;
    if (wss[idx]) { S.wsFilter = wss[idx]; await sendCmd("setWorkspace", { cwd: wss[idx], name: base(wss[idx]) }, "已切至项目：" + base(wss[idx])); }
  },
  setNoteKind: (k) => { S.noteKind = k; S.ledgerSub = "gazette"; loadReport(); },
  stepNote: (dir) => {
    const step = S.noteKind === "month" ? 30 : S.noteKind === "week" ? 7 : 1;
    const next = addDays(S.noteDay, dir * step);
    const today = iso(new Date());
    S.noteDay = next > today ? today : next;
    loadReport();
  },
  openDayNote: (k) => { S.tab = "ledger"; S.ledgerSub = "gazette"; S.noteKind = "day"; S.noteDay = k; loadReport(); },
  setPalette: (p) => { document.body.dataset.pal = p; sendCmd("setSettings", { patch: { palette: p } }, "纸色已切换"); },
  setTheme: (m) => { S.theme = m; localStorage.setItem("ja_theme", m); applyTheme(); render(); },
  toggleOpt: (k) => { const cur = S.data?.settings?.[k] !== false; sendCmd("setSettings", { patch: { [k]: !cur } }); },
  setPhase: (ph) => sendCmd("setPhase", { phase: ph }, "铜版时辰：" + ph),
  cyclePhase: () => {
    const order = ["auto", "dawn", "day", "dusk", "night", "snow"];
    const cur = S.data?.live?.phase || "auto";
    const next = order[(order.indexOf(cur) + 1) % order.length];
    sendCmd("setPhase", { phase: next }, "Plate XII · " + next);
  },
  spout: () => { S.spoutAt = Date.now(); drawPlate(); sendCmd("spout", {}, "🐋 铜版鲸鱼已喷水"); },
  setBudget: (v) => { const n = Number(v); if (Number.isFinite(n) && n >= 0) sendCmd("setSettings", { patch: { budget: n } }, "预算已保存"); },
  setCurrency: (c) => sendCmd("setSettings", { patch: { currency: c } }, "币种：" + c),
  updCheck: () => sendCmd("updateCheck", {}, "已检查更新"),
  updRun: () => sendCmd("updateRun", {}, "正在后台下载更新…"),
};

function render() {
  const root = document.getElementById("app");
  if (!root) return;
  const activeEl = document.activeElement;
  const activeId = activeEl && activeEl.id;
  if (activeId === "chat-in") S.draft = activeEl.value;
  if (activeId === "pin-in" && !S.authed) return;
  const prevMain = root.querySelector(".main");
  const prevScroll = prevMain ? prevMain.scrollTop : 0;

  if (!S.authed) {
    root.innerHTML = \`
      <div class="lock">
        <div class="sheet" style="width:100%;max-width:340px;padding:22px 20px">
          <div class="caps" style="color:var(--gold-deep)">Ex Libris · Pocket Atelier</div>
          <h2 style="font:500 30px/1.15 var(--f-serif);margin:8px 0 4px">Paper, ink & <em>gold.</em></h2>
          <div class="orn"><i></i><span class="orn-whale"></span><i></i></div>
          <div class="plate" style="height:108px;margin:8px 0" onclick="S.spoutAt=Date.now();drawPlate()">
            <canvas id="whale-cv"></canvas>
            <span class="plate-tag">Plate <b>XII</b> · Ex Libris</span>
          </div>
          <p style="color:var(--ink-2);font-size:12.5px;margin:8px 0 4px">请输入电脑端「Pocket Atelier 藏书票」上的 6 位配对码，或直接用手机相机扫描铜版藏书票二维码。</p>
          <form onsubmit="__act.login(event)">
            <input id="pin-in" class="pin-in" inputmode="numeric" maxlength="6" placeholder="••••••" autofocus>
            <div><button type="submit" class="btn btn-ink" style="padding:8px 26px;font-size:12.5px">展卷入室 ›</button></div>
          </form>
        </div>
      </div>
      \${S.toastMsg ? \`<div class="toast">\${esc(S.toastMsg)}</div>\` : ""}\`;
    requestAnimationFrame(drawPlate);
    return;
  }

  const d = S.data || {}, u = d.usage || {}, s = d.settings || {}, live = d.live || {}, det = d.detail || null, upd = d.update || {};
  const dispName = (s.name || u.user || "Jules").trim();
  const initial = Array.from(dispName)[0]?.toUpperCase() || "J";
  const now = new Date();
  const todayIso = u.today || iso(now), monthPrefix = todayIso.slice(0, 7);
  const daysRaw = u.days || {}, dayCost = {}, dayTok = {};
  for (const [k, bag] of Object.entries(daysRaw)) { dayCost[k] = bagCost(bag, s); dayTok[k] = bagTokens(bag); }
  const todayCost = dayCost[todayIso] || 0, todayTok = dayTok[todayIso] || 0;
  const monthCost = Object.entries(dayCost).filter(([k]) => k.startsWith(monthPrefix)).reduce((a, [, v]) => a + v, 0);
  const totalCost = bagCost(u.models || {}, s), totalSaved = bagSaved(u.models || {}, s), totalTok = bagTokens(u.models || {});
  const running = !!(live.running || det?.running);
  const phase = live.phase || "auto";
  const phaseLabel = { auto: "Auto · 随辰", dawn: "Dawn · 晨", day: "Noon · 昼", dusk: "Dusk · 暮", night: "Night · 夜", snow: "Snow · 雪" }[phase] || "Noon";

  let bodyHtml = "";
  if (S.tab === "chat") {
    const curTitle = det?.title || live.title || "新会话 · Fresh Sheet";
    const curCwd = base(det?.cwd || live.cwd || S.wsFilter);
    const curModel = det?.model || live.model || "DeepSeek";
    const msgs = det?.messages?.length ? det.messages : (live.domMessages || []);
    const streamTxt = live.sessionId && (!det || live.sessionId === det.id) ? live.streamText : "";
    const showHeroPlate = msgs.length === 0 || S.showPlate;

    bodyHtml = \`
      <div class="rubric">
        <div class="rubric-top">
          <div class="rubric-title" onclick="__act.setTab('sessions')">\${esc(curTitle)} <span style="color:var(--gold-deep);font-size:13px">▾</span></div>
          <button class="btn" style="padding:4px 9px;font-size:10.5px" onclick="__act.togglePlate()">\${showHeroPlate ? "收起铜版" : "展卷观鲸"}</button>
          <button class="btn btn-gold" style="padding:4px 10px;font-size:11px" onclick="__act.newSession()">+ 新纸</button>
        </div>
        <div class="rubric-meta">
          <span class="r-pill" onclick="__act.pickWs()">项目 <b>\${esc(curCwd)}</b> ▾</span>
          <span class="r-pill" onclick="__act.pickModel()">模型 <b>\${esc(curModel)}</b> ▾</span>
          <span class="r-pill" onclick="\${live.splitActive ? '__act.closeSplit()' : '__act.openInSplit()'}">桌面 <b>\${live.splitActive ? "多卷同览中 (" + (live.splitCount || 2) + ")" : "并置分屏 ›"}</b></span>
        </div>
      </div>
      \${showHeroPlate ? \`
        <div class="plate" onclick="__act.spout()">
          <canvas id="whale-cv"></canvas>
          <span class="plate-tag" onclick="event.stopPropagation();__act.cyclePhase()">Plate <b>XII</b> · \${esc(phaseLabel)}</span>
        </div>
        <p class="hero-line">Good day, \${esc(dispName)} — <em>one piece at a time.</em></p>
      \` : ""}
      <div class="chat-flow">
        \${msgs.length === 0 ? \`
          <div class="sheet" style="text-align:center;padding:20px 16px">
            <div class="caps" style="color:var(--gold-deep)">Folio I · Fresh Manuscript</div>
            <div class="orn"><i></i><span class="orn-whale"></span><i></i></div>
            <p class="lede" style="margin:6px auto 4px">一张温润的新纸，从掌中落笔。</p>
            <p style="font-size:12px;color:var(--ink-3);margin:0">在下方书写指令，电脑端 DeepSeek Harness 将即刻执行并实时同步手稿；亦可轻点上方铜版召唤鲸鱼喷水。</p>
          </div>
        \` : msgs.map((m) => {
          if (m.role === "compaction") return \`<div class="compaction-sep"><i class="rule"></i><span>上下文已拓印浓缩 · Context Compacted</span><i class="rule"></i></div>\`;
          if (m.role === "user") return \`<div class="msg-u">\${esc(m.text)}</div>\`;
          return \`
            <div class="msg-a">
              <div class="msg-head">
                <span class="msg-model">\${esc(m.model || "Atelier")}</span>
                \${m.tokens ? \`<span class="caps">\${fmt(m.tokens)} tok</span>\` : ""}
                \${m.time ? \`<span class="msg-time">\${hm(m.time)}</span>\` : ""}
              </div>
              \${m.thinking ? \`<details class="think-box"><summary>Thinking · 思考脉络</summary><div>\${esc(m.thinking)}</div></details>\` : ""}
              \${m.tools && m.tools.length ? \`<div class="tool-list">\${m.tools.map((t) => \`<span class="tool-chip"><i>\${esc(t.name)}</i> \${esc(t.summary || "")}</span>\`).join("")}</div>\` : ""}
              <div class="md">\${renderMd(m.text)}</div>
            </div>\`;
        }).join("")}
        \${running ? \`
          <div class="sheet" style="border-color:var(--gold);padding:11px 14px">
            <div style="display:flex;align-items:center;gap:8px;color:var(--gold-deep);font:600 10px/1 var(--f-sans);letter-spacing:.18em;text-transform:uppercase">
              <span class="dot run"></span> 桌面工坊正在推演与执笔…
            </div>
            \${streamTxt ? \`<div class="md" style="margin-top:8px">\${renderMd(streamTxt)}</div>\` : ""}
          </div>
        \` : ""}
      </div>\`;
  } else if (S.tab === "sessions") {
    const allSessions = u.sessions || [];
    const byWs = {};
    for (const x of allSessions) {
      const k = x.cwd || "未归档项目";
      const g = (byWs[k] ||= { cwd: k, name: base(k), sessions: [], tokens: 0, cost: 0 });
      g.sessions.push(x);
      g.tokens += bagTokens(x.by);
      g.cost += bagCost(x.by, s);
    }
    const wsGroups = Object.values(byWs).sort((a, b) => (b.sessions[0]?.last || 0) - (a.sessions[0]?.last || 0));
    const maxWsTok = Math.max(1, ...wsGroups.map((g) => g.tokens));
    const filtered = allSessions.filter((x) => (!S.wsFilter || x.cwd === S.wsFilter) && (!S.search || (x.title + " " + x.ask + " " + x.cwd).toLowerCase().includes(S.search.toLowerCase())));

    bodyHtml = \`
      <div class="sheet" style="padding:14px 16px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
          <div>
            <div class="caps" style="color:var(--gold-deep)">Parallel Folios · 桌面多卷同览</div>
            <div style="font:500 16.5px/1.25 var(--f-serif);margin-top:2px">\${live.splitActive ? \`当前桌面已展开 \${live.splitCount || 2} 卷并置对照\` : "在电脑屏幕并排开启多个项目或会话"}</div>
          </div>
          \${live.splitActive
            ? \`<button class="btn btn-ink" onclick="__act.closeSplit()">收卷单屏</button>\`
            : \`<button class="btn btn-ink" onclick="__act.openInSplit()">桌面并置 ›</button>\`}
        </div>
      </div>
      <div class="sh"><span class="sh-no">I</span><h5>Projects</h5><i class="rule"></i><small>\${wsGroups.length} 个项目目录</small></div>
      <div class="sheet" style="padding:10px 14px">
        <ol class="done">
          \${wsGroups.slice(0, 8).map((g) => \`
            <li>
              <div class="dh">
                <b style="cursor:pointer" onclick="S.wsFilter=\${JSON.stringify(g.cwd === S.wsFilter ? '' : g.cwd).replace(/"/g,'&quot;')};render()">\${esc(g.name)}</b>
                <small>\${g.sessions.length} 卷 · \${money(g.cost, s)}</small>
              </div>
              <div style="margin:4px 0 6px"><i class="hb"><b style="width:\${Math.max(3, (g.tokens / maxWsTok) * 100)}%"></b></i></div>
              <div style="display:flex;gap:6px;flex-wrap:wrap">
                <button class="btn \${S.wsFilter === g.cwd ? 'btn-gold' : ''}" style="padding:3px 9px;font-size:10.5px" onclick="S.wsFilter=\${JSON.stringify(g.cwd === S.wsFilter ? '' : g.cwd).replace(/"/g,'&quot;')};render()">\${S.wsFilter === g.cwd ? "显示全部" : "筛选此项目"}</button>
                <button class="btn" style="padding:3px 9px;font-size:10.5px" onclick="__act.newSession(\${JSON.stringify(g.cwd).replace(/"/g,'&quot;')})">+ 新建会话</button>
                \${g.sessions[0] ? \`<button class="btn" style="padding:3px 9px;font-size:10.5px" onclick="__act.openInSplit('\${esc(g.sessions[0].id)}', \${JSON.stringify(g.cwd).replace(/"/g,'&quot;')})">桌面并置分屏 ›</button>\` : ""}
              </div>
            </li>\`).join("")}
        </ol>
      </div>
      <div class="sh"><span class="sh-no">II</span><h5>Manuscripts</h5><i class="rule"></i><small>\${S.wsFilter ? base(S.wsFilter) : "全部会话"} (\${filtered.length})</small></div>
      <div style="display:flex;gap:8px;align-items:center">
        <input style="flex:1;height:32px;padding:0 10px;border:0;border-bottom:1px solid var(--line-2);background:transparent;outline:none;font:400 13px var(--f-sans)" placeholder="检索卷名、提问或目录…" value="\${esc(S.search)}" oninput="S.search=this.value;render()">
        \${S.wsFilter ? \`<button class="btn" style="padding:4px 10px;font-size:11px" onclick="S.wsFilter='';render()">清除筛选</button>\` : ""}
      </div>
      <div class="sheet" style="padding:8px 14px">
        <ol class="done">
          \${filtered.slice(0, 35).map((x) => {
            const active = x.id === S.sessionId, c = bagCost(x.by, s), tok = bagTokens(x.by);
            return \`
              <li style="\${active ? 'background:var(--gold-soft);margin:0 -8px;padding-left:34px;padding-right:8px;border-radius:4px' : ''}">
                <div class="dh" onclick="__act.selectSession('\${esc(x.id)}', \${JSON.stringify(x.title || '会话').replace(/"/g, '&quot;')})" style="cursor:pointer">
                  <b>\${x.running ? '● ' : ''}\${esc(x.title || "Untitled")}</b>
                  <small style="color:var(--gold-deep);font-weight:600">\${money(c, s)}</small>
                </div>
                \${x.ask ? \`<p onclick="__act.selectSession('\${esc(x.id)}', \${JSON.stringify(x.title || '会话').replace(/"/g, '&quot;')})" style="cursor:pointer"><i>问</i><span>\${esc(x.ask.slice(0, 88))}</span></p>\` : ""}
                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:5px;font-size:10.5px;color:var(--ink-3)">
                  <span>\${esc(base(x.cwd))} · \${x.turns || 0} 轮 · \${fmt(tok)} tok</span>
                  <div style="display:flex;gap:6px">
                    <button class="btn" style="padding:2px 8px;font-size:10px" onclick="__act.selectSession('\${esc(x.id)}', \${JSON.stringify(x.title || '会话').replace(/"/g, '&quot;')})">掌中执笔</button>
                    <button class="btn btn-gold" style="padding:2px 8px;font-size:10px" onclick="__act.openInSplit('\${esc(x.id)}', \${JSON.stringify(x.cwd || '').replace(/"/g, '&quot;')})">并置分屏</button>
                  </div>
                </div>
              </li>\`;
          }).join("")}
        </ol>
      </div>\`;
  } else if (S.tab === "ledger") {
    const last14 = [];
    for (let i = 13; i >= 0; i--) { const k = addDays(todayIso, -i); last14.push([k, dayCost[k] || 0, dayTok[k] || 0]); }
    const max14 = Math.max(1e-9, ...last14.map((x) => x[1]));
    const selDay = S.sparkDay || todayIso;
    const budgetRef = s.budget > 0 ? s.budget / (s.currency === "CNY" ? +(s.rate || 7.1) : 1) : (totalCost / Math.max(1, Object.keys(daysRaw).length)) * 1.5;
    const budgetRatio = budgetRef > 0 ? todayCost / budgetRef : 0;

    // 12-week heatmap cells
    const heatCells = [];
    const peakTok = Math.max(1, ...Object.values(dayTok));
    const endD = new Date(); endD.setHours(0,0,0,0);
    const startD = new Date(endD); startD.setDate(endD.getDate() - endD.getDay() - 11 * 7);
    for (let i = 0; i < 12 * 7; i++) {
      const dd = new Date(startD); dd.setDate(startD.getDate() + i);
      const k = iso(dd), v = dayTok[k] || 0, r = v / peakTok;
      const lv = !v ? 0 : r < 0.06 ? 1 : r < 0.2 ? 2 : r < 0.5 ? 3 : 4;
      heatCells.push(\`<i style="background:var(--h\${lv});\${dd > endD ? 'opacity:0' : 'cursor:pointer'}" onclick="__act.openDayNote('\${k}')"></i>\`);
    }

    if (S.ledgerSub === "gazette") {
      const rep = S.report;
      const [from, to] = spanOf(S.noteKind, S.noteDay);
      const repTok = rep ? bagTokens(rep.models) : 0, repCost = rep ? bagCost(rep.models, s) : 0;
      const repTurns = rep ? (rep.sessions || []).reduce((a, x) => a + (x.turns || 0), 0) : 0;
      bodyHtml = \`
        <div class="sheet">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:6px">
            <span class="caps">The Atelier Gazette</span>
            <div class="seg">
              <button class="\${S.noteKind==='day'?'on':''}" onclick="__act.setNoteKind('day')">日报</button>
              <button class="\${S.noteKind==='week'?'on':''}" onclick="__act.setNoteKind('week')">周报</button>
              <button class="\${S.noteKind==='month'?'on':''}" onclick="__act.setNoteKind('month')">月报</button>
              <button onclick="__act.setLedgerSub('ledger')">账本</button>
            </div>
          </div>
          <div style="display:flex;align-items:center;justify-content:center;gap:14px;margin:10px 0 4px">
            <button class="btn" style="width:26px;height:26px;padding:0;border-radius:50%" onclick="__act.stepNote(-1)">‹</button>
            <h2 style="margin:0;font:500 25px/1.15 var(--f-serif)">\${from === to ? from : from.slice(5) + " – " + to.slice(5)}</h2>
            <button class="btn" style="width:26px;height:26px;padding:0;border-radius:50%" onclick="__act.stepNote(1)">›</button>
          </div>
          <div class="orn"><i></i><span class="orn-whale"></span><i></i></div>
          \${!rep ? \`<p class="lede" style="color:var(--ink-3)">正在展卷翻阅…</p>\` : \`
            <p class="lede">\${rep.sessions.length ? \`这一期共开了 \${rep.sessions.length} 个会话、推演 \${repTurns} 轮，累计耗墨 \${fmt(repTok)} tokens。\` : "这一期很安静，纸上没有留下墨迹。"}</p>
            <div class="figs">
              <div><small class="caps">Sessions</small><b>\${rep.sessions.length}</b></div>
              <div><small class="caps">Turns</small><b>\${repTurns}</b></div>
              <div><small class="caps">Tokens</small><b>\${fmt(repTok)}</b></div>
              <div><small class="caps">Spent</small><b class="gold">\${money(repCost, s)}</b></div>
            </div>
            \${rep.sessions.length ? \`
              <div class="sh"><span class="sh-no">I</span><h5>What Got Done</h5><i class="rule"></i><small>工作总结</small></div>
              <ol class="done">
                \${rep.sessions.slice(0, 8).map((x) => \`
                  <li onclick="__act.selectSession('\${esc(x.id)}', \${JSON.stringify(x.title||'会话').replace(/"/g,'&quot;')})" style="cursor:pointer">
                    <div class="dh">
                      <b>\${esc(x.title || "Untitled")}</b>
                      <small>\${esc(base(x.cwd))} · \${x.turns} 轮</small>
                    </div>
                    \${x.w?.asks?.[0] ? \`<p><i>问</i><span>\${esc(x.w.asks[0][1].slice(0, 80))}</span></p>\` : ""}
                    \${x.w?.outs?.length ? \`<p><i>成</i><span>\${esc(x.w.outs[x.w.outs.length - 1][1].slice(0, 96))}</span></p>\` : ""}
                    \${x.w?.files?.length ? \`<p style="color:var(--ink-3)"><i>改</i><span>共改动 \${x.w.files.length} 个文件</span></p>\` : ""}
                  </li>\`).join("")}
              </ol>
            \` : ""}
          \`}
        </div>\`;
    } else {
      const models = Object.entries(u.models || {}).sort((a, b) => costOf(b[0], b[1], s) - costOf(a[0], a[1], s));
      const maxMod = models[0] ? costOf(models[0][0], models[0][1], s) : 1;
      bodyHtml = \`
        <div class="sheet">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
            <span class="caps">The House Ledger · 工坊账本</span>
            <div class="seg">
              <button class="on" onclick="__act.setLedgerSub('ledger')">账本</button>
              <button onclick="__act.setLedgerSub('gazette')">小记 · Gazette</button>
            </div>
          </div>
          <h2 style="text-align:center;font:500 26px/1.15 var(--f-serif);margin:10px 0 4px">Ledger & <em>Figures</em></h2>
          <div class="orn"><i></i><span class="orn-whale"></span><i></i></div>
          <div class="figs">
            <div><small class="caps">Today</small><b class="gold">\${money(todayCost, s)}</b></div>
            <div><small class="caps">Month</small><b>\${money(monthCost, s)}</b></div>
            <div><small class="caps">All Time</small><b>\${money(totalCost, s)}</b></div>
            <div><small class="caps">Cache 省</small><b>\${money(totalSaved, s)}</b></div>
          </div>
          <div class="sh"><span class="sh-no">I</span><h5>Last 14 Days</h5><i class="rule"></i><small onclick="__act.openDayNote('\${selDay}')" style="color:var(--gold-deep);cursor:pointer">\${selDay.slice(5)} · \${money(dayCost[selDay] || 0, s)} · 读小记 ›</small></div>
          <div class="spark">
            \${last14.map(([k, v]) => \`<i class="\${k === selDay ? 'active' : ''}" style="height:\${Math.max(5, (v / max14) * 100)}%" onclick="S.sparkDay='\${k}';render()"></i>\`).join("")}
          </div>
          <div class="bar \${s.budget > 0 && budgetRatio > 1 ? 'warn' : ''}"><i style="width:\${Math.min(100, budgetRatio * 100)}%"></i></div>
          <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--ink-3)">
            <span>今日 \${fmt(todayTok)} tok (\${money(todayCost, s)})</span>
            <span>\${s.budget > 0 ? "预算 " + money(budgetRef, s) : "对比日均"}</span>
          </div>
          <div class="sh"><span class="sh-no">II</span><h5>12-Week Heatmap</h5><i class="rule"></i><small>点选方格读日报</small></div>
          <div class="heat-grid">\${heatCells.join("")}</div>
          <div class="sh"><span class="sh-no">III</span><h5>By Model</h5><i class="rule"></i><small>模型花费</small></div>
          <ul class="ws-list" style="margin-top:6px">
            \${models.slice(0, 8).map(([m, v]) => {
              const c = costOf(m, v, s);
              return \`<li><span>\${esc(m)}</span><i class="hb"><b style="width:\${Math.max(3, (c / (maxMod || 1)) * 100)}%"></b></i><small style="color:var(--gold-deep);font-weight:600">\${money(c, s)}</small></li>\`;
            }).join("")}
          </ul>
        </div>\`;
    }
  } else if (S.tab === "atelier") {
    const pal = s.palette || "atelier";
    bodyHtml = \`
      <div class="sheet">
        <div style="text-align:center">
          <div class="caps">Atelier Settings · 掌中工坊</div>
          <h2 style="font:500 26px/1.15 var(--f-serif);margin:6px 0 2px">The <em>atelier</em> controls</h2>
          <div class="orn"><i></i><span class="orn-whale"></span><i></i></div>
        </div>
        <div class="plate" style="height:108px;margin:8px 0" onclick="__act.spout()">
          <canvas id="whale-cv"></canvas>
          <span class="plate-tag">Plate <b>XII</b> · \${esc(phaseLabel)} · 点触喷水</span>
        </div>
        <div class="sh"><span class="sh-no">I</span><h5>Plate & Parallel</h5><i class="rule"></i><small>铜版与多卷</small></div>
        <div class="opt">
          <div><strong>Engraved Whale · 唤鲸喷水</strong><small>让手机与电脑桌面上的铜版鲸鱼同时喷起水柱</small></div>
          <button class="btn btn-ink" onclick="__act.spout()">🐋 喷水</button>
        </div>
        <div class="opt">
          <div><strong>Time of Day · 铜版时辰</strong><small>切换桌面首页铜版画的昼夜与飞雪天象</small></div>
          <div class="seg">
            \${[["auto","随辰"],["dawn","晨"],["day","昼"],["dusk","暮"],["night","夜"],["snow","雪"]].map(([k, l]) => \`
              <button class="\${phase === k ? 'on' : ''}" onclick="__act.setPhase('\${k}')">\${l}</button>
            \`).join("")}
          </div>
        </div>
        <div class="opt">
          <div><strong>Parallel Folios · 桌面多卷同览</strong><small>在电脑端开启或收起多项目并排分屏工作台</small></div>
          <div style="display:flex;gap:6px">
            <button class="btn \${live.splitActive ? 'btn-gold' : ''}" onclick="__act.openInSplit()">展卷分屏</button>
            \${live.splitActive ? \`<button class="btn" onclick="__act.closeSplit()">收卷</button>\` : ""}
          </div>
        </div>
        <div class="sh"><span class="sh-no">II</span><h5>Appearance</h5><i class="rule"></i><small>纸色与肌理</small></div>
        <div class="opt">
          <div><strong>Palette · 纸色</strong><small>桌面与掌中画室同步切换三套传统纸墨配色</small></div>
          <div class="seg">
            \${[["atelier","纸与金"],["ink","墨与青"],["cinnabar","楮与朱"]].map(([k, l]) => \`
              <button class="\${pal === k ? 'on' : ''}" onclick="__act.setPalette('\${k}')">\${l}</button>
            \`).join("")}
          </div>
        </div>
        <div class="opt">
          <div><strong>Pocket Lighting · 掌中昼夜</strong><small>设置手机端页面的浅色宣纸或深色夜读模式</small></div>
          <div class="seg">
            \${[["auto","随系统"],["light","浅纸"],["dark","夜墨"]].map(([k, l]) => \`
              <button class="\${S.theme === k ? 'on' : ''}" onclick="__act.setTheme('\${k}')">\${l}</button>
            \`).join("")}
          </div>
        </div>
        \${[
          ["skin", "Atelier Skin", "桌面全局纸色、金线与衬线排版"],
          ["sea", "Conversation Sea", "会话背景里的木刻海面、海鸥与游鲸"],
          ["icons", "Engraved Icons", "手绘细线描金图标"],
          ["paper", "Paper Grain", "极淡的宣纸纹理衬底"],
          ["timeOfDay", "Solar Terms", "随时间与二十四节气变换天象"],
        ].map(([k, t, desc]) => \`
          <div class="opt">
            <div><strong>\${t}</strong><small>\${desc}</small></div>
            <button class="sw \${s[k] !== false ? 'on' : ''}" onclick="__act.toggleOpt('\${k}')"></button>
          </div>
        \`).join("")}
        <div class="sh"><span class="sh-no">III</span><h5>Ledger & Version</h5><i class="rule"></i><small>账本与版本</small></div>
        <div class="opt">
          <div><strong>Currency · 币种</strong><small>汇率 $1 = ¥\${s.rate || 7.1}</small></div>
          <div class="seg">
            \${["CNY", "USD"].map((c) => \`<button class="\${s.currency === c ? 'on' : ''}" onclick="__act.setCurrency('\${c}')">\${c}</button>\`).join("")}
          </div>
        </div>
        <div class="opt">
          <div><strong>Daily Budget · 每日预算</strong><small>0 表示不设上限（对比日均）</small></div>
          <input style="width:76px;height:28px;border:0;border-bottom:1px solid var(--line-2);background:transparent;text-align:right;font:500 15px var(--f-serif)" type="number" value="\${s.budget || 0}" onchange="__act.setBudget(this.value)">
        </div>
        <div class="opt">
          <div><strong>Atelier · v\${upd.current || "__VERSION__"}</strong><small>\${upd.pending ? "已下载 v" + upd.pending + "，重启生效" : upd.available ? "发现新版本 v" + upd.latest : "已是最新镌刻版"}</small></div>
          \${upd.available && !upd.pending
            ? \`<button class="btn btn-ink" onclick="__act.updRun()">更新 v\${upd.latest}</button>\`
            : \`<button class="btn" onclick="__act.updCheck()">检查更新</button>\`}
        </div>
      </div>\`;
  }

  const approvals = live.approvals || [];
  const approvalHtml = S.tab === "chat" && approvals.length ? \`
    <div class="approve-card">
      <div class="caps" style="color:var(--gold-deep)">Approval Required · 桌面端等待批阅确认</div>
      <div class="approve-btns">
        \${approvals.map((a) => \`<button class="btn btn-ink" onclick="__act.approve(\${a.index}, \${JSON.stringify(a.label).replace(/"/g, '&quot;')})">\${esc(a.label)}</button>\`).join("")}
      </div>
    </div>\` : "";

  const curSessionCost = det ? bagCost(det.by, s) : todayCost;
  const curSessionTok = det ? bagTokens(det.by) : todayTok;
  const composerHtml = S.tab === "chat" ? \`
    <div class="composer-wrap">
      <div class="composer-box">
        <textarea id="chat-in" rows="1" placeholder="在宣纸上落笔，发送至桌面端执行…" oninput="S.draft=this.value" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();__act.sendChat();}">\${esc(S.draft)}</textarea>
        <div class="composer-dock">
          <button type="button" class="chip" onclick="__act.setTab('ledger')">
            <span class="coin">\${s.currency === "USD" ? "$" : "¥"}</span>
            <b>\${money(curSessionCost, s).replace(/^[¥$]/, "")}</b>
            <span style="color:var(--ink-3)">· \${fmt(curSessionTok)} tok</span>
          </button>
          <div style="display:flex;gap:6px">
            \${running ? \`<button type="button" class="send-btn stop-btn" onclick="__act.stopChat()">■ 收笔</button>\` : ""}
            <button type="button" class="send-btn" onclick="__act.sendChat()">落笔 ↑</button>
          </div>
        </div>
      </div>
    </div>\` : "";

  root.innerHTML = \`
    <header class="mast">
      <div class="dl">
        <span class="caps">\${WEEK[now.getDay()]} · \${MONTHS[now.getMonth()]} \${now.getDate()}</span>
        <span class="rule"></span>
        <button type="button" class="dl-btn" onclick="__act.cyclePhase()">Plate XII · \${esc(phaseLabel)}</button>
        <button type="button" class="dl-btn" onclick="\${live.splitActive ? '__act.closeSplit()' : '__act.openInSplit()'}">\${live.splitActive ? "Parallel ●" : "Parallel ›"}</button>
      </div>
      <div class="mast-row">
        <div class="brand">
          <span class="mark">\${esc(initial)}</span>
          <span class="bname"><b>\${esc(dispName)}</b><span>Atelier · Pocket Folio</span></span>
        </div>
        <div class="status-chip" onclick="pollState(true)">
          <span class="dot \${running ? 'run' : live.desktopOnline ? 'on' : ''}"></span>
          <span>\${running ? "推演中" : live.desktopOnline ? "桌面在线" : "本地账本"}</span>
        </div>
      </div>
    </header>
    <main class="main">\${bodyHtml}</main>
    \${approvalHtml}
    \${composerHtml}
    <nav class="tabs">
      <button class="tab \${S.tab==='chat'?'active':''}" onclick="__act.setTab('chat')"><em>I</em><b>手稿</b><small>MANUSCRIPT</small></button>
      <button class="tab \${S.tab==='sessions'?'active':''}" onclick="__act.setTab('sessions')"><em>II</em><b>多卷</b><small>PROJECTS</small></button>
      <button class="tab \${S.tab==='ledger'?'active':''}" onclick="__act.setTab('ledger')"><em>III</em><b>小记</b><small>GAZETTE</small></button>
      <button class="tab \${S.tab==='atelier'?'active':''}" onclick="__act.setTab('atelier')"><em>IV</em><b>工坊</b><small>ATELIER</small></button>
    </nav>
    \${S.toastMsg ? \`<div class="toast">\${esc(S.toastMsg)}</div>\` : ""}\`;

  const nextMain = root.querySelector(".main");
  if (nextMain && prevScroll > 0) nextMain.scrollTop = prevScroll;
  if (activeId === "chat-in") {
    const ta = document.getElementById("chat-in");
    if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
  }
  requestAnimationFrame(drawPlate);
}

render();
if (S.authed) { pollState(false); loadReport(); }
setInterval(() => {
  if (!document.hidden && S.authed) {
    const ae = document.activeElement;
    if (ae && ae.id === "chat-in" && S.draft) return; // do not disrupt active typing
    pollState(false);
  }
}, 2400);
</script>
</body>
</html>`

const json = (body, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } })
const wrap = async (fn) => { try { return json({ ok: true, value: await fn() }) } catch (e) { return json({ ok: false, error: String(e?.message || e) }, 500) } }

// Same pattern as built-in plugins: exact routes on the authenticated /api channel,
// reached from the client with document-relative fetch('api/...') in both desktop and web.
let liveRootCtx = null
export function apply(root) {
  liveRootCtx = root
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
