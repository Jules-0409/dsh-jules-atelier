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
const DEFAULTS = { name: "", skin: true, fonts: true, paper: true, motion: true, hero: true, heat: true, icons: true, palette: "atelier", sea: true, ledger: true, sideLedger: true, currency: "CNY", rate: 7.1, budget: 0, prices: {}, update: "auto", notes: true, timeOfDay: true };
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
  const url = ep === "usage" ? "api/jules-atelier.usage?tz=" + new Date().getTimezoneOffset() + (payload && payload.fresh ? "&fresh=1" : "") : "api/jules-atelier.settings";
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
  store.loaded = true; applyBodyFlags(); syncPalette(); syncBotTheme(); emit();
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
    h(Sec, { no: "V", en: "Updates", zh: "更新" }),
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
  syncPalette(); seaCheck();
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
function Heat({ d, s, onDay }) {
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
    cells.push(h("i", { key: k, title: `${k} · ${fmt(v)} tokens · ${money(d.dayCost[k] || 0, s)}${v && onDay ? " · 点击看日报" : ""}`, className: v && onDay ? "ja-on" : undefined, onClick: v && onDay ? () => onDay(k) : undefined, style: { background: l ? `var(--h${l})` : undefined, opacity: future ? 0 : 1 } }));
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
  const now = new Date(), occ = occasion(now), phase = (() => { try { return localStorage.getItem("ja-phase"); } catch { return null; } })() || phaseOf(now.getHours());
  dataRef.current.phase = s.timeOfDay === false ? "day" : phase; dataRef.current.full = !!(occ && occ[2] === "moon");
  React.useEffect(() => showPlate ? mountWhale(plateRef.current, cvRef.current, dataRef.current) : undefined, [showPlate]);
  const [note, setNote] = React.useState(null);
  const [en] = occ || greeting();
  const first = d.first ? new Date(d.first) : now;
  return h("div", { className: "ja-root ja-hero" },
    h("div", { className: "ja-dl" },
      h("span", { className: "ja-caps" }, `${WEEK[now.getDay()]} · ${MONTHS[now.getMonth()]} ${now.getDate()}`),
      h("span", { className: "ja-rule" }),
      h("span", { className: "ja-caps" }, `Day ${d.dayNo} · since ${MONTHS[first.getMonth()]} ${first.getDate()}`)),
    showPlate ? h("div", { className: "ja-plate", ref: plateRef, title: "移动鼠标打光 · 点击喷水" },
      h("canvas", { ref: cvRef, "aria-label": "ASCII whale" }),
      h("span", { className: "ja-pc ja-tl" }, "Plate ", h("b", null, "XII"), s.timeOfDay === false ? null : " · " + { dawn: "Dawn", day: "Noon", dusk: "Dusk", night: "Nocturne" }[phase])) : null,
    h("p", { className: "ja-line" }, `${en}, ${displayName(st)} — `, h("em", null, occ ? occ[1] + "." : "one piece at a time.")),
    u && s.notes !== false ? h(NoteCard, { d, s, onOpen: setNote }) : null,
    u && s.heat !== false ? h(Heat, { d, s, onDay: s.notes !== false ? (k) => setNote({ kind: "day", day: k }) : null }) : null,
    note ? h(NoteView, { note, onClose: () => setNote(null) }) : null);
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
function SessionHover({ sessionId }) {
  const st = useStore(), s = st.settings;
  if (!s.skin || !st.usage) return null;
  const x = st.usage.sessions.find((v) => v.id === sessionId);
  if (!x) return null;
  const tok = bagTokens(x.by), cost = bagCost(x.by, s), ctx = x.ctxWin ? Math.min(100, (x.ctxUsed / x.ctxWin) * 100) : 0;
  const dir = (x.cwd || "").replace(/^\/Users\/[^/]+|^\/home\/[^/]+|^[A-Z]:\\Users\\[^\\]+/i, "~");
  const dt = (ms) => { const d = new Date(ms); return `${d.getMonth() + 1}月${d.getDate()}日`; };
  const row = (k, v) => h("div", { className: "ja-hv-row" }, h("span", null, k), h("b", null, v));
  const work = [x.turns ? `${x.turns} 轮` : "", x.tools ? `${x.tools} 次工具` : "", x.files ? `改 ${x.files} 个文件` : ""].filter(Boolean).join(" · ");
  return h("div", { className: "ja-root ja-hv" },
    x.ask ? h("div", { className: "ja-hv-ask" }, h("span", { className: "ja-caps" }, "最近一问"), h("p", null, x.ask)) : null,
    h("div", { className: "ja-hv-grid" },
      x.model ? row("模型", x.model) : null,
      work ? row("工作", work) : null,
      tok ? row("花费", `${money(cost, s)} · ${fmt(tok)} tok`) : null,
      x.ctxWin ? h("div", { className: "ja-hv-row" }, h("span", null, "上下文"), h("b", null, h("i", { className: "ja-hv-bar" + (ctx > 85 ? " ja-warn" : "") }, h("i", { style: { width: `${ctx}%` } })), `${Math.round(ctx)}%${x.compactions ? ` · 压缩 ${x.compactions} 次` : ""}`)) : null,
      dir ? row("目录", dir) : null,
      x.created ? row("开始", dt(x.created) + (x.last && dt(x.last) !== dt(x.created) ? ` → ${dt(x.last)}` : "")) : null));
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
function Sec({ no, en, zh }) { return h("div", { className: "ja-sh" }, h("span", { className: "ja-sh-no" }, no), h("h5", null, en), h("i", { className: "ja-rule" }), h("small", null, zh)); }
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
    h(Sec, { no: "I", en: "Appearance", zh: "外观" }),
    h(Opt, { title: "Palette", desc: "纸与金：暖白纸色配金线；墨与青：冷调宣纸配青瓷色。浅色与深色模式各自适配。" },
      h("div", { className: "ja-seg" }, [["atelier", "纸与金"], ["ink", "墨与青"]].map(([k, l]) => h("button", { key: k, type: "button", "aria-pressed": (s.palette === "ink" ? "ink" : "atelier") === k, onClick: () => setSettings({ palette: k }) }, l)))),
    h(Opt, { title: "Atelier skin", desc: "纸色、金线、墨色按钮，覆盖侧栏、消息、输入框、弹窗与菜单。关闭后只保留配色。" }, h(Sw, { on: s.skin, onChange: set("skin"), label: "Atelier skin" })),
    h(Opt, { title: "Engraved icons", desc: "侧栏、输入框、消息操作栏的小图标换成手绘的细线版本，带一点金色点缀。" }, h(Sw, { on: s.icons !== false, onChange: set("icons"), label: "Engraved icons" })),
    h(Opt, { title: "Typography", desc: "正文 Manrope + 苹方，标题与数字 Cormorant Garamond。" }, h(Sw, { on: s.fonts, onChange: set("fonts"), label: "Typography" })),
    h(Opt, { title: "Paper grain", desc: "极淡的纸纹底。" }, h(Sw, { on: s.paper, onChange: set("paper"), label: "Paper grain" })),
    h(Opt, { title: "Conversation sea", desc: "会话背景里一片字符画海面：浅色有日光与海鸥，深色有月与星；AI 工作时浪会大一些，偶尔有鲸鱼游过。" }, h(Sw, { on: s.sea !== false, onChange: set("sea"), label: "Conversation sea" })),
    h(Opt, { title: "Motion", desc: "消息浮现、按钮金光扫过、弹窗过渡。系统开启“减少动态效果”时自动停用。" }, h(Sw, { on: s.motion, onChange: set("motion"), label: "Motion" })),
    h(Sec, { no: "II", en: "Home", zh: "首页" }),
    h(Opt, { title: "Engraved whale", desc: "首页铜版鲸鱼：今天用得越多刻线越密，会话运行时会喷水。" }, h(Sw, { on: s.hero, onChange: set("hero"), label: "Whale" })),
    h(Opt, { title: "Time of day", desc: "首页铜版随时间变化：清晨薄雾、白天日轮、傍晚暖金、深夜星点和弯月；节日会换一句问候。" }, h(Sw, { on: s.timeOfDay !== false, onChange: set("timeOfDay"), label: "Time of day" })),
    h(Opt, { title: "Daily & weekly notes", desc: "首页出现「昨日小记」，周一换成「上周小记」；点热力图的任意一天也能翻看那天的日报。" }, h(Sw, { on: s.notes !== false, onChange: set("notes"), label: "Notes" })),
    h(Opt, { title: "Token heatmap", desc: "铺满宽度的每日用量热力图，加上今日 / 本月费用。" }, h(Sw, { on: s.heat, onChange: set("heat"), label: "Heatmap" })),
    h(Sec, { no: "III", en: "Ledger", zh: "账本" }),
    h(Opt, { title: "Session ledger", desc: "输入框下方显示本会话费用，点开看分项、模型与上下文占用。" }, h(Sw, { on: s.ledger, onChange: set("ledger"), label: "Session ledger" })),
    h(Opt, { title: "Sidebar ledger", desc: "侧栏底部显示今日费用和 14 天走势。" }, h(Sw, { on: s.sideLedger, onChange: set("sideLedger"), label: "Sidebar ledger" })),
    h(Opt, { title: "Currency", desc: s.currency === "CNY" ? "价格表以美元计，按汇率换算。" : "价格表原样以美元显示。" },
      s.currency === "CNY" ? h("label", { className: "ja-rate" }, h("span", null, "$1 ="), h(NumIn, { value: s.rate, onCommit: set("rate"), width: 64 }), h("span", null, "¥")) : null,
      h("div", { className: "ja-seg" }, ["CNY", "USD"].map((c) => h("button", { key: c, type: "button", "aria-pressed": s.currency === c, onClick: () => setSettings({ currency: c }) }, c === "CNY" ? "¥ CNY" : "$ USD")))),
    h(Opt, { title: "Daily budget", desc: `以${s.currency === "CNY" ? "人民币" : "美元"}计，0 表示不设预算（进度条改为对比日均）。今天已花 ${money(d.todayCost, s)}。` }, h(NumIn, { value: s.budget, onCommit: set("budget") })),
    h(Sec, { no: "IV", en: "Price book", zh: "USD / 1M tokens" }),
    h("div", { className: "ja-pwrap" }, h("table", { className: "ja-prices" },
      h("colgroup", null, h("col", null), h("col", { style: { width: 78 } }), h("col", { style: { width: 78 } }), h("col", { style: { width: 78 } }), h("col", { style: { width: 74 } }), h("col", { style: { width: 48 } })),
      h("thead", null, h("tr", null, h("th", null, "Model"), h("th", null, "Input"), h("th", null, "Cache"), h("th", null, "Output"), h("th", null, "Spent"), h("th", null, ""))),
      h("tbody", null, models.map(([m, v]) => {
        const p = priceOf(m, s), custom = !!(s.prices && s.prices[m]);
        return h("tr", { key: m },
          h("td", { title: m }, m, h("small", null, custom ? "custom" : bookPrice(m).label)),
          [0, 1, 2].map((i) => h("td", { key: i }, h(NumIn, { value: p[i], onCommit: (n) => setPrice(m, i, n) }))),
          h("td", { className: "ja-c" }, money(costOf(m, v, s), s)),
          h("td", null, custom ? h("button", { type: "button", className: "ja-link", onClick: () => resetPrice(m) }, "Reset") : null));
      })))),
    h("p", { className: "ja-fine" }, "价格为估算值：标注 est. 的模型请按你的实际账单改一下，改动会立即反映到账本与首页。"),
    h(UpdateSection, { s }),
    h("footer", { className: "ja-colo" }, h("i", { className: "ja-rule" }), h("span", null, "one piece at a time."), h("i", { className: "ja-rule" })));
}

