/** Подписка на пуши таверны. Разрешение браузера спрашиваем только по нажатию гостя. */

const PREFS_KEY = "tri_okna_push"

function isoDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function keyBytes(base64) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/")
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0))
}

function post(path, body) {
  return fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).then((res) => res.json())
}

export function pushPrefs() {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) || "null")
    if (raw?.endpoint) return raw
  } catch {
    /* повреждённые настройки считаем выключенными */
  }
  return { endpoint: "", kinds: { rest: false, moon: false }, restDay: "", seenDay: "" }
}

function savePrefs(prefs) {
  if (prefs.endpoint) localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  else localStorage.removeItem(PREFS_KEY)
}

function standalone() {
  return window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true
}

/** "ok" — можно подписаться; "ios-home" — iPhone, нужно добавить на экран «Домой»; "denied" — запрещено в браузере; "no" — браузер не умеет. */
export function pushSupport() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  if (ios && !standalone()) return "ios-home"
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "no"
  if (Notification.permission === "denied") return "denied"
  return "ok"
}

let serverKey = null

/** Публичный ключ сервера; пустая строка — пушей нет (например, на GitHub Pages без сервера). */
export async function pushServerKey() {
  if (serverKey !== null) return serverKey
  try {
    const data = await fetch("api/push/key").then((res) => res.json())
    serverKey = data?.ok && data.key ? data.key : ""
  } catch {
    serverKey = ""
  }
  return serverKey
}

async function registration() {
  return navigator.serviceWorker.register("sw.js")
}

export async function enablePush(kinds) {
  const key = await pushServerKey()
  if (!key) return { ok: false, reason: "server" }
  const support = pushSupport()
  if (support !== "ok") return { ok: false, reason: support }
  const permission = await Notification.requestPermission()
  if (permission !== "granted") return { ok: false, reason: permission === "denied" ? "denied" : "dismissed" }
  const reg = await registration()
  await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) })
  const prefs = { ...pushPrefs(), endpoint: sub.endpoint, kinds: { ...pushPrefs().kinds, ...kinds } }
  const data = await post("api/push/subscribe", {
    subscription: sub.toJSON(),
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Moscow",
    kinds: prefs.kinds,
  })
  if (!data?.ok) return { ok: false, reason: "server" }
  savePrefs(prefs)
  return { ok: true }
}

export async function setPushKinds(kinds) {
  const prefs = pushPrefs()
  const next = { ...prefs.kinds, ...kinds }
  if (!next.rest && !next.moon) return disablePush()
  return enablePush(next)
}

export async function disablePush() {
  const prefs = pushPrefs()
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    await sub?.unsubscribe()
  } catch {
    /* подписка уже снята браузером */
  }
  if (prefs.endpoint) post("api/push/unsubscribe", { endpoint: prefs.endpoint }).catch(() => {})
  savePrefs({ endpoint: "" })
  return { ok: true }
}

export function pushOn(kind) {
  const prefs = pushPrefs()
  return Boolean(prefs.endpoint) && (!kind || Boolean(prefs.kinds?.[kind]))
}

/** Гость исчерпал расклады: утром можно напомнить, что карты отдохнули. */
export function notePushRest() {
  const prefs = pushPrefs()
  const day = isoDay()
  if (!prefs.endpoint || prefs.restDay === day) return
  post("api/push/rest", { endpoint: prefs.endpoint, day }).then((data) => {
    if (data?.ok) savePrefs({ ...pushPrefs(), restDay: day })
    else if (data?.reason === "unknown") savePrefs({ endpoint: "" })
  }).catch(() => {})
}

/** Гость пришёл сам — утреннее напоминание уже не нужно. */
export function notePushSeen() {
  const prefs = pushPrefs()
  const day = isoDay()
  if (!prefs.endpoint || prefs.seenDay === day) return
  post("api/push/seen", { endpoint: prefs.endpoint, day }).then((data) => {
    if (data?.ok) savePrefs({ ...pushPrefs(), seenDay: day })
    else if (data?.reason === "unknown") savePrefs({ endpoint: "" })
  }).catch(() => {})
}

export async function testPush() {
  const prefs = pushPrefs()
  if (!prefs.endpoint) return { ok: false, reason: "off" }
  try {
    return await post("api/push/test", { endpoint: prefs.endpoint })
  } catch {
    return { ok: false, reason: "server" }
  }
}
