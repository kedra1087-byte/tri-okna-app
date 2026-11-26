const SESSION = "tri_okna_account"

export function rememberAccount(account) {
  sessionStorage.setItem(SESSION, JSON.stringify({
    store: account.store,
    token: account.token,
  }))
}

export function clearAccount() {
  sessionStorage.removeItem(SESSION)
}

export function currentAccount() {
  try {
    const raw = JSON.parse(sessionStorage.getItem(SESSION) || "null")
    if (!raw?.token || (raw.store !== "google" && raw.store !== "apple")) return null
    const exp = tokenExp(raw.token)
    if (exp && exp * 1000 < Date.now() + 15000) {
      clearAccount()
      return null
    }
    return { store: raw.store, token: raw.token }
  } catch {
    return null
  }
}

export async function accountMode() {
  if (typeof window.triOknaAccount === "function") {
    try {
      const got = await window.triOknaAccount()
      if (got?.token && (got.store === "google" || got.store === "apple")) {
        rememberAccount(got)
        return { kind: "store", account: { store: got.store, token: got.token } }
      }
    } catch {
      /* оболочка магазина не отдала вход */
    }
    return { kind: "store", account: currentAccount() }
  }
  const saved = currentAccount()
  if (saved) return { kind: "store", account: saved }
  return { kind: "local", account: null }
}

function guestZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || ""
  } catch {
    return ""
  }
}

export function postJson(path, body) {
  return fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tz: guestZone(), ...body }),
  }).then((res) => res.json())
}

function tokenExp(token) {
  try {
    const part = String(token).split(".")[1]
    const padded = part.replace(/-/g, "+").replace(/_/g, "/")
    const json = JSON.parse(atob(padded))
    return Number(json.exp) || 0
  } catch {
    return 0
  }
}
