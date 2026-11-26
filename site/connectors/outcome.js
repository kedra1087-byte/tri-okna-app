/** «Сбылось?» — через несколько дней таверна спрашивает, как вышло с вопросом расклада. Всё хранится в журнале на телефоне. */

export const ASK_AFTER_DAYS = 3
export const ASK_WITHIN_DAYS = 60
export const LATER_DAYS = 3

export const OUTCOMES = [
  { id: "yes", label: "Сбылось" },
  { id: "part", label: "Отчасти" },
  { id: "no", label: "Не сбылось" },
]

export const OUTCOME_WORD = Object.fromEntries(OUTCOMES.map((item) => [item.id, item.label]))

export const OUTCOME_REPLY = {
  yes: "Записали в журнал: сбылось. Карты в тот раз смотрели верно.",
  part: "Записали: отчасти. Так бывает часто — карты показывают направление, а путь выбираете вы.",
  no: "Записали: не сбылось. Спасибо за честность — это тоже ответ, и он помогает читать карты точнее.",
}

function dayNumber(key) {
  const [year, month, day] = String(key || "").split("-").map(Number)
  if (!year || !month || !day) return NaN
  return Math.round(Date.UTC(year, month - 1, day) / 864e5)
}

export function daysBetween(fromKey, toKey) {
  return dayNumber(toKey) - dayNumber(fromKey)
}

export function addDays(key, days) {
  const date = new Date(dayNumber(key) * 864e5 + days * 864e5)
  return `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`
}

export function canAsk(entry, today) {
  if (entry?.type !== "spread" || !String(entry.q || "").trim() || entry.came) return false
  const age = daysBetween(entry.date, today)
  return age >= ASK_AFTER_DAYS && age <= ASK_WITHIN_DAYS
}

/** Запись, о которой спросить в зале: самая свежая из созревших и не отложенных. */
export function nextToAsk(list, today) {
  return (list || []).find((entry) => canAsk(entry, today) && !(entry.later && daysBetween(today, entry.later) > 0)) || null
}

export function agoText(days) {
  if (days === 0) return "сегодня"
  if (days === 1) return "вчера"
  const last = days % 10
  const teen = days % 100 >= 11 && days % 100 <= 14
  const word = teen ? "дней" : last === 1 ? "день" : last >= 2 && last <= 4 ? "дня" : "дней"
  return `${days} ${word} назад`
}

export function outcomeStats(list) {
  const stats = { yes: 0, part: 0, no: 0, total: 0 }
  for (const entry of list || []) {
    if (entry?.type === "spread" && stats[entry.came] !== undefined) {
      stats[entry.came] += 1
      stats.total += 1
    }
  }
  return stats
}
