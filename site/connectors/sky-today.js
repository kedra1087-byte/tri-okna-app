/** Небо на сегодня: Луна, её фаза и планета дня. Гороскоп строится по солнечным домам от знака гостя.
 * Долготы считаются по сокращённой лунной теории (Meeus, гл. 47): точность около полуградуса,
 * этого хватает, чтобы знать знак Луны и час перехода с точностью до часа.
 */

import { SIGNS } from "./astrology.js"

const RAD = Math.PI / 180
const norm = (deg) => ((deg % 360) + 360) % 360
const sin = (deg) => Math.sin(deg * RAD)

function daysFromJ2000(date) {
  return date.getTime() / 864e5 + 2440587.5 - 2451545.0
}

export function sunLongitude(date) {
  const d = daysFromJ2000(date)
  const mean = 280.46 + 0.9856474 * d
  const anomaly = 357.529 + 0.98560028 * d
  return norm(mean + 1.915 * sin(anomaly) + 0.02 * sin(2 * anomaly))
}

export function moonLongitude(date) {
  const d = daysFromJ2000(date)
  const mean = 218.316 + 13.176396 * d
  const anomaly = 134.963 + 13.064993 * d
  const elong = 297.85 + 12.190749 * d
  const sunAnomaly = 357.529 + 0.98560028 * d
  const node = 93.272 + 13.22935 * d
  return norm(
    mean
      + 6.289 * sin(anomaly)
      + 1.274 * sin(2 * elong - anomaly)
      + 0.658 * sin(2 * elong)
      + 0.214 * sin(2 * anomaly)
      - 0.186 * sin(sunAnomaly)
      - 0.114 * sin(2 * node),
  )
}

const signAt = (longitude) => Math.floor(norm(longitude) / 30)

const ELEMENT = ["огонь", "земля", "воздух", "вода"]
const GEN = ["Овна", "Тельца", "Близнецов", "Рака", "Льва", "Девы", "Весов", "Скорпиона", "Стрельца", "Козерога", "Водолея", "Рыб"]
const LOC = ["Овне", "Тельце", "Близнецах", "Раке", "Льве", "Деве", "Весах", "Скорпионе", "Стрельце", "Козероге", "Водолее", "Рыбах"]
const ORDINAL = ["первый", "второй", "третий", "четвёртый", "пятый", "шестой", "седьмой", "восьмой", "девятый", "десятый", "одиннадцатый", "двенадцатый"]
const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"]

const HOUSE = [
  "Это вы сами: тело, внешность, собственные желания. Хороший день начать что-то лично своё.",
  "Это деньги и ресурсы. Проверьте траты и не давайте в долг на эмоциях.",
  "Это разговоры, письма и короткие поездки. Напишите то, что откладывали.",
  "Это дом и семья. Проведите день ближе к своим и разберите быт.",
  "Это радость, творчество и романтика. Позвольте себе удовольствие без чувства вины.",
  "Это режим, рутина и здоровье. Наведите порядок в делах и во сне.",
  "Это партнёры и договоры. Договаривайтесь, а не продавливайте.",
  "Это общие деньги, глубокие чувства и кризисы. Не открывайте старые раны без нужды.",
  "Это дальние дороги, учёба и смысл. Читайте, учитесь, планируйте поездку.",
  "Это карьера и репутация. Вас сегодня видно — покажите результат.",
  "Это друзья и планы. Позвоните тем, кто поддерживает, и обсудите будущее.",
  "Это тишина и отдых. Меньше публичности, больше сна и времени наедине с собой.",
]

const WEEKDAY = [
  "Воскресенье — день Солнца: покажите себя и сделайте то, что радует.",
  "Понедельник — день Луны: чувства острее, берегите силы и быт.",
  "Вторник — день Марса: решительность на пользу, споры — нет.",
  "Среда — день Меркурия: переговоры, письма, документы, учёба.",
  "Четверг — день Юпитера: просите совета и думайте о большом.",
  "Пятница — день Венеры: любовь, красота, примирения.",
  "Суббота — день Сатурна: доделывайте и наводите порядок, новое не начинайте.",
]

