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
  stopPose();
  if (view !== "session") { const sv = $("#sessionVideo"); if (sv) sv.innerHTML = ""; }  // stop the demo clip
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

/* ===========================================================
   Exercise guide — parameterized side-view figure engine
   =========================================================== */
const FIG = { Lua:26, Lfa:26, Lt:52, Lth:50, Lsh:48, headR:12, neck:9, foot:14, floorY:168, handX:190, vbW:300, vbH:196 };
const vadd = (a, b) => ({ x:a.x+b.x, y:a.y+b.y });
const vsub = (a, b) => ({ x:a.x-b.x, y:a.y-b.y });
const vmul = (a, s) => ({ x:a.x*s, y:a.y*s });
const vunit = (a) => { const d = Math.hypot(a.x, a.y) || 1; return { x:a.x/d, y:a.y/d }; };
function armReach(t) { return (0.96 - 0.48 * t) * (FIG.Lua + FIG.Lfa); }

function circleInt(c1, r1, c2, r2, upper) {
  const dx = c2.x-c1.x, dy = c2.y-c1.y, d = Math.hypot(dx, dy);
  if (d > r1+r2 || d < Math.abs(r1-r2) || d === 0) return null;
  const a = (r1*r1 - r2*r2 + d*d) / (2*d), h2 = r1*r1 - a*a;
  if (h2 < 0) return null;
  const h = Math.sqrt(h2), xm = c1.x + a*dx/d, ym = c1.y + a*dy/d, rx = -dy*(h/d), ry = dx*(h/d);
  const s1 = { x:xm+rx, y:ym+ry }, s2 = { x:xm-rx, y:ym-ry };
  return upper ? (s1.y < s2.y ? s1 : s2) : (s1.y > s2.y ? s1 : s2);
}

function elbowIK(S, H, Lua, Lfa) {
  const dx = H.x-S.x, dy = H.y-S.y, d = Math.hypot(dx, dy) || 0.01;
  if (d >= Lua+Lfa-0.5) return vadd(S, vmul(vunit({ x:dx, y:dy }), Lua));
  const a = (Lua*Lua - Lfa*Lfa + d*d) / (2*d), h = Math.sqrt(Math.max(0, Lua*Lua - a*a));
  const xm = S.x + a*dx/d, ym = S.y + a*dy/d;
  const e1 = { x:xm - dy*(h/d), y:ym + dx*(h/d) }, e2 = { x:xm + dy*(h/d), y:ym - dx*(h/d) };
  return e1.x < e2.x ? e1 : e2;   // elbow points back toward the feet
}

function poseGeom(ex, t) {
  const P = ex.pose;
  const handSurfaceY = FIG.floorY - (P.handLift || 0);
  const footSurfaceY = FIG.floorY - (P.footLift || 0);
  const H = { x:FIG.handX, y:handSurfaceY };
  const bodyLen = P.support === "knees" ? (FIG.Lt + FIG.Lth) : (FIG.Lt + FIG.Lth + FIG.Lsh);
  const fwd = P.leanFwd || 8, Rtop = armReach(0);
  const Stop = { x:H.x + fwd, y:H.y - Math.sqrt(Math.max(1, Rtop*Rtop - fwd*fwd)) };
  const dyF = Math.min(footSurfaceY - Stop.y, bodyLen - 1);
  const dxF = Math.sqrt(Math.max(1, bodyLen*bodyLen - dyF*dyF));
  const F = { x:Stop.x - dxF, y:footSurfaceY };               // foot pivot stays planted
  // shoulder = where the planted body (circle around F) meets the planted arm (circle around H);
  // if full bend is geometrically out of reach (raised hands / big lean), bend as far as possible.
  const S = circleInt(F, bodyLen, H, armReach(t), true) || vadd(F, vmul(vunit(vsub(H, F)), bodyLen));
  const u = vunit(vsub(F, S));                                 // shoulder -> foot (down the spine)
  const hip = vadd(S, vmul(u, FIG.Lt));
  let knee, ankle, toe;
  const up = vunit(vsub(S, F)); // from the foot up the body toward the head
  if (P.support === "knees") {
    knee = vadd(S, vmul(u, FIG.Lt + FIG.Lth));   // knee is the planted pivot on the floor
    ankle = vadd(knee, { x: 5, y: -24 });         // shins lift up behind (feet off the floor)
    toe   = vadd(ankle, { x: 9, y: -7 });
  } else {
    knee = vadd(S, vmul(u, FIG.Lt + FIG.Lth));
    toe   = { x: F.x, y: footSurfaceY };          // ball of the foot planted on the floor
    ankle = vadd(toe, vmul(up, FIG.foot));        // ankle lifts up the body line → heel raised, toes pointing back
  }
  const E = elbowIK(S, H, FIG.Lua, FIG.Lfa);
  const head = vadd(S, vmul(vunit(vsub(S, F)), FIG.neck + FIG.headR));
  return { H, F, S, hip, knee, ankle, toe, E, head, handSurfaceY, footSurfaceY };
}

