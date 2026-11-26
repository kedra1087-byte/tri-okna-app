import test from "node:test"
import assert from "node:assert/strict"
import {
  PRODUCTS, addMonths, emptyWallet, extraSpreads, grant, loadWallet, renewDue, saveWallet, setRenew, subActive,
} from "./purchases.js"

const memory = () => {
  const map = new Map()
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, String(v)) }
}

test("пакет добавляет три расклада только на сегодня", () => {
  const now = new Date(2026, 9, 24, 19, 0)
  let wallet = grant(emptyWallet(), "pack3", { now, day: "2026-10-24" })
  wallet = grant(wallet, "pack3", { now, day: "2026-10-24" })
  assert.equal(extraSpreads(wallet, "2026-10-24"), 6)
  assert.equal(extraSpreads(wallet, "2026-10-25"), 0)
  wallet = grant(wallet, "pack3", { now, day: "2026-10-25" })
  assert.deepEqual(wallet.packs, { "2026-10-25": 3 })
  assert.equal(wallet.history.length, 3)
  assert.equal(wallet.history[0].price, PRODUCTS.pack3.price)
})

test("подписка на месяц, повторная покупка продлевает от конца срока", () => {
  const now = new Date(2026, 9, 24, 19, 0)
  let wallet = grant(emptyWallet(), "regular_month", { now })
  assert.ok(subActive(wallet, now))
  assert.equal(new Date(wallet.sub.until).getMonth(), 10)
  wallet = grant(wallet, "regular_year", { now })
  const until = new Date(wallet.sub.until)
  assert.equal(until.getFullYear(), 2027)
  assert.equal(until.getMonth(), 10)
  assert.equal(wallet.sub.sku, "regular_year")
  assert.ok(!subActive(wallet, new Date(2027, 11, 1)))
})

test("31 января плюс месяц — конец февраля", () => {
  const next = addMonths(new Date(2027, 0, 31, 12), 1)
  assert.equal(next.getMonth(), 1)
  assert.equal(next.getDate(), 28)
})

test("отменённая подписка доживает срок и не продлевается", () => {
  const now = new Date(2026, 9, 24)
  let wallet = setRenew(grant(emptyWallet(), "regular_month", { now }), false)
  assert.ok(subActive(wallet, new Date(2026, 10, 20)))
  wallet = renewDue(wallet, new Date(2026, 11, 30))
  assert.ok(!subActive(wallet, new Date(2026, 11, 30)))
  assert.equal(wallet.history.length, 1)
})

test("тестовое автопродление закрывает пропущенные месяцы", () => {
  const now = new Date(2026, 9, 24)
  let wallet = grant(emptyWallet(), "regular_month", { now })
  wallet = renewDue(wallet, new Date(2027, 0, 26))
  assert.ok(subActive(wallet, new Date(2027, 0, 26)))
  assert.equal(wallet.history.filter((row) => row.renewal).length, 3)
})

test("кошелёк переживает сохранение, мусор не ломает загрузку", () => {
  const storage = memory()
  const wallet = grant(emptyWallet(), "regular_month", { now: new Date(2026, 9, 24) })
  saveWallet(storage, wallet)
  assert.deepEqual(loadWallet(storage), wallet)
  storage.setItem("tri_okna_wallet", "{broken")
  assert.deepEqual(loadWallet(storage), emptyWallet())
  storage.setItem("tri_okna_wallet", JSON.stringify({ sub: { sku: "made_up", until: "2030-01-01" } }))
  assert.equal(loadWallet(storage).sub, null)
})
