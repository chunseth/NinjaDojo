const SNAPSHOT_DEBOUNCE_MS = 1200;
const HEARTBEAT_MS = 15000;
const LIVE_NINJAS_PATH_PREFIX = "/live-ninjas";
const MY_NINJAS_PATH_PREFIX = "/my-ninjas";

if (window.__NINJADOJO_BRIDGE_LOADED__) {
  // Prevent duplicate observers/intervals if script is injected more than once.
  // This can happen on SPA navigations/reloads.
} else {
  window.__NINJADOJO_BRIDGE_LOADED__ = true;

let debounceTimer = null;
let heartbeatTimer = null;
let bridgeStopped = false;

function normalizeName(input) {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z\s'-]/g, "");
}

function extractKidsByStatus() {
  const active = new Map();
  const inactive = new Map();

  const cards = document.querySelectorAll(
    "app-live-ninjas .many_ninjas_main .many_inside_ninjas .many_ninjas"
  );

  cards.forEach((card) => {
    const nameNode = card.querySelector(".ninjas_details h3");
    const rawName = (nameNode?.textContent || "").trim();
    if (!rawName) return;

    const normalized = normalizeName(rawName);
    if (!normalized) return;

    const isExpired = card.classList.contains("time-expired");
    if (isExpired) {
      inactive.set(normalized, rawName);
      active.delete(normalized);
      return;
    }
    active.set(normalized, rawName);
    inactive.delete(normalized);
  });

  return {
    activeNames: Array.from(active.values()).sort((a, b) => a.localeCompare(b)),
    inactiveNames: Array.from(inactive.values()).sort((a, b) => a.localeCompare(b))
  };
}

function extractMyNinjasActive() {
  const active = new Map();
  const rows = document.querySelectorAll("app-my-ninjas .home-list-wrapper");

  rows.forEach((row) => {
    const statusText =
      (row.querySelector(".active-wrapper-list")?.textContent || row.textContent || "").toLowerCase();
    if (!statusText.includes("subscription status: active")) {
      return;
    }
    const rawName = (row.querySelector(".label-wrapper-list span")?.textContent || "").trim();
    if (!rawName) {
      return;
    }
    const normalized = normalizeName(rawName);
    if (!normalized) {
      return;
    }
    active.set(normalized, rawName);
  });

  return Array.from(active.values()).sort((a, b) => a.localeCompare(b));
}

function stopBridge() {
  if (bridgeStopped) {
    return;
  }
  bridgeStopped = true;
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  observer.disconnect();
}

function isRuntimeAvailable() {
  return typeof chrome !== "undefined" && Boolean(chrome.runtime?.id);
}

function isLiveNinjasPage() {
  return location.hostname === "sensei.codeninjas.com" && location.pathname.startsWith(LIVE_NINJAS_PATH_PREFIX);
}

function isMyNinjasPage() {
  return location.hostname === "sensei.codeninjas.com" && location.pathname.startsWith(MY_NINJAS_PATH_PREFIX);
}

function getPageKind() {
  if (isLiveNinjasPage()) {
    return "live-ninjas";
  }
  if (isMyNinjasPage()) {
    return "my-ninjas";
  }
  return null;
}

function sendSnapshot(reason) {
  if (bridgeStopped) {
    return;
  }
  const pageKind = getPageKind();
  if (!pageKind) {
    return;
  }
  if (!isRuntimeAvailable()) {
    stopBridge();
    return;
  }
  const { activeNames, inactiveNames } =
    pageKind === "live-ninjas"
      ? extractKidsByStatus()
      : { activeNames: extractMyNinjasActive(), inactiveNames: [] };
  const payload = {
    type: "ACTIVE_KIDS_SNAPSHOT",
    reason,
    pageKind,
    activeNames,
    inactiveNames,
    pageUrl: location.href,
    pageTitle: document.title
  };

  try {
    const maybePromise = chrome.runtime.sendMessage(payload);
    if (maybePromise && typeof maybePromise.then === "function") {
      maybePromise.catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        if (message.toLowerCase().includes("context invalidated")) {
          stopBridge();
          return;
        }
        console.debug("NinjaDojo bridge message skipped:", message);
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("context invalidated")) {
      stopBridge();
      return;
    }
    console.debug("NinjaDojo bridge send failed:", error);
  }
}

function scheduleSnapshot(reason) {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => sendSnapshot(reason), SNAPSHOT_DEBOUNCE_MS);
}

const observer = new MutationObserver(() => {
  scheduleSnapshot("dom-mutation");
});

if (getPageKind()) {
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });

  sendSnapshot("initial");
  heartbeatTimer = setInterval(() => sendSnapshot("heartbeat"), HEARTBEAT_MS);
}

}
