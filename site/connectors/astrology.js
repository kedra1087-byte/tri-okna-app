/** Небо для методики Золотой зари.
 * Сейчас коннектор считает солнечный знак и декан по дате рождения.
 * Полную карту (время, место, асцендент) подключают сюда же: функция readSky
 * должна начать возвращать rising и дома, не меняя расклады.
 */

export const SIGNS = [
  { id: "aries", name: "Овен", major: "emperor", start: [3, 21], end: [4, 19] },
  { id: "taurus", name: "Телец", major: "hierophant", start: [4, 20], end: [5, 20] },
  { id: "gemini", name: "Близнецы", major: "lovers", start: [5, 21], end: [6, 20] },
  { id: "cancer", name: "Рак", major: "chariot", start: [6, 21], end: [7, 22] },
  { id: "leo", name: "Лев", major: "strength", start: [7, 23], end: [8, 22] },
  { id: "virgo", name: "Дева", major: "hermit", start: [8, 23], end: [9, 22] },
  { id: "libra", name: "Весы", major: "justice", start: [9, 23], end: [10, 22] },
  { id: "scorpio", name: "Скорпион", major: "death", start: [10, 23], end: [11, 21] },
  { id: "sagittarius", name: "Стрелец", major: "temperance", start: [11, 22], end: [12, 21] },
  { id: "capricorn", name: "Козерог", major: "devil", start: [12, 22], end: [1, 19] },
  { id: "aquarius", name: "Водолей", major: "star", start: [1, 20], end: [2, 18] },
  { id: "pisces", name: "Рыбы", major: "moon", start: [2, 19], end: [3, 20] },
]

const DECAN_RULERS = {
  aries: ["Марс", "Солнце", "Венера"],
  taurus: ["Меркурий", "Луна", "Сатурн"],
  gemini: ["Юпитер", "Марс", "Солнце"],
  cancer: ["Венера", "Меркурий", "Луна"],
  leo: ["Сатурн", "Юпитер", "Марс"],
  virgo: ["Солнце", "Венера", "Меркурий"],
  libra: ["Луна", "Сатурн", "Юпитер"],
  scorpio: ["Марс", "Солнце", "Венера"],
  sagittarius: ["Меркурий", "Луна", "Сатурн"],
  capricorn: ["Юпитер", "Марс", "Солнце"],
  aquarius: ["Венера", "Меркурий", "Луна"],
  pisces: ["Сатурн", "Юпитер", "Марс"],
}

function monthDay(date) {
  const value = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(value.getTime())) return null
  return [value.getMonth() + 1, value.getDate()]
}

function contains(sign, month, day) {
  const [sm, sd] = sign.start
  const [em, ed] = sign.end
  const afterStart = month > sm || (month === sm && day >= sd)
  const beforeEnd = month < em || (month === em && day <= ed)
  if (sm <= em) return afterStart && beforeEnd
  return afterStart || beforeEnd
}

export function sunSign(date) {
  const parts = monthDay(date)
  if (!parts) return null
  const [month, day] = parts
  return SIGNS.find((sign) => contains(sign, month, day)) ?? null
}

export function decanOf(date) {
  const sign = sunSign(date)
  const parts = monthDay(date)
  if (!sign || !parts) return null
  const [month, day] = parts
  const [sm, sd] = sign.start
  let dayInSign
  if (month === sm) dayInSign = day - sd
  else if (sign.start[0] > sign.end[0] && month <= sign.end[0]) {
    const daysInStartMonth = new Date(2000, sm, 0).getDate()
    dayInSign = daysInStartMonth - sd + day
  } else {
    const daysInStartMonth = new Date(2000, sm, 0).getDate()
    dayInSign = daysInStartMonth - sd + day
  }
  const index = dayInSign >= 20 ? 2 : dayInSign >= 10 ? 1 : 0
  return {
    sign,
    index,
    name: ["первый", "второй", "третий"][index],
    ruler: DECAN_RULERS[sign.id][index],
  }
}

export function readSky(profile = {}) {
  const date = profile.birthDate ? new Date(profile.birthDate) : null
  const sign = date ? sunSign(date) : null
  const decan = date ? decanOf(date) : null
  return {
    source: profile.birthTime && profile.birthPlace ? "chart-requested" : "sun-only",
    sun: sign,
    decan,
    rising: null,
    houses: null,
    plug: "ephemeris",
  }
}
