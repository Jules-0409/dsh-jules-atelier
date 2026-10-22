let React = require("react");
const ReactDOM = require("react-dom");
const h = React.createElement;
const name = "dsh-jules-atelier";
const VERSION = "__VERSION__";
const inject = ["slots", "theme", "connection"];
const API = "jules-atelier/";
const FISH = "__FISH__";
const FONT_CSS = __FONTS__;
const SKIN_CSS = __SKIN__;
const PARTS_CSS = __PARTS__;

/* ---------------- palette (light / dark) ---------------- */
const P = (light, dark) => ({ light, dark });
const TOKENS = {
  "--dsw-alias-bg-base": P("#F4EFE5", "#1C1B19"),
  "--dsw-alias-bg-layer-1": P("#FAF8F3", "#22211E"),
  "--dsw-alias-bg-layer-2": P("#EFEADF", "#262420"),
  "--dsw-alias-bg-layer-3": P("#E9E2D4", "#2B2925"),
  "--dsw-alias-bg-overlay": P("#FAF8F3", "#24231F"),
  "--dsw-alias-bg-skeleton": P("#ECE5D8", "#2A2824"),
  "--dsw-alias-bg-module-platform": P("#F4EFE5", "#1C1B19"),
  "--dsw-alias-border-l1": P("#E2DACB", "#2E2C28"),
  "--dsw-alias-border-l2": P("#D5CAB6", "#3A3732"),
  "--dsw-alias-border-l3": P("#C9BCA4", "#46423B"),
  "--dsw-alias-border-l4": P("#B8A98E", "#57524A"),
  "--dsw-alias-brand-primary": P("#A48659", "#C3A574"),
  "--dsw-alias-brand-text": P("#7E6440", "#D9BE8E"),
  "--dsw-alias-link": P("#7E6440", "#D9BE8E"),
  "--dsw-alias-label-primary": P("#2E2A24", "#ECE5D6"),
  "--dsw-alias-label-secondary": P("#69645A", "#B3AB9B"),
  "--dsw-alias-label-tertiary": P("#A29B8D", "#7E776A"),
  "--dsw-alias-label-caption": P("#A29B8D", "#7E776A"),
  "--dsw-alias-label-dimmed": P("#C9C2B4", "#4E4A42"),
  "--dsw-alias-label-primary-bluish": P("#7E6440", "#D9BE8E"),
  "--dsw-alias-label-primary-inverted": P("#FAF8F3", "#1C1B19"),
  "--dsw-alias-interactive-bg-hover": P("rgba(120,100,70,.07)", "rgba(236,229,214,.05)"),
  "--dsw-alias-interactive-bg-active": P("rgba(164,134,89,.14)", "rgba(195,165,116,.14)"),
  "--dsw-alias-interactive-bg-hover-solid": P("#EDE7DB", "#2A2825"),
  "--dsw-alias-interactive-bg-hover-accent": P("rgba(164,134,89,.12)", "rgba(195,165,116,.12)"),
  "--dsw-alias-button-primary-fill": P("#2E2A24", "#ECE5D6"),
  "--dsw-alias-button-primary-hover": P("#4A443A", "#FFFFFF"),
  "--dsw-alias-button-primary-dimmed": P("#C9C2B4", "#4E4A42"),
  "--dsw-alias-state-business-primary": P("#A48659", "#C3A574"),
  "--dsw-alias-state-success-primary": P("#6F7C69", "#9DAA93"),
  "--dsw-alias-state-error-primary": P("#9A4A3C", "#E3907E"),
  "--dsw-alias-state-warn-primary": P("#B07A2E", "#E2A95B"),
  "--dsw-alias-state-idle-primary": P("#A29B8D", "#7E776A"),
  "--dsw-alias-markdown-inline-code": P("rgba(164,134,89,.12)", "rgba(195,165,116,.12)"),
  "--dsw-alias-markdown-code-block": P("#EFEADF", "#22211E"),
  "--dsw-alias-scrollbar-bg-l1": P("rgba(120,100,70,.18)", "rgba(236,229,214,.14)"),
  "--dsw-alias-scrollbar-hover-l1": P("rgba(120,100,70,.32)", "rgba(236,229,214,.26)"),
  "--dsw-specific-sidebar-fill": P("#EDE7DB", "#171614"),
  "--dsw-specific-sidebar-nav-item-active": P("rgba(164,134,89,.14)", "rgba(195,165,116,.13)"),
  "--dsw-specific-sidebar-nav-item-hover": P("rgba(120,100,70,.07)", "rgba(236,229,214,.05)"),
  "--dsw-specific-input-major": P("#FAF8F3", "#22211E"),
  "--dsw-specific-bubble": P("#EDE7DB", "#2A2825"),
  "--dsw-specific-menu": P("#FAF8F3", "#24231F"),
  "--dsw-alias-button-info-fill": P("#2E2A24", "#ECE5D6"),
  "--dsw-alias-button-info-hover": P("#7E6440", "#D9BE8E"),
  "--dsw-alias-label-primary-foreground": P("#FAF8F3", "#1C1B19"),
  "--dsw-alias-label-primary-dimmed": P("#3E3830", "#D8D0C0"),
  "--dsw-alias-label-shimmer": P("rgba(164,134,89,.55)", "rgba(240,201,135,.6)"),
  "--dsw-alias-label-deep-diving": P("#7E6440", "#D9BE8E"),
  "--dsw-alias-label-deep-diving-shimmer": P("#C9AE82", "#F0C987"),
  "--dsw-alias-brand-primary-new-colorprimary-new-color": P("#A48659", "#C3A574"),
  "--dsw-alias-brand-primary-invert": P("#2E2A24", "#ECE5D6"),
  "--dsw-alias-button-contrast-fill": P("#69645A", "#ECE5D6"),
  "--dsw-alias-button-elevated-fill": P("#FAF8F3", "#2E2C28"),
  "--dsw-alias-button-floating-fill": P("#FAF8F3", "#262420"),
  "--dsw-alias-button-floating-hover": P("#EFEADF", "#2E2C28"),
  "--dsw-alias-button-ghost-active-border": P("#A48659", "#C3A574"),
  "--dsw-alias-button-ghost-active-fill": P("rgba(164,134,89,.10)", "rgba(195,165,116,.12)"),
  "--dsw-alias-button-ghost-active-hover": P("rgba(164,134,89,.16)", "rgba(195,165,116,.18)"),
  "--dsw-alias-state-business-tertiary": P("rgba(164,134,89,.12)", "rgba(195,165,116,.14)"),
  "--dsw-alias-state-success-secondary": P("#8A9784", "#B5C2AB"),
  "--dsw-alias-state-success-tertiary": P("#E7EBE1", "#2A3027"),
  "--dsw-alias-state-error-secondary": P("#B86B5C", "#E3907E"),
  "--dsw-alias-state-warn-secondary": P("#C99248", "#E8B977"),
  "--dsw-alias-state-warn-tertiary": P("#F5E9D3", "#352C1F"),
  "--dsw-alias-state-warn-label": P("#9A6A26", "#E8B977"),
  "--dsw-alias-tooltip-bg": P("#2E2A24", "#3A3732"),
  "--dsw-alias-toast-bg": P("#2E2A24", "#3A3732"),
  "--dsw-alias-toast-label": P("#FAF8F3", "#ECE5D6"),
  "--dsw-alias-switch-thumb": P("#FAF8F3", "#ECE5D6"),
  "--dsw-alias-menu-icon": P("#69645A", "#B3AB9B"),
  "--dsw-alias-menu-group-header-fill": P("rgba(250,248,243,.96)", "rgba(36,35,31,.96)"),
  "--dsw-alias-markdown-code-block-banner": P("#E9E2D4", "#262420"),
  "--dsw-alias-markdown-code-segment-selected": P("#FAF8F3", "#2E2C28"),
  "--dsw-alias-markdown-code-segment-unselected": P("#EFEADF", "#22211E"),
  "--dsw-alias-markdown-citation": P("#EDE7DB", "#2E2C28"),
  "--dsw-alias-markdown-tag": P("#EDE7DB", "#2A2825"),
  "--dsw-alias-markdown-placeholder": P("#F1ECE1", "#24231F"),
  "--dsw-alias-bg-multi-select": P("#EFEADF", "#2A2825"),
  "--dsw-alias-bg-document-preview": P("#EFEADF", "#1C1B19"),
  "--dsw-alias-bg-document-selection": P("rgba(164,134,89,.32)", "rgba(195,165,116,.32)"),
  "--dsw-alias-bg-mask-drop": P("rgba(250,248,243,.75)", "rgba(28,27,25,.75)"),
  "--dsw-alias-bg-mask-1": P("rgba(46,38,26,.28)", "rgba(0,0,0,.55)"),
  "--dsw-alias-bg-mask-2": P("rgba(46,38,26,.14)", "rgba(0,0,0,.25)"),
  "--dsw-alias-border-l2-darkmode-thin": P("#E2DACB", "#2E2C28"),
  "--dsw-alias-scrollbar-bg-l2": P("rgba(120,100,70,.22)", "rgba(236,229,214,.16)"),
  "--dsw-alias-scrollbar-hover-l2": P("rgba(120,100,70,.36)", "rgba(236,229,214,.28)"),
  "--dsw-alias-turn-trigger-bg": P("#EFEADF", "rgba(236,229,214,.05)"),
  "--dsw-alias-turn-trigger-bg-hover": P("rgba(164,134,89,.12)", "rgba(195,165,116,.12)"),
  "--dsw-alias-interactive-bg-hover-danger": P("rgba(154,74,60,.08)", "rgba(227,144,126,.12)"),
  "--dsw-alias-settings-card-fill": P("#FAF8F3", "#22211E"),
  "--dsw-alias-settings-card-stroke": P("#E2DACB", "#2E2C28"),
  "--dsw-alias-onboarding-accent": P("#A48659", "#C3A574"),
  "--dsw-alias-file-diff-added-bg": P("#E8EDE2", "#232B22"),
  "--dsw-alias-file-diff-added-gutter": P("#EEF2E9", "#1B221A"),
  "--dsw-alias-file-diff-added-marker": P("#5E7356", "#9DB48F"),
  "--dsw-alias-file-diff-deleted-bg": P("#F4E3DD", "#33211D"),
  "--dsw-alias-file-diff-deleted-gutter": P("#F7EAE5", "#271915"),
  "--dsw-alias-file-diff-deleted-marker": P("#9A4A3C", "#E3907E"),
  "--dsw-alias-code-diff-added": P("rgba(111,124,105,.12)", "rgba(157,170,147,.14)"),
  "--dsw-alias-code-diff-deleted": P("rgba(154,74,60,.10)", "rgba(227,144,126,.12)"),
  "--dsw-specific-bubble-highlight": P("#E2D6BF", "#3A3732"),
  "--dsw-specific-selector": P("#EFEADF", "#2A2825"),
  "--dsw-specific-tip": P("#EFEADF", "#2A2825"),
  "--dsw-specific-login-input": P("#FAF8F3", "#1F1E1B"),
  "--dsw-specific-sidebar-nav-item-active-accent": P("rgba(164,134,89,.16)", "rgba(195,165,116,.16)"),
};


