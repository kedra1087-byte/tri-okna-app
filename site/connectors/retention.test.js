import test from "node:test"
import assert from "node:assert/strict"
import { agoText, addDays, canAsk, daysBetween, nextToAsk, outcomeStats } from "./outcome.js"
import { monthCards, monthSummary } from "./month.js"
import { layMoon, moonEvents, moonHeadline, moonWindow, nextMoon } from "./moon.js"

const spread = (id, date, extra = {}) => ({ id, type: "spread", date, q: "Что с работой?", cards: [], ...extra })

test("«Сбылось?» спрашивает через три дня и не дольше двух месяцев", () => {
  assert.equal(daysBetween("2026-10-22", "2026-10-25"), 3)
  assert.equal(addDays("2026-10-30", 3), "2026-11-2")
  assert.equal(canAsk(spread("a", "2026-10-23"), "2026-10-25"), false)
  assert.equal(canAsk(spread("a", "2026-10-22"), "2026-10-25"), true)
  assert.equal(canAsk(spread("a", "2026-8-1"), "2026-10-25"), false)
  assert.equal(canAsk(spread("a", "2026-10-1", { q: "" }), "2026-10-25"), false)
  assert.equal(canAsk(spread("a", "2026-10-1", { came: "yes" }), "2026-10-25"), false)
  assert.equal(canAsk({ type: "yesno", date: "2026-10-1", q: "Да?" }, "2026-10-25"), false)
})

test("в зале спрашивают о самом свежем созревшем раскладе, отложенный ждёт", () => {
  const list = [spread("new", "2026-10-24"), spread("later", "2026-10-20", { later: "2026-10-27" }), spread("old", "2026-10-10")]
  assert.equal(nextToAsk(list, "2026-10-25").id, "old")
  assert.equal(nextToAsk(list, "2026-10-27").id, "new")
  assert.equal(nextToAsk([spread("x", "2026-10-25")], "2026-10-25"), null)
})

test("подписи времени и счёт ответов", () => {
  assert.equal(agoText(3), "3 дня назад")
  assert.equal(agoText(11), "11 дней назад")
  assert.equal(agoText(21), "21 день назад")
  const stats = outcomeStats([spread("a", "2026-10-1", { came: "yes" }), spread("b", "2026-10-1", { came: "no" }), spread("c", "2026-10-1")])
  assert.deepEqual(stats, { yes: 1, part: 0, no: 1, total: 2 })
})

test("месяц в картах считает 30 дней, масти, тон и повторы", () => {
  const list = [
    { type: "daily", date: "2026-10-25", cards: ["cups_2"] },
    { type: "spread", date: "2026-10-20", cards: ["cups_3", "cups_2", "magician"] },
    { type: "yesno", date: "2026-10-10", cards: ["cups_ace"] },
    { type: "spread", date: "2026-10-1", cards: ["cups_king", "swords_9"] },
    { type: "daily", date: "2026-9-1", cards: ["tower"] },
  ]
  const stats = monthCards(list, "2026-10-25")
  assert.equal(stats.total, 7)
  assert.equal(stats.suits.cups, 5)
  assert.equal(stats.suits.major, 1)
  assert.equal(stats.top[0].card.id, "cups_2")
  assert.equal(stats.top[0].count, 2)
  const lines = monthSummary(stats)
  assert.match(lines[0], /Кубки/)
  assert.match(lines[2], /«Двойка Кубков» — 2 раза/)
  assert.equal(monthSummary(monthCards(list.slice(0, 1), "2026-10-25")), null)
})

test("фазы Луны: известное полнолуние 24 ноября 2026 и новолуние 9 ноября 2026", () => {
  const events = moonEvents(new Date("2026-11-01T00:00:00Z"), 30)
  const full = events.find((event) => event.phase === "full")
  const fresh = events.find((event) => event.phase === "new")
  assert.ok(Math.abs(full.at - new Date("2026-11-24T14:53:00Z")) < 6 * 36e5, full.at.toISOString())
  assert.ok(Math.abs(fresh.at - new Date("2026-11-09T07:02:00Z")) < 6 * 36e5, fresh.at.toISOString())
})

test("лунный расклад открыт вокруг фазы и одинаков для того же гостя", () => {
  const near = moonEvents(new Date("2026-11-01T00:00:00Z"), 30).find((event) => event.phase === "new").at
  const window = moonWindow(new Date(near.getFullYear(), near.getMonth(), near.getDate() + 1, 12))
  assert.equal(window.phase, "new")
  assert.equal(window.offset, -1)
  assert.match(moonHeadline(window), /^Вчера было новолуние в /)
  assert.equal(moonWindow(new Date(near.getFullYear(), near.getMonth(), near.getDate() + 4, 12)), null)
  const a = layMoon(window, "Юля")
  const b = layMoon(window, "юля ")
  assert.deepEqual(a.cards.map((item) => item.card.id), b.cards.map((item) => item.card.id))
  assert.equal(new Set(a.cards.map((item) => item.card.id)).size, 3)
  assert.deepEqual(a.cards.map((item) => item.role), ["Что посеять", "Что поможет", "Что отпустить"])
  assert.match(a.reading.note, /^Итог расклада\./)
  assert.doesNotMatch(a.reading.note, /называет карта|показывает карта/)
  assert.match(a.reading.note, /Что советуют карты — /)
  assert.ok(nextMoon(new Date(near.getFullYear(), near.getMonth(), near.getDate(), 12)).at > near)
})
