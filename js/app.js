/* ===========================================================
   Bettery — chest-focused push-up trainer
   Vanilla JS, no build step. Data persists in localStorage.
   =========================================================== */
"use strict";

const VERSION = "1.0.0";
const KEY = "bettery.v1";

/* ---------- tiny DOM helpers ---------- */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const el = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };

/* ===========================================================
   Body muscle map (front view, built from a mirrored half)
   =========================================================== */
const BODY_HALF = `
  <path class="silhouette" d="M120,50 L134,52 C150,54 161,60 173,74 C187,87 191,101 189,119 L185,169 L182,214 L169,214 L170,170 L150,118 C144,115 140,115 137,121 C143,148 140,176 132,206 L120,210 Z"/>
`;

const MUS_HALF = `
  <path data-muscle="traps"       d="M122,55 L134,58 C149,60 159,66 169,75 L160,78 C150,69 136,63 122,63 Z"/>
  <path data-muscle="front-delt"  d="M150,72 C167,67 183,78 187,99 C189,111 181,117 169,113 C157,107 150,93 150,72 Z"/>
  <path data-muscle="triceps"     d="M187,101 C191,119 189,151 184,167 L181,167 C183,140 182,113 181,103 Z"/>
  <path data-muscle="biceps"      d="M170,113 C179,118 183,141 181,161 L173,163 C170,140 168,119 170,113 Z"/>
  <path data-muscle="forearm"     d="M170,167 C181,169 183,201 181,213 L170,214 L170,168 Z"/>
  <path data-muscle="upper-chest" d="M122,72 L147,78 C151,80 151,87 148,91 L122,91 Z"/>
  <path data-muscle="chest"       d="M122,93 L148,93 C150,105 146,115 138,119 C130,122 124,120 122,117 Z"/>
  <path data-muscle="serratus"    d="M127,123 L136,121 L136,125 L128,127 Z M128,129 L136,127 L136,131 L129,134 Z"/>
  <path data-muscle="oblique"     d="M133,123 C141,148 139,176 132,202 L127,201 C129,172 127,144 127,125 Z"/>
`;

const CENTER = `
  <circle class="bodypart" cx="120" cy="32" r="22"/>
  <path class="bodypart" d="M109,50 L131,50 L129,66 L111,66 Z"/>
  <rect data-muscle="core" x="108" y="124" width="24" height="72" rx="10"/>
  <line class="ab-line" x1="120" y1="130" x2="120" y2="190"/>
  <line class="ab-line" x1="110" y1="146" x2="130" y2="146"/>
  <line class="ab-line" x1="110" y1="162" x2="130" y2="162"/>
  <line class="ab-line" x1="110" y1="178" x2="130" y2="178"/>
`;

function muscleSVG() {
  return `
  <svg viewBox="0 0 240 234" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Front body muscle map">
    <g class="layer-body">${BODY_HALF}<g transform="matrix(-1 0 0 1 240 0)">${BODY_HALF}</g></g>
    <g class="layer-mus">${MUS_HALF}<g transform="matrix(-1 0 0 1 240 0)">${MUS_HALF}</g></g>
    <g class="layer-center">${CENTER}</g>
  </svg>`;
}

function lerp(a, b, t) { return Math.round(a + (b - a) * t); }
function colorFor(intensity) {
  const t = Math.max(0, Math.min(1, (intensity - 0.3) / 0.7));   // amber -> red over 0.3..1
  const lo = [255, 176, 32], hi = [255, 59, 48];
  return `rgb(${lerp(lo[0], hi[0], t)},${lerp(lo[1], hi[1], t)},${lerp(lo[2], hi[2], t)})`;
}

function paintMap(container, muscleMap) {
  const svg = $("svg", container);
  if (!svg) return;
  $$("[data-muscle]", svg).forEach(p => { p.style.fill = ""; p.classList.remove("active"); });
  Object.entries(muscleMap || {}).forEach(([m, v]) => {
    $$(`[data-muscle="${m}"]`, svg).forEach(p => { p.style.fill = colorFor(v); p.classList.add("active"); });
  });
}