/* ---------------- settings + pricing ---------------- */
const DEFAULTS = { name: "", skin: true, fonts: true, paper: true, motion: true, hero: true, heat: true, icons: true, ledger: true, sideLedger: true, currency: "CNY", rate: 7.1, budget: 0, prices: {}, update: "auto" };
// USD per 1M tokens: [uncached input, cache read, output]. Editable in Settings → Atelier.
const PRICE_BOOK = [
  [/deepseek.*(flash|chat)/i, [0.3, 0.006, 1.2], "DeepSeek Flash"],
  [/deepseek.*(pro|reason)/i, [0.55, 0.055, 2.2], "DeepSeek Pro · est."],
  [/claude.*opus/i, [4, 0.2, 20], "Claude Opus"],
  [/claude.*sonnet/i, [2, 0.2, 10], "Claude Sonnet"],
  [/claude.*haiku/i, [0.8, 0.08, 4], "Claude Haiku"],
  [/gpt-6/i, [2, 0.1, 10], "GPT-6"],
  [/gpt/i, [1.25, 0.125, 10], "GPT · est."],
  [/gemini.*flash/i, [0.75, 0.075, 3.75], "Gemini Flash"],
  [/gemini/i, [2.5, 0.25, 15], "Gemini Pro · est."],
  [/minimax/i, [0.3, 0.03, 1.2], "MiniMax · est."],
  [/mimo.*pro/i, [0.435, 0.0036, 0.87], "MiMo Pro"],
  [/mimo/i, [0.2, 0.002, 0.6], "MiMo · est."],
  [/swe/i, [1.25, 0.125, 10], "SWE · est."],
  [/kimi|moonshot/i, [0.6, 0.15, 2.5], "Kimi · est."],
  [/qwen/i, [0.4, 0.08, 1.6], "Qwen · est."],
];
const FALLBACK_PRICE = [1, 0.1, 4];
function bookPrice(model) { for (const [re, p, label] of PRICE_BOOK) if (re.test(model)) return { p, label }; return { p: FALLBACK_PRICE, label: "Unlisted · est." }; }
function priceOf(model, s) { const o = s && s.prices && s.prices[model]; return Array.isArray(o) && o.length === 3 && o.every((x) => Number.isFinite(+x)) ? o.map(Number) : bookPrice(model).p; }
// v = [uncached input, cache read, output, calls]
const costOf = (model, v, s) => { const p = priceOf(model, s); return (v[0] * p[0] + v[1] * p[1] + v[2] * p[2]) / 1e6; };
const bagCost = (bag, s) => Object.entries(bag || {}).reduce((a, [m, v]) => a + costOf(m, v, s), 0);
const bagTokens = (bag) => Object.values(bag || {}).reduce((a, v) => a + v[0] + v[1] + v[2], 0);
const sumBag = (bag) => Object.values(bag || {}).reduce((a, v) => [a[0] + v[0], a[1] + v[1], a[2] + v[2], a[3] + v[3]], [0, 0, 0, 0]);
function money(usd, s, opts) {
  const cny = (s || DEFAULTS).currency === "CNY", v = usd * (cny ? +(s.rate || 7.1) : 1), sym = cny ? "¥" : "$";
  if (opts === "parts") return [sym, v < 0.005 && v > 0 ? "<0.01" : v >= 1000 ? Math.round(v).toLocaleString("en-US") : v >= 100 ? v.toFixed(0) : v.toFixed(2)];
  if (v > 0 && v < 0.005) return `<${sym}0.01`;
  return sym + (v >= 1000 ? Math.round(v).toLocaleString("en-US") : v >= 100 ? v.toFixed(0) : v.toFixed(2));
}