const BODY_FILL = "#414c66";
function elbowAngle(g) {
  const a = vunit(vsub(g.S, g.E)), b = vunit(vsub(g.H, g.E));
  return Math.round(Math.acos(Math.max(-1, Math.min(1, a.x*b.x + a.y*b.y))) * 180 / Math.PI);
}
function bodyArmAngle(g) {
  const a = vunit(vsub(g.hip, g.S)), b = vunit(vsub(g.E, g.S));
  return Math.round(Math.acos(Math.max(-1, Math.min(1, a.x*b.x + a.y*b.y))) * 180 / Math.PI);
}
function muscleVal(ex, ...ms) { let v = 0; ms.forEach(m => { if ((ex.muscles[m] || 0) > v) v = ex.muscles[m] || 0; }); return v; }
function muscleFill(ex, ...ms) { const v = muscleVal(ex, ...ms); return v >= 0.35 ? colorFor(v) : BODY_FILL; }
function hotCls(ex, ...ms) { return muscleVal(ex, ...ms) >= 0.5 ? " fig-hot" : ""; }

/* a tapered "muscle" shape between two joints, with a mid bulge (bias offsets the belly to one side) */
function lp(A, B, wA, wM, wB, bias) {
  bias = bias || { x:0, y:0 };
  const dir = vunit(vsub(B, A)), pe = { x:-dir.y, y:dir.x }, M = { x:(A.x+B.x)/2, y:(A.y+B.y)/2 }, n = v => v.toFixed(1);
  const a1 = vadd(A, vmul(pe, wA/2)), a2 = vadd(A, vmul(pe, -wA/2));
  const b1 = vadd(B, vmul(pe, wB/2)), b2 = vadd(B, vmul(pe, -wB/2));
  const m1 = vadd(vadd(M, vmul(pe, wM/2)), bias), m2 = vadd(vadd(M, vmul(pe, -wM/2)), bias);
  const capB = vadd(B, vmul(dir, Math.max(wB,3)/2)), capA = vadd(A, vmul(dir, -Math.max(wA,3)/2));
  return `M${n(a1.x)},${n(a1.y)} Q${n(m1.x)},${n(m1.y)} ${n(b1.x)},${n(b1.y)} Q${n(capB.x)},${n(capB.y)} ${n(b2.x)},${n(b2.y)} Q${n(m2.x)},${n(m2.y)} ${n(a2.x)},${n(a2.y)} Q${n(capA.x)},${n(capA.y)} ${n(a1.x)},${n(a1.y)} Z`;
}
function arcPath(C, v1, v2, R) {
  const n = v => v.toFixed(1), s = vadd(C, vmul(v1, R)), e = vadd(C, vmul(v2, R));
  const sweep = (v1.x*v2.y - v1.y*v2.x) > 0 ? 1 : 0;
  return `M${n(s.x)},${n(s.y)} A${R},${R} 0 0 ${sweep} ${n(e.x)},${n(e.y)}`;
}