/* Combined map of every chest exercise's primary muscles, for the home preview */
function chestOverview() {
  const out = {};
  EXERCISES.forEach(ex => Object.entries(ex.muscles).forEach(([m, v]) => { out[m] = Math.max(out[m] || 0, v); }));
  return out;
}

function muscleChipsHTML(muscleMap) {
  return Object.entries(muscleMap)
    .sort((a, b) => b[1] - a[1])
    .filter(([, v]) => v >= 0.4)
    .map(([m, v]) => `<span class="mchip ${v >= 0.7 ? "prime" : "sec"}">${MUSCLE_LABELS[m] || m}</span>`)
    .join("");
}

/* ===========================================================
   State + persistence
   =========================================================== */
const DEFAULTS = { sets: 3, reps: 12, rest: 60, sound: true, reminder: "" };
let state = loadState();
let session = null;     // active workout
let restTimer = null;

function loadState() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (_) {}
  return {
    settings: Object.assign({}, DEFAULTS, saved.settings || {}),
    history: Array.isArray(saved.history) ? saved.history : []
  };
}
function save() { localStorage.setItem(KEY, JSON.stringify(state)); }

/* ===========================================================
   Stats
   =========================================================== */
function dayKey(ts) { const d = new Date(ts); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }

function computeStats() {
  const h = state.history;
  let total = 0, best = 0, week = 0;
  const weekAgo = Date.now() - 7 * 864e5;
  h.forEach(s => {
    total += s.total;
    if (s.date >= weekAgo) week += s.total;
    s.results.forEach(r => { if (r > best) best = r; });
  });
  // streak: consecutive days with a workout, ending today or yesterday
  const days = new Set(h.map(s => dayKey(s.date)));
  let streak = 0;
  let cur = new Date();
  if (!days.has(dayKey(cur.getTime()))) cur.setDate(cur.getDate() - 1); // allow "yesterday" to keep streak alive
  while (days.has(dayKey(cur.getTime()))) { streak++; cur.setDate(cur.getDate() - 1); }
  return { total, best, week, streak, sessions: h.length };
}

/* ===========================================================
   Navigation
   =========================================================== */
function go(view) {
  $$(".view").forEach(v => v.classList.remove("view--active"));
  $(`#view-${view}`).classList.add("view--active");
  $$(".nav-btn").forEach(b => b.classList.toggle("nav--on", b.dataset.view === view));
  $("#main").scrollTop = 0;
  window.scrollTo(0, 0);
  if (view === "home") renderHome();
  if (view === "train") renderExercises();
  if (view === "history") renderHistory();
  if (view === "settings") renderSettings();
}

/* ===========================================================
   Home
   =========================================================== */
function renderHome() {
  const s = computeStats();
  $("#statTotal").textContent    = s.total;
  $("#statStreak").textContent   = s.streak;
  $("#statSessions").textContent = s.sessions;
  const hr = new Date().getHours();
  const part = hr < 12 ? "Morning" : hr < 18 ? "Afternoon" : "Evening";
  $("#homeGreeting").textContent = `Good ${part}. Let's build that chest. 💥`;
  $("#qsHint").textContent = `${state.settings.sets} sets · pick a variation to begin`;
  const hm = $("#homeMap");
  if (!hm.dataset.ready) { hm.innerHTML = muscleSVG(); hm.dataset.ready = "1"; }
  paintMap(hm, chestOverview());
}

/* ===========================================================
   Train — exercise list
   =========================================================== */
let levelFilter = "all";

function renderExercises() {
  const list = $("#exerciseList");
  const items = EXERCISES.filter(e => levelFilter === "all" || e.level === levelFilter);
  list.innerHTML = "";
  items.forEach(ex => {
    const tags = Object.entries(ex.muscles).sort((a, b) => b[1] - a[1]).filter(([, v]) => v >= 0.55).slice(0, 3)
      .map(([m, v]) => `<span class="tag ${v >= 0.7 ? "tag-prime" : ""}">${MUSCLE_LABELS[m]}</span>`).join("");
    const card = el(`
      <button class="ex-card" data-id="${ex.id}">
        <div class="ex-emoji">${ex.emoji}</div>
        <div class="ex-body">
          <div class="ex-name">${ex.name}</div>
          <div class="ex-focus">${ex.focus}</div>
          <div class="ex-tags">${tags}</div>
        </div>
        <span class="lvl lvl-${ex.level}">${ex.level}</span>
      </button>`);
    card.addEventListener("click", () => openSetup(ex));
    list.appendChild(card);
  });
}

