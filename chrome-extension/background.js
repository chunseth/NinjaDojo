import { EXTENSION_ENV } from "./env.js";

const config = {
  supabaseUrl: EXTENSION_ENV.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: EXTENSION_ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  externalSource: "sensei"
};

const pageState = new Map();
const flushTimers = new Map();
const TABLE_ACTIVE_SESSIONS = "active_sessions";
const TABLE_STUDENTS = "students";
const INACTIVE_GRACE_MS = 3 * 60 * 1000;

function normalizeName(input) {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z\s'-]/g, "");
}

function chicagoDayKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function hashPageId(url) {
  let hash = 0;
  for (let idx = 0; idx < url.length; idx += 1) {
    hash = (hash << 5) - hash + url.charCodeAt(idx);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

async function upsertRows(tableName, rows, contextLabel, conflictColumn = "idempotency_key") {
  if (!rows.length) {
    return;
  }
  if (!config.supabaseUrl.startsWith("https://") || config.supabaseUrl.includes("REPLACE_WITH")) {
    console.error("NinjaDojo extension misconfigured: set NEXT_PUBLIC_SUPABASE_URL and run npm run sync:extension-env");
    return;
  }
  if (config.supabaseAnonKey.includes("REPLACE_WITH")) {
    console.error("NinjaDojo extension misconfigured: set NEXT_PUBLIC_SUPABASE_ANON_KEY and run npm run sync:extension-env");
    return;
  }

  const endpoint = `${config.supabaseUrl}/rest/v1/${encodeURIComponent(tableName)}?on_conflict=${encodeURIComponent(conflictColumn)}`;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${config.supabaseAnonKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal"
      },
      body: JSON.stringify(rows)
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`NinjaDojo sync failed (${contextLabel})`, response.status, text);
      return;
    }
  } catch (error) {
    console.error(
      `NinjaDojo network error while syncing ${contextLabel}. Check Supabase URL/project status and extension host permissions.`,
      error
    );
  }
}

function supabaseHeaders() {
  return {
    apikey: config.supabaseAnonKey,
    Authorization: `Bearer ${config.supabaseAnonKey}`,
    "Content-Type": "application/json"
  };
}

function encodeIn(values) {
  const encoded = values.map((value) => `"${String(value).replace(/"/g, '\\"')}"`).join(",");
  return `(${encoded})`;
}

function buildSessionIdempotencyKey(normalizedName, dayKey, sourceStatus) {
  return `${config.externalSource}:${normalizedName}:${dayKey}:${sourceStatus}`;
}

async function fetchKnownActiveTodayFromSupabase(names, dayKey) {
  const uniqueNames = Array.from(new Set((names || []).map((name) => normalizeName(name)).filter(Boolean)));
  if (!uniqueNames.length) {
    return new Set();
  }
  if (!config.supabaseUrl.startsWith("https://") || config.supabaseUrl.includes("REPLACE_WITH")) {
    return new Set();
  }
  if (config.supabaseAnonKey.includes("REPLACE_WITH")) {
    return new Set();
  }

  const activeKeys = uniqueNames.map((normalizedName) => buildSessionIdempotencyKey(normalizedName, dayKey, "active"));
  const selectUrl = `${config.supabaseUrl}/rest/v1/${encodeURIComponent(TABLE_ACTIVE_SESSIONS)}?select=idempotency_key&idempotency_key=in.${encodeURIComponent(encodeIn(activeKeys))}`;

  try {
    const existingRes = await fetch(selectUrl, {
      method: "GET",
      headers: supabaseHeaders()
    });
    if (!existingRes.ok) {
      const text = await existingRes.text();
      console.error("NinjaDojo sync failed (active history select)", existingRes.status, text);
      return new Set();
    }

    const rows = await existingRes.json();
    const knownActive = new Set();
    (rows || []).forEach((row) => {
      const key = String(row.idempotency_key || "");
      const parts = key.split(":");
      if (parts.length >= 4) {
        knownActive.add(parts[1]);
      }
    });
    return knownActive;
  } catch (error) {
    console.error("NinjaDojo network error while reading active history.", error);
    return new Set();
  }
}