/** Достоинства стихий по Золотой заре: огонь и воздух, вода и земля дружат; огонь — вода, воздух — земля враждуют. */
function dignity(a, b) {
  if (a === b) return "same"
  const pair = [a, b].sort().join("+")
  if (pair === "воздух+огонь" || pair === "вода+земля") return "friendly"
  if (pair === "вода+огонь" || pair === "воздух+земля") return "contrary"
  return "neutral"
}

const DIGNITY = {
  same: "Одна стихия: настроение дня совпадает с вашим, решать легче обычного.",
  friendly: "Стихии дружат: день подталкивает в вашу сторону, сопротивления меньше.",
  contrary: "Стихии враждуют: будет трение. Не принимайте резких решений на эмоциях.",
  neutral: "Стихии нейтральны: день не помогает и не мешает — всё зависит от вас.",
}

function phaseOf(date) {
  const angle = norm(moonLongitude(date) - sunLongitude(date))
  if (angle < 12 || angle > 348) return { name: "новолуние", text: "Новолуние: загадывайте и начинайте с малого, но крупное не подписывайте." }
  if (angle > 168 && angle < 192) return { name: "полнолуние", text: "Полнолуние: эмоции выше обычного, тайное всплывает. Не рубите сплеча." }
  if (angle < 180) return { name: "растущая Луна", text: "Луна растёт: хорошо начинать, звать и набирать." }
  return { name: "убывающая Луна", text: "Луна убывает: хорошо завершать, отпускать и расчищать." }
}

function signChange(start, end) {
  const from = signAt(moonLongitude(start))
  if (from === signAt(moonLongitude(end))) return null
  let lo = start.getTime()
  let hi = end.getTime()
  while (hi - lo > 60e3) {
    const mid = (lo + hi) / 2
    if (signAt(moonLongitude(new Date(mid))) === from) lo = mid
    else hi = mid
  }
  const at = new Date(Math.round(hi / 36e5) * 36e5)
  return { from, to: signAt(moonLongitude(end)), hour: at.getHours() }
}

export function moonToday(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const end = new Date(start.getTime() + 864e5 - 1)
  const noon = new Date(start.getTime() + 12 * 36e5)
  const index = signAt(moonLongitude(noon))
  return {
    index,
    sign: SIGNS[index],
    change: signChange(start, end),
    phase: phaseOf(noon),
  }
}

export function horoscope(signName, date = new Date()) {
  const moon = moonToday(date)
  const own = SIGNS.findIndex((sign) => sign.name === signName)
  const lines = []
  let moonLine = `Луна в ${LOC[moon.index]}`
  if (moon.change) {
    const hour = `${String(moon.change.hour).padStart(2, "0")}:00`
    moonLine += moon.change.to === moon.index
      ? ` — до ${hour} она ещё в ${LOC[moon.change.from]}`
      : `, около ${hour} переходит в знак ${GEN[moon.change.to]}`
  }
  if (own >= 0) {
    const house = (moon.index - own + 12) % 12
    lines.push({ k: "Луна", t: `${moonLine}. Для ${GEN[own]} это ${ORDINAL[house]} дом. ${HOUSE[house]}` })
    const lunar = ELEMENT[moon.index % 4]
    const yours = ELEMENT[own % 4]
    lines.push({ k: "Стихии", t: `У Луны ${lunar}, у вас ${yours}. ${DIGNITY[dignity(lunar, yours)]}` })
  } else {
    lines.push({ k: "Луна", t: `${moonLine}.` })
  }
  lines.push({ k: "День", t: WEEKDAY[date.getDay()] })
  lines.push({ k: "Фаза", t: moon.phase.text })
  return {
    date: `${date.getDate()} ${MONTHS[date.getMonth()]}`,
    sign: own >= 0 ? SIGNS[own].name : "",
    signGen: own >= 0 ? GEN[own] : "",
    moon,
    moonIn: LOC[moon.index],
    moonGen: GEN[moon.index],
    lines,
    card: moon.sign.major,
  }
}
