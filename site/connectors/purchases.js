/** Покупки таверны: что продаётся, что гость уже купил, и оплата.
 * Сейчас оплата тестовая: кошелёк лежит на телефоне, деньги не списываются.
 * Робокасса встанет на место createTestPayments: pay(order) так же вернёт { ok, status }.
 */

export const WALLET_KEY = "tri_okna_wallet"
export const PACK_SPREADS = 3
export const REGULAR = { spreads: 10, follow: 5 }
const HISTORY_CAP = 50

export const PRODUCTS = {
  pack3: {
    sku: "pack3",
    kind: "pack",
    title: "Ещё 3 расклада",
    price: 99,
    spreads: PACK_SPREADS,
    note: "Только на сегодня — до полуночи.",
  },
  regular_month: {
    sku: "regular_month",
    kind: "sub",
    title: "Завсегдатай на месяц",
    short: "Месяц",
    price: 299,
    months: 1,
    note: "Продлевается раз в месяц. Отменить можно в любой момент.",
  },
  regular_year: {
    sku: "regular_year",
    kind: "sub",
    title: "Завсегдатай на год",
    short: "Год",
    price: 1990,
    months: 12,
    note: "Выходит 166 ₽ в месяц. Продлевается раз в год.",
  },
}

export function emptyWallet() {
  return { packs: {}, sub: null, history: [] }
}

export function loadWallet(storage) {
  try {
    const raw = JSON.parse(storage.getItem(WALLET_KEY) || "null")
    if (!raw || typeof raw !== "object") return emptyWallet()
    const sub = raw.sub && PRODUCTS[raw.sub.sku] && !Number.isNaN(Date.parse(raw.sub.until)) ? raw.sub : null
    return {
      packs: raw.packs && typeof raw.packs === "object" ? raw.packs : {},
      sub,
      history: Array.isArray(raw.history) ? raw.history.slice(0, HISTORY_CAP) : [],
    }
  } catch {
    return emptyWallet()
  }
}

export function saveWallet(storage, wallet) {
  storage.setItem(WALLET_KEY, JSON.stringify(wallet))
}

export function addMonths(date, months) {
  const next = new Date(date)
  const day = next.getDate()
  next.setMonth(next.getMonth() + months)
  // 31 января + месяц — это 28 или 29 февраля, а не 3 марта.
  if (next.getDate() < day) next.setDate(0)
  return next
}

export function subActive(wallet, now = new Date()) {
  return Boolean(wallet.sub && new Date(wallet.sub.until) > now)
}

export function extraSpreads(wallet, day) {
  return Number(wallet.packs?.[day]) || 0
}

export function newOrderId(now = new Date()) {
  return `${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function record(wallet, product, { now, orderId, test, renewal = false }) {
  const row = { id: orderId || newOrderId(now), sku: product.sku, price: product.price, at: now.toISOString(), test }
  if (renewal) row.renewal = true
  return [row, ...wallet.history].slice(0, HISTORY_CAP)
}

export function grant(wallet, sku, { now = new Date(), day, orderId, test = true } = {}) {
  const product = PRODUCTS[sku]
  if (!product) throw new Error(`Нет такого товара: ${sku}`)
  const next = { ...wallet, packs: { ...wallet.packs }, history: record(wallet, product, { now, orderId, test }) }
  if (product.kind === "pack") {
    next.packs = { [day]: extraSpreads(wallet, day) + product.spreads }
  } else {
    const start = subActive(wallet, now) ? new Date(wallet.sub.until) : now
    next.sub = {
      sku,
      until: addMonths(start, product.months).toISOString(),
      renew: true,
      since: subActive(wallet, now) ? wallet.sub.since : now.toISOString(),
    }
  }
  return next
}

export function setRenew(wallet, renew) {
  if (!wallet.sub) return wallet
  return { ...wallet, sub: { ...wallet.sub, renew: Boolean(renew) } }
}

/** Тестовое автопродление: при настоящей оплате его сделает сервер по ответу Робокассы. */
export function renewDue(wallet, now = new Date(), test = true) {
  if (!wallet.sub?.renew) return wallet
  let next = wallet
  let guard = 0
  while (new Date(next.sub.until) <= now && guard < 60) {
    const product = PRODUCTS[next.sub.sku]
    next = {
      ...next,
      sub: { ...next.sub, until: addMonths(new Date(next.sub.until), product.months).toISOString() },
      history: record(next, product, { now: new Date(next.sub.until), test, renewal: true }),
    }
    guard += 1
  }
  return next
}

export function createTestPayments({ delay = 1200 } = {}) {
  return {
    mode: "test",
    pay(order, { decline = false } = {}) {
      return new Promise((resolve) => {
        setTimeout(() => resolve(decline ? { ok: false, status: "declined" } : { ok: true, status: "paid", orderId: order.orderId }), delay)
      })
    },
  }
}