async function buildEvents(pageId, incomingNames, incomingInactiveNames = []) {
  const dayKey = chicagoDayKey();
  const previousState = pageState.get(pageId);
  const nowMs = Date.now();
  const activeState =
    previousState && previousState.dayKey === dayKey && previousState.activeNames instanceof Set
      ? previousState.activeNames
      : new Set();
  const seenActiveToday =
    previousState && previousState.dayKey === dayKey && previousState.seenActive instanceof Set
      ? new Set(previousState.seenActive)
      : new Set();
  const lastSeenActiveAt =
    previousState && previousState.dayKey === dayKey && previousState.lastSeenActiveAt instanceof Map
      ? new Map(previousState.lastSeenActiveAt)
      : new Map();
  const incomingSet = new Set(incomingNames.map((name) => normalizeName(name)).filter(Boolean));
  incomingSet.forEach((name) => {
    seenActiveToday.add(name);
    lastSeenActiveAt.set(name, nowMs);
  });
  const incomingInactiveMap = new Map();
  incomingInactiveNames.forEach((name) => {
    const normalized = normalizeName(name);
    if (normalized) {
      incomingInactiveMap.set(normalized, name);
    }
  });
  const nowIso = new Date().toISOString();

  const events = [];

  incomingNames.forEach((rawName) => {
    const normalized = normalizeName(rawName);
    if (!normalized) return;
    events.push({
      student_name: rawName,
      normalized_name: normalized,
      source_status: "active",
      source_page_id: pageId,
      observed_at: nowIso,
      external_source: config.externalSource,
      idempotency_key: buildSessionIdempotencyKey(normalized, dayKey, "active")
    });
  });

  const inactiveCandidates = new Set();

  activeState.forEach((previousName) => {
    if (!incomingSet.has(previousName)) {
      inactiveCandidates.add(previousName);
    }
  });

  incomingInactiveMap.forEach((rawInactiveName, inactiveName) => {
    if (incomingSet.has(inactiveName)) {
      return;
    }
    inactiveCandidates.add(inactiveName);
  });

  const unknownInactive = Array.from(inactiveCandidates).filter((name) => !seenActiveToday.has(name));
  const knownActiveFromSupabase = await fetchKnownActiveTodayFromSupabase(unknownInactive, dayKey);
  knownActiveFromSupabase.forEach((name) => seenActiveToday.add(name));

  inactiveCandidates.forEach((inactiveName) => {
    if (!seenActiveToday.has(inactiveName)) {
      return;
    }
    const lastSeenAt = Number(lastSeenActiveAt.get(inactiveName) ?? 0);
    if (lastSeenAt > 0 && nowMs - lastSeenAt < INACTIVE_GRACE_MS) {
      return;
    }
    const rawInactiveName = incomingInactiveMap.get(inactiveName) ?? inactiveName;
    events.push({
      student_name: rawInactiveName,
      normalized_name: inactiveName,
      source_status: "inactive",
      source_page_id: pageId,
      observed_at: nowIso,
      external_source: config.externalSource,
      idempotency_key: buildSessionIdempotencyKey(inactiveName, dayKey, "inactive")
    });
  });

  pageState.set(pageId, { dayKey, activeNames: incomingSet, seenActive: seenActiveToday, lastSeenActiveAt });
  return events;
}

function buildMyNinjasRows(incomingNames) {
  const rows = [];
  const seen = new Set();

  incomingNames.forEach((rawName) => {
    const normalized = normalizeName(rawName);
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    rows.push({
      full_name: rawName,
      normalized_name: normalized,
      status: "active"
    });
  });

  return rows;
}

