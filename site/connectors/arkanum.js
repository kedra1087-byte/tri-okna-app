/** Логика исходного «Арканума»: вопрос, темы, аркан судьбы, журнал. Картинки лежат в cards/. */

import { ARCANA, CORR, DECK, IMGS, Q, QLABEL, QPOS, POS } from "./arkanum-data.js"
import { cardOpen, synthesize } from "./synthesis.js"
import { hexById } from "./hexagrams.js"
import { runeById } from "./runes.js"
import { dropEcho } from "./echo.js"
import { applyCard, applyRune, applySign, boundLot, detectTopic, questionTopic } from "./topic.js"

export { detectTopic }

const BY_ID = Object.fromEntries(DECK.map((card) => [card.id, card]))

const PAINTED = {
  fool: "fool",
  mag: "magician",
  priestess: "priestess",
  empress: "empress",
  emperor: "emperor",
  hierophant: "hierophant",
  lovers: "lovers",
  chariot: "chariot",
  strength: "strength",
  hermit: "hermit",
  wheel: "wheel",
  justice: "justice",
  hanged: "hanged",
  death: "death",
  temperance: "temperance",
  devil: "devil",
  tower: "tower",
  star: "star",
  moon: "moon",
  sun: "sun",
  judgement: "judgement",
  world: "world",
}

const ARCNUM = {
  fool: 22, mag: 1, priestess: 2, empress: 3, emperor: 4, hierophant: 5, lovers: 6,
  chariot: 7, strength: 8, hermit: 9, wheel: 10, justice: 11, hanged: 12, death: 13,
  temperance: 14, devil: 15, tower: 16, star: 17, moon: 18, sun: 19, judgement: 20, world: 21,
}

const SIGNS = [["Козерог", 20], ["Водолей", 19], ["Рыбы", 21], ["Овен", 20], ["Телец", 21], ["Близнецы", 21], ["Рак", 23], ["Лев", 23], ["Дева", 23], ["Весы", 23], ["Скорпион", 22], ["Стрелец", 22], ["Козерог", 32]]

const PROFILE_KEY = "arkanum_profile"
const JOURNAL_KEY = "arkanum_journal"
const JOURNAL_LIMIT = 300

export { DECK, IMGS, QLABEL, QPOS, POS }

export function byId(id) {
  return BY_ID[id] ?? null
}

const PAINTED_ALIAS = { magician: "mag" }

export function paintedSrc(id) {
  const key = PAINTED[id] ? id : PAINTED_ALIAS[id]
  return key && PAINTED[key] ? `assets/cards/${PAINTED[key]}.webp` : ""
}

export function zodiac(day, month) {
  return day < SIGNS[month - 1][1]
    ? SIGNS[month - 1][0]
    : (SIGNS[month][1] === 32 ? "Козерог" : SIGNS[month][0])
}

export function birthArcana(day, month, year) {
  let s = String(day) + String(month) + String(year)
  let total = 0
  for (let i = 0; i < s.length; i += 1) total += +s[i]
  while (total > 22) {
    s = String(total)
    let next = 0
    for (let i = 0; i < s.length; i += 1) next += +s[i]
    total = next
  }
  return total || 22
}

export function toRoman(n) {
  const pairs = [["X", 10], ["IX", 9], ["V", 5], ["IV", 4], ["I", 1]]
  let rest = n
  let out = ""
  pairs.forEach(([glyph, value]) => {
    while (rest >= value) {
      out += glyph
      rest -= value
    }
  })
  return out || "0"
}

export function arcanaByNumber(n) {
  const id = Object.keys(ARCNUM).find((key) => ARCNUM[key] === n)
  return id ? BY_ID[id] : null
}

export function arcanaTitle(n) {
  return ARCANA[n - 1]?.[0] ?? ""
}

export function arcanaLine(n) {
  return ARCANA[n - 1]?.[1] ?? ""
}

export const BIRTH_MIN_YEAR = 1900