/* ---------------- shared store (usage + settings) ---------------- */
const store = { usage: null, settings: { ...DEFAULTS }, loaded: false };
const subs = new Set();
const emit = () => subs.forEach((f) => f());
let timer = 0;
async function api(ep, payload) {
  const post = ep === "settings/set";
  const url = ep === "usage" ? "api/jules-atelier.usage" + (payload && payload.fresh ? "?fresh=1" : "") : "api/jules-atelier.settings";
  const r = await fetch(url, { credentials: "same-origin", cache: "no-store", ...(post ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload.value) } : {}) });
  const res = r.ok ? await r.json().catch(() => null) : null;
  if (!res || !res.ok) throw new Error((res && res.error) || `HTTP ${r.status}`);
  return res.value;
}
async function refresh(fresh) {
  try { store.usage = await api("usage", { fresh: !!fresh }); emit(); } catch (e) { console.warn("jules-atelier: usage failed", e); }
}
async function loadSettings() {
  try { store.settings = { ...DEFAULTS, ...(await api("settings/get")) }; } catch (e) { console.warn("jules-atelier: settings failed", e); }
  store.loaded = true; applyBodyFlags(); emit();
}
/* ---------------- self-update (host checks GitHub, replaces the plugin folder) ---------------- */
const upd = { info: null, busy: false, err: "" };
async function updApi(post, fresh) {
  const r = await fetch("api/jules-atelier.update" + (fresh ? "?fresh=1" : ""), { credentials: "same-origin", cache: "no-store", ...(post ? { method: "POST" } : {}) });
  const res = r.ok ? await r.json().catch(() => null) : await r.json().catch(() => null);
  if (!res || !res.ok) throw new Error((res && res.error) || `HTTP ${r.status}`);
  return res.value;
}
async function updCheck(fresh) {
  upd.busy = true; upd.err = ""; emit();
  try { upd.info = await updApi(false, fresh); } catch (e) { upd.err = String(e.message || e); }
  upd.busy = false; emit(); return upd.info;
}
async function updRun() {
  upd.busy = true; upd.err = ""; emit();
  try { upd.info = await updApi(true); } catch (e) { upd.err = String(e.message || e); }
  upd.busy = false; emit();
}
function toast(text) {
  if (!document.body) return;
  const el = document.createElement("div");
  el.className = "ja-root ja-toast"; el.setAttribute("role", "status"); el.textContent = text;
  const close = () => { el.classList.add("out"); setTimeout(() => el.remove(), 400); };
  el.onclick = close; document.body.appendChild(el); setTimeout(close, 9000);
}
async function updNotice() {
  const i = await updCheck(false); if (!i) return;
  const once = (k, text) => { try { if (localStorage.getItem(k)) return; localStorage.setItem(k, "1"); } catch {} toast(text); };
  if (i.pending) once("ja-upd-pending:" + i.pending, `Atelier 已更新到 v${i.pending} · 重启 Harness 后生效`);
  else if (i.available && i.mode === "notify") once("ja-upd-avail:" + i.latest, `Atelier v${i.latest} 可以更新了 · 设置 › Atelier › Updates`);
}
const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "刚刚" : m < 60 ? `${m} 分钟前` : m < 1440 ? `${Math.round(m / 60)} 小时前` : `${Math.round(m / 1440)} 天前`; };
function UpdateSection({ s }) {
  const i = upd.info;
  React.useEffect(() => { if (!upd.info && !upd.busy) updCheck(false); }, []);
  const mode = s.update || "auto";
  const status = upd.busy ? "正在连接 GitHub…"
    : upd.err ? "出错了：" + upd.err
    : !i ? "尚未检查"
    : i.pending ? `已下载 v${i.pending}，重启 Harness 后生效。`
    : i.error ? `检查失败（${i.error}），稍后会自动重试。`
    : i.available ? `GitHub 上有新版本 v${i.latest}。`
    : `已是最新版本 · 检查于${ago(i.checkedAt)}`;
  const canUpdate = i && i.available && !i.pending;
  return h(React.Fragment, null,
    h("h5", null, "Updates"),
    h(Opt, { title: "Auto update", desc: mode === "auto" ? "启动后和每 12 小时从 GitHub 检查一次，有新版就自动下载，重启 Harness 后生效。" : mode === "notify" ? "只检查并提醒，由你手动点更新。" : "不自动检查，可以随时手动检查。" },
      h("div", { className: "ja-seg" }, [["auto", "自动"], ["notify", "仅提醒"], ["off", "关闭"]].map(([k, l]) => h("button", { key: k, type: "button", "aria-pressed": mode === k, onClick: () => setSettings({ update: k }) }, l)))),
    h(Opt, { title: `Version · v${(i && i.current) || "…"}`, desc: status },
      canUpdate ? h("button", { type: "button", className: "ja-btn ja-btn-ink", disabled: upd.busy, onClick: updRun }, `更新到 v${i.latest}`)
        : h("button", { type: "button", className: "ja-btn", disabled: upd.busy, onClick: () => updCheck(true) }, "检查更新")));
}