/* Anatomical side-view male figure: shaped muscles, worked areas highlighted, elbow + body-arm angle arcs. */
function figureSVG(ex, g) {
  const P = ex.pose, n = (v) => v.toFixed(1);
  const along = (a,b,d) => ({ x:a.x+(b.x-a.x)*d, y:a.y+(b.y-a.y)*d });
  let blocks = "";
  if (P.handLift > 0) blocks += `<rect class="fig-surface" x="${n(g.H.x-34)}" y="${n(g.handSurfaceY)}" width="86" height="${n(FIG.floorY-g.handSurfaceY)}" rx="4"/>`;
  if (P.footLift > 0) { const bx = Math.max(2, g.F.x - 56); blocks += `<rect class="fig-surface" x="${n(bx)}" y="${n(g.footSurfaceY)}" width="${n(g.F.x + 42 - bx)}" height="${n(FIG.floorY-g.footSurfaceY)}" rx="4"/>`; }

  const u = vunit(vsub(g.hip, g.S));
  let fr = { x:-u.y, y:u.x };
  if (((g.H.x-g.S.x)*fr.x + (g.H.y-g.S.y)*fr.y) < 0) fr = { x:u.y, y:-u.x };
  const back = vmul(fr, -1), deg = (Math.atan2(u.y,u.x)*180/Math.PI).toFixed(1);

  const thigh = lp(g.hip, g.knee, 18, 19, 13, vmul(back,2));
  const shin  = lp(g.knee, g.ankle, 14, 14, 7, vmul(back,3));
  const foot  = lp(g.ankle, g.toe, 7, 8, 5, {x:0,y:0});
  const torso = lp(g.S, g.hip, 26, 25, 18, vmul(fr,4));
  const neckEnd = vsub(g.head, vmul(vunit(vsub(g.head, g.S)), 13));
  const neck  = lp(g.S, neckEnd, 13, 12, 12, {x:0,y:0});
  const upper = lp(g.S, g.E, 17, 16, 10, {x:0,y:0});
  const fore  = lp(g.E, g.H, 12, 11, 6, {x:0,y:0});
  const chestC = vadd(along(g.S,g.hip,0.27), vmul(fr,8));
  const coreC  = vadd(along(g.S,g.hip,0.60), vmul(fr,6));

  return `<svg viewBox="0 0 ${FIG.vbW} ${FIG.vbH}" xmlns="http://www.w3.org/2000/svg" aria-label="${ex.name} side view, worked muscles highlighted">
    <line class="fig-floor" x1="6" y1="${FIG.floorY}" x2="${FIG.vbW-6}" y2="${FIG.floorY}"/>
    ${blocks}
    <path class="body" d="${thigh}"/>
    <path class="body" d="${shin}"/>
    <path class="body" d="${foot}"/>
    <path class="body" d="${torso}"/>
    <ellipse class="mus${hotCls(ex,'core')}" cx="${n(coreC.x)}" cy="${n(coreC.y)}" rx="12" ry="7" transform="rotate(${deg} ${n(coreC.x)} ${n(coreC.y)})" fill="${muscleFill(ex,'core')}"/>
    <ellipse class="mus${hotCls(ex,'chest','upper-chest')}" cx="${n(chestC.x)}" cy="${n(chestC.y)}" rx="15" ry="9.5" transform="rotate(${deg} ${n(chestC.x)} ${n(chestC.y)})" fill="${muscleFill(ex,'chest','upper-chest')}"/>
    <path class="body" d="${neck}"/>
    <ellipse class="body" cx="${n(g.head.x)}" cy="${n(g.head.y)}" rx="12.5" ry="10.5" transform="rotate(${deg} ${n(g.head.x)} ${n(g.head.y)})"/>
    <path class="mus${hotCls(ex,'triceps')}" d="${upper}" fill="${muscleFill(ex,'triceps')}"/>
    <ellipse class="mus${hotCls(ex,'front-delt')}" cx="${n(g.S.x)}" cy="${n(g.S.y)}" rx="10.5" ry="9.5" fill="${muscleFill(ex,'front-delt')}"/>
    <path class="body" d="${fore}"/>
    <ellipse class="fig-hand" cx="${n(g.H.x)}" cy="${n(g.H.y)}" rx="6.5" ry="3.6" transform="rotate(${deg} ${n(g.H.x)} ${n(g.H.y)})"/>
  </svg>`;
}