/* ===========================================================
   Session setup modal
   =========================================================== */
function stepperRow(label, value, min, max, step) {
  const row = el(`
    <div class="setup-row">
      <span>${label}</span>
      <div class="mini-step">
        <button data-d="-1">−</button><span class="val">${value}</span><button data-d="1">+</button>
      </div>
    </div>`);
  const valEl = $(".val", row);
  row._get = () => +valEl.textContent;
  $$("button", row).forEach(b => b.addEventListener("click", () => {
    let v = +valEl.textContent + (+b.dataset.d) * step;
    v = Math.max(min, Math.min(max, v));
    valEl.textContent = v;
  }));
  return row;
}

function openSetup(ex) {
  const node = el(`
    <div>
      <h3>${ex.emoji} ${ex.name}</h3>
      <p class="muted small">${ex.desc}</p>
      <div class="muscle-chips" style="justify-content:flex-start;margin:12px 0">${muscleChipsHTML(ex.muscles)}</div>
      <details class="cues"><summary class="muted small">Form cues</summary>
        <ul class="muted small" style="padding-left:18px;margin:8px 0">${ex.cues.map(c => `<li>${c}</li>`).join("")}</ul>
      </details>
      <div class="setup-body"></div>
      <div class="modal-actions">
        <button class="btn btn-ghost" data-x>Cancel</button>
        <button class="btn btn-primary" data-start>Start →</button>
      </div>
    </div>`);
  const sets = stepperRow("Sets", state.settings.sets, 1, 12, 1);
  const reps = stepperRow("Reps target", ex.defaultReps || state.settings.reps, 1, 100, 1);
  const rest = stepperRow("Rest (sec)", state.settings.rest, 10, 240, 5);
  const body = $(".setup-body", node);
  body.append(sets, reps, rest);

  const m = showModal(node);
  $("[data-x]", node).onclick = () => m.close();
  $("[data-start]", node).onclick = () => {
    m.close();
    startSession(ex, sets._get(), reps._get(), rest._get());
  };
}

/* ===========================================================
   Active session
   =========================================================== */
function startSession(ex, sets, reps, rest) {
  session = { ex, sets, reps, rest, currentSet: 1, results: [], repValue: reps, startedAt: Date.now(), resting: false };
  const sm = $("#sessionMap");
  if (!sm.dataset.ready) { sm.innerHTML = muscleSVG(); sm.dataset.ready = "1"; }
  paintMap(sm, ex.muscles);
  $("#sessionTitle").textContent = ex.name;
  $("#sessionFocus").textContent = ex.focus;
  $("#sessionMuscles").innerHTML = muscleChipsHTML(ex.muscles);
  go("session");
  renderSet();
}

function renderSetDots() {
  const dots = $("#setDots");
  dots.innerHTML = "";
  for (let i = 1; i <= session.sets; i++) {
    const cls = i < session.currentSet ? "done" : (i === session.currentSet && !session.resting ? "current" : "");
    dots.appendChild(el(`<span class="set-dot ${cls}"></span>`));
  }
}

function renderSet() {
  session.resting = false;
  session.repValue = session.reps;
  $("#restPanel").classList.add("hidden");
  $("#setPanel").classList.remove("hidden");
  $("#setLabel").textContent = `Set ${session.currentSet} of ${session.sets}`;
  $("#repValue").textContent = session.repValue;
  renderSetDots();
}

function changeReps(d) {
  if (!session) return;
  session.repValue = Math.max(0, session.repValue + d);
  $("#repValue").textContent = session.repValue;
}

