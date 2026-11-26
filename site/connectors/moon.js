/** Новолуние и полнолуние: когда они, и расклад, открытый за день до фазы, в её день и на следующий день. */

import { DECK, Q } from "./arkanum-data.js"
import { todayKey } from "./arkanum.js"
import { daysBetween } from "./outcome.js"
import { moonLongitude, sunLongitude } from "./sky-today.js"
import { synthesize } from "./synthesis.js"

const norm = (deg) => ((deg % 360) + 360) % 360
const LOC = ["Овне", "Тельце", "Близнецах", "Раке", "Льве", "Деве", "Весах", "Скорпионе", "Стрельце", "Козероге", "Водолее", "Рыбах"]
const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"]
const STEP = 3 * 36e5

export const MOON_PHASES = {
  new: {
    name: "новолуние",
    title: "Расклад новолуния",
    invite: "Три карты на новый лунный круг.",
    roles: ["Что посеять", "Что поможет", "Что отпустить"],
    lead: "Луна начинает новый круг. Это время загадывать и начинать с малого: три карты подскажут, что посеять в этом цикле, что поможет прорасти и что не брать с собой.",
  },
  full: {
    name: "полнолуние",
    title: "Расклад полнолуния",
    invite: "Три карты на вершине лунного круга.",
    roles: ["Что проявилось", "Что отпустить", "За что поблагодарить"],
    lead: "Луна в полной силе: тайное всплывает, чувства громче обычного. Три карты покажут, что проявилось, что пора отпустить и за что сказать спасибо.",
  },
}

function elongation(time) {
  const date = new Date(time)
  return norm(moonLongitude(date) - sunLongitude(date))
}

function crossed(phase, a, b) {
  if (phase === "new") return a > 270 && b < 90
  return a < 180 && b >= 180
}

function exact(phase, lo, hi) {
  while (hi - lo > 60e3) {
    const mid = (lo + hi) / 2
    if (crossed(phase, elongation(lo), elongation(mid))) hi = mid
    else lo = mid
  }
  return new Date(hi)
}

/** Ближайшие точные фазы начиная с момента from. */
export function moonEvents(from = new Date(), days = 35) {
  const events = []
  let time = from.getTime()
  let prev = elongation(time)
  const end = time + days * 864e5
  while (time < end) {
    const next = time + STEP
    const value = elongation(next)
    for (const phase of ["new", "full"]) {
      if (crossed(phase, prev, value)) {
        const at = exact(phase, time, next)
        events.push({ phase, at, sign: LOC[Math.floor(norm(moonLongitude(at)) / 30)] })
      }
    }
    prev = value
    time = next
  }
  return events
}

/** Фаза, расклад которой открыт сегодня: вчера, сегодня или завтра по местным суткам гостя. */
export function moonWindow(date = new Date()) {
  const today = todayKey(date)
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1)
  for (const event of moonEvents(start, 3)) {
    const day = todayKey(event.at)
    const offset = daysBetween(today, day)
    if (offset >= -1 && offset <= 1) return { ...event, day, offset, key: `${event.phase}-${day}` }
  }
  return null
}

export function nextMoon(date = new Date()) {
  const window = moonWindow(date)
  return moonEvents(date, 35).find((event) => !window || todayKey(event.at) !== window.day) || null
}

export function moonDate(at) {
  return `${at.getDate()} ${MONTHS[at.getMonth()]}`
}

export function moonHeadline(event) {
  const phase = MOON_PHASES[event.phase].name
  if (event.offset === 0) return `Сегодня ${phase} в ${event.sign}`
  if (event.offset === 1) return `Завтра ${phase} в ${event.sign}`
  return `Вчера было ${phase} в ${event.sign}`
}

function seeded(text) {
  let hash = 2166136261
  for (let i = 0; i < text.length; i += 1) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0
  return () => {
    hash = (Math.imul(hash, 1664525) + 1013904223) >>> 0
    return hash / 0x100000000
  }
}

/** Одна фаза — один расклад: тот же гость в ту же фазу получает те же карты. */
export function layMoon(event, name = "") {
  const phase = MOON_PHASES[event.phase]
  const random = seeded(`${event.key}|${String(name).trim().toLowerCase()}`)
  const pool = [...DECK]
  const cards = phase.roles.map((role) => {
    const index = Math.floor(random() * pool.length)
    const [card] = pool.splice(index, 1)
    return { role, card }
  })
  return { phase: event.phase, key: event.key, cards, reading: explainMoon(event.phase, cards) }
}

export function explainMoon(phaseId, cards) {
  const phase = MOON_PHASES[phaseId]
  const items = cards.map((item) => ({
    role: item.role,
    name: item.card.name,
    hint: item.card.hint,
    body: item.role === "Что поможет" ? (Q[item.card.id]?.a || item.card.meaning) : item.card.meaning,
    personal: "",
  }))
  return {
    title: "Что говорят карты",
    lead: "",
    items,
    note: synthesize({ cards, question: phase.name }),
  }
}