/* elbow flare = angle the upper arms make with the torso (from above). This is what shifts
   the load between triceps (tucked) and chest (flared) — it's a top-down angle, so it's shown
   as a value rather than drawn on the side view. */
const FLARE = { knee:45, incline:45, standard:45, wide:75, diamond:20, decline:45, archer:55, pseudo:30 };
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

/* top-down hand-placement diagram */
const HAND_NOTES = {
  shoulder: "Hands about shoulder-width apart, fingers pointing forward.",
  wide:     "Hands ~1.5× shoulder width, fingers angled slightly out.",
  diamond:  "Hands together under your chest — thumbs and index fingers form a diamond.",
  archer:   "Hands set wide. Work one side at a time; the far arm stays straight as a kickstand.",
  pseudo:   "Hands down by your waist, fingers turned out to the sides."
};
const hdHand = (cx, cy, rot) => `<ellipse class="hd-hand" cx="${cx}" cy="${cy}" rx="10" ry="13" transform="rotate(${rot||0} ${cx} ${cy})"/>`;
const hdArm  = (a, b) => `<line class="hd-arm" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`;
function handDiagramSVG(p) {
  const L = [72, 40], R = [128, 40];
  const base = `<circle class="hd-head" cx="100" cy="16" r="9"/><rect class="hd-body" x="66" y="30" width="68" height="13" rx="6"/><rect class="hd-body" x="80" y="42" width="40" height="34" rx="12" opacity="0.5"/>`;
  let s;
  if (p === "wide")        { const hl=[38,84], hr=[162,84]; s = hdArm(L,hl)+hdArm(R,hr)+hdHand(hl[0],hl[1],-20)+hdHand(hr[0],hr[1],20); }
  else if (p === "diamond"){ const hl=[94,94], hr=[106,94]; s = hdArm(L,hl)+hdArm(R,hr)+`<path class="hd-anno" d="M94,90 L106,90 L100,104 Z"/>`+hdHand(hl[0],hl[1],35)+hdHand(hr[0],hr[1],-35); }
  else if (p === "archer") { const hl=[30,74], hr=[126,82]; s = hdArm(L,hl)+hdArm(R,hr)+hdHand(hl[0],hl[1],-80)+hdHand(hr[0],hr[1],0)+`<text class="hd-label" x="100" y="120" text-anchor="middle">weight over the bent arm</text>`; }
  else if (p === "pseudo") { const hl=[84,98], hr=[116,98]; s = hdArm(L,hl)+hdArm(R,hr)+hdHand(hl[0],hl[1],-55)+hdHand(hr[0],hr[1],55); }
  else                     { const hl=[72,80], hr=[128,80]; s = hdArm(L,hl)+hdArm(R,hr)+hdHand(hl[0],hl[1],0)+hdHand(hr[0],hr[1],0); }
  return `<svg viewBox="0 0 200 130" xmlns="http://www.w3.org/2000/svg" aria-label="hand placement, top view">${base}${s}</svg>`;
}

/* guide view: two static poses (top + bottom), worked muscles highlighted, both angles labelled */
let pose = { ex:null, view:"anim" };
function stopPose() {}   // no running animation any more; kept so go() can call it safely