function completeSet() {
  if (!session) return;
  session.results.push(session.repValue);
  if (session.currentSet >= session.sets) { finishSession(); return; }
  startRest();
}

/* ---------- rest timer ---------- */
const RING_CIRC = 2 * Math.PI * 52;   // r=52 in the ring svg

function startRest() {
  session.resting = true;
  session.restLeft = session.rest;
  $("#setPanel").classList.add("hidden");
  $("#restPanel").classList.remove("hidden");
  $("#nextSetLabel").textContent = `Set ${session.currentSet + 1}`;
  renderSetDots();
  updateRing();
  clearInterval(restTimer);
  restTimer = setInterval(tickRest, 1000);
}

function updateRing() {
  $("#restSeconds").textContent = session.restLeft;
  const frac = session.restLeft / session.rest;
  $("#ringFg").style.strokeDashoffset = RING_CIRC * (1 - frac);
}

function tickRest() {
  session.restLeft--;
  if (session.restLeft <= 0) { endRest(); return; }
  updateRing();
}

function endRest() {
  clearInterval(restTimer);
  restTimer = null;
  if (state.settings.sound) beep();
  notify("Rest over 💪", `Time for set ${session.currentSet + 1} of ${session.ex.name}.`);
  session.currentSet++;
  renderSet();
}

function skipRest() { if (session && session.resting) endRest(); }
function addRest() { if (session && session.resting) { session.restLeft += 15; session.rest += 15; updateRing(); } }

function finishSession() {
  clearInterval(restTimer);
  const total = session.results.reduce((a, b) => a + b, 0);
  const rec = {
    date: Date.now(),
    exId: session.ex.id, name: session.ex.name, emoji: session.ex.emoji,
    sets: session.sets, reps: session.reps, results: session.results.slice(),
    total, durationSec: Math.round((Date.now() - session.startedAt) / 1000)
  };
  state.history.unshift(rec);
  save();
  notify("Workout complete! 🎉", `${total} reps across ${session.sets} sets of ${session.ex.name}.`);
  showSummary(rec, session.ex);
  session = null;
}

function showSummary(rec, ex) {
  const mins = Math.floor(rec.durationSec / 60), secs = rec.durationSec % 60;
  const node = el(`
    <div>
      <h3>Nice work 🔥</h3>
      <div class="summary-big"><span class="big">${rec.total}</span><div class="muted">total reps</div></div>
      <div class="setup-row"><span>Sets</span><b>${rec.sets} (${rec.results.join(" · ")})</b></div>
      <div class="setup-row"><span>Exercise</span><b>${rec.name}</b></div>
      <div class="setup-row"><span>Duration</span><b>${mins}m ${secs}s</b></div>
      <div class="modal-actions">
        <button class="btn btn-ghost" data-again>Repeat</button>
        <button class="btn btn-primary" data-done>Done</button>
      </div>
    </div>`);
  const m = showModal(node, true);
  $("[data-done]", node).onclick = () => { m.close(); go("home"); };
  $("[data-again]", node).onclick = () => { m.close(); openSetup(ex); };
}

async function exitSession() {
  if (!session) { go("train"); return; }
  const ok = await confirmDialog("End workout?", "Your progress in this session won't be saved.", "End");
  if (ok) { clearInterval(restTimer); session = null; go("train"); }
}

/* ===========================================================
   History
   =========================================================== */
function fmtDate(ts) {
  const d = new Date(ts), now = new Date();
  const same = d.toDateString() === now.toDateString();
  const yest = new Date(now.getTime() - 864e5).toDateString() === d.toDateString();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (same) return `Today, ${time}`;
  if (yest) return `Yesterday, ${time}`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) + `, ${time}`;
}

