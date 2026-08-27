import {
  currentUser,
  deleteAttempt,
  getAttempt,
  getExam,
  initStore,
  isCloud,
  listAttempts,
  setExam,
  signIn,
  signOut,
  signUp,
  upsertAttempt
} from "./store.js";
import {
  PLATFORMS,
  SUBJECTS,
  TYPE_META,
  bySubject,
  defaultsFor,
  fmt,
  num,
  sectionAvgs,
  summarize,
  trend
} from "./stats.js";
import { drawSpark, el, pctBar, svgIcons, today, toast } from "./ui.js";

const root = document.getElementById("app");
const icons = svgIcons();
let cache = [];

function parseHash() {
  const raw = (location.hash || "#/").replace(/^#/, "");
  const [path, qs] = raw.split("?");
  const parts = path.split("/").filter(Boolean);
  const params = Object.fromEntries(new URLSearchParams(qs || ""));
  return { parts, params };
}

function go(to) {
  location.hash = to;
}

function filterRows(type) {
  const exam = getExam();
  return cache.filter((r) => r.exam === exam && (!type || r.test_type === type));
}

function shell(active, inner, { fabType } = {}) {
  const exam = getExam();
  root.innerHTML = `
    <div class="app-bg"></div>
    <header class="topbar">
      <div class="brand">Mock<span>Tracker</span></div>
      <div class="spacer"></div>
      <div class="seg" id="examSeg">
        <button data-exam="cgl" class="${exam === "cgl" ? "on" : ""}">CGL</button>
        <button data-exam="chsl" class="${exam === "chsl" ? "on" : ""}">CHSL</button>
      </div>
      ${isCloud() && currentUser() ? `<button class="icon-btn" id="logoutBtn" title="Sign out" style="font-size:1.1rem">🚪</button>` : ""}
    </header>
    <main class="page">${inner}</main>
    <nav class="nav">
      <a href="#/" class="${active === "home" ? "on" : ""}">${icons.home}Home</a>
      <a href="#/full" class="${active === "full" ? "on" : ""}">${icons.full}Full</a>
      <a href="#/sectional" class="${active === "sectional" ? "on" : ""}">${icons.sectional}Section</a>
      <a href="#/quiz" class="${active === "daily" ? "on" : ""}">${icons.quiz}Quiz</a>
      <a href="#/all" class="${active === "all" ? "on" : ""}">${icons.all}All</a>
    </nav>
    ${
      fabType
        ? `<button class="fab" id="fab" aria-label="Add">+</button>`
        : ""
    }
  `;
  document.getElementById("examSeg").onclick = (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    setExam(b.dataset.exam);
    render();
  };
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      if (await confirmModal("Are you sure you want to sign out?", "Sign out")) {
        await signOut();
        location.reload();
      }
    };
  }
  const fab = document.getElementById("fab");
  if (fab) fab.onclick = () => go(`/add?type=${fabType}`);
}

function attemptItem(r) {
  return `
    <a class="item" href="#/attempt/${r.id}">
      <div>
        <div class="name">${escapeHtml(r.name || TYPE_META[r.test_type]?.title || "Test")}</div>
        <div class="meta">${r.taken_on} · ${r.platform}${r.subject ? " · " + r.subject : ""}${r.topic ? " · " + r.topic : ""}</div>
      </div>
      <div>
        <div class="score">${fmt(r.score)}<span style="color:var(--muted);font-weight:500;font-size:.8rem">/${fmt(r.total_marks, 0)}</span></div>
        <div class="pct">${fmt(r.accuracy_pct)}% acc</div>
      </div>
    </a>
  `;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function confirmModal(message, confirmText = "OK") {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.7);backdrop-filter:blur(5px);z-index:100;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.2s;";
    
    const box = document.createElement("div");
    box.className = "card";
    box.style.cssText = "width:320px;text-align:center;padding:24px;border:1px solid var(--line);transform:scale(0.9);transition:transform 0.2s;";
    box.innerHTML = `
      <p style="margin:0 0 24px;font-size:1.1rem;font-weight:600;">${escapeHtml(message)}</p>
      <div style="display:flex;gap:12px;">
        <button class="btn ghost" id="btn-cancel">Cancel</button>
        <button class="btn danger" id="btn-ok">${escapeHtml(confirmText)}</button>
      </div>
    `;
    
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    
    requestAnimationFrame(() => {
      overlay.style.opacity = "1";
      box.style.transform = "scale(1)";
    });
    
    const close = (result) => {
      overlay.style.opacity = "0";
      box.style.transform = "scale(0.9)";
      setTimeout(() => { if (document.body.contains(overlay)) document.body.removeChild(overlay); }, 200);
      resolve(result);
    };
    
    document.getElementById("btn-cancel").onclick = () => close(false);
    document.getElementById("btn-ok").onclick = () => close(true);
  });
}