async function syncStudentsFromMyNinjas(rows) {
  if (!rows.length) {
    return;
  }
  if (!config.supabaseUrl.startsWith("https://") || config.supabaseUrl.includes("REPLACE_WITH")) {
    console.error("NinjaDojo extension misconfigured: set NEXT_PUBLIC_SUPABASE_URL and run npm run sync:extension-env");
    return;
  }
  if (config.supabaseAnonKey.includes("REPLACE_WITH")) {
    console.error("NinjaDojo extension misconfigured: set NEXT_PUBLIC_SUPABASE_ANON_KEY and run npm run sync:extension-env");
    return;
  }

  const normalizedNames = rows.map((row) => row.normalized_name);
  const selectUrl = `${config.supabaseUrl}/rest/v1/${encodeURIComponent(TABLE_STUDENTS)}?select=id,normalized_name&normalized_name=in.${encodeURIComponent(encodeIn(normalizedNames))}`;

  try {
    const existingRes = await fetch(selectUrl, {
      method: "GET",
      headers: supabaseHeaders()
    });
    if (!existingRes.ok) {
      const text = await existingRes.text();
      console.error("NinjaDojo sync failed (students select)", existingRes.status, text);
      return;
    }
    const existingRows = await existingRes.json();
    const existingMap = new Map();
    (existingRows || []).forEach((row) => {
      if (!existingMap.has(row.normalized_name)) {
        existingMap.set(row.normalized_name, row.id);
      }
    });

    const toInsert = [];
    const toUpdate = [];
    rows.forEach((row) => {
      const existingId = existingMap.get(row.normalized_name);
      if (existingId) {
        toUpdate.push({ id: existingId, status: "active" });
      } else {
        toInsert.push(row);
      }
    });

    if (toInsert.length > 0) {
      const insertUrl = `${config.supabaseUrl}/rest/v1/${encodeURIComponent(TABLE_STUDENTS)}`;
      const insertRes = await fetch(insertUrl, {
        method: "POST",
        headers: {
          ...supabaseHeaders(),
          Prefer: "return=minimal"
        },
        body: JSON.stringify(toInsert)
      });
      if (!insertRes.ok) {
        const text = await insertRes.text();
        console.error("NinjaDojo sync failed (students insert)", insertRes.status, text);
      }
    }

    for (const row of toUpdate) {
      const updateUrl = `${config.supabaseUrl}/rest/v1/${encodeURIComponent(TABLE_STUDENTS)}?id=eq.${encodeURIComponent(row.id)}`;
      const updateRes = await fetch(updateUrl, {
        method: "PATCH",
        headers: {
          ...supabaseHeaders(),
          Prefer: "return=minimal"
        },
        body: JSON.stringify({ status: "active" })
      });
      if (!updateRes.ok) {
        const text = await updateRes.text();
        console.error("NinjaDojo sync failed (students update)", updateRes.status, text);
      }
    }
  } catch (error) {
    console.error("NinjaDojo network error while syncing students from my-ninjas.", error);
  }
}

function queueSync(pageKind, pageId, names, inactiveNames) {
  const timerKey = `${pageKind}:${pageId}`;
  const existing = flushTimers.get(timerKey);
  if (existing) {
    clearTimeout(existing);
  }
  flushTimers.set(
    timerKey,
    setTimeout(async () => {
      if (pageKind === "my-ninjas") {
        const rows = buildMyNinjasRows(names);
        await syncStudentsFromMyNinjas(rows);
      } else {
        const rows = await buildEvents(pageId, names, inactiveNames);
        await upsertRows(TABLE_ACTIVE_SESSIONS, rows, "active_sessions");
      }
      flushTimers.delete(timerKey);
    }, 1000)
  );
}

chrome.runtime.onMessage.addListener((payload) => {
  if (payload?.type !== "ACTIVE_KIDS_SNAPSHOT") {
    return;
  }
  const pageKind = payload.pageKind === "my-ninjas" ? "my-ninjas" : "live-ninjas";
  const pageId = `${hashPageId(payload.pageUrl || "unknown")}`;
  const activeNames = Array.isArray(payload.activeNames) ? payload.activeNames : [];
  const inactiveNames = Array.isArray(payload.inactiveNames) ? payload.inactiveNames : [];
  queueSync(pageKind, pageId, activeNames, inactiveNames);
});