function renderHistory() {
  const s = computeStats();
  $("#histTotal").textContent = s.total;
  $("#histBest").textContent  = s.best;
  $("#histVol").textContent   = s.week;
  const list = $("#historyList");
  if (!state.history.length) {
    list.innerHTML = `<div class="empty">No workouts yet.<br>Head to <b>Train</b> and knock out your first set. 💪</div>`;
    return;
  }
  list.innerHTML = "";
  state.history.forEach(r => {
    list.appendChild(el(`
      <div class="hist-item">
        <div class="hist-emoji">${r.emoji || "💪"}</div>
        <div class="hist-main">
          <div class="hist-name">${r.name}</div>
          <div class="hist-date">${fmtDate(r.date)} · ${r.sets} sets (${r.results.join("·")})</div>
        </div>
        <div class="hist-total"><b>${r.total}</b><div class="muted small">reps</div></div>
      </div>`));
  });
}

/* ===========================================================
   Settings
   =========================================================== */
function miniStep(host, field, min, max, step) {
  const render = () => { $(".val", host).textContent = state.settings[field]; };
  host.innerHTML = `<button data-d="-1">−</button><span class="val"></span><button data-d="1">+</button>`;
  render();
  $$("button", host).forEach(b => b.addEventListener("click", () => {
    state.settings[field] = Math.max(min, Math.min(max, state.settings[field] + (+b.dataset.d) * step));
    render(); save();
  }));
}

function renderSettings() {
  updateNotifyUI();
  $("#reminderTime").value = state.settings.reminder || "";
  $("#soundToggle").checked = !!state.settings.sound;
  $("#verLabel").textContent = `v${VERSION}`;
  $$(".mini-step[data-def]").forEach(h => {
    if (h.dataset.bound) return; h.dataset.bound = "1";
    const f = h.dataset.def;
    if (f === "sets") miniStep(h, "sets", 1, 12, 1);
    if (f === "reps") miniStep(h, "reps", 1, 100, 1);
    if (f === "rest") miniStep(h, "rest", 10, 240, 5);
  });
}

/* ===========================================================
   Notifications + sound
   =========================================================== */
let swReg = null;

function updateNotifyUI() {
  const st = $("#notifyStatus"), btn = $("#notifyBtn");
  if (!("Notification" in window)) { st.textContent = "Not supported on this browser"; btn.classList.add("hidden"); return; }
  const p = Notification.permission;
  st.textContent = p === "granted" ? "Status: enabled ✓" : p === "denied" ? "Blocked in browser settings" : "Status: off";
  btn.classList.toggle("hidden", p === "granted");
}

async function enableNotify() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") { toast("Notifications are blocked — enable them in browser settings."); return false; }
  const p = await Notification.requestPermission();
  updateNotifyUI();
  if (p === "granted") { toast("Notifications enabled 🔔"); scheduleReminder(); return true; }
  return false;
}

function notify(title, body) {
  try {
    const opts = { body, icon: "icons/icon-192.png", badge: "icons/icon-192.png", vibrate: [120, 60, 120], tag: "bettery" };
    if (swReg && swReg.showNotification) swReg.showNotification(title, opts);
    else if ("Notification" in window && Notification.permission === "granted") new Notification(title, opts);
  } catch (_) {}
}

let audioCtx = null;
function beep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    [880, 1320].forEach((f, i) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = f; o.type = "sine";
      o.connect(g); g.connect(audioCtx.destination);
      const t = audioCtx.currentTime + i * 0.18;
      g.gain.setValueAtTime(0.001, t);
      g.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      o.start(t); o.stop(t + 0.18);
    });
  } catch (_) {}
}

/* Best-effort daily reminder: fires while the app is open/recently used.
   (Reliable scheduled push needs a server; documented in the UI.) */
