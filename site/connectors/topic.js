/** Тема вопроса и привязка лица знака/карты к тому, что спросили.
 * Лицо лота не меняется: меняется только то, к чему оно прилагается.
 */

import { DECK, Q } from "./arkanum-data.js"
import { faceLine, preparedFace } from "./asks.js"
import { verdictOf } from "./yesno.js"

const stems = (list) => new RegExp(`(?<![а-яё])(?:${list})`)
const LOVE = stems("любл|любв|любим|любит|любов|влюб|отнош|муж|жен(?:а|ы|е|у|ой|щин|их|ат|ит|ись)|парн|девушк|свадьб|замуж|роман|семь(?:я|и|ю|ей|ёй)|семейн|сердц|свидан|расстав|развод|ревн|бывш|чувств|верну|вернёт|вернется|вернёшься|напишет|позвон|бросит|измен")
const WORK = stems("(?:под|без|пере)?работ|карьер|бизнес|проект|приложени|стартап|запуск|клиент|заказчик|сайт|компани|офис|начальн|руковод|увол|коллег|должност|собеседов|ваканс|учеб|учёб|экзамен")
const MONEY = stems("деньг|денег|денеж|заработ|зарплат|доход|долг|кредит|покупк|продаж|ипотек|финанс|оплат|инвест|бюджет")
const LEAVE = stems("уходить|уйти|уйду|уйдёте|уйдете|остаться|оставаться|останусь|расста|разъеха")

const STAY_HINTS = new Set([
  "рано бросать", "звать своих", "примкнуть", "сначала старое", "встретить",
  "не менять курс", "держаться берега", "сначала свои", "починить своё", "остаться на месте",
])
const GO_HINTS = new Set([
  "пора идти", "сказать «пошли»", "отойти", "развязать", "не держать", "отпустить", "не пускать корни",
])

export function detectTopic(text) {
  const t = String(text || "").toLowerCase()
  if (LOVE.test(t)) return "l"
  if (WORK.test(t)) return "w"
  if (MONEY.test(t)) return "m"
  return "s"
}

export function askKind(text) {
  const raw = String(text || "")
  const t = raw.toLowerCase()
  return {
    topic: detectTopic(raw),
    leave: LEAVE.test(t),
    question: raw.trim(),
  }
}

export function questionTopic(question, fallback = "s") {
  const kind = askKind(question)
  if (kind.topic !== "s") return kind.topic
  if (kind.leave) return "s"
  return fallback
}

export function hexStance(hex) {
  const hint = String(hex?.hint || "")
  if (STAY_HINTS.has(hint)) return "stay"
  if (GO_HINTS.has(hint)) return "go"
  if (hex?.tone === "wait") return "wait"
  if (hex?.tone === "no") return "hold"
  return "do"
}

export function signLeaveCall(hex) {
  const stance = hexStance(hex)
  if (stance === "stay") return "Уходить или остаться: лучше остаться."
  if (stance === "go") return "Уходить или остаться: пора уходить."
  if (stance === "hold") return "Уходить или остаться: резких шагов сейчас лучше не делать."
  if (stance === "wait") return "Уходить или остаться: не решайте сгоряча."
  return ""
}

/** Шаг знака без чужой темы: «работа» только если спросили про работу. */
export function bindStep(step, kind) {
  const text = String(step || "").trim()
  if (!text || kind?.topic === "w") return text
  return text
    .replace(/вчерашний рабочий шаг/g, "вчерашний шаг")
    .replace(/Доведите работу/g, "Доведите начатое")
    .replace(/в работе, не в разговоре/g, "в деле, не в споре")
    .replace(/шаг в работе/g, "шаг в деле")
    .replace(/главная работа/g, "главное дело")
}

export function applySign(hex, question) {
  const kind = askKind(question)
  const lean = String(hex?.meaning || "")
  return {
    kind,
    act: lean,
    lean,
    step: bindStep(hex?.a, kind),
  }
}

const RUNE_STAY = new Set(["eihwaz", "othala"])
const RUNE_GO = new Set(["raidho", "dagaz", "uruz", "sowilo", "wunjo"])
const RUNE_HOLD = new Set(["thurisaz", "hagalaz"])

export function runeStance(rune) {
  const id = rune?.id
  if (RUNE_STAY.has(id)) return "stay"
  if (RUNE_GO.has(id)) return "go"
  if (RUNE_HOLD.has(id)) return "hold"
  if (rune?.tone === "wait") return "wait"
  if (rune?.tone === "no") return "hold"
  return "do"
}

export function runeLeaveCall(rune) {
  const stance = runeStance(rune)
  if (stance === "stay") return "На вопрос, уходить или остаться, руна отвечает: лучше остаться. Сейчас важнее сохранить свою опору."
  if (stance === "go") return "На вопрос, уходить или остаться, руна отвечает: уйти можно, но решиться на это должны вы сами."
  if (stance === "hold") return "На вопрос, уходить или остаться, руна отвечает: не действуйте напролом. Любой шаг сейчас лучше делать в обход."
  if (stance === "wait") return "На вопрос, уходить или остаться, руна отвечает: пока не торопитесь. Это решение ещё не созрело."
  return ""
}