function poseBlock(label, g, ex, cue) {
  return `<figure class="poserow">
    <div class="poselabel">${label}<span class="ac ac-el">elbow ${elbowAngle(g)}°</span></div>
    ${figureSVG(ex, g)}
    <p class="posecue">${cue}</p>
  </figure>`;
}
function renderDiagram(ex) {
  const base = ex.pose.support === "knees" ? "head to knees" : "head to heels";
  const topCue = `Start at the top: arms straight, body in one line (${base}). Brace your core and squeeze your glutes.`;
  const botCue = `Bend your elbows about ${FLARE[ex.id] || 45}° from your body and lower your chest until it's a fist's height from the floor — then press back up.`;
  $("#poseStage").innerHTML =
    `<div class="twopose">${poseBlock("① Top — start", poseGeom(ex,0), ex, topCue)}${poseBlock("② Bottom", poseGeom(ex,1), ex, botCue)}</div>`;
}
function renderPhotos(ex) {
  const ph = (lbl, fr) => `<figure class="poserow"><div class="poselabel">${lbl}</div><div class="photo-demo"><img class="pdimg is-on" src="img/exercises/${ex.img}/${fr}.jpg" alt="${ex.name} ${lbl}" decoding="async"></div></figure>`;
  $("#poseStage").innerHTML = `<div class="twopose">${ph("① Top — start","top")}${ph("② Bottom","bottom")}</div>`;
}
function setDemo(view) {
  pose.view = (view === "photo" && pose.ex.img) ? "photo" : "anim";
  $$("#demoToggle [data-view]").forEach(b => b.classList.toggle("chip--on", b.dataset.view === pose.view));
  if (pose.view === "photo") { $("#demoView").textContent = "real photos · top & bottom"; renderPhotos(pose.ex); }
  else { $("#demoView").textContent = "anatomical · muscles + angles"; renderDiagram(pose.ex); }
}

function openGuide(ex) {
  stopPose();
  pose.ex = ex; pose.t = 0; pose.dir = 1; pose.frame = 0;
  $("#guideTitle").textContent = ex.name;
  $("#guideFocus").textContent = ex.focus;
  const lvl = $("#guideLevel"); lvl.textContent = ex.level; lvl.className = "lvl lvl-" + ex.level;
  $("#guideSteps").innerHTML = ex.steps.map(s => `<li>${s}</li>`).join("");
  $("#guideKeys").innerHTML = ex.cues.map(c => `<li>${c}</li>`).join("");
  $("#handNote").textContent = "Hand placement: " + (HAND_NOTES[ex.hands] || "");
  $("#emphasisNote").innerHTML = emphasisNote(ex);
  const gm = $("#guideMap"); gm.innerHTML = muscleSVG(); paintMap(gm, ex.muscles);
  $("#guideMuscles").innerHTML = muscleChipsHTML(ex.muscles);
  const photoChip = $("#demoToggle [data-view='photo']");
  if (photoChip) photoChip.style.display = ex.img ? "" : "none";
  go("guide");                       // show the view BEFORE inserting the demo so media loads
  setDemo("anim");
}

/* ===========================================================
   Active session
   =========================================================== */
const DEFAULT_VIDEO = "img/clips/pushup.mp4";   // shown during a series unless an exercise sets its own `video`
function startSession(ex, sets, reps, rest) {
  session = { ex, sets, reps, rest, currentSet: 1, results: [], repValue: reps, startedAt: Date.now(), resting: false };
  const sv = $("#sessionVideo"), sm = $("#sessionMap");
  const vsrc = ex.video || DEFAULT_VIDEO;
  if (vsrc) {
    sv.innerHTML = `<video src="${vsrc}" autoplay loop muted playsinline preload="auto"></video>`;
    sv.classList.remove("hidden");
    sm.classList.add("hidden");
  } else {
    sv.innerHTML = ""; sv.classList.add("hidden");
    sm.classList.remove("hidden");
    if (!sm.dataset.ready) { sm.innerHTML = muscleSVG(); sm.dataset.ready = "1"; }
    paintMap(sm, ex.muscles);
  }
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

  // exercise guide
  $("#exitGuide").addEventListener("click", () => go("train"));
  $("#guideStart").addEventListener("click", () => { if (pose.ex) openSetup(pose.ex); });
  $$("#demoToggle [data-view]").forEach(b => b.addEventListener("click", () => setDemo(b.dataset.view)));

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
