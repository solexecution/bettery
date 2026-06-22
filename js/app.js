/* ===========================================================
   Bettery — chest-focused push-up trainer
   Vanilla JS, no build step. Data persists in localStorage.
   =========================================================== */
"use strict";

const VERSION = "1.6.5";
const KEY = "bettery.v1";

/* ---------- tiny DOM helpers ---------- */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const el = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };

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
const DEFAULTS = { sets: 3, reps: 12, rest: 60, sound: true, reminder: "", voice: true, tempo: 3, voiceName: "" };
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
  document.body.classList.toggle("session-mode", view === "session");   // immersive full-screen during a set
  if (view !== "session") { const sv = $("#sessionVideo"); if (sv) sv.innerHTML = ""; }  // stop the demo clip
  if (view !== "guide")   { const gv = $("#poseStage video"); if (gv) gv.pause(); }       // pause the guide clip
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
    card.addEventListener("click", () => openGuide(ex));
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

/* elbow flare = angle the upper arms make with the torso (from above). This is what shifts
   the load between triceps (tucked) and chest (flared) — it's a top-down angle, so it's shown
   as a value rather than drawn on the side view. */
const FLARE = { standard:45, wide:75, diamond:20, decline:45, archer:55, pseudo:30 };
const EMPHASIS = {
  shoulder: "a balanced chest + triceps load.",
  wide:     "the wide flare biases the outer chest and front delts.",
  diamond:  "tucked tight, which shifts the work onto the triceps and inner chest.",
  archer:   "weight stacks over the bent arm for heavy single-side loading.",
  pseudo:   "the forward lean loads the upper chest and front delts."
};
function emphasisNote(ex) {
  const prim = Object.entries(ex.muscles).filter(([,v]) => v >= 0.7).sort((a,b) => b[1]-a[1]).map(([m]) => MUSCLE_LABELS[m]).join(" + ");
  const f = FLARE[ex.id] || 45;
  return `<b>Trains ${prim}.</b> Elbows sit about <b>${f}° from the torso</b> — ${EMPHASIS[ex.hands] || ""} <span class="muted">Tighter angle → more triceps; wider → more chest.</span>`;
}

/* hand-placement notes shown in the guide */
const HAND_NOTES = {
  shoulder: "Hands about shoulder-width apart, fingers pointing forward.",
  wide:     "Hands ~1.5× shoulder width, fingers angled slightly out.",
  diamond:  "Hands together under your chest — thumbs and index fingers form a diamond.",
  archer:   "Hands set wide. Work one side at a time; the far arm stays straight as a kickstand.",
  pseudo:   "Hands down by your waist, fingers turned out to the sides."
};
/* the exercise currently shown in the guide view */
let pose = { ex: null };

function renderPhotos(ex) {
  const ph = (lbl, fr) => `<figure class="poserow"><div class="poselabel">${lbl}</div><div class="photo-demo"><img class="pdimg is-on" src="img/exercises/${ex.img}/${fr}.jpg" alt="${ex.name} ${lbl}" decoding="async"></div></figure>`;
  $("#poseStage").innerHTML = `<div class="twopose">${ph("① Top — start","top")}${ph("② Bottom","bottom")}</div>`;
}

/* exercises without their own photos (archer, pseudo) get the looping form clip instead of a blank panel */
function renderGuideClip(ex) {
  const src = ex.video || DEFAULT_VIDEO;
  $("#poseStage").innerHTML =
    `<div class="guide-clip"><video src="${src}" autoplay loop muted playsinline disablepictureinpicture disableremoteplayback controlslist="nodownload noplaybackrate noremoteplayback" preload="auto"></video></div>
     <p class="muted small" style="text-align:center;margin-top:8px">General push-up form — follow the steps below for the ${ex.name}-specific movement.</p>`;
}