/** Почему дату рождения нельзя принять. Пустая строка — дата в порядке. */
export function birthIssue(birthDate, now = new Date()) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(birthDate || ""))
  if (!match) return "incomplete"
  const year = +match[1]
  const month = +match[2]
  const day = +match[3]
  if (year < BIRTH_MIN_YEAR) return "too-old"
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return "no-such-day"
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (date > today) return "future"
  return ""
}

/** Полных лет на сегодня по дате рождения; null, если дата не принята. */
export function ageOn(birthDate, now = new Date()) {
  if (birthIssue(birthDate, now)) return null
  const [year, month, day] = String(birthDate).split("-").map(Number)
  const had = now.getMonth() + 1 > month || (now.getMonth() + 1 === month && now.getDate() >= day)
  return now.getFullYear() - year - (had ? 0 : 1)
}

export function profileFrom(input, now = new Date()) {
  const name = String(input?.name || "").trim()
  const birth = String(input?.birthDate || "")
  if (birthIssue(birth, now)) return name ? { name, sign: "", arcana: 0, dob: null } : null
  const [year, month, day] = birth.split("-").map(Number)
  return { name, dob: [day, month, year], arcana: birthArcana(day, month, year), sign: zodiac(day, month) }
}

function signEl(sign) {
  if (["Овен", "Лев", "Стрелец"].includes(sign)) return "огонь"
  if (["Телец", "Дева", "Козерог"].includes(sign)) return "земля"
  if (["Близнецы", "Весы", "Водолей"].includes(sign)) return "воздух"
  return "вода"
}

function friends(a, b) {
  return a === b || (a === "огонь" && b === "воздух") || (a === "воздух" && b === "огонь") || (a === "вода" && b === "земля") || (a === "земля" && b === "вода")
}

export function personalize(card, profile) {
  if (!profile?.sign) return ""
  const genitive = { "Меркурий": "Меркурия", "Луна": "Луны", "Венера": "Венеры", "Юпитер": "Юпитера", "Марс": "Марса", "Солнце": "Солнца", "Сатурн": "Сатурна" }
  const signs = { "Овен": "Овна", "Телец": "Тельца", "Близнецы": "Близнецов", "Рак": "Рака", "Лев": "Льва", "Дева": "Девы", "Весы": "Весов", "Скорпион": "Скорпиона", "Стрелец": "Стрельца", "Козерог": "Козерога", "Водолей": "Водолея", "Рыбы": "Рыб" }
  const signName = signs[profile.sign] || profile.sign
  if (ARCNUM[card.id] === profile.arcana) return "Это ваш аркан судьбы по нумерологии даты рождения — карта ложится лично про вас."
  const link = CORR[card.id]
  if (!link) return ""
  const element = signEl(profile.sign)
  if (link.t === "sign") {
    if (link.v === profile.sign) return `Карта вашего знака (${link.v}) — она говорит прямо с вами.`
    if (link.el === element) return `Карта из вашей стихии (${link.el}) — она сегодня на одной волне с вами.`
    if (friends(link.el, element)) return `Стихия карты (${link.el}) питает вашу (${element}) — ждите поддержки, а не борьбы.`
    if (contrary(link.el, element)) return `Стихия карты (${link.el}) противоположна вашей (${element}) — здесь будет трение, не торопитесь.`
    return `Стихия карты (${link.el}) отличается от вашей (${element}) — она приходит чему-то научить, примите урок мягко.`
  }
  if (link.t === "planet") {
    const planet = genitive[link.v] || link.v
    if (RULER[profile.sign] === link.v) return `Карта ${planet} — управителя ${signName}: её совет вам ближе остальных.`
    return `Карта ${planet}: для ${signName} сегодня это тема внимания — уделите ей чуть-чуть любви.`
  }
  const feminine = link.v === "Воды" || link.v === "Земли"
  const pure = feminine ? "чистой" : "чистого"
  if (link.el === element) return `Карта ${pure} ${link.v} — вашей стихии: действуйте привычно, у вас всё получится.`
  if (friends(link.el, element)) return `Карта ${pure} ${link.v} — родственной для ${signName} стихии: она поддержит.`
  if (contrary(link.el, element)) return `Карта ${pure} ${link.v} — противоположной для ${signName} стихии: будет трение, не торопитесь.`
  return `Карта ${pure} ${link.v} — чужой для ${signName}, но не враждебной стихии: она добавит то, чего не хватает.`
}