let saveTimer = 0;
function setSettings(patch) {
  store.settings = { ...store.settings, ...patch }; applyBodyFlags(); emit();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const { ...persist } = store.settings;
    api("settings/set", { value: persist }).catch((e) => console.warn("jules-atelier: save failed", e));
  }, 350);
}
function applyBodyFlags() {
  const s = store.settings, b = document.body; if (!b) return;
  b.classList.toggle("ja-skin", !!s.skin);
  b.classList.toggle("ja-fonts", !!s.skin && !!s.fonts);
  b.classList.toggle("ja-paper", !!s.skin && !!s.paper);
  b.classList.toggle("ja-motion", !!s.skin && !!s.motion);
  syncIcons(!!s.skin && s.icons !== false);
}
function useStore() {
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => {
    subs.add(force);
    if (subs.size === 1) { refresh(); timer = setInterval(() => { if (!document.hidden) refresh(); }, 30000); }
    return () => { subs.delete(force); if (!subs.size) clearInterval(timer); };
  }, []);
  return store;
}

/* ---------------- derived numbers ---------------- */
const fmt = (n) => n >= 1e9 ? (n / 1e9).toFixed(1) + "B" : n >= 1e6 ? (n >= 1e8 ? Math.round(n / 1e6) : (n / 1e6).toFixed(1)) + "M" : n >= 1e3 ? Math.round(n / 1e3) + "K" : String(Math.round(n || 0));
const split = (n) => { const s = fmt(n); const m = s.match(/^([\d.]+)([A-Z]?)$/); return m ? [m[1], m[2]] : [s, ""]; };
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
let memo = { u: null, s: null, d: null };
function derive(u, s) {
  if (memo.u === u && memo.s === s && memo.d) return memo.d;
  const daysRaw = (u && u.days) || {};
  const days = {}, dayCost = {};
  for (const [k, bag] of Object.entries(daysRaw)) { days[k] = bagTokens(bag); dayCost[k] = bagCost(bag, s); }
  const todayIso = iso(new Date()), month = todayIso.slice(0, 7);
  const keys = Object.keys(days).filter((k) => days[k] > 0).sort();
  const vals = keys.map((k) => days[k]);
  const total = vals.reduce((a, b) => a + b, 0), avg = vals.length ? total / vals.length : 1;
  const today = days[todayIso] || 0, peak = vals.length ? Math.max(...vals) : 0;
  const costs = keys.map((k) => dayCost[k]), avgCost = costs.length ? costs.reduce((a, b) => a + b, 0) / costs.length : 0;
  let streak = 0; for (let d = new Date(); ; d.setDate(d.getDate() - 1)) { const k = iso(d); if (days[k] > 0) streak++; else if (k !== todayIso) break; if (streak > 999) break; }
  const first = keys[0];
  const dayNo = first ? Math.floor((new Date(todayIso) - new Date(first)) / 864e5) + 1 : 1;
  const all = sumBag((u && u.models) || {});
  const monthCost = Object.entries(dayCost).filter(([k]) => k.startsWith(month)).reduce((a, [, v]) => a + v, 0);
  const totalCost = bagCost((u && u.models) || {}, s);
  const sessions = (u && u.sessions) || [];
  const d = { days, dayCost, keys, total, avg, today, peak, streak, first, dayNo, todayIso, todayCost: dayCost[todayIso] || 0, avgCost, monthCost, totalCost,
    sessions: sessions.length, running: sessions.filter((x) => x.running).length, cache: all[1] / Math.max(1, all[0] + all[1]) };
  memo = { u, s, d };
  return d;
}
const lastDays = (d, n) => { const out = []; for (let i = n - 1; i >= 0; i--) { const t = new Date(); t.setDate(t.getDate() - i); const k = iso(t); out.push([k, d.dayCost[k] || 0]); } return out; };
/* ---------------- whale engine ---------------- */
function mountWhale(plate, cv, D) {
  const ctx = cv.getContext("2d");
  if (!ctx) return () => {};
__WHALE__
  plate.addEventListener("pointermove", (e) => { if (!S) return; const R = plate.getBoundingClientRect(); S.LT = { x: e.clientX - R.left, y: e.clientY - R.top }; S.hoverT = 1; });
  plate.addEventListener("pointerleave", () => { if (!S) return; S.LT = { x: S.cx0 - 260, y: S.cy0 - 260 }; S.hoverT = 0; });
  plate.addEventListener("click", () => { if (S) S.nextSpout = 0; });
  let raf = 0, dead = false, t0 = performance.now();
  const T = () => performance.now() - t0;
  const ro = new ResizeObserver(() => { build(); draw(T()); }); ro.observe(plate);
  const mo = new MutationObserver(() => { build(); }); mo.observe(document.body, { attributes: true, attributeFilter: ["data-ds-dark-theme", "style", "class"] });
  const io = new IntersectionObserver((e) => { visible = e[0].isIntersecting; }); io.observe(plate);
  build();
  if (reduce) draw(6000);
  else { let last = -1; const loop = () => { if (dead) return; const t = T(); if (visible && !document.hidden && t - last >= 33) { draw(t); last = t; } raf = requestAnimationFrame(loop); }; raf = requestAnimationFrame(loop); }
  return () => { dead = true; cancelAnimationFrame(raf); ro.disconnect(); mo.disconnect(); io.disconnect(); };
}