function openGuide(ex) {
  pose.ex = ex;
  $("#guideTitle").textContent = ex.name;
  $("#guideFocus").textContent = ex.focus;
  const lvl = $("#guideLevel"); lvl.textContent = ex.level; lvl.className = "lvl lvl-" + ex.level;
  $("#guideSteps").innerHTML = ex.steps.map(s => `<li>${s}</li>`).join("");
  $("#guideKeys").innerHTML = ex.cues.map(c => `<li>${c}</li>`).join("");
  $("#handNote").textContent = "Hand placement: " + (HAND_NOTES[ex.hands] || "");
  $("#emphasisNote").innerHTML = emphasisNote(ex);
  $("#guideMuscles").innerHTML = muscleChipsHTML(ex.muscles);
  go("guide");                       // show the view BEFORE inserting the photos so they load
  if (ex.img) { $("#demoView").textContent = "real photos · top & bottom"; renderPhotos(ex); }
  else { $("#demoView").textContent = "form clip"; renderGuideClip(ex); }
}

/* ===========================================================
   Active session
   =========================================================== */
const DEFAULT_VIDEO = "img/clips/pushup.mp4";   // shown during a series unless an exercise sets its own `video`
const DEFAULT_VIDEO_REPS = 4;                   // pushup.mp4 shows 4 full push-ups
const REP_SECONDS = 1.5;                         // play speed so each rep lasts this long
function startSession(ex, sets, reps, rest) {
  session = { ex, sets, reps, rest, currentSet: 1, results: [], repValue: reps, startedAt: Date.now(), resting: false };
  const sv = $("#sessionVideo");
  const vsrc = ex.video || DEFAULT_VIDEO;
  if (vsrc) {
    sv.innerHTML = `<video src="${vsrc}" autoplay loop muted playsinline disablepictureinpicture disableremoteplayback controlslist="nodownload noplaybackrate noremoteplayback" preload="auto"></video>`;
    sv.classList.remove("hidden");
    const vid = sv.querySelector("video");
    const clipReps = ex.videoReps || DEFAULT_VIDEO_REPS;
    const setRate = () => { if (vid.duration && isFinite(vid.duration) && clipReps > 0) vid.playbackRate = Math.min(8, Math.max(0.1, (vid.duration / clipReps) / REP_SECONDS)); };
    vid.addEventListener("loadedmetadata", setRate);
    if (vid.readyState >= 1) setRate();
  } else {
    sv.innerHTML = ""; sv.classList.add("hidden");
  }
  $("#sessionTitle").textContent = ex.name;
  $("#sessionFocus").textContent = ex.focus;
  $("#sessionMuscles").innerHTML = muscleChipsHTML(ex.muscles);
  go("session");
  renderSet();
  try { history.pushState({ bettery: "session" }, ""); } catch (_) {}   // back-button guard for the active workout
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
  setupSetActions();
  renderSetDots();
}

function changeReps(d) {
  if (!session) return;
  session.repValue = Math.max(0, session.repValue + d);
  $("#repValue").textContent = session.repValue;
}

function completeSet() {
  if (!session) return;
  cancelCount();
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
  if (session.restLeft <= 0) { endRest(true); return; }
  updateRing();
}

function endRest(announce) {
  clearInterval(restTimer);
  restTimer = null;
  if (announce) {                       // only when rest ran out on its own, not when skipped
    if (state.settings.sound) beep();
    notify("Rest over 💪", `Time for set ${session.currentSet + 1} of ${session.ex.name}.`);
  }
  session.currentSet++;
  renderSet();
}

function skipRest() { if (session && session.resting) endRest(false); }
function addRest() { if (session && session.resting) { session.restLeft += 15; session.rest += 15; updateRing(); } }