let reminderTimer = null;
function scheduleReminder() {
  clearTimeout(reminderTimer);
  const r = state.settings.reminder;
  if (!r || Notification.permission !== "granted") return;
  const [h, m] = r.split(":").map(Number);
  const now = new Date();
  const next = new Date();
  next.setHours(h, m, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  const ms = next - now;
  if (ms < 2 ** 31) reminderTimer = setTimeout(() => {
    notify("Time to train 💪", "Your chest session is waiting. Let's get a pump.");
    scheduleReminder();
  }, ms);
}

/* ===========================================================
   Modal + toast + confirm
   =========================================================== */
function showModal(node, sticky) {
  const ov = el(`<div class="modal-overlay"></div>`);
  const box = el(`<div class="modal"></div>`);
  box.appendChild(node); ov.appendChild(box);
  const close = () => { ov.remove(); document.removeEventListener("keydown", esc); };
  const esc = (e) => { if (e.key === "Escape" && !sticky) close(); };
  if (!sticky) ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
  document.addEventListener("keydown", esc);
  document.body.appendChild(ov);
  return { close };
}

function confirmDialog(title, msg, okLabel = "Confirm") {
  return new Promise(res => {
    const node = el(`
      <div>
        <h3>${title}</h3>
        <p class="muted">${msg}</p>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-x>Cancel</button>
          <button class="btn btn-danger" data-ok>${okLabel}</button>
        </div>
      </div>`);
    const m = showModal(node);
    $("[data-x]", node).onclick = () => { m.close(); res(false); };
    $("[data-ok]", node).onclick = () => { m.close(); res(true); };
  });
}

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove("show"), 2600);
}

/* ===========================================================
   Install prompt
   =========================================================== */
let deferredInstall = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstall = e;
  $("#installBtn").classList.remove("hidden");
});
window.addEventListener("appinstalled", () => { $("#installBtn").classList.add("hidden"); toast("Installed! Find Bettery on your home screen."); });

/* ===========================================================
   Wire events + boot
   =========================================================== */
function bindEvents() {
  $$(".nav-btn").forEach(b => b.addEventListener("click", () => go(b.dataset.view)));
  $$("[data-go]").forEach(b => b.addEventListener("click", () => go(b.dataset.go)));

  // level filter
  $$("#levelFilter .chip").forEach(c => c.addEventListener("click", () => {
    levelFilter = c.dataset.level;
    $$("#levelFilter .chip").forEach(x => x.classList.toggle("chip--on", x === c));
    renderExercises();
  }));

  // session controls
  $("#repMinus").addEventListener("click", () => changeReps(-1));
  $("#repPlus").addEventListener("click", () => changeReps(1));
  $("#completeBtn").addEventListener("click", completeSet);
  $("#skipRest").addEventListener("click", skipRest);
  $("#addRest").addEventListener("click", addRest);
  $("#exitSession").addEventListener("click", exitSession);

  // history
  $("#clearHistory").addEventListener("click", async () => {
    if (!state.history.length) { toast("Nothing to clear."); return; }
    const ok = await confirmDialog("Clear all history?", "This permanently deletes every logged workout on this device.", "Delete all");
    if (ok) { state.history = []; save(); renderHistory(); toast("History cleared."); }
  });

  // settings
  $("#notifyBtn").addEventListener("click", enableNotify);
  $("#testNotify").addEventListener("click", async () => {
    const ok = await enableNotify();
    if (ok || Notification.permission === "granted") notify("Test notification 🔔", "Notifications are working. Now go get a pump.");
  });
  $("#reminderTime").addEventListener("change", (e) => {
    state.settings.reminder = e.target.value; save();
    if (e.target.value) { enableNotify().then(ok => { if (ok) { scheduleReminder(); toast(`Daily reminder set for ${e.target.value}.`); } }); }
    else { clearTimeout(reminderTimer); toast("Daily reminder off."); }
  });
  $("#soundToggle").addEventListener("change", (e) => { state.settings.sound = e.target.checked; save(); });

  // install
  $("#installBtn").addEventListener("click", async () => {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    await deferredInstall.userChoice;
    deferredInstall = null;
    $("#installBtn").classList.add("hidden");
  });

  // warn before leaving an active workout (in-page, no native dialog)
  window.addEventListener("popstate", () => {});
}

async function registerSW() {
  if (!("serviceWorker" in navigator)) return;
  if (location.search.includes("nosw")) return;   // dev escape hatch
  try { swReg = await navigator.serviceWorker.register("service-worker.js"); } catch (_) {}
}

function boot() {
  bindEvents();
  renderHome();
  registerSW();
  if ("Notification" in window && Notification.permission === "granted") scheduleReminder();
}

document.addEventListener("DOMContentLoaded", boot);