export function applyRune(rune, question) {
  const kind = askKind(question)
  const lean = String(rune?.meaning || "")
  return {
    kind,
    act: lean,
    lean,
    how: rune?.how || "",
    step: bindStep(rune?.a, kind),
  }
}

const CARD_STAY = new Set(["emperor", "hermit", "strength", "pentacles_4", "pentacles_9", "pentacles_king", "swords_4"])
const CARD_GO = new Set(["fool", "death", "cups_8", "swords_6", "chariot", "wands_ace", "tower", "judgement"])
const CARD_WAIT = new Set(["priestess", "moon", "swords_2", "pentacles_7", "hanged"])

export function cardStance(card) {
  const id = card?.id
  if (CARD_STAY.has(id)) return "stay"
  if (CARD_GO.has(id)) return "go"
  if (CARD_WAIT.has(id)) return "wait"
  const tone = verdictOf(id)
  if (tone === "wait") return "wait"
  if (tone === "no") return "hold"
  return "do"
}

const ASIDE_ROLES = new Set(["Что мешает", "Что отпустить"])
const ANSWER_ROLES = new Set(["Ответ", "Что делать", "На этот вопрос"])

/** Ответ на «уйти или остаться» по всему столу: одна строка для вывода, а не окрик в каждой карте. */
export function cardsLeaveCall(items) {
  const flow = (items || []).filter((item) => item?.card && !ASIDE_ROLES.has(item.role))
  if (!flow.length) return ""
  let go = 0
  let stay = 0
  let wait = 0
  flow.forEach((item, index) => {
    const weight = ANSWER_ROLES.has(item.role) ? 3 : index === flow.length - 1 ? 2 : 1
    const stance = cardStance(voiceCard(item.card))
    if (stance === "go") go += weight
    else if (stance === "stay") stay += weight
    else if (stance === "wait" || stance === "hold") wait += weight
  })
  const say = flow.length === 1 ? "карта отвечает" : "карты отвечают"
  if (go > stay && go >= wait) return `На вопрос, уходить или остаться, ${say}: пора уходить.`
  if (stay > go && stay >= wait) return `На вопрос, уходить или остаться, ${say}: лучше остаться.`
  if (wait) return `На вопрос, уходить или остаться, ${say}: не решайте сгоряча. Дайте себе время, прежде чем делать резкий шаг.`
  return flow.length === 1
    ? "Ни «уходите», ни «оставайтесь» карта прямо не говорит: решение за вами, и торопиться с ним не нужно."
    : "Ни «уходите», ни «оставайтесь» карты прямо не говорят: решение за вами, и торопиться с ним не нужно."
}

const ARCANUM = Object.fromEntries(DECK.map((card) => [card.id, card]))

/** Карта колоды стола (у Каэля id вроде magician и нет meaning) → текст Арканума. */
export function voiceCard(card) {
  if (!card || card.kind === "rune" || card.lines) return card
  const id = card.id === "magician" ? "mag" : card.id
  const known = ARCANUM[id]
  if (!known) return card
  if (card.meaning && card.hint && card.id === known.id) return card
  return { ...known, name: card.name || known.name }
}

/** Позиции стола про людей: у каждой свой текст в колоде, его не склеивают из общих фраз. */
const PERSON_KEY = { "Вы": "y", "Другой человек": "o", "Что между вами": "b" }

/** Текст карты под тему и позицию. Готовые предложения из колоды идут как есть, без приставок. */
export function cardLean(card, topic, role = "", question = "", turn = 0) {
  const asked = preparedFace(question)
  if (asked) {
    const line = faceLine(card, asked, role, turn)
    if (line) return line
  }
  const lines = Q[card?.id] || {}
  const meaning = String(card?.meaning || "").trim()
  const person = PERSON_KEY[role]
  if (person && lines[person]) return lines[person]
  if (role === "Деньги" && lines.m) return lines.m
  if (topic === "l" && lines.l) return lines.l
  if ((topic === "w" || topic === "m") && lines[topic]) return [meaning, lines[topic]].filter(Boolean).join(" ")
  return meaning
}

/** Позиции, где гость ждёт действия, а не описания: ответ начинается с совета карты. */
const STEP_FIRST_ROLES = new Set(["Что делать", "Что поможет"])

export function applyCard(card, question, topic, role = "", turn = 0) {
  card = voiceCard(card)
  const kind = askKind(question)
  const t = topic && topic !== "s" ? topic : kind.topic
  const advice = Q[card?.id] || {}
  const lean = cardLean(card, t, role, question, turn)
  const step = bindStep(advice.a || card?.a, { topic: t })
  const act = STEP_FIRST_ROLES.has(role) && step && lean ? `${step}\n\n${lean}` : lean
  return {
    kind,
    act,
    lean,
    step,
    topic: t,
  }
}

export function boundLot(item, question, topic, turn = 0) {
  if (!item?.card) return item
  const lot = item.card.kind === "rune"
    ? applyRune(item.card, question)
    : item.card.lines
      ? applySign(item.card, question)
      : applyCard(item.card, question, topic, item.role || "", turn)
  return {
    ...item,
    card: { ...item.card, a: lot.step, meaning: lot.lean },
  }
}
