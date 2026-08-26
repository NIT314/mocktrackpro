export function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
}

export function derived(row) {
  const score = num(row.score);
  const total = num(row.total_marks) || 0;
  const correct = num(row.correct);
  const wrong = num(row.wrong);
  const unattempted = num(row.unattempted);
  const attempted = correct + wrong;
  const qs = attempted + unattempted;
  const time = num(row.time_taken_min);
  const ttot = num(row.total_time_min);
  return {
    ...row,
    score_pct: total ? round((score / total) * 100) : 0,
    accuracy_pct: attempted ? round((correct / attempted) * 100) : 0,
    speed_pct: ttot ? round((time / ttot) * 100) : qs ? round((attempted / qs) * 100) : 0
  };
}

export function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function round(n) {
  return Math.round(n * 100) / 100;
}

export function fmt(n, d = 1) {
  if (n == null || n === "") return "—";
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return Number.isInteger(x) ? String(x) : x.toFixed(d);
}

export function defaultsFor(type) {
  if (type === "full") {
    return { total_marks: 200, unattempted: 100, total_time_min: 60 };
  }
  if (type === "daily") {
    return { total_marks: 10, unattempted: 10, total_time_min: 10 };
  }
  return { total_marks: 50, unattempted: 25, total_time_min: 20 };
}

export function summarize(rows) {
  if (!rows.length) {
    return { count: 0, avgScore: 0, bestScore: 0, avgAcc: 0, avgPct: 0, avgTime: 0 };
  }
  const avg = (fn) => rows.reduce((s, r) => s + fn(r), 0) / rows.length;
  return {
    count: rows.length,
    avgScore: round(avg((r) => num(r.score))),
    bestScore: round(Math.max(...rows.map((r) => num(r.score)))),
    avgAcc: round(avg((r) => num(r.accuracy_pct))),
    avgPct: round(avg((r) => num(r.score_pct))),
    avgTime: round(avg((r) => num(r.time_taken_min)))
  };
}

export function bySubject(rows) {
  const map = {};
  for (const r of rows) {
    const key = (r.subject || "Other").trim() || "Other";
    if (!map[key]) map[key] = [];
    map[key].push(r);
  }
  return Object.entries(map)
    .map(([subject, list]) => ({ subject, ...summarize(list) }))
    .sort((a, b) => b.avgAcc - a.avgAcc);
}

export function sectionAvgs(rows) {
  const keys = ["maths", "reasoning", "english", "gk"];
  const out = {};
  for (const k of keys) {
    const vals = rows.map((r) => r[k]).filter((v) => v != null && v !== "");
    out[k] = vals.length ? round(vals.reduce((s, v) => s + num(v), 0) / vals.length) : 0;
  }
  return out;
}

export function trend(rows, key = "score_pct", n = 12) {
  return [...rows]
    .sort((a, b) => String(a.taken_on).localeCompare(String(b.taken_on)))
    .slice(-n)
    .map((r) => ({ x: r.taken_on, y: num(r[key]) }));
}

export const TYPE_META = {
  full: { title: "Full mocks", hint: "100Q • 200 marks", color: "violet" },
  sectional: { title: "Sectional", hint: "Chapter / section", color: "gold" },
  daily: { title: "Daily quiz", hint: "Short 10Q drills", color: "mint" }
};

export const PLATFORMS = ["Testbook", "Oliveboard", "Test Ranking", "Other"];
export const SUBJECTS = ["Maths", "Reasoning", "English", "GK/GS"];