/** Классические управители знаков, как у Золотой зари. */
const RULER = { "Овен": "Марс", "Телец": "Венера", "Близнецы": "Меркурий", "Рак": "Луна", "Лев": "Солнце", "Дева": "Меркурий", "Весы": "Венера", "Скорпион": "Марс", "Стрелец": "Юпитер", "Козерог": "Сатурн", "Водолей": "Сатурн", "Рыбы": "Юпитер" }

function contrary(a, b) {
  return (a === "огонь" && b === "вода") || (a === "вода" && b === "огонь") || (a === "воздух" && b === "земля") || (a === "земля" && b === "воздух")
}

const IN_SIGN = { "Овен": "Овне", "Телец": "Тельце", "Близнецы": "Близнецах", "Рак": "Раке", "Лев": "Льве", "Дева": "Деве", "Весы": "Весах", "Скорпион": "Скорпионе", "Стрелец": "Стрельце", "Козерог": "Козероге", "Водолей": "Водолее", "Рыбы": "Рыбах" }
const LETTER = { fool: "Алеф", mag: "Бет", priestess: "Гимель", empress: "Далет", emperor: "Хе", hierophant: "Вав", lovers: "Зайин", chariot: "Хет", strength: "Тет", hermit: "Йод", wheel: "Каф", justice: "Ламед", hanged: "Мем", death: "Нун", temperance: "Самех", devil: "Айин", tower: "Пе", star: "Цади", moon: "Коф", sun: "Реш", judgement: "Шин", world: "Тав" }
const SUIT_ORDER = { "Овен": "wands", "Лев": "wands", "Стрелец": "wands", "Рак": "cups", "Скорпион": "cups", "Рыбы": "cups", "Весы": "swords", "Водолей": "swords", "Близнецы": "swords", "Козерог": "pentacles", "Телец": "pentacles", "Дева": "pentacles" }
const FIRST_PIP = { "Овен": 2, "Рак": 2, "Весы": 2, "Козерог": 2, "Телец": 5, "Лев": 5, "Скорпион": 5, "Водолей": 5, "Близнецы": 8, "Дева": 8, "Стрелец": 8, "Рыбы": 8 }
const DECAN_PLANET = {
  "Овен": ["Марс", "Солнце", "Венера"], "Телец": ["Меркурий", "Луна", "Сатурн"], "Близнецы": ["Юпитер", "Марс", "Солнце"],
  "Рак": ["Венера", "Меркурий", "Луна"], "Лев": ["Сатурн", "Юпитер", "Марс"], "Дева": ["Солнце", "Венера", "Меркурий"],
  "Весы": ["Луна", "Сатурн", "Юпитер"], "Скорпион": ["Марс", "Солнце", "Венера"], "Стрелец": ["Меркурий", "Луна", "Сатурн"],
  "Козерог": ["Юпитер", "Марс", "Солнце"], "Водолей": ["Венера", "Меркурий", "Луна"], "Рыбы": ["Сатурн", "Юпитер", "Марс"],
}
/** Титулы младших карт по «Книге Т». */
const LORD = {
  wands_2: "Владыка Владычества", wands_3: "Владыка Утверждённой Силы", wands_4: "Владыка Завершённого Труда",
  wands_5: "Владыка Борьбы", wands_6: "Владыка Победы", wands_7: "Владыка Доблести",
  wands_8: "Владыка Стремительности", wands_9: "Владыка Великой Силы", wands_10: "Владыка Угнетения",
  cups_2: "Владыка Любви", cups_3: "Владыка Изобилия", cups_4: "Владыка Смешанного Удовольствия",
  cups_5: "Владыка Утраты в Удовольствии", cups_6: "Владыка Удовольствия", cups_7: "Владыка Призрачного Успеха",
  cups_8: "Владыка Оставленного Успеха", cups_9: "Владыка Материального Счастья", cups_10: "Владыка Совершенного Успеха",
  swords_2: "Владыка Восстановленного Мира", swords_3: "Владыка Печали", swords_4: "Владыка Отдыха от Борьбы",
  swords_5: "Владыка Поражения", swords_6: "Владыка Заслуженного Успеха", swords_7: "Владыка Непрочного Усилия",
  swords_8: "Владыка Укороченной Силы", swords_9: "Владыка Отчаяния и Жестокости", swords_10: "Владыка Разрушения",
  pentacles_2: "Владыка Гармоничной Перемены", pentacles_3: "Владыка Материальных Трудов", pentacles_4: "Владыка Земной Власти",
  pentacles_5: "Владыка Материальной Беды", pentacles_6: "Владыка Материального Успеха", pentacles_7: "Владыка Неосуществлённого Успеха",
  pentacles_8: "Владыка Благоразумия", pentacles_9: "Владыка Материального Приобретения", pentacles_10: "Владыка Богатства",
}