/* ---------------- daily & weekly notes ----------------
 * A small "gazette" composed from the host's report endpoint: yesterday's note on the
 * home page (last week's on Mondays), a full page with history navigation, and
 * heatmap cells that open the note for that day. */
const notesCache = new Map();
async function fetchReport(from, to) {
  const k = from + ":" + to, hit = notesCache.get(k);
  if (hit && Date.now() - hit.at < 60000) return hit.v;
  const r = await fetch(`api/jules-atelier.report?from=${from}&to=${to}&tz=${new Date().getTimezoneOffset()}`, { credentials: "same-origin", cache: "no-store" });
  const res = await r.json().catch(() => null);
  if (!res || !res.ok) throw new Error((res && res.error) || `HTTP ${r.status}`);
  notesCache.set(k, { at: Date.now(), v: res.value });
  return res.value;
}
const addDays = (k, n) => { const d = new Date(k + "T12:00:00"); d.setDate(d.getDate() + n); return iso(d); };
const monday = (k) => { const d = new Date(k + "T12:00:00"); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return iso(d); };
const span = (kind, day) => kind === "week" ? [monday(day), addDays(monday(day), 6)] : [day, day];
const WEEK_ZH = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const hm = (ms) => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const base = (p) => (p || "").split(/[\\/]/).filter(Boolean).pop() || "—";
const modelName = (m) => { const l = bookPrice(m).label; return /est\.|Unlisted/.test(l) ? m : l; };
const late = (ms) => { const h = new Date(ms).getHours(); return h >= 23 || h < 4; };
function noteFacts(r, s) {
  const ss = r.sessions, toks = (b) => bagTokens(b);
  const turns = ss.reduce((a, x) => a + x.turns, 0), tokens = toks(r.models), cost = bagCost(r.models, s);
  const ws = {}; for (const x of ss) { const k = base(x.cwd); const w = (ws[k] ||= { name: k, tokens: 0, sessions: 0, turns: 0 }); w.tokens += toks(x.by); w.sessions++; w.turns += x.turns; }
  const wsList = Object.values(ws).sort((a, b) => b.tokens - a.tokens || b.turns - a.turns);
  const models = Object.entries(r.models).map(([m, v]) => [m, toks({ m: v })]).sort((a, b) => b[1] - a[1]);
  const first = ss.reduce((a, x) => (x.first && (!a || x.first < a) ? x.first : a), 0), last = ss.reduce((a, x) => Math.max(a, x.last || 0), 0);
  const ranked = ss.slice().sort((a, b) => toks(b.by) - toks(a.by) || b.turns - a.turns);
  const longest = ss.slice().sort((a, b) => (b.last - b.first) - (a.last - a.first))[0];
  const dayTok = Object.fromEntries(Object.entries(r.days).map(([k, b]) => [k, toks(b)]));
  const busiest = Object.entries(dayTok).sort((a, b) => b[1] - a[1])[0];
  const activeHours = r.hours.filter((x) => x > 0).length;
  // "latest" means latest in the evening; activity after midnight counts as the night before
  const lateKey = (ms) => { const d = new Date(ms); return (d.getHours() < 5 ? d.getHours() + 24 : d.getHours()) * 60 + d.getMinutes(); };
  const latest = ss.filter((x) => x.last).sort((a, b) => lateKey(b.last) - lateKey(a.last))[0];
  const files = new Set(); let cmds = 0, looks = 0;
  for (const x of ss) { const w = x.w || {}; for (const p of w.files || []) files.add(p); for (const [k, n] of Object.entries(w.tools || {})) { if (/^(bash|shell|run|exec|command|terminal|powershell)/i.test(k)) cmds += n; else if (/^web_/i.test(k)) looks += n; } }
  const worked = ss.filter((x) => x.w && (x.w.asks.length || x.w.outs.length)).sort((a, b) => b.turns - a.turns || toks(b.by) - toks(a.by));
  return { sessions: ss.length, turns, tokens, cost, wsList, models, first, last, ranked, longest, dayTok, busiest, activeHours, latest, files: files.size, cmds, looks, worked };
}
/* one readable line out of a chat message: drop code, tables and markdown, keep the first sentence or two */
function headline(text, max) {
  let t = String(text || "").replace(/```[\s\S]*?(```|$)/g, " ").split("\n").map((l) => l.trim()).filter((l) => l && !/^(\||[-*_]{3,}$|>)/.test(l));
  t = t.map((l) => l.replace(/^#+\s*|^[-*+]\s+|^\d+[.)]\s+/, "").replace(/\*\*|__|`/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/^@\S+\s*/, "")).filter(Boolean);
  let out = "";
  for (const l of t) { out += (out ? " " : "") + l; if (out.length >= 24) break; }
  const m = out.match(/^(.{12,}?[。！？!?；;])/); if (m && m[1].length <= max) out = m[1];
  out = out.length > max ? out.slice(0, max - 1).replace(/[，,、：:\s]+$/, "") + "…" : out;
  return out.replace(/\s*[：:]$/, "…");
}
const fileList = (files, cwd) => {
  const names = files.map((p) => { const r = cwd && p.startsWith(cwd) ? p.slice(cwd.length).replace(/^[\\/]+/, "") : p; return r.split(/[\\/]/).pop(); });
  const uniq = [...new Set(names)];
  return uniq.slice(0, 3).join("、") + (files.length > 3 ? ` 等 ${files.length} 个文件` : "");
};
function lede(kind, day, f) {
  if (!f.sessions) return kind === "week" ? "这一周很安静，没有留下记录。" : "这一天很安静，没有留下记录。";
  const today = iso(new Date());
  if (kind === "week") {
    const n = Object.values(f.dayTok).filter((v) => v > 0).length;
    let t = `这一周有 ${n} 天在工作，开了 ${f.sessions} 个会话、聊了 ${f.turns} 轮`;
    if (f.files) t += `，改了 ${f.files} 个文件`;
    if (f.busiest && n > 1) t += `；最忙的是${WEEK_ZH[new Date(f.busiest[0] + "T12:00:00").getDay()]}`;
    if (f.wsList[0] && f.wsList[0].name !== "—") t += `，心思多半在 ${f.wsList[0].name}`;
    t += "。";
    if (f.latest && late(f.latest.last)) t += `最晚的一次停在${WEEK_ZH[new Date(f.latest.last).getDay()]} ${hm(f.latest.last)}。`;
    return t;
  }
  const who = day === today ? "今天" : day === addDays(today, -1) ? "昨天" : day >= addDays(today, -6) ? WEEK_ZH[new Date(day + "T12:00:00").getDay()] : "这一天";
  let t = `${who}开了 ${f.sessions} 个会话、聊了 ${f.turns} 轮`;
  if (f.files) t += `，改了 ${f.files} 个文件`;
  if (f.wsList[0] && f.wsList[0].name !== "—") t += f.wsList.length > 1 ? `，大半时间在 ${f.wsList[0].name}` : `，都在 ${f.wsList[0].name}`;
  t += "；";
  if (f.first && f.last) t += `${hm(f.first)} 动笔，${day === today ? "到现在" : "最后停在 " + hm(f.last)}。`;
  if (f.last && late(f.last) && day !== today) t += "又是一个晚睡的夜。";
  else if (f.models[0]) t += `主力是 ${modelName(f.models[0][0])}。`;
  return t;
}
function dateTitle(kind, day) {
  const d = new Date(day + "T12:00:00");
  if (kind === "week") { const [a, b] = span("week", day), A = new Date(a + "T12:00:00"), B = new Date(b + "T12:00:00"); return `${MONTHS[A.getMonth()]} ${A.getDate()} – ${A.getMonth() === B.getMonth() ? "" : MONTHS[B.getMonth()] + " "}${B.getDate()}`; }
  return `${WEEK[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}
function HatchBar({ v, max }) { return h("i", { className: "ja-hb" }, h("b", { style: { width: `${Math.max(2, (v / (max || 1)) * 100)}%` } })); }
function HourStrip({ hours }) {
  const max = Math.max(1, ...hours);
  return h("div", { className: "ja-hours" },
    h("div", { className: "ja-hcols" }, hours.map((v, i) => h("i", { key: i, title: `${i}:00 · ${v} 次调用`, style: { height: `${v ? Math.max(8, (v / max) * 100) : 0}%` } }))),
    h("div", { className: "ja-hlab" }, ["0", "6", "12", "18", "24"].map((x) => h("span", { key: x }, x))));
}
function WeekBars({ from, dayTok }) {
  const keys = [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(from, i)), max = Math.max(1, ...keys.map((k) => dayTok[k] || 0));
  return h("div", { className: "ja-wbars" }, keys.map((k) => h("div", { key: k, title: `${k} · ${fmt(dayTok[k] || 0)} tokens` },
    h("span", null, h("i", { style: { height: `${dayTok[k] ? Math.max(6, (dayTok[k] / max) * 100) : 0}%` } })),
    h("small", null, WEEK_ZH[new Date(k + "T12:00:00").getDay()].slice(1)))));
}
function NoteView({ note, onClose }) {
  const st = useStore(), s = st.settings, d = derive(st.usage, s);
  const [kind, setKind] = React.useState(note.kind), [day, setDay] = React.useState(note.day);
  const [rep, setRep] = React.useState(null), [err, setErr] = React.useState("");
  const [from, to] = span(kind, day), today = iso(new Date());
  React.useEffect(() => { let on = true; setErr(""); fetchReport(from, to).then((v) => on && setRep(v), (e) => on && setErr(String(e.message || e))); return () => { on = false; }; }, [from, to]);
  React.useEffect(() => { const k = (e) => { if (e.key === "Escape") onClose(); if (e.key === "ArrowLeft") step(-1); if (e.key === "ArrowRight") step(1); }; document.addEventListener("keydown", k); return () => document.removeEventListener("keydown", k); });
  const step = (n) => { const next = addDays(day, n * (kind === "week" ? 7 : 1)); if (span(kind, next)[0] <= today) setDay(next > today ? today : next); };
  const ready = rep && rep.from === from && rep.to === to, f = ready ? noteFacts(rep, s) : null;
  const no = Math.max(1, d.first ? Math.floor((new Date(from) - new Date(d.first)) / (kind === "week" ? 6048e5 : 864e5)) + 1 : 1);
  const fig = (label, val, unit) => h("div", { key: label }, h("small", { className: "ja-caps" }, label), h("b", null, val, unit ? h("u", null, unit) : null));
  const [tk, tu] = split(f ? f.tokens : 0);
  return portal(h("div", { className: "ja-root ja-note-bg", onPointerDown: (e) => { if (e.target === e.currentTarget) onClose(); } },
    h("article", { className: "ja-note", role: "dialog", "aria-label": kind === "week" ? "Weekly note" : "Daily note" },
      h("button", { type: "button", className: "ja-x", "aria-label": "关闭", onClick: onClose }, "×"),
      h("header", { className: "ja-mast" },
        h("div", { className: "ja-mrow" },
          h("span", { className: "ja-caps" }, kind === "week" ? `The Weekly Note · No. ${no}` : `The Daily Note · No. ${no}`),
          h("div", { className: "ja-seg" }, [["day", "日报"], ["week", "周报"]].map(([k, l]) => h("button", { key: k, type: "button", "aria-pressed": kind === k, onClick: () => setKind(k) }, l)))),
        h("div", { className: "ja-mtitle" },
          h("button", { type: "button", className: "ja-nav", "aria-label": "上一个", onClick: () => step(-1) }, "‹"),
          h("h2", null, dateTitle(kind, day)),
          h("button", { type: "button", className: "ja-nav", "aria-label": "下一个", disabled: to >= today, onClick: () => step(1) }, "›")),
        h("div", { className: "ja-orn", "aria-hidden": true }, h("i"), h("span", { className: "ja-orn-whale" }), h("i"))),
      err ? h("p", { className: "ja-lede" }, "读取失败：" + err) : !f ? h("p", { className: "ja-lede ja-dim" }, "正在翻页…") : h(React.Fragment, null,
        h("p", { className: "ja-lede" }, lede(kind, day, f)),
        f.sessions ? h(React.Fragment, null,
          h("div", { className: "ja-figs" },
            fig("Sessions", f.sessions), fig("Turns", f.turns), fig("Files", f.files), fig("Tokens", tk, tu), fig("Spent", money(f.cost, s))),
          h("p", { className: "ja-facts" }, [
            f.first ? `${kind === "week" ? WEEK_ZH[new Date(f.first).getDay()] + " " : ""}${hm(f.first)} 动笔` : "",
            f.last ? `${kind === "week" ? WEEK_ZH[new Date(f.last).getDay()] + " " : ""}${hm(f.last)} 收笔` : "",
            f.cmds ? `${f.cmds} 条命令` : "", f.looks ? `查了 ${f.looks} 次资料` : "",
            d.streak > 1 ? `至今连续 ${d.streak} 天` : ""].filter(Boolean).join("  ·  ")),
          f.worked.length ? h("section", null, h("h6", { className: "ja-caps" }, "What got done · 工作总结"),
            h("ol", { className: "ja-done" }, f.worked.slice(0, kind === "week" ? 8 : 6).map((x) => {
              const w = x.w, ask = w.asks[0] && headline(w.asks[0][1], 56), out = w.outs.length && headline(w.outs[w.outs.length - 1][1], 96);
              const tn = Object.entries(w.tools || {}).reduce((a, [k, n]) => a + (/^(bash|shell|run|exec|command|terminal|powershell)/i.test(k) ? n : 0), 0);
              const span = x.first ? (iso(new Date(x.first)) !== iso(new Date(x.last)) ? `${WEEK_ZH[new Date(x.first).getDay()]} ${hm(x.first)}–${WEEK_ZH[new Date(x.last).getDay()]} ${hm(x.last)}` : `${hm(x.first)}–${hm(x.last)}`) : "";
              return h("li", { key: x.id },
                h("div", { className: "ja-dh" }, h("b", null, x.title || "Untitled"), h("small", null, [base(x.cwd), span, `${x.turns} 轮`].filter(Boolean).join(" · "))),
                ask ? h("p", null, h("i", null, "问"), ask) : null,
                out ? h("p", null, h("i", null, "成"), out) : null,
                w.files.length || tn ? h("p", { className: "ja-dim" }, h("i", null, "改"), [w.files.length ? fileList(w.files, x.cwd) : "", tn ? `${tn} 条命令` : ""].filter(Boolean).join(" · ")) : null);
            }))) : null,
          h("div", { className: "ja-cols" },
            h("section", null, h("h6", { className: "ja-caps" }, kind === "week" ? "Day by day" : "Hour by hour"),
              kind === "week" ? h(WeekBars, { from, dayTok: f.dayTok }) : h(HourStrip, { hours: rep.hours })),
            h("section", null, h("h6", { className: "ja-caps" }, "Where & with whom"),
              h("ul", { className: "ja-ws" },
                f.wsList.slice(0, 3).map((w) => h("li", { key: "w" + w.name }, h("span", null, w.name), h(HatchBar, { v: w.tokens, max: f.wsList[0].tokens }), h("small", null, `${w.sessions} 会话`))),
                f.models.slice(0, 3).map(([m, v]) => h("li", { key: "m" + m, className: "ja-mod" }, h("span", { title: m }, modelName(m)), h(HatchBar, { v, max: f.models[0][1] }), h("small", null, Math.round((v / (f.tokens || 1)) * 100) + "%"))))))) : null),
      h("footer", { className: "ja-nfoot" }, h("span", null, "Composed locally from your session logs"), h("span", null, "← → 翻页 · Esc 关闭")))));
}
const noteSeenKey = (n) => `ja-note-seen:${n.kind}:${n.day}`;
function pendingNote(d) {
  const today = new Date(), t = iso(today);
  if (today.getDay() === 1) { const from = addDays(monday(t), -7); const n = { kind: "week", day: from }; let any = 0; for (let i = 0; i < 7; i++) any += d.days[addDays(from, i)] || 0; if (any) return n; }
  for (let i = 1; i <= 7; i++) { const k = addDays(t, -i); if (d.days[k]) return { kind: "day", day: k }; }
  return null;
}
function NoteCard({ d, s, onOpen }) {
  const n = pendingNote(d), [, force] = React.useReducer((x) => x + 1, 0);
  const [rep, setRep] = React.useState(null);
  const seen = (() => { try { return n && localStorage.getItem(noteSeenKey(n)); } catch { return null; } })();
  const key = n ? n.kind + n.day : "";
  React.useEffect(() => { if (!n || seen) return; let on = true; const [a, b] = span(n.kind, n.day); fetchReport(a, b).then((v) => on && setRep(v), () => {}); return () => { on = false; }; }, [key, !!seen]);
  if (!n || seen || !rep) return null;
  const f = noteFacts(rep, s), dismiss = (e) => { e.stopPropagation(); try { localStorage.setItem(noteSeenKey(n), "1"); } catch {} force(); };
  const label = n.kind === "week" ? "The Weekly Note" : n.day === addDays(iso(new Date()), -1) ? "The Daily Note · Yesterday" : `The Daily Note · ${WEEK[new Date(n.day + "T12:00:00").getDay()]}`;
  const bits = [`${f.sessions} 个会话`, `${f.turns} 轮`];
  if (f.wsList[0] && f.wsList[0].name !== "—") bits.push(f.wsList[0].name);
  if (n.kind === "day" && f.first && f.last) bits.push(`${hm(f.first)}–${hm(f.last)}`);
  return h("div", { className: "ja-ncard", role: "button", tabIndex: 0, title: lede(n.kind, n.day, f), onClick: () => onOpen(n), onKeyDown: (e) => { if (e.key === "Enter") onOpen(n); } },
    h("span", { className: "ja-caps" }, label),
    h("span", { className: "ja-rule" }),
    h("span", { className: "ja-nc-f" }, bits.join("  ·  ")),
    h("span", { className: "ja-rule" }),
    h("em", { className: "ja-nc-go" }, "Read ›"),
    h("button", { type: "button", className: "ja-x", "aria-label": "收起", title: "收起这一期", onClick: dismiss }, "×"));
}

/* ---------------- time of day & small occasions ---------------- */
function phaseOf(hr) { return hr >= 5 && hr < 8 ? "dawn" : hr >= 8 && hr < 17 ? "day" : hr >= 17 && hr < 20 ? "dusk" : "night"; }
const OCCASIONS = {
  "01-01": ["Happy New Year", "新年快乐"], "12-25": ["Merry Christmas", "圣诞快乐"], "12-31": ["Last page of the year", "一年的最后一页"],
  "2026-09-25": ["Happy Mid-Autumn", "月圆人团圆", "moon"], "2027-09-15": ["Happy Mid-Autumn", "月圆人团圆", "moon"], "2028-10-03": ["Happy Mid-Autumn", "月圆人团圆", "moon"],
  "2027-02-06": ["Happy Spring Festival", "新春快乐"], "2028-01-26": ["Happy Spring Festival", "新春快乐"], "2029-02-13": ["Happy Spring Festival", "新春快乐"],
};
function occasion(now) { const k = iso(now); return OCCASIONS[k] || OCCASIONS[k.slice(5)] || null; }

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

/* ---------------- second palette: 墨与青 (ink & celadon) ----------------
 * Derived from the paper-and-gold palette: warm neutrals become cool rice paper,
 * gold becomes celadon teal. State colours (error / warn / success / diff) stay put. */
function inkColor(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), c = (mx - mn) / 255, l = (mx + mn) / 510;
  let hue = 0;
  if (mx !== mn) { const d = mx - mn; hue = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; hue = (hue * 60 + 360) % 360; }
  if (hue < 12 || hue > 72) return [r, g, b];
  const s = c === 0 ? 0 : c / (1 - Math.abs(2 * l - 1));
  let nh, ns, nl = l;
  if (c > 0.16) { nh = 178; ns = Math.min(0.42, s * 0.9); nl = l > 0.5 ? l : l * 0.9; }
  else { nh = 200; ns = s * 0.28; }
  const k = (n) => (n + nh / 30) % 12, a = ns * Math.min(nl, 1 - nl);
  const f = (n) => Math.round(255 * (nl - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
  return [f(0), f(8), f(4)];
}
const hex2 = (n) => n.toString(16).padStart(2, "0").toUpperCase();
function inkify(text) {
  return String(text)
    .replace(/#([0-9a-fA-F]{6})\b/g, (all, hx) => { const v = parseInt(hx, 16); const [r, g, b] = inkColor(v >> 16, (v >> 8) & 255, v & 255); return "#" + hex2(r) + hex2(g) + hex2(b); })
    .replace(/rgba?\((\d+),\s*(\d+),\s*(\d+)/g, (all, r, g, b) => { const o = inkColor(+r, +g, +b); return (all.startsWith("rgba") ? "rgba(" : "rgb(") + o.join(","); })
    .replace(/(--w-[a-z]+:)(\d+),(\d+),(\d+)/g, (all, k, r, g, b) => k + inkColor(+r, +g, +b).join(","))
    .replace(".35  0 0 0 0 .27  0 0 0 0 .16", ".18  0 0 0 0 .26  0 0 0 0 .30")
    .replace(".95  0 0 0 0 .88  0 0 0 0 .72", ".78  0 0 0 0 .90  0 0 0 0 .92");
}
const INK_TOKENS = Object.fromEntries(Object.entries(TOKENS).map(([k, v]) => [k, /warn|error|success|diff|danger/.test(k) ? v : { light: inkify(v.light), dark: inkify(v.dark) }]));
const PALETTES = { atelier: { label: "纸与金", tokens: TOKENS, skin: SKIN_CSS, parts: PARTS_CSS }, ink: { label: "墨与青", tokens: INK_TOKENS, skin: inkify(SKIN_CSS), parts: inkify(PARTS_CSS) } };
let CTX = null, palKey = null, palOff = null;
function syncPalette() {
  if (!CTX) return;
  const k = store.settings.palette === "ink" ? "ink" : "atelier";
  if (k === palKey) return;
  const p = PALETTES[k];
  if (palOff) palOff.all();
  const b = adaptiveStyle("ja-skin", p.skin), c = adaptiveStyle("ja-parts", p.parts);
  let t = () => {};
  try { t = CTX.theme.overrideTokens(name, p.tokens) || (() => {}); } catch (e) { console.error("jules-atelier: palette", e); }
  palKey = k; palOff = { all: () => { b(); c(); t(); } };
  document.body.classList.toggle("ja-pal-ink", k === "ink");
  syncBotTheme();
}
function dropPalette() { if (palOff) palOff.all(); palOff = null; palKey = null; document.body && document.body.classList.remove("ja-pal-ink"); }

/* ---------------- conversation sea ----------------
 * A quiet engraved seascape behind the conversation: a low horizon, a setting sun
 * drawn in horizontal hatching (stars only at night), a few drawn-out clouds and
 * swells set as fine strokes that grow denser towards the viewer, with a single
 * gold reflection path. One ink, one accent. While a turn runs the water moves a
 * little quicker. The scene falls away behind the text column. ~12 fps, paused
 * when hidden, a still frame under reduced motion. */
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
function mountSea(host, colSel) {
  const cv = document.createElement("canvas"); cv.className = "ja-sea"; cv.setAttribute("aria-hidden", "true");
  host.prepend(cv);
  const ctx = cv.getContext("2d"); if (!ctx) { cv.remove(); return () => {}; }
  const FS = 7; let W = 0, H = 0, CW = 4.2, CH = 8, cols = 0, rows = 0, ink = "#2E2A24", gold = "#A48659", dark = false, mono = "monospace";
  let colL = -1, colR = -1, stars = [], gulls = [], energy = 0, busy = false, raf = 0, dead = false, last = 0;
  const t0 = performance.now();
  const hash = (x, y, k) => { let v = (x * 374761393 + y * 668265263 + k * 1442695041) | 0; v = Math.imul(v ^ (v >>> 13), 1274126177); return ((v ^ (v >>> 16)) >>> 0) / 4294967296; };
  const sm = (a, b, v) => { v = Math.max(0, Math.min(1, (v - a) / (b - a))); return v * v * (3 - 2 * v); };
  function measureCol() {
    const c = colSel && host.querySelector(colSel); colL = colR = -1;
    if (c) { const r = c.getBoundingClientRect(), R = host.getBoundingClientRect(); if (r.width > 40) { colL = (r.left - R.left) / CW; colR = (r.right - R.left) / CW; } }
  }
  function build() {
    const DPR = Math.min(2, devicePixelRatio || 1); W = host.clientWidth; H = host.clientHeight; if (!W || !H) return;
    cv.width = W * DPR; cv.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const cs = getComputedStyle(document.body); ink = cs.getPropertyValue("--ja-ink").trim() || ink; gold = cs.getPropertyValue("--ja-gold").trim() || gold;
    dark = document.body.hasAttribute("data-ds-dark-theme"); mono = cs.getPropertyValue("--ja-mono").trim() || mono;
    ctx.font = `700 ${FS}px ${mono}`; ctx.textBaseline = "top"; CW = ctx.measureText("M").width || 4.2;
    cols = Math.ceil(W / CW) + 1; rows = Math.ceil(H / CH) + 1; measureCol();
    const hz = Math.round(rows * 0.6); stars = [];
    for (let y = 2; y < hz - 3; y++) for (let x = 0; x < cols; x++) { const r = hash(x, y, 7); if (r < 0.0045 * (1 - y / hz * 0.6)) stars.push([x, y, hash(x, y, 9) * 6.28, hash(x, y, 11)]); }
    gulls = [0, 1].map((i) => ({ x: hash(i, 3, 5) * cols, y: hz * (0.3 + 0.25 * hash(i, 4, 5)), v: 0.35 + hash(i, 6, 5) * 0.25, ph: hash(i, 8, 5) * 6 }));
  }
  // Dense engraving, as in the home whale: every cell carries a glyph from the same
  // ramp, tone comes from a lit height field. Buckets: [ink|gold] x NL alpha levels
  // (the levels only soften the scene behind the text column).
  const NL = 6, RB = " .,:;-=+*#%@", SKY = " .,-=+"; let bk = [];
  const put = (g, x, y, ch, c) => { if (ch === " ") return; const k = (g ? NL : 0) + c; (bk[k] ||= []).push(x * CW, y * CH, ch); };
  const colLv = new Uint8Array(4096);
  function levels() { for (let x = 0; x < cols && x < 4096; x++) { if (colL < 0) { colLv[x] = 0; continue; } const d = Math.min(x - colL, colR - x); colLv[x] = Math.round((NL - 1) * sm(-14, 6, d)); } }
  const tang = (a) => { const c = Math.abs(Math.cos(a)), s2 = Math.abs(Math.sin(a)); return c > 0.92 ? "|" : s2 > 0.92 ? "-" : Math.cos(a) * Math.sin(a) > 0 ? "/" : "\\"; };
  const fr = (v) => v - Math.floor(v);
  const vn = (x, k) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash(i, 0, k) * (1 - u) + hash(i + 1, 0, k) * u; };
  const ridge = (x) => { const a = vn(x * 0.09, 21), b = vn(x * 0.23, 22), c = vn(x * 0.61, 23); return a * 0.6 + b * 0.3 + c * 0.1; };
  function draw(now) {
    if (!W || !H) return;
    const t = (now - t0) / 1000; energy += ((busy ? 1 : 0) - energy) * 0.04;
    const tt = t * (1 + energy * 0.6);
    bk = []; levels();
    const hz0 = colR > 0 && cols - colR < 24 ? 0.62 : 0.55, hz = Math.round(rows * hz0), ml = colL > 0 ? colL : cols * 0.2, mg = colR > 0 ? cols - colR : cols * 0.25;
    const mx = Math.round(colR > 0 ? colR + mg * 0.5 : cols * 0.82);
    const Rx = Math.max(7, Math.min(mg * 0.36, cols * 0.08)), Rr = Rx * CW / CH, my = Math.round(hz - Rr * 0.55);
    const tick = Math.floor(t * 2);
    // headland on the left margin: an engraved silhouette sloping into the sea
    const land = new Float32Array(cols), lw = Math.max(18, ml + 16);
    for (let x = 0; x < cols; x++) { const e = 1 - sm(lw * 0.45, lw, x); land[x] = e > 0 ? (rows * 0.13 * (0.4 + 0.8 * ridge(x)) + rows * 0.07 * (1 - x / lw)) * e : 0; }
    // sky: paper, with a few hatched cloud banks and haze settling on the horizon
    for (let y = 0; y < hz; y++) {
      const yn = y / hz;
      for (let x = 0; x < cols; x++) {
        const c = colLv[x], top = hz - land[x];
        if (y >= top) { // land: dense on the shadow side, lighter where the light comes from the right
          const sl = land[Math.min(cols - 1, x + 1)] - land[Math.max(0, x - 1)], dep = (y - top) / Math.max(1, land[x]);
          const v = 0.45 + dep * 0.35 + (sl > 0 ? 0.25 : -0.15) * Math.min(1, Math.abs(sl));
          const ch = y - top < 1 ? (sl > 0.25 ? "/" : sl < -0.25 ? "\\" : "_") : RB[Math.max(2, Math.min(RB.length - 1, Math.round(v * (RB.length - 1) + (hash(x, y, 4) - 0.5) * 1.5)))];
          put(false, x, y, ch, c); continue;
        }
        if (dark) { const r = hash(x, y, 7); if (r < 0.007 * (1 - yn * 0.7)) { const tw = 0.5 + 0.5 * Math.sin(t * (0.6 + r * 90) + r * 999); put(tw > 0.8, x, y, tw > 0.92 ? "+" : tw > 0.45 ? "*" : ".", c); continue; } }
        if (!dark) {
          const dx = (x - mx) / Rx, dy = (y - my) / Rr, d = Math.hypot(dx, dy);
          if (d < 1.55) { // the sun: a dense engraved disc, cut by thinning bands toward the horizon, with a dotted halo
            const b = (y - (my - Rr)) / (2 * Rr);
            if (d < 1) {
              const cut = b > 0.5 && ((my + Math.round(Rr) - y) % Math.max(2, Math.round(5 - b * 4)) === 0);
              if (cut) continue;
              const v = Math.pow(1 - d * d, 0.5) + (hash(x, y, 2) - 0.5) * 0.06;
              put(true, x, y, " .-=+*#"[Math.max(1, Math.min(6, Math.round(1 + v * 5.4)))], c); continue;
            }
            if (hash(x, y, 6) < 0.2 * (1 - (d - 1) / 0.55)) { put(true, x, y, d < 1.2 ? ":" : ".", c); continue; }
          }
        }
        let tone = 0.35 * Math.pow(yn, 6);
        for (const [cy, cw, cx0, sp] of [[0.3, 0.05, 0.25, 0.006], [0.55, 0.045, 0.7, -0.004], [0.8, 0.04, 0.4, 0.003]]) {
          const ry = (yn - cy) / cw; if (Math.abs(ry) > 2.2) continue;
          const u = fr(x / cols - cx0 + t * sp), shape = vn(u * 9, 31 + cy * 10) * 1.6 - 0.45 - ry * ry * 0.35;
          if (shape > 0) tone += Math.min(1, shape) * (ry < 0 ? 0.55 : 0.95);
        }
        if (!dark) { const d = Math.hypot((x - mx) / Rx, (y - my) / Rr); tone *= sm(1.1, 2.2, d) * 0.85 + 0.15; } else tone *= 0.75;
        if (tone < 0.06) continue;
        const hatch = (y % 2 === 0) ? 1 : 0.35;
        const k = Math.floor(tone * hatch * 7 + hash(x, y, 3) * 0.8);
        if (k > 0) put(false, x, y, " .-~=+*"[Math.min(6, k)], c);
      }
    }
    for (let x = 0; x < cols; x++) if (land[x] < 0.5) put(false, x, hz, hash(x, 0, tick) < 0.85 ? "_" : " ", colLv[x]);
    // water: woodcut swells; a crest line wherever the phase wraps between rows,
    // a shaded face beneath it fading to a light back
    const N = Math.max(1, rows - hz);
    const phAt = (x, y) => { const yy = (y - hz) / N, p = 0.04 + 0.96 * yy, wz = 2.2 / p, wx = (x - cols * 0.5) * CW / (p * 95);
      return wz * 0.5 + 0.5 * Math.sin(wx * 0.6 + wz * 0.17 + tt * 0.3) + 0.25 * Math.sin(wx * 1.7 - wz * 0.11 - tt * 0.45) + 0.1 * Math.sin(wx * 4.1 + tt * 0.8) - tt * 0.2; };
    let prev = new Float32Array(cols), cur = new Float32Array(cols);
    for (let x = 0; x < cols; x++) prev[x] = phAt(x, hz + 0.5);
    for (let y = hz + 1; y < rows; y++) {
      const yy = (y - hz) / N, rw = Rx * (0.3 + 1.5 * yy);
      for (let x = 0; x < cols; x++) cur[x] = phAt(x, y);
      for (let x = 0; x < cols; x++) {
        const c = colLv[x];
        if (land[x] > 0.5 && y - hz < land[x] * 0.7 && hash(x, y, tick) < 0.8 - (y - hz) / (land[x] * 0.7) * 0.6) { put(false, x, y, (y + tick) % 3 ? "=" : "-", c); continue; }
        const ph = cur[x], f = fr(ph), span = Math.abs(prev[x] - ph);
        const glint = Math.abs(x - mx) < rw ? (1 - Math.abs(x - mx) / rw) * (dark ? 0.55 : 1) : 0;
        if (Math.floor(prev[x]) !== Math.floor(ph)) {
          if (glint > 0 && hash(x, y, tick) < glint * 1.2) { put(true, x, y, "~", c); continue; }
          if (span > 0.6) { if (vn(x * 0.18 + y * 7.3, 41) > 0.5) put(false, x, y, "-", c); continue; }
          put(false, x, y, yy > 0.45 && hash(x, y, 13) < 0.2 ? "^" : "~", c); continue;
        }
        if (span > 0.45) { if (hash(x, y, 17) < 0.25) put(false, x, y, ".", c); continue; }
        const face = 1 - f; // just below a crest face≈1, darkest
        if (glint > 0 && face < 0.6 && hash(x, y, tick + 3) < glint) { put(true, x, y, face < 0.3 ? "-" : "=", c); continue; }
        const v = 0.08 + Math.pow(face, 1.6) * (0.5 + 0.55 * yy) + (hash(x, y, 5) - 0.5) * 0.1;
        const k = Math.round(v * (RB.length - 1)); if (k > 0) put(false, x, y, RB[Math.min(RB.length - 1, k)], c);
      }
      const sw = prev; prev = cur; cur = sw;
    }
    ctx.clearRect(0, 0, W, H); ctx.font = `${dark ? 600 : 700} ${FS}px ${mono}`;
    const base = dark ? 0.36 : 0.26, gb = dark ? 0.42 : 0.62;
    for (let k = 0; k < bk.length; k++) { const list = bk[k]; if (!list) continue; const lv = k % NL;
      ctx.fillStyle = k >= NL ? gold : ink; ctx.globalAlpha = (k >= NL ? gb : base) * (1 - 0.72 * lv / (NL - 1));
      for (let i = 0; i < list.length; i += 3) ctx.fillText(list[i + 2], list[i], list[i + 1]); }
    ctx.globalAlpha = 1;
  }
  const sel = remap("[class*=JXrxFq_markBusy], svg[class*=_spinnerMotion_]", hashMap());
  const pollBusy = () => { try { busy = !!host.querySelector(sel) || !!document.querySelector("[class*=_indicator_] [class*=_dots_]"); } catch { busy = false; } measureCol(); };
  const ro = new ResizeObserver(() => { build(); draw(performance.now()); }); ro.observe(host);
  const mo = new MutationObserver(() => { build(); }); mo.observe(document.body, { attributes: true, attributeFilter: ["data-ds-dark-theme", "class"] });
  build(); pollBusy(); const bt = setInterval(pollBusy, 1000);
  if (reduceMotion()) draw(t0 + 6000);
  else { const loop = (now) => { if (dead) return; if (!document.hidden && now - last >= (busy || energy > 0.05 ? 90 : document.hasFocus() ? 180 : 1000)) { last = now; draw(now); } raf = requestAnimationFrame(loop); }; raf = requestAnimationFrame(loop); }
  return () => { dead = true; cancelAnimationFrame(raf); clearInterval(bt); ro.disconnect(); mo.disconnect(); cv.remove(); };
}
let seaHost = null, seaOff = null, seaMo = null, seaT = 0;
function seaCheck() {
  const s = store.settings, on = !!s.skin && s.sea !== false;
  let host = null;
  if (on) { const m = hashMap(); host = document.querySelector(remap("[class*=ST7X_W_body]", m)); if (host && !host.querySelector(remap("[class*=icaHSq_root]", m))) host = null; }
  if (host === seaHost && (!host || host.querySelector(":scope > .ja-sea"))) return;
  if (seaOff) seaOff(); seaOff = null; seaHost = host;
  if (host) seaOff = mountSea(host, remap("[class*=icaHSq_column]", hashMap()));
}
function startSea() {
  if (seaMo) return;
  seaMo = new MutationObserver(() => { if (!seaT) seaT = setTimeout(() => { seaT = 0; seaCheck(); }, 400); });
  seaMo.observe(document.body, { childList: true, subtree: true });
  seaCheck();
}
function stopSea() { if (seaMo) seaMo.disconnect(); seaMo = null; clearTimeout(seaT); seaT = 0; if (seaOff) seaOff(); seaOff = null; seaHost = null; }

/* ---------------- DS Bot themes ----------------
 * DS Bot (ds-bot) paints the whole window from its own theme. Instead of fighting
 * it, offer it two themes through its public hub (window.dshBotQueue): Atelier's
 * paper & gold and ink & celadon. They show up in DS Bot → 通用 → 主题. */
const BOT_CSS = __BOTCSS__;
const BOT_BASE = {
  light: { bg: "#FAF8F3", sidebar: "#F1ECE1", bubble: "#F3EEE4", card: "#FFFDF8", text: "#2E2A24", user: "#2E2A24", userText: "#FAF8F3", accent: "#A48659" },
  dark: { bg: "#22211E", sidebar: "#262420", bubble: "#2B2925", card: "#282622", text: "#ECE5D6", user: "#ECE5D6", userText: "#22211E", accent: "#C3A574" } };
const inkMode = (m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, inkify(v)]));
/* One DS Bot theme, "atelier", that always follows the Atelier palette (纸与金 / 墨与青). */
let botHub = null, botOff = null, botKey = null;
function botTheme() {
  const ink = store.settings.palette === "ink";
  return { label: "Atelier", light: ink ? inkMode(BOT_BASE.light) : BOT_BASE.light, dark: ink ? inkMode(BOT_BASE.dark) : BOT_BASE.dark, css: ink ? inkify(BOT_CSS) : BOT_CSS };
}
function syncBotTheme() {
  if (!botHub) return;
  const k = store.settings.palette === "ink" ? "ink" : "atelier";
  if (k === botKey) return;
  try { const off = botHub.registerTheme("atelier", botTheme()); if (!botOff) botOff = off; botKey = k; } catch (e) { console.warn("jules-atelier: ds-bot theme", e); }
}
/* Engraved Bot characters for DS Bot: a solid ink silhouette with paper-coloured
 * engraving cuts, like a woodblock. Eyes are punched through by DS Bot's own mask. */
const WHALE_D = "M65.3 20.9l5.1 .1 4.8 .9 4.8 1.7 4.3 2.3 3.8 3.1 3 3.4 2.3 3.8 1.6 4.3 .9 4.3 0 4.8-.8 4.8-1.4 4.3-2.3 4.3-3.2 4.3-3.4 3.3-4.3 3.1-7.2 3.5-7.6 1.7-7.2 .1-9.6-1.6-3.3-1-2.9-1.7-8.8-8.9-6-4.7-3.3-.5-7.7 1.1-4.8-.1-4.7-1.2-1.9-1.2-1-1-.5-1.5 .4-1.4 1.1-1.3 1.9-1.3 4.7-1.5 7.7-.6 1.1-.5 .7-1 0-1.4-2.8-7.2-1.2-5.3-.1-4.3 .4-1.4 .9-1.2 1.9-.2 2 1 2.2 2.3 2.2 3.4 3.2 7.6 1.9 9.7 .5-.1 1.1-7.2 1.8-4.8 3.2-5.2 3.9-4.3 4.9-3.9 5.6-2.9 5.8-1.9z";
const cutLines = (id, d, y0, y1, step, w0, w1, rot) => {
  let s = "";
  for (let y = y0, i = 0; y <= y1; y += step, i++) {
    const t = (y - y0) / Math.max(1, y1 - y0), w = (w0 + (w1 - w0) * t).toFixed(2);
    s += `<path d="M-10 ${y.toFixed(1)}H110" stroke="#fff" stroke-opacity=".5" stroke-width="${w}"/>`;
  }
  return `<clipPath id="%MASK%${id}"><path d="${d}"/></clipPath><g clip-path="url(#%MASK%${id})"${rot ? ` transform="rotate(${rot} 50 50)"` : ""}>${s}</g>`;
};
const rays = (id, d, cx, cy, r0, r1, a0, a1, n, w) => {
  let s = "";
  for (let i = 0; i <= n; i++) {
    const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180;
    s += `<path d="M${(cx + r0 * Math.cos(a)).toFixed(1)} ${(cy + r0 * Math.sin(a)).toFixed(1)}L${(cx + r1 * Math.cos(a)).toFixed(1)} ${(cy + r1 * Math.sin(a)).toFixed(1)}" stroke="#fff" stroke-opacity=".5" stroke-width="${w}" stroke-linecap="round"/>`;
  }
  return `<clipPath id="%MASK%${id}"><path d="${d}"/></clipPath><g clip-path="url(#%MASK%${id})">${s}</g>`;
};
const LIGHTHOUSE = "M37 13L50 3.5L63 13ZM40 13H60V25H40ZM33 25H67V31H33ZM38.5 31H61.5L68 89Q50 95 32 89Z";
const BOAT_SAIL = "M47 7L47 61L15 61Q30 36 47 7ZM53 17L53 61L80 61Q70 40 53 17Z";
const BOAT = BOAT_SAIL + "M10 65H90L78 84Q50 90 22 84Z";
const SHELL = (() => {
  const cx = 50, cy = 84, R = 70, a0 = -152, a1 = -28, n = 7, P = (r, a) => [(cx + r * Math.cos(a * Math.PI / 180)).toFixed(1), (cy + r * Math.sin(a * Math.PI / 180)).toFixed(1)].join(" ");
  let d = `M${cx} ${cy}L${P(R, a0)}`;
  for (let i = 0; i < n; i++) { const s = a0 + (a1 - a0) * i / n, e = a0 + (a1 - a0) * (i + 1) / n; d += `Q${P(R + 9, (s + e) / 2)} ${P(R, e)}`; }
  return d + "ZM41 83H59L57.5 92H42.5Z";
})();
const INKWELL = "M38 6H62V13H38ZM41 13H59V25H41ZM23 35Q23 25 33 25H67Q77 25 77 35V82Q77 91 68 91H32Q23 91 23 82Z";
const ATELIER_SHAPES = {
  etched: { label: "刻线鲸鱼", eyes: { at: [[72.5, 48.4], [85.6, 43.4]], w: 8.6, h: 21, tilt: -17 },
    body: (p) => `<path d="${WHALE_D}" fill="${p}" fill-rule="evenodd"/>` + cutLines("w", WHALE_D, 58, 88, 3.6, 0.7, 1.7) },
  lighthouse: { label: "灯塔", eyes: { at: [[44.5, 47], [55.5, 47]], w: 5.4, h: 11.5, tilt: 0 },
    body: (p) => `<path d="${LIGHTHOUSE}" fill="${p}"/><path d="M43.5 15.5H56.5V22.5H43.5Z" fill="#fff" fill-opacity=".62"/>` + cutLines("l", "M38.5 31H61.5L68 89Q50 95 32 89Z", 60, 92, 4.2, 0.8, 1.8) },
  sailboat: { label: "帆船", eyes: { at: [[43, 73.5], [57, 73.5]], w: 5.4, h: 10.5, tilt: 0 },
    body: (p) => `<path d="${BOAT}" fill="${p}"/>` + cutLines("b", BOAT_SAIL, 12, 60, 3.8, 1.6, 0.6) },
  shell: { label: "扇贝", eyes: { at: [[42.5, 50], [57.5, 50]], w: 6, h: 12.5, tilt: 0 },
    body: (p) => `<path d="${SHELL}" fill="${p}"/>` + rays("s", SHELL, 50, 84, 10, 84, -152 + 124 / 14, -28 - 124 / 14, 6, 1.5) },
  inkwell: { label: "墨水瓶", eyes: { at: [[42, 64], [58, 64]], w: 6, h: 13, tilt: 0 },
    body: (p) => `<path d="${INKWELL}" fill="${p}"/>` + cutLines("i", "M23 35Q23 25 33 25H67Q77 25 77 35V48H23Z", 29, 46, 3.4, 1.7, 0.7) },
};
function registerBotThemes() {
  const shapeOffs = [];
  const task = (hub) => {
    botHub = hub; botKey = null; syncBotTheme();
    if (typeof hub.registerShape === "function") for (const [id, sh] of Object.entries(ATELIER_SHAPES)) {
      try { shapeOffs.push(hub.registerShape(id, { label: sh.label, size: 100, body: sh.body, eyes: sh.eyes })); } catch (e) { console.warn("jules-atelier: ds-bot shape", id, e); }
    }
  };
  if (window.dshBot && typeof window.dshBot.registerTheme === "function") task(window.dshBot);
  else { if (!window.dshBotQueue) window.dshBotQueue = []; window.dshBotQueue.push(task); }
  return () => { shapeOffs.forEach((f) => { try { typeof f === "function" && f(); } catch {} }); try { typeof botOff === "function" && botOff(); } catch {} botHub = null; botOff = null; botKey = null; };
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
    CTX = ctx; const a = addStyle("ja-fonts", FONT_CSS);
    syncPalette(); applyBodyFlags(); loadSettings(); startSea(); const bt = registerBotThemes();
    const nt = setTimeout(() => updNotice().catch(() => {}), 4000);
    return () => { clearTimeout(nt); bt(); a(); stopSea(); dropPalette(); CTX = null; ["ja-skin", "ja-fonts", "ja-paper", "ja-motion", "ja-pal-ink"].forEach((k) => document.body.classList.remove(k)); syncIcons(false); };
  }, "jules-atelier: styles");
  const reg = (slot, opts, comp) => ctx.slots.inject(slot, () => ctx.slots.register({ name: slot, ...opts }, comp));
  reg("conversation.hero.brand.mark", { priority: -10 }, HeroMark);
  reg("sidebar.brand.mark", { priority: -10 }, BrandMark);
  reg("sidebar.brand.name", { priority: -10 }, BrandName);
  reg("conversation.composer.dock", { id: "jules-atelier-ledger", order: 90, inject: (sessionId) => ({ sessionId }) }, LedgerChip);
  reg("sidebar.session.row.hover", { id: "jules-atelier-hover", order: 50 }, SessionHover);
  reg("sidebar.footer.action", { id: "jules-atelier-ledger", order: -10 }, SideLedger);
  reg("settings.section", { id: "jules-atelier", order: 60, label: "Atelier" }, AtelierSettings);
}