function analysisBlock(rows, type) {
  const s = summarize(rows);
  const points = trend(rows);
  let extra = "";
  if (type === "full") {
    const sec = sectionAvgs(rows);
    extra = `
      <div class="card">
        <div class="kicker">Section averages</div>
        ${sectionRow("Maths", sec.maths, 50, "violet")}
        ${sectionRow("Reasoning", sec.reasoning, 50, "")}
        ${sectionRow("English", sec.english, 50, "gold")}
        ${sectionRow("GK/GS", sec.gk, 50, "coral")}
      </div>`;
  } else {
    const topics = bySubject(rows);
    extra = topics.length
      ? `<div class="card">
          <div class="kicker">Subject snapshot</div>
          ${topics
            .map(
              (t) => `
            <div style="margin-bottom:10px">
              <div style="display:flex;justify-content:space-between;font-size:.85rem">
                <b>${escapeHtml(t.subject)}</b><span>${fmt(t.avgAcc)}% acc · ${t.count} tests</span>
              </div>
              ${pctBar(t.avgAcc, type === "daily" ? "" : "gold")}
            </div>`
            )
            .join("")}
        </div>`
      : "";
  }
  return `
    <div class="grid-3" style="margin-bottom:12px">
      <div class="stat"><b>${s.count}</b><span>Tests</span></div>
      <div class="stat"><b>${fmt(s.avgPct)}%</b><span>Avg score</span></div>
      <div class="stat"><b>${fmt(s.avgAcc)}%</b><span>Avg accuracy</span></div>
    </div>
    <div class="card">
      <div class="kicker">Score % trend</div>
      <div class="chart-wrap"><canvas id="spark" style="width:100%;height:168px"></canvas></div>
    </div>
    ${extra}
  `;
}

function sectionRow(lab, val, max, klass) {
  return `
    <div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;font-size:.85rem">
        <span>${lab}</span><b>${fmt(val)}</b>
      </div>
      ${pctBar(max ? (val / max) * 100 : 0, klass)}
    </div>`;
}

function renderHome() {
  const exam = getExam();
  const all = filterRows();
  const full = filterRows("full");
  const sectional = filterRows("sectional");
  const daily = filterRows("daily");
  const s = summarize(all);
  shell(
    "home",
    `
    ${!isCloud() ? `<div class="banner">Local mode — data is on this phone. Settings se Supabase jod sakte ho.</div>` : ""}
    <p class="h1">${exam.toUpperCase()} overview</p>
    <p class="sub">Full, sectional aur daily quiz alag tabs mein — yahan combined pulse.</p>
    <div class="grid-3" style="margin-bottom:14px">
      <div class="stat"><b>${s.count}</b><span>Total tests</span></div>
      <div class="stat"><b>${fmt(s.avgPct)}%</b><span>Avg score</span></div>
      <div class="stat"><b>${fmt(s.bestScore)}</b><span>Best marks</span></div>
    </div>
    <div class="grid-3" style="margin-bottom:16px">
      <a class="type-tile full" href="#/full"><span class="n">${full.length}</span><strong>Full</strong><em>Complete mocks</em></a>
      <a class="type-tile sectional" href="#/sectional"><span class="n">${sectional.length}</span><strong>Section</strong><em>Chapter tests</em></a>
      <a class="type-tile daily" href="#/quiz"><span class="n">${daily.length}</span><strong>Quiz</strong><em>Daily 10Q</em></a>
    </div>
    <div class="card">
      <div class="kicker">Recent</div>
      <div class="list">${all.slice(0, 6).map(attemptItem).join("") || `<div class="empty">Abhi kuch nahi. + se pehla test add karo.</div>`}</div>
    </div>
  `,
    { fabType: "full" }
  );
}