function pipDecan(id) {
  const [suit, rank] = id.split("_")
  const pip = Number(rank)
  if (!(pip >= 2 && pip <= 10)) return null
  const sign = Object.keys(SUIT_ORDER).find((name) => SUIT_ORDER[name] === suit && pip >= FIRST_PIP[name] && pip < FIRST_PIP[name] + 3)
  return sign ? { sign, planet: DECAN_PLANET[sign][pip - FIRST_PIP[sign]] } : null
}

/** Карта декана: младшая карта 2–10, как у Золотой зари. index — 0, 1 или 2. */
export function decanCard(signName, index) {
  const suit = SUIT_ORDER[signName]
  if (!suit || !(index >= 0 && index <= 2)) return null
  const id = `${suit}_${FIRST_PIP[signName] + index}`
  return { id, card: BY_ID[id] || null, planet: DECAN_PLANET[signName][index], title: LORD[id] }
}

export function inSign(signName) {
  return IN_SIGN[signName] || signName
}

/** Соответствие карты по Золотой заре одной строкой. */
export function cardCorrespondence(rawId) {
  const id = rawId === "magician" ? "mag" : rawId
  const link = CORR[id]
  if (!link) return ""
  if (LETTER[id]) {
    const sky = link.t === "el" ? `стихия ${link.el}` : link.v
    return `буква ${LETTER[id]} · ${sky}`
  }
  const decan = pipDecan(id)
  if (decan) return `${LORD[id]} · ${decan.planet} в ${IN_SIGN[decan.sign]}`
  if (id.endsWith("_ace")) return `Корень сил ${link.v}`
  return `стихия ${link.el}`
}

