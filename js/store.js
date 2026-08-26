import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { derived, uid } from "./stats.js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const CFG_KEY = "mt_supabase";
const LOCAL_KEY = "mt_attempts";
const EXAM_KEY = "mt_exam";

let supabase = null;
let session = null;

export function getExam() {
  return localStorage.getItem(EXAM_KEY) || "cgl";
}
export function setExam(exam) {
  localStorage.setItem(EXAM_KEY, exam);
}

export function getConfig() {
  if (SUPABASE_URL && SUPABASE_URL !== 'YOUR_SUPABASE_URL_HERE') {
    return { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY };
  }
  try {
    return JSON.parse(localStorage.getItem(CFG_KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveConfig(url, anonKey) {
  localStorage.setItem(CFG_KEY, JSON.stringify({ url: url.trim(), anonKey: anonKey.trim() }));
}

export function isCloud() {
  const { url, anonKey } = getConfig();
  return Boolean(url && anonKey);
}

export async function initStore() {
  if (!isCloud()) {
    supabase = null;
    session = { user: { id: "local" } };
    return { mode: "local", session };
  }
  const { url, anonKey } = getConfig();
  supabase = createClient(url, anonKey);
  const { data } = await supabase.auth.getSession();
  session = data.session;
  supabase.auth.onAuthStateChange((_e, s) => {
    session = s;
    window.dispatchEvent(new Event("mt-auth"));
  });
  return { mode: "cloud", session };
}

export function currentUser() {
  return session?.user || null;
}

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUp(email, password) {
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
}

export async function signOut() {
  if (supabase) await supabase.auth.signOut();
}

function localAll() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
  } catch {
    return [];
  }
}
function localSave(rows) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(rows));
}

export async function listAttempts() {
  if (!isCloud() || !session?.user?.id || session.user.id === "local") {
    return localAll().sort((a, b) => String(b.taken_on).localeCompare(String(a.taken_on)));
  }
  const { data, error } = await supabase
    .from("attempts")
    .select("*")
    .order("taken_on", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getAttempt(id) {
  const rows = await listAttempts();
  return rows.find((r) => r.id === id) || null;
}

export async function upsertAttempt(row) {
  const ready = derived({
    ...row,
    id: row.id || uid(),
    user_id: session?.user?.id || "local"
  });
  if (!isCloud() || ready.user_id === "local") {
    const rows = localAll();
    const i = rows.findIndex((r) => r.id === ready.id);
    if (i >= 0) rows[i] = ready;
    else rows.unshift(ready);
    localSave(rows);
    return ready;
  }
  const { data, error } = await supabase.from("attempts").upsert(ready).select().single();
  if (error) throw error;
  return data;
}

export async function deleteAttempt(id) {
  if (!isCloud() || session?.user?.id === "local") {
    localSave(localAll().filter((r) => r.id !== id));
    return;
  }
  const { error } = await supabase.from("attempts").delete().eq("id", id);
  if (error) throw error;
}
