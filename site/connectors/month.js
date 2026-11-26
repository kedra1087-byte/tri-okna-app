/** Ваш месяц в картах: что чаще выпадало за 30 дней по журналу на телефоне. */

import { DECK, Q } from "./arkanum-data.js"
import { daysBetween } from "./outcome.js"
import { verdictOf } from "./yesno.js"

export const MONTH_DAYS = 30
export const MONTH_MIN_CARDS = 5

const BY_ID = Object.fromEntries(DECK.map((card) => [card.id, card]))
const ALIAS = { magician: "mag" }

export const SUIT_ORDER = [
  { id: "major", name: "Старшие арканы", share: 22 / 78 },
  { id: "wands", name: "Жезлы", share: 14 / 78 },
  { id: "cups", name: "Кубки", share: 14 / 78 },
  { id: "swords", name: "Мечи", share: 14 / 78 },
  { id: "pentacles", name: "Пентакли", share: 14 / 78 },
]

const SUIT_TEXT = {
  major: "Старших арканов больше обычного — месяц про крупные повороты, а не про мелочи. Решения сейчас весят больше, чем кажется.",
  wands: "Чаще обычного приходили Жезлы — месяц про действие, желания и смелость. Важно не перегореть.",
  cups: "Чаще обычного приходили Кубки — месяц про чувства и близких. Решения сейчас идут через сердце.",
  swords: "Чаще обычного приходили Мечи — месяц про мысли, разговоры и трудные решения. Берегите голову от лишних тревог.",
  pentacles: "Чаще обычного приходили Пентакли — месяц про деньги, работу и тело. Хорошее время для практичных шагов.",
  even: "Масти легли ровно — месяц без перекоса: жизнь идёт по всем направлениям сразу.",
}

function known(id) {
  return BY_ID[id] || BY_ID[ALIAS[id]] || null
}

function suitOf(id) {
  return id.includes("_") ? id.split("_")[0] : "major"
}

function timesWord(n) {
  const last = n % 10
  const teen = n % 100 >= 11 && n % 100 <= 14
  return teen ? "раз" : last >= 2 && last <= 4 ? "раза" : "раз"
}

export function cardsWord(n) {
  const last = n % 10
  const teen = n % 100 >= 11 && n % 100 <= 14
  return teen ? "карт" : last === 1 ? "карта" : last >= 2 && last <= 4 ? "карты" : "карт"
}

export function monthCards(list, today, days = MONTH_DAYS) {
  const counts = new Map()
  const suits = Object.fromEntries(SUIT_ORDER.map((suit) => [suit.id, 0]))
  const tone = { yes: 0, no: 0, wait: 0 }
  let total = 0
  for (const entry of list || []) {
    const age = daysBetween(entry?.date, today)
    if (!(age >= 0 && age < days)) continue
    for (const raw of entry.cards || []) {
      const card = known(raw)
      if (!card) continue
      total += 1
      counts.set(card.id, (counts.get(card.id) || 0) + 1)
      suits[suitOf(card.id)] += 1
      tone[verdictOf(card.id)] += 1
    }
  }
  const top = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, count]) => ({ card: BY_ID[id], count }))
  return { total, suits, tone, top }
}

function dominantSuit(stats) {
  let best = null
  for (const suit of SUIT_ORDER) {
    const ratio = stats.suits[suit.id] / stats.total / suit.share
    if (ratio >= 1.3 && (!best || ratio > best.ratio)) best = { id: suit.id, ratio }
  }
  return best?.id || "even"
}

function toneLine({ yes, no, wait }) {
  const head = `Светлых карт — ${yes}, трудных — ${no}, просящих паузы — ${wait}.`
  if (yes >= no * 1.5 && yes > wait) return `${head} Месяц скорее светлый.`
  if (no > yes) return `${head} Месяц непростой: карты чаще предупреждали, чем обещали.`
  if (wait > yes && wait > no) return `${head} Месяц про ожидание: многое ещё складывается.`
  return `${head} Светлого и трудного примерно поровну.`
}

export function monthSummary(stats) {
  if (stats.total < MONTH_MIN_CARDS) return null
  const lines = [SUIT_TEXT[dominantSuit(stats)], toneLine(stats.tone)]
  const [first] = stats.top
  if (first) {
    const advice = Q[first.card.id]?.a
    lines.push(`Чаще всего приходила карта «${first.card.name}» — ${first.count} ${timesWord(first.count)}. Когда карта стучится настойчиво, её стоит услышать${advice ? `: ${advice[0].toLowerCase()}${advice.slice(1)}` : "."}`)
  }
  return lines
}