function shuffle(list, random) {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function layQuestion(input, random = Math.random) {
  const question = String(input?.question || "").trim()
  const topic = question ? (input.topic || questionTopic(question, input.heroTopic)) : null
  const profile = profileFrom(input)
  const asked = Array.isArray(input?.roles) && input.roles.length ? input.roles : QPOS
  const roles = question ? asked : POS
  const count = question ? roles.length : POS.length
  const cards = shuffle(DECK, random).slice(0, count).map((card, index) => ({
    role: roles[index],
    card,
    note: card.hint,
  }))
  const spread = {
    id: "question",
    title: question ? "Ваш вопрос" : "Расклад на день",
    cards,
    question,
    topic,
    profile,
    tell: Math.floor(random() * 8),
  }
  spread.reading = explainQuestion(spread)
  return spread
}

export function explainQuestion(spread) {
  const asked = String(spread.question || "").trim()
  const turn = spread.tell || 0
  const bound = spread.cards.map((item) => applyCard(item.card, asked, spread.topic, item.role, turn))
  const items = spread.cards.map((item, index) => {
    const card = item.card
    return {
      role: item.role,
      name: card.name,
      hint: card.hint,
      body: asked ? bound[index].act : card.meaning,
      open: cardOpen(item.role, card.name),
      personal: spread.profile?.sign ? personalize(card, spread.profile) : "",
    }
  })
  const lead = asked ? "" : "Расклад на день: утро, день и вечер."
  const end = spread.question || spread.profile?.sign
    ? ""
    : "Привязка к натальной карте появляется, когда названы имя и день рождения."
  const noteCards = spread.cards.map((item) => boundLot(item, asked, spread.topic, spread.tell || 0))
  const note = synthesize({ cards: noteCards, question: asked, end, echo: true })
  return { title: "Карты ответили", layout: "cards", lead, items, note }
}

export function cardAdvice(card, topic) {
  const advice = Q[card.id]
  if (!advice || !topic) return ""
  return advice.a
}

export function todayKey(date = new Date()) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

export function dailyCard(profile, date = new Date()) {
  const str = todayKey(date) + (profile?.name || "")
  let hash = 0
  for (let i = 0; i < str.length; i += 1) hash = (hash * 31 + str.charCodeAt(i)) >>> 0
  return DECK[hash % DECK.length]
}

export function loadProfile(storage) {
  try {
    return JSON.parse(storage.getItem(PROFILE_KEY) || "null")
  } catch {
    return null
  }
}

export function saveProfile(storage, profile) {
  if (!profile?.name && !profile?.dob) {
    storage.removeItem(PROFILE_KEY)
    return
  }
  storage.setItem(PROFILE_KEY, JSON.stringify(profile))
}

export function loadJournal(storage) {
  try {
    const list = JSON.parse(storage.getItem(JOURNAL_KEY) || "[]")
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function saveJournal(storage, entry) {
  const list = loadJournal(storage)
  list.unshift(entry)
  storage.setItem(JOURNAL_KEY, JSON.stringify(list.slice(0, JOURNAL_LIMIT)))
}

export function patchEntry(storage, id, patch) {
  if (!id) return
  const list = loadJournal(storage)
  const entry = list.find((item) => item.id === id)
  if (!entry) return
  Object.assign(entry, patch)
  storage.setItem(JOURNAL_KEY, JSON.stringify(list))
}

export function dailyOpened(storage, date = new Date()) {
  const today = todayKey(date)
  return loadJournal(storage).some((entry) => entry.type === "daily" && entry.date === today)
}

/** Ответ на уточнение, когда голос таролога недоступен. Карты те же, новых не добавляет. */
export function followupAnswer(cards, text, turn = 0, spreadTopic = null) {
  const known = (cards || [])
    .map((item) => ({ role: item.role, card: byId(item.id) || byId(item.id === "magician" ? "mag" : "") || runeById(item.id) || hexById(item.id) }))
    .filter((item) => item.card)
  if (!known.length) return "Перечитайте значения карт — ответ в них."
  const asked = detectTopic(text)
  const topic = asked !== "s" ? asked : (spreadTopic || "s")
  const { role, card } = known[turn % known.length]
  const place = role ? ` из позиции «${role}»` : ""
  const bound = card.lines ? applySign(card, text) : card.kind === "rune" ? applyRune(card, text) : applyCard(card, text, topic)
  const who = card.lines ? "знак" : card.kind === "rune" ? "руна" : ""
  const title = who ? `Отвечает ${who} «${card.name}»` : `Отвечает «${card.name}»`
  // Текст позиции гость уже прочитал. В уточнении остаётся только новый шаг.
  const step = dropEcho(bound.step, bound.act)
  return [ `${title}${place} — ${card.hint}.`, step ].filter(Boolean).join("\n\n")
}

export function patchLatestSpeech(storage, speech) {
  const list = loadJournal(storage)
  if (!list[0] || list[0].type !== "spread") return
  list[0].speech = String(speech || "").slice(0, 2000)
  storage.setItem(JOURNAL_KEY, JSON.stringify(list))
}