/* ---------------- components ---------------- */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
function greeting() {
  const hr = new Date().getHours();
  if (hr < 5) return ["Good night", "夜深了"]; if (hr < 12) return ["Good morning", "早上好"];
  if (hr < 18) return ["Good afternoon", "下午好"]; return ["Good evening", "晚上好"];
}
function Heat({ d, s }) {
  const gridRef = React.useRef(null), [weeks, setWeeks] = React.useState(18);
  React.useLayoutEffect(() => {
    const el = gridRef.current; if (!el || typeof ResizeObserver === "undefined") return;
    const fit = () => { const n = Math.max(8, Math.min(53, Math.floor((el.clientWidth + 3) / 12))); setWeeks((w) => (w === n ? w : n)); };
    const ro = new ResizeObserver(fit); ro.observe(el); fit(); return () => ro.disconnect();
  }, []);
  const cells = [], end = new Date(); end.setHours(0, 0, 0, 0);
  const start = new Date(end); start.setDate(end.getDate() - end.getDay() - (weeks - 1) * 7);
  const lv = (v) => { if (!v) return 0; const r = v / (d.peak || 1); return r < .06 ? 1 : r < .2 ? 2 : r < .5 ? 3 : 4; };
  for (let i = 0; i < weeks * 7; i++) {
    const day = new Date(start); day.setDate(start.getDate() + i);
    const k = iso(day), v = d.days[k] || 0, l = lv(v), future = day > end;
    cells.push(h("i", { key: k, title: `${k} · ${fmt(v)} tokens · ${money(d.dayCost[k] || 0, s)}`, style: { background: l ? `var(--h${l})` : undefined, opacity: future ? 0 : 1 } }));
  }
  const stat = (label, n, unit, cls) => h("div", { key: label }, h("small", { className: "ja-caps" }, label), h("b", { className: cls }, n, unit ? h("u", null, unit) : null));
  const [t1, t2] = split(d.total), [ts, tv] = money(d.todayCost, s, "parts"), [ms, mv] = money(d.monthCost, s, "parts");
  return h("div", { className: "ja-heat" },
    h("div", { className: "ja-grid", ref: gridRef, "aria-label": "Token heatmap" }, cells),
    h("div", { className: "ja-stats" },
      stat("Today", h(React.Fragment, null, h("u", { style: { marginLeft: 0, marginRight: 2 } }, ts), tv), null, "ja-money"),
      stat(MONTHS[new Date().getMonth()], h(React.Fragment, null, h("u", { style: { marginLeft: 0, marginRight: 2 } }, ms), mv)),
      stat("Tokens", t1, t2), stat("Streak", d.streak, "天")));
}
function HeroMark() {
  const st = useStore(), u = st.usage, s = st.settings, d = derive(u, s);
  const plateRef = React.useRef(null), cvRef = React.useRef(null), dataRef = React.useRef({ gap: 12, running: 0 });
  const busy = Math.min(1, d.today / (d.avg || 1));
  dataRef.current.gap = 18 - 12 * busy; dataRef.current.running = d.running;
  const showPlate = s.hero !== false;
  React.useEffect(() => showPlate ? mountWhale(plateRef.current, cvRef.current, dataRef.current) : undefined, [showPlate]);
  const now = new Date(), [en] = greeting();
  const first = d.first ? new Date(d.first) : now;
  return h("div", { className: "ja-root ja-hero" },
    h("div", { className: "ja-dl" },
      h("span", { className: "ja-caps" }, `${WEEK[now.getDay()]} · ${MONTHS[now.getMonth()]} ${now.getDate()}`),
      h("span", { className: "ja-rule" }),
      h("span", { className: "ja-caps" }, `Day ${d.dayNo} · since ${MONTHS[first.getMonth()]} ${first.getDate()}`)),
    showPlate ? h("div", { className: "ja-plate", ref: plateRef, title: "移动鼠标打光 · 点击喷水" },
      h("canvas", { ref: cvRef, "aria-label": "ASCII whale" }),
      h("span", { className: "ja-pc ja-tl" }, "Plate ", h("b", null, "XII"))) : null,
    h("p", { className: "ja-line" }, `${en}, ${displayName(st)} — `, h("em", null, "one piece at a time.")),
    u && s.heat !== false ? h(Heat, { d, s }) : null);
}
/* Display name: Settings → Atelier → Name, else the signed-in account shown in the
 * sidebar footer, else the OS user name reported by the host. */
function accountName() {
  try {
    const el = [...document.querySelectorAll('[class*="_footArea"] [class*="_label"]')].find((e) => !e.closest(".ja-root"));
    const t = el && (el.textContent || "").trim();
    return t && t.length <= 24 && !t.includes("@") ? t : "";
  } catch { return ""; }
}
function displayName(st) {
  const set = ((st.settings && st.settings.name) || "").trim();
  if (set) return set;
  const acc = accountName(); if (acc) return acc;
  const os = st.usage && st.usage.user;
  return os ? os.charAt(0).toUpperCase() + os.slice(1) : "friend";
}
function BrandMark({ size }) {
  const st = useStore(), sz = size || 24, n = displayName(st);
  return h("span", { className: "ja-root ja-mark", style: { width: sz, height: sz, fontSize: Math.round(sz * .62) } }, Array.from(n)[0].toUpperCase());
}
function BrandName() {
  const st = useStore();
  return h("span", { className: "ja-root ja-name" }, h("b", null, displayName(st)), h("span", null, "Atelier"));
}

/* ---- popover plumbing ---- */
function usePopover() {
  const [open, setOpen] = React.useState(false), [pos, setPos] = React.useState(null);
  const anchor = React.useRef(null), panel = React.useRef(null);
  React.useLayoutEffect(() => {
    if (!open || !anchor.current) return;
    const place = () => {
      const r = anchor.current.getBoundingClientRect(), w = 340, H = panel.current ? panel.current.offsetHeight : 420;
      const left = Math.max(12, Math.min(window.innerWidth - w - 12, r.left + r.width / 2 - w / 2));
      const top = r.top - H - 10 > 12 ? r.top - H - 10 : Math.min(window.innerHeight - H - 12, r.bottom + 10);
      setPos({ left, top });
    };
    place(); const ro = new ResizeObserver(place); if (panel.current) ro.observe(panel.current);
    window.addEventListener("resize", place);
    const down = (e) => { if (!panel.current?.contains(e.target) && !anchor.current?.contains(e.target)) setOpen(false); };
    const key = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", down, true); document.addEventListener("keydown", key);
    return () => { ro.disconnect(); window.removeEventListener("resize", place); document.removeEventListener("pointerdown", down, true); document.removeEventListener("keydown", key); };
  }, [open]);
  return { open, setOpen, pos, anchor, panel };
}
const portal = (node) => ReactDOM.createPortal(node, document.body);