function renderType(type, navKey, hash) {
  const rows = filterRows(type);
  const meta = TYPE_META[type];
  shell(
    navKey,
    `
    <p class="h1">${meta.title}</p>
    <p class="sub">${meta.hint} · sirf ${getExam().toUpperCase()} data</p>
    ${analysisBlock(rows, type)}
    <div class="card" style="margin-top:10px">
      <div class="kicker">All entries</div>
      <div class="list">${rows.map(attemptItem).join("") || `<div class="empty"><b>Is type mein kuch nahi</b>Neeche + dabao</div>`}</div>
    </div>
  `,
    { fabType: type }
  );
  const canvas = document.getElementById("spark");
  if (canvas) drawSpark(canvas, trend(rows), type === "full" ? "#a78bfa" : type === "sectional" ? "#fbbf24" : "#5eead4");
}

function renderAll() {
  const rows = filterRows();
  shell(
    "all",
    `
    <p class="h1">All Activity</p>
    <p class="sub">Chronological list of every test · Filters coming soon</p>
    <div class="card" style="margin-top:10px">
      <div class="list">${rows.map(attemptItem).join("") || `<div class="empty"><b>Koi data nahi hai</b>Neeche + dabao</div>`}</div>
    </div>
  `,
    { fabType: "full" }
  );
}

function field(name, label, type, value, extra = "") {
  if (type === "select") {
    return `<div class="field"><label>${label}</label><select name="${name}">${extra}</select></div>`;
  }
  if (type === "textarea") {
    return `<div class="field"><label>${label}</label><textarea name="${name}">${escapeHtml(value || "")}</textarea></div>`;
  }
  return `<div class="field"><label>${label}</label><input name="${name}" type="${type}" value="${escapeHtml(value ?? "")}" ${extra}></div>`;
}