function finishSession() {
  clearInterval(restTimer);
  cancelCount();
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

let exiting = false;
async function exitSession() {
  if (!session) { go("train"); return; }
  if (exiting) return;                 // a confirm is already open
  exiting = true;
  const ok = await confirmDialog("End workout?", "Your progress in this session won't be saved.", "End");
  exiting = false;
  if (ok) { clearInterval(restTimer); cancelCount(); session = null; go("train"); }
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
  $("#voiceToggle").checked = !!state.settings.voice;
  if (!voiceSupported()) { $("#voiceToggle").checked = false; $("#voiceToggle").disabled = true; }
  renderVoiceOptions();
  $("#verLabel").textContent = `v${VERSION}`;
  $$(".mini-step[data-def]").forEach(h => {
    if (h.dataset.bound) return; h.dataset.bound = "1";
    const f = h.dataset.def;
    if (f === "sets") miniStep(h, "sets", 1, 12, 1);
    if (f === "reps") miniStep(h, "reps", 1, 100, 1);
    if (f === "rest") miniStep(h, "rest", 10, 240, 5);
    if (f === "tempo") miniStep(h, "tempo", 2, 6, 1);
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

/* ===========================================================
   Voice rep counter — speaks each rep aloud, hands-free
   =========================================================== */
let voices = [];
function loadVoices() { try { voices = window.speechSynthesis.getVoices() || []; } catch (_) { voices = []; } renderVoiceOptions(); }
if ("speechSynthesis" in window) { loadVoices(); try { window.speechSynthesis.onvoiceschanged = loadVoices; } catch (_) {} }

function voiceSupported() { return "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined"; }
function voiceEnabled()   { return !!state.settings.voice && voiceSupported(); }

/* No celebrity/real-person voices are available to the web — only what's installed on the device.
   So we default to the most natural-sounding female English voice the browser offers and let the
   user override it per device in Settings. */
const FEMALE_HINTS = ["samantha","ava","allison","susan","victoria","karen","moira","tessa","fiona","serena","zira","aria","jenny","michelle","sonia","libby","clara","amber","ashley","nora","amelie","joana","google us english","female","woman"];
function isLikelyFemale(v) { const n = (v.name || "").toLowerCase(); return FEMALE_HINTS.some(h => n.includes(h)); }

function pickVoice() {
  const want = state.settings.voiceName;
  if (want) { const m = voices.find(v => v.voiceURI === want || v.name === want); if (m) return m; }
  const en = voices.filter(v => v.lang && v.lang.toLowerCase().startsWith("en"));
  return en.find(v => isLikelyFemale(v) && v.localService)   // natural female, on-device
      || en.find(v => isLikelyFemale(v))                     // any female English
      || en.find(v => v.localService)                        // any on-device English
      || en[0] || null;
}
function speak(text) {
  if (!voiceSupported()) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US"; u.rate = 1.05; u.pitch = 1; u.volume = 1;
    const v = pickVoice(); if (v) u.voice = v;
    window.speechSynthesis.speak(u);
  } catch (_) {}
}

let countTimer = null;
let counting = false;

function setCountingUI(on) {
  counting = on;
  const vb = $("#voiceBtn"); if (!vb) return;
  vb.classList.toggle("counting", on);
  vb.textContent = on ? "⏸ Stop" : "🔊 Count";
  $("#repValue").classList.toggle("counting", on);
  $("#repMinus").disabled = on;
  $("#repPlus").disabled  = on;
}

/* set up the active-set buttons (voice hero + manual log) for the current set */
function setupSetActions() {
  cancelCount();
  setCountingUI(false);
  const vb = $("#voiceBtn"), cb = $("#completeBtn");
  if (voiceEnabled()) {
    vb.classList.remove("hidden");
    cb.classList.remove("btn-primary"); cb.classList.add("btn-ghost");
  } else {
    vb.classList.add("hidden");
    cb.classList.add("btn-primary"); cb.classList.remove("btn-ghost");
  }
}

function cancelCount() {
  clearTimeout(countTimer); countTimer = null; counting = false;
  try { window.speechSynthesis.cancel(); } catch (_) {}
}

function toggleVoiceCount() {
  if (!session || session.resting) return;
  if (counting) { stopCount(); return; }
  startCount();
}

function startCount() {
  if (!voiceSupported()) { toast("Voice isn't supported on this browser."); return; }
  const target = session.repValue;
  if (target < 1) { toast("Set a rep target first."); return; }
  try { window.speechSynthesis.cancel(); } catch (_) {}
  setCountingUI(true);
  speak("Let's go");
  let n = 0;
  const tempoMs = Math.round((state.settings.tempo || 3) * 1000);
  const tick = () => {
    if (!counting) return;                       // stopped mid-count
    n++;
    $("#repValue").textContent = n;
    session.repValue = n;                        // the logged number tracks what's actually counted
    speak(String(n));
    if (n >= target) { finishCount(); return; }
    countTimer = setTimeout(tick, tempoMs);
  };
  countTimer = setTimeout(tick, 1100);           // brief lead-in after "Let's go"
}

function finishCount() {
  clearTimeout(countTimer); countTimer = null;
  setCountingUI(false);
  if (state.settings.sound) beep();
  speak("Set complete");
  setTimeout(completeSet, 400);                  // log the set, then rest / finish
}

function stopCount() {                            // count reached stays as the rep value — tap Complete to log it
  cancelCount();
  setCountingUI(false);
}

/* Settings: list the device's English voices so the user can choose the counting voice */
function renderVoiceOptions() {
  const sel = $("#voiceSelect"); if (!sel) return;
  const en = voices.filter(v => v.lang && v.lang.toLowerCase().startsWith("en"));
  sel.innerHTML = "";
  if (!en.length) { const o = document.createElement("option"); o.value = ""; o.textContent = "System default"; sel.appendChild(o); return; }
  const cur = pickVoice();
  en.forEach(v => {
    const o = document.createElement("option");
    o.value = v.voiceURI;
    o.textContent = v.name + (v.localService ? "" : " · online");
    if (cur && v.voiceURI === cur.voiceURI) o.selected = true;
    sel.appendChild(o);
  });
}

/* Settings: audition the chosen voice counting 1 → 20 */
let previewTimer = null, previewing = false;
function previewVoiceCount() {
  const btn = $("#previewVoice");
  if (previewing) {                                       // tapping again stops it
    clearTimeout(previewTimer); previewing = false;
    try { window.speechSynthesis.cancel(); } catch (_) {}
    if (btn) btn.textContent = "▶ Hear it count 1–20";
    return;
  }
  if (!voiceSupported()) { toast("Voice isn't supported on this browser."); return; }
  previewing = true; if (btn) btn.textContent = "⏸ Stop";
  try { window.speechSynthesis.cancel(); } catch (_) {}
  let n = 0;
  const step = () => {
    if (!previewing) return;
    n++;
    speak(String(n));
    if (n >= 20) { previewing = false; if (btn) btn.textContent = "▶ Hear it count 1–20"; return; }
    previewTimer = setTimeout(step, 650);
  };
  previewTimer = setTimeout(step, 150);
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
  $("#voiceBtn").addEventListener("click", toggleVoiceCount);
  $("#skipRest").addEventListener("click", skipRest);
  $("#addRest").addEventListener("click", addRest);
  $("#exitSession").addEventListener("click", exitSession);

  // exercise guide
  $("#exitGuide").addEventListener("click", () => go("train"));
  $("#guideStart").addEventListener("click", () => { if (pose.ex) openSetup(pose.ex); });

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
  $("#voiceToggle").addEventListener("change", (e) => { state.settings.voice = e.target.checked; save(); });
  $("#voiceSelect").addEventListener("change", (e) => { state.settings.voiceName = e.target.value; save(); speak("Hi. I'll count your reps."); });
  $("#previewVoice").addEventListener("click", previewVoiceCount);

  // install
  $("#installBtn").addEventListener("click", async () => {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    await deferredInstall.userChoice;
    deferredInstall = null;
    $("#installBtn").classList.add("hidden");
  });

  // back button during an active workout → in-page confirm (no native dialog), re-arm the guard
  window.addEventListener("popstate", () => {
    if (!session || exiting) return;
    history.pushState({ bettery: "session" }, "");
    exitSession();
  });
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