function Spark({ d, n }) {
  const days = lastDays(d, n), max = Math.max(1e-9, ...days.map((x) => x[1]));
  return h("div", { className: "ja-spark", "aria-hidden": true }, days.map(([k, v]) => h("i", { key: k, className: k === d.todayIso ? "ja-today" : undefined, title: `${k} · ${money(v, store.settings)}`, style: { height: `${Math.max(4, (v / max) * 100)}%` } })));
}
function BudgetBar({ d, s }) {
  const ref = s.budget > 0 ? s.budget / (s.currency === "CNY" ? +s.rate || 7.1 : 1) : d.avgCost * 1.5;
  const r = ref > 0 ? d.todayCost / ref : 0;
  return h(React.Fragment, null,
    h("div", { className: "ja-bar" + (s.budget > 0 && r > 1 ? " ja-warn" : "") }, h("i", { style: { width: `${Math.min(100, r * 100)}%` } })),
    h("div", { className: "ja-meta" }, h("span", null, "Today ", h("b", null, money(d.todayCost, s))),
      h("span", null, s.budget > 0 ? `budget ${money(ref, s)}` : `avg ${money(d.avgCost, s)}/day`)));
}
function LedgerPanel({ session, d, s, onSettings }) {
  const by = (session && session.by) || {}, tot = sumBag(by), p = (i) => Object.entries(by).reduce((a, [m, v]) => a + (v[i] * priceOf(m, s)[i]) / 1e6, 0);
  const cost = bagCost(by, s), ctxPct = session && session.ctxWin ? Math.min(100, (session.ctxUsed / session.ctxWin) * 100) : 0;
  const models = Object.entries(by).sort((a, b) => costOf(b[0], b[1], s) - costOf(a[0], a[1], s));
  const row = (label, tokens, usd, key) => h("div", { className: "ja-row", key: key || label }, h("span", null, label), h("i", null, fmt(tokens)), h("b", null, money(usd, s)));
  return h(React.Fragment, null,
    h("section", null,
      h("h4", null, "Ledger · this session"),
      h("div", { className: "ja-big" }, h("b", null, money(cost, s)), h("span", null, `${fmt(tot[0] + tot[1] + tot[2])} tokens`)),
      session && session.title ? h("div", { className: "ja-title" }, session.title) : h("div", { className: "ja-title" }, "A fresh sheet — nothing spent yet.")),
    tot[3] ? h("section", null,
      row("Input", tot[0], p(0)), row("Cache read", tot[1], p(1)), row("Output", tot[2], p(2)),
      h("div", { className: "ja-meta", style: { marginTop: 6 } }, h("span", null, `${tot[3]} calls · ${session.turns || 0} turns`), h("span", null, `cache hit ${Math.round((tot[1] / Math.max(1, tot[0] + tot[1])) * 100)}%`))) : null,
    models.length > 1 ? h("section", null, h("h4", null, "By model"), h("div", { style: { marginTop: 6 } },
      models.map(([m, v]) => h("div", { className: "ja-row ja-model", key: m }, h("span", null, h("i", { className: "ja-dot" }), h("em", null, m)), h("i", null, fmt(v[0] + v[1] + v[2])), h("b", null, money(costOf(m, v, s), s)))))) : null,
    session && session.ctxWin ? h("section", null, h("h4", null, "Context"),
      h("div", { className: "ja-bar" + (ctxPct > 85 ? " ja-warn" : "") }, h("i", { style: { width: `${ctxPct}%` } })),
      h("div", { className: "ja-meta" }, h("span", null, h("b", null, fmt(session.ctxUsed)), ` / ${fmt(session.ctxWin)}`), h("span", null, `${Math.round(ctxPct)}% · ${session.compactions || 0} compactions`))) : null,
    h("section", null, h("h4", null, "The house · last 14 days"), h(Spark, { d, n: 14 }), h(BudgetBar, { d, s }),
      h("div", { className: "ja-meta", style: { marginTop: 4 } }, h("span", null, `${MONTHS[new Date().getMonth()]} `, h("b", null, money(d.monthCost, s))), h("span", null, "all time ", h("b", null, money(d.totalCost, s))))),
    h("div", { className: "ja-foot" }, h("span", null, "prices are estimates."), h("span", { className: "ja-caps" }, "Settings → Atelier")));
}
function LedgerChip({ sessionId }) {
  const st = useStore(), s = st.settings, d = derive(st.usage, s), pop = usePopover();
  if (s.ledger === false || !st.usage) return null;
  const session = st.usage.sessions.find((x) => x.id === sessionId);
  const cost = session ? bagCost(session.by, s) : 0, tok = session ? bagTokens(session.by) : 0;
  return h(React.Fragment, null,
    h("button", { type: "button", ref: pop.anchor, className: "ja-root ja-chip" + (session && session.running ? " ja-live" : ""), "aria-expanded": pop.open, "aria-label": "Session ledger", title: "本会话费用 · 点击查看账本",
      onClick: () => { if (!pop.open) refresh(true); pop.setOpen(!pop.open); } },
      h("span", { className: "ja-coin" }, s.currency === "CNY" ? "¥" : "$"), h("b", null, money(cost, s).replace(/^[¥$]/, ""))),
    pop.open ? portal(h("div", { ref: pop.panel, className: "ja-root ja-panel", role: "dialog", "aria-label": "Ledger", style: pop.pos || { visibility: "hidden", left: 0, top: 0 } },
      h(LedgerPanel, { session, d, s, onSettings: null }))) : null);
}
function SideLedger() {
  const st = useStore(), s = st.settings, d = derive(st.usage, s), pop = usePopover();
  if (s.sideLedger === false || !st.usage) return null;
  const latest = st.usage.sessions[0];
  return h(React.Fragment, null,
    h("button", { type: "button", ref: pop.anchor, className: "ja-root ja-side", "aria-expanded": pop.open, title: "今日费用 · 点击查看账本", onClick: () => pop.setOpen(!pop.open) },
      h("div", { className: "ja-top" }, h("span", { className: "ja-caps" }, "Today"), h("b", null, money(d.todayCost, s))),
      h(Spark, { d, n: 14 }),
      h("div", { className: "ja-meta", style: { marginTop: 5 } }, h("span", null, `${fmt(d.today)} tok`), h("span", null, `${MONTHS[new Date().getMonth()]} ${money(d.monthCost, s)}`))),
    pop.open ? portal(h("div", { ref: pop.panel, className: "ja-root ja-panel", role: "dialog", "aria-label": "Ledger", style: pop.pos || { visibility: "hidden", left: 0, top: 0 } },
      h(LedgerPanel, { session: latest, d, s, onSettings: null }))) : null);
}