function renderForm(existing, presetType) {
  const type = existing?.test_type || presetType || "full";
  const draftKey = `mt_draft_${type}_${existing?.id || 'new'}`;
  let draft = null;
  try { draft = JSON.parse(localStorage.getItem(draftKey)); } catch (e) {}
  
  const d = { taken_on: today(), exam: getExam(), test_type: type, platform: "Testbook", ...defaultsFor(type), ...(existing || {}), ...(draft || {}) };
  const typeFields =
    type === "full"
      ? `
        <div class="grid-2">
          ${field("maths", "Maths score", "number", d.maths, 'step="0.25"')}
          ${field("reasoning", "Reasoning", "number", d.reasoning, 'step="0.25"')}
        </div>
        <div class="grid-2">
          ${field("english", "English", "number", d.english, 'step="0.25"')}
          ${field("gk", "GK/GS", "number", d.gk, 'step="0.25"')}
        </div>`
      : `
        ${field("subject", "Subject", "select", d.subject, SUBJECTS.map((s) => `<option ${d.subject === s ? "selected" : ""}>${s}</option>`).join(""))}
        ${type === "sectional" ? field("sectional_kind", "Kind", "select", d.sectional_kind, ["Chapter", "Complete"].map((s) => `<option ${d.sectional_kind === s ? "selected" : ""}>${s}</option>`).join("")) : ""}
        ${field("topic", "Topic", "text", d.topic, 'placeholder="Order & ranking"')}`;

  shell(
    type === "daily" ? "daily" : type,
    `
    <p class="h1">${existing ? "Edit" : "Add"} ${TYPE_META[type].title}</p>
    <p class="sub">Jo platform pe diya, wahi numbers yahan.</p>
    <form id="f" class="card">
      ${field("taken_on", "Date", "date", d.taken_on)}
      ${field("platform", "Platform", "select", d.platform, PLATFORMS.map((p) => `<option ${d.platform === p ? "selected" : ""}>${p}</option>`).join(""))}
      ${field("name", "Test name", "text", d.name, 'placeholder="CT 01 / PYQ / Live mock"')}
      <div class="grid-2">
        ${field("score", "Score", "number", d.score, 'step="0.25" required')}
        ${field("total_marks", "Total marks", "number", d.total_marks, 'step="0.25" required')}
      </div>
      <div class="grid-3">
        ${field("correct", "Correct", "number", d.correct)}
        ${field("wrong", "Wrong", "number", d.wrong)}
        ${field("unattempted", "Unattempted", "number", d.unattempted)}
      </div>
      <div class="grid-2">
        ${field("time_taken_min", "Time (min)", "number", d.time_taken_min, 'step="0.01"')}
        ${field("total_time_min", "Total time", "number", d.total_time_min, 'step="0.01"')}
      </div>
      ${typeFields}
      <div class="grid-2">
        ${field("percentile", "Percentile", "number", d.percentile, 'step="0.01"')}
        ${field("rank", "Rank", "number", d.rank, 'step="1"')}
      </div>
      ${field("notes", "Notes", "textarea", d.notes)}
      <button class="btn" type="submit">Save</button>
    </form>
  `
  );
  
  const formEl = document.getElementById("f");
  formEl.addEventListener("input", () => {
    const fd = new FormData(formEl);
    localStorage.setItem(draftKey, JSON.stringify(Object.fromEntries(fd.entries())));
  });

  formEl.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const row = Object.fromEntries(fd.entries());
    ["score", "total_marks", "correct", "wrong", "unattempted", "time_taken_min", "total_time_min", "maths", "reasoning", "english", "gk", "percentile", "rank"].forEach((k) => {
      row[k] = row[k] === "" ? null : num(row[k]);
    });
    row.test_type = type;
    row.exam = getExam();
    if (existing) row.id = existing.id;
    try {
      await upsertAttempt(row);
      localStorage.removeItem(draftKey);
      toast("Saved");
      go(type === "daily" ? "/quiz" : `/${type}`);
    } catch (err) {
      toast(err.message || "Save failed");
    }
  };
}

function renderDetail(id) {
  const r = cache.find((x) => x.id === id);
  if (!r) {
    shell("home", `<div class="empty">Not found</div>`);
    return;
  }
  const same = cache.filter((x) => x.exam === r.exam && x.test_type === r.test_type && x.id !== r.id);
  const avg = summarize(same);
  const maxScore = Math.max(num(r.score), avg.avgScore, num(r.total_marks) || 1);
  shell(
    r.test_type === "daily" ? "daily" : r.test_type,
    `
    <p class="h1">${escapeHtml(r.name || "Attempt")}</p>
    <p class="sub">${r.taken_on} · ${r.platform} · ${r.exam.toUpperCase()} · ${TYPE_META[r.test_type].title}</p>
    <div class="metric-grid">
      <div class="metric"><div class="lab">Score</div><div class="val">${fmt(r.score)}/${fmt(r.total_marks, 0)}</div>${pctBar(r.score_pct)}</div>
      <div class="metric"><div class="lab">Accuracy</div><div class="val">${fmt(r.accuracy_pct)}%</div>${pctBar(r.accuracy_pct, "gold")}</div>
      <div class="metric"><div class="lab">Attempted</div><div class="val">${num(r.correct) + num(r.wrong)}/${num(r.correct) + num(r.wrong) + num(r.unattempted)}</div>${pctBar(r.speed_pct, "violet")}</div>
      <div class="metric"><div class="lab">Time</div><div class="val">${fmt(r.time_taken_min)}/${fmt(r.total_time_min)}</div>${pctBar(r.total_time_min ? (num(r.time_taken_min) / num(r.total_time_min)) * 100 : 0, "coral")}</div>
    </div>
    ${
      r.test_type === "full"
        ? `<div class="card" style="margin-top:10px"><div class="kicker">Sections</div>
            ${sectionRow("Maths", r.maths, 50, "violet")}
            ${sectionRow("Reasoning", r.reasoning, 50, "")}
            ${sectionRow("English", r.english, 50, "gold")}
            ${sectionRow("GK/GS", r.gk, 50, "coral")}
          </div>`
        : `<div class="card" style="margin-top:10px"><span class="chip">${escapeHtml(r.subject || "")}</span> ${escapeHtml(r.topic || "")}</div>`
    }
    <div class="card" style="margin-top:10px">
      <div class="kicker">You vs your ${r.test_type} average</div>
      <div class="compare">
        ${cmp("Score", r.score, avg.avgScore, maxScore)}
        ${cmp("Accuracy", r.accuracy_pct, avg.avgAcc, 100)}
      </div>
    </div>
    <div class="row" style="margin-top:12px">
      <button class="btn ghost" id="edit">Edit</button>
      <button class="btn danger" id="del">Delete</button>
    </div>
  `
  );
  document.getElementById("edit").onclick = () => go(`/add?id=${r.id}&type=${r.test_type}`);
  document.getElementById("del").onclick = async () => {
    if (!(await confirmModal("Delete this attempt permanently?", "Delete"))) return;
    await deleteAttempt(r.id);
    toast("Deleted");
    go(r.test_type === "daily" ? "/quiz" : `/${r.test_type}`);
  };
}

function cmp(lab, you, avg, max) {
  const y = num(you);
  const a = num(avg);
  const m = max || Math.max(y, a, 1);
  return `<div>
    <div class="line"><span>${lab}</span><div class="track"><div class="you" style="width:${(y / m) * 100}%"></div></div><b>${fmt(y)}</b></div>
    <div class="line"><span style="color:var(--muted)">Avg</span><div class="track"><div class="avg" style="width:${(a / m) * 100}%"></div></div><span>${fmt(a)}</span></div>
  </div>`;
}

function renderAuth() {
  root.innerHTML = `
    <div class="app-bg"></div>
    <main class="page" style="padding-top:72px">
      <p class="h1">Mock Tracker</p>
      <p class="sub">Apka account — data Supabase pe rahega permanent.</p>
      <form id="auth" class="card">
        ${field("email", "Email", "email", "", "required")}
        ${field("password", "Password", "password", "", "required minlength=6")}
        <button class="btn" type="submit">Sign in</button>
        <button class="btn ghost" type="button" id="up" style="margin-top:8px">Create account</button>
      </form>
    </main>
  `;
  const form = document.getElementById("auth");
  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    try {
      await signIn(fd.get("email"), fd.get("password"));
      toast("Welcome");
      await boot();
    } catch (err) {
      toast(err.message);
    }
  };
  document.getElementById("up").onclick = async () => {
    const fd = new FormData(form);
    try {
      await signUp(fd.get("email"), fd.get("password"));
      toast("Check email / then sign in");
    } catch (err) {
      toast(err.message);
    }
  };
}

async function render() {
  const { parts, params } = parseHash();
  if (isCloud() && !currentUser()) {
    return renderAuth();
  }
  try {
    cache = await listAttempts();
  } catch (e) {
    shell("home", `<div class="banner">${escapeHtml(e.message)}</div>`);
    return;
  }
  const [a, b] = parts;
  if (!a) return renderHome();
  if (a === "full") return renderType("full", "full");
  if (a === "sectional") return renderType("sectional", "sectional");
  if (a === "quiz") return renderType("daily", "daily");
  if (a === "all") return renderAll();
  if (a === "add") {
    const existing = params.id ? await getAttempt(params.id) : null;
    return renderForm(existing, params.type || existing?.test_type);
  }
  if (a === "attempt" && b) return renderDetail(b);
  renderHome();
}

async function boot() {
  try {
    await initStore();
    if (isCloud() && !currentUser()) renderAuth();
    else await render();
  } catch (err) {
    console.error("Boot error:", err);
    root.innerHTML = `<div style="padding:20px;text-align:center;color:red;margin-top:50px;font-family:sans-serif;">Error connecting to Supabase: ${err.message}<br><br><button onclick="localStorage.removeItem('mt_supabase');location.reload()" style="padding:10px;margin-top:20px;cursor:pointer;">Reset Settings</button></div>`;
  }
}

window.addEventListener("hashchange", () => render());
window.addEventListener("mt-auth", () => boot());
boot();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js");
}