/* ---- settings section ---- */
function Sw({ on, onChange, label }) { return h("button", { type: "button", role: "switch", className: "ja-sw", "aria-checked": !!on, "aria-label": label, onClick: () => onChange(!on) }); }
function Opt({ title, desc, children }) { return h("div", { className: "ja-opt" }, h("div", null, h("strong", null, title), desc ? h("small", null, desc) : null), children); }
function TxtIn({ value, onCommit, placeholder }) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => setV(value), [value]);
  return h("input", { className: "ja-in", value: v, placeholder, maxLength: 24, style: { width: 150, textAlign: "left" }, onChange: (e) => setV(e.target.value), onBlur: () => onCommit(v.trim()), onKeyDown: (e) => { if (e.key === "Enter") e.currentTarget.blur(); } });
}
function NumIn({ value, onCommit, step, width }) {
  const [v, setV] = React.useState(String(value));
  React.useEffect(() => setV(String(value)), [value]);
  const commit = () => { const n = Number(v); if (Number.isFinite(n) && n >= 0) onCommit(n); else setV(String(value)); };
  return h("input", { className: "ja-in", inputMode: "decimal", value: v, step, style: width ? { width } : undefined, onChange: (e) => setV(e.target.value), onBlur: commit, onKeyDown: (e) => { if (e.key === "Enter") e.currentTarget.blur(); } });
}
function AtelierSettings() {
  const st = useStore(), s = st.settings, d = derive(st.usage, s);
  const set = (k) => (v) => setSettings({ [k]: v });
  const models = Object.entries((st.usage && st.usage.models) || {}).sort((a, b) => costOf(b[0], b[1], s) - costOf(a[0], a[1], s));
  const setPrice = (m, i, n) => { const cur = priceOf(m, s).slice(); cur[i] = n; setSettings({ prices: { ...s.prices, [m]: cur } }); };
  const resetPrice = (m) => { const next = { ...s.prices }; delete next[m]; setSettings({ prices: next }); };
  return h("div", { className: "ja-root ja-set" },
    h("header", null, h("div", null, h("span", { className: "ja-caps" }, "Atelier · v" + ((upd.info && upd.info.current) || VERSION)), h("h3", null, "The ", h("em", null, "atelier"), " settings"),
      h("p", null, "纸与金的皮肤、鲸鱼首页、账本与上下文——全部在本机计算，不上传任何数据。")),
      h(BrandMark, { size: 44 })),
    h(Opt, { title: "Name", desc: "侧栏字标、首页问候里显示的名字。留空则自动读取账号名或系统用户名。" }, h(TxtIn, { value: s.name || "", placeholder: (() => { const a = accountName() || (st.usage && st.usage.user) || ""; return a ? "auto · " + a : "auto"; })(), onCommit: set("name") })),
    h("h5", null, "Appearance"),
    h(Opt, { title: "Atelier skin", desc: "纸色、金线、墨色按钮，覆盖侧栏、消息、输入框、弹窗与菜单。关闭后只保留配色。" }, h(Sw, { on: s.skin, onChange: set("skin"), label: "Atelier skin" })),
    h(Opt, { title: "Engraved icons", desc: "侧栏、输入框、消息操作栏的小图标换成手绘的细线版本，带一点金色点缀。" }, h(Sw, { on: s.icons !== false, onChange: set("icons"), label: "Engraved icons" })),
    h(Opt, { title: "Typography", desc: "正文 Manrope + 苹方，标题与数字 Cormorant Garamond。" }, h(Sw, { on: s.fonts, onChange: set("fonts"), label: "Typography" })),
    h(Opt, { title: "Paper grain", desc: "极淡的纸纹底。" }, h(Sw, { on: s.paper, onChange: set("paper"), label: "Paper grain" })),
    h(Opt, { title: "Motion", desc: "消息浮现、按钮金光扫过、弹窗过渡。系统开启“减少动态效果”时自动停用。" }, h(Sw, { on: s.motion, onChange: set("motion"), label: "Motion" })),
    h("h5", null, "Home"),
    h(Opt, { title: "Engraved whale", desc: "首页铜版鲸鱼：今天用得越多刻线越密，会话运行时会喷水。" }, h(Sw, { on: s.hero, onChange: set("hero"), label: "Whale" })),
    h(Opt, { title: "Token heatmap", desc: "铺满宽度的每日用量热力图，加上今日 / 本月费用。" }, h(Sw, { on: s.heat, onChange: set("heat"), label: "Heatmap" })),
    h("h5", null, "Ledger"),
    h(Opt, { title: "Session ledger", desc: "输入框下方显示本会话费用，点开看分项、模型与上下文占用。" }, h(Sw, { on: s.ledger, onChange: set("ledger"), label: "Session ledger" })),
    h(Opt, { title: "Sidebar ledger", desc: "侧栏底部显示今日费用和 14 天走势。" }, h(Sw, { on: s.sideLedger, onChange: set("sideLedger"), label: "Sidebar ledger" })),
    h(Opt, { title: "Currency", desc: s.currency === "CNY" ? "价格表以美元计，按汇率换算。" : "价格表原样以美元显示。" },
      s.currency === "CNY" ? h(NumIn, { value: s.rate, onCommit: set("rate") }) : null,
      h("div", { className: "ja-seg" }, ["CNY", "USD"].map((c) => h("button", { key: c, type: "button", "aria-pressed": s.currency === c, onClick: () => setSettings({ currency: c }) }, c === "CNY" ? "¥ CNY" : "$ USD")))),
    h(Opt, { title: "Daily budget", desc: `以${s.currency === "CNY" ? "人民币" : "美元"}计，0 表示不设预算（进度条改为对比日均）。今天已花 ${money(d.todayCost, s)}。` }, h(NumIn, { value: s.budget, onCommit: set("budget") })),
    h("h5", null, "Price book · USD per 1M tokens"),
    h("table", { className: "ja-prices" },
      h("thead", null, h("tr", null, h("th", null, "Model"), h("th", null, "Input"), h("th", null, "Cache"), h("th", null, "Output"), h("th", null, "Spent"), h("th", null, ""))),
      h("tbody", null, models.map(([m, v]) => {
        const p = priceOf(m, s), custom = !!(s.prices && s.prices[m]);
        return h("tr", { key: m },
          h("td", { title: m }, m, h("small", null, custom ? "custom" : bookPrice(m).label)),
          [0, 1, 2].map((i) => h("td", { key: i }, h(NumIn, { value: p[i], onCommit: (n) => setPrice(m, i, n) }))),
          h("td", { className: "ja-c" }, money(costOf(m, v, s), s)),
          h("td", null, custom ? h("button", { type: "button", className: "ja-link", onClick: () => resetPrice(m) }, "Reset") : null));
      }))),
    h("p", { className: "ja-note" }, "价格为估算值：标注 est. 的模型请按你的实际账单改一下，改动会立即反映到账本与首页。"),
    h(UpdateSection, { s }));
}

/* ---------------- class-hash remapping ----------------
 * The skin targets CSS-module classes like "pXSMma_headline". Module hashes differ
 * between builds (web vs desktop, and across app updates), so at runtime each
 * reference hash is matched to the live module whose class-name set overlaps best,
 * and the skin is rewritten to the live hashes. */
const SIG = __SIG__;
function liveModules() {
  const g = new Map();
  const add = (c) => {
    const i = c.lastIndexOf("_"); if (i <= 0) return;
    const hsh = c.slice(0, i), n = c.slice(i + 1);
    if (!/^_?[A-Za-z0-9-][A-Za-z0-9_-]{5}$/.test(hsh) || !/^[A-Za-z][A-Za-z0-9]*$/.test(n)) return;
    let set = g.get(hsh); if (!set) g.set(hsh, (set = new Set())); set.add(n);
  };
  const walk = (rules) => { for (const r of rules) { if (r.selectorText) for (const m of r.selectorText.matchAll(/\.([A-Za-z0-9_-]+)/g)) add(m[1]); if (r.cssRules) walk(r.cssRules); } };
  for (const sh of document.styleSheets) { if (sh.ownerNode && sh.ownerNode.dataset && sh.ownerNode.dataset.plugin === name) continue; try { walk(sh.cssRules); } catch {} }
  return g;
}
function hashMap() {
  const live = liveModules(), map = {};
  for (const [ref, names] of Object.entries(SIG)) {
    if (live.has(ref)) continue;
    const want = new Set(names); let best = null, bs = 0, second = 0;
    for (const [hsh, set] of live) {
      let inter = 0; for (const n of set) if (want.has(n)) inter++;
      const sc = inter / (want.size + set.size - inter);
      if (sc > bs) { second = bs; bs = sc; best = hsh; } else if (sc > second) second = sc;
    }
    if (best && bs >= 0.3 && bs > second * 1.25) map[ref] = best;
  }
  return map;
}
function remap(css, map) {
  return css.replace(/\[class\*=([A-Za-z0-9_-]+)\]/g, (all, tok) => {
    const i = tok.lastIndexOf("_"); const to = i > 0 && map[tok.slice(0, i)];
    return to ? `[class*=${to}_${tok.slice(i + 1)}]` : all;
  });
}
function adaptiveStyle(id, css) {
  const remove = addStyle(id, css); let last = "", t = 0;
  const run = () => { const map = hashMap(), key = JSON.stringify(map); if (key !== last) { last = key; addStyle(id, remap(css, map)); } };
  run();
  const mo = new MutationObserver(() => { clearTimeout(t); t = setTimeout(run, 250); });
  mo.observe(document.head, { childList: true, subtree: true });
  return () => { mo.disconnect(); clearTimeout(t); remove(); };
}

/* ---------------- engraved icons ----------------
 * Host icons are recognised by the geometry of their children (tag + head of the path
 * data), never by class names. The original children stay in place (React keeps
 * owning them) and are hidden by CSS; the hand-drawn version is appended as
 * <g class="ja-ic"> and removed again when the skin or the option is turned off.
 */
const ICONS = __ICONS__;
const GEOM = ["cx", "cy", "x", "y", "r", "width"];
function sigOf(svg) {
  const out = [];
  for (const c of svg.querySelectorAll("*")) {
    if (c.closest(".ja-ic")) continue;
    const d = c.getAttribute("d");
    out.push(c.tagName.toLowerCase() + ":" + (d || GEOM.map((a) => c.getAttribute(a) || "").join(",")).slice(0, 12));
  }
  return out.join("|");
}
function engrave(svg) {
  if (!(svg instanceof SVGSVGElement) || svg.closest(".ja-root")) return;
  const s = sigOf(svg), art = ICONS[s];
  let g = svg.querySelector(":scope>g.ja-ic");
  if (!art) { if (g) { g.remove(); svg.removeAttribute("data-ja-ic"); } return; }
  if (g && g.dataset.sig === s) return;
  if (!g) { g = document.createElementNS("http://www.w3.org/2000/svg", "g"); g.setAttribute("class", "ja-ic"); }
  const over = art[0] === "+";
  g.dataset.sig = s; g.innerHTML = over ? art.slice(1) : art;
  svg.appendChild(g); svg.setAttribute("data-ja-ic", over ? "over" : "swap");
}
let icObs = null, icQueue = new Set(), icRaf = 0;
function icFlush() {
  icRaf = 0;
  const q = [...icQueue]; icQueue.clear();
  for (const n of q) { if (!n.isConnected) continue; if (n instanceof SVGSVGElement) engrave(n); n.querySelectorAll && n.querySelectorAll("svg").forEach(engrave); }
}
function icPush(n) { if (n) icQueue.add(n); if (!icRaf) icRaf = requestAnimationFrame(icFlush); }
function syncIcons(on) {
  if (on && !icObs && document.body) {
    icObs = new MutationObserver((ms) => {
      for (const m of ms) {
        const t = m.target;
        if (t.closest && t.closest(".ja-ic")) continue;
        const svg = t instanceof SVGElement ? (t instanceof SVGSVGElement ? t : t.ownerSVGElement) : null;
        if (svg) { if (!(m.type === "childList" && [...m.addedNodes].every((x) => x.classList && x.classList.contains("ja-ic")))) icPush(svg); }
        else m.addedNodes.forEach((x) => x.nodeType === 1 && icPush(x));
      }
    });
    icObs.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["d"] });
    icPush(document.body);
  } else if (!on && icObs) {
    icObs.disconnect(); icObs = null; icQueue.clear();
    document.querySelectorAll("g.ja-ic").forEach((g) => g.remove());
    document.querySelectorAll("svg[data-ja-ic]").forEach((s) => s.removeAttribute("data-ja-ic"));
  }
}

/* ---------------- plugin ---------------- */
function addStyle(id, text) {
  let el = document.getElementById(id);
  if (!el) { el = document.createElement("style"); el.id = id; el.dataset.plugin = name; document.head.appendChild(el); }
  el.textContent = text;
  return () => el.remove();
}
function apply(ctx) {
  ctx.effect(() => {
    const a = addStyle("ja-fonts", FONT_CSS), b = adaptiveStyle("ja-skin", SKIN_CSS), c = adaptiveStyle("ja-parts", PARTS_CSS);
    applyBodyFlags(); loadSettings();
    const nt = setTimeout(() => updNotice().catch(() => {}), 4000);
    return () => { clearTimeout(nt); a(); b(); c(); ["ja-skin", "ja-fonts", "ja-paper", "ja-motion"].forEach((k) => document.body.classList.remove(k)); syncIcons(false); };
  }, "jules-atelier: styles");
  ctx.effect(() => {
    try { return ctx.theme.overrideTokens(name, TOKENS); }
    catch (e) { console.error("jules-atelier: theme override failed", e); return () => {}; }
  }, "jules-atelier: palette");
  const reg = (slot, opts, comp) => ctx.slots.inject(slot, () => ctx.slots.register({ name: slot, ...opts }, comp));
  reg("conversation.hero.brand.mark", { priority: -10 }, HeroMark);
  reg("sidebar.brand.mark", { priority: -10 }, BrandMark);
  reg("sidebar.brand.name", { priority: -10 }, BrandName);
  reg("conversation.composer.dock", { id: "jules-atelier-ledger", order: 90, inject: (sessionId) => ({ sessionId }) }, LedgerChip);
  reg("sidebar.footer.action", { id: "jules-atelier-ledger", order: -10 }, SideLedger);
  reg("settings.section", { id: "jules-atelier", order: 60, label: "Atelier" }, AtelierSettings);
}
