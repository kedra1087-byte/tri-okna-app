/** Расклады. Герой выбирает spreadId. Экран только рисует то, что вернул коннектор. */

import { byId as arcanumById, decanCard, explainQuestion, inSign, layQuestion } from "./arkanum.js"
import { cardById, majorsExcept } from "./decks.js"
import { readSky } from "./astrology.js"
import { sizeOf } from "./heroes.js"
import { cardOpen, synthesize } from "./synthesis.js"
import { layHexagram } from "./hexagrams.js"
import { layRunes } from "./runes.js"
import { applyCard, boundLot, questionTopic } from "./topic.js"

function shuffle(list, random) {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function pull(count, skipIds, random) {
  return shuffle(majorsExcept(skipIds), random).slice(0, count)
}

function spreadRandom(question, random) {
  let n = 2166136261
  const text = String(question || "")
  for (let i = 0; i < text.length; i += 1) n = Math.imul(n ^ text.charCodeAt(i), 16777619)
  n >>>= 0
  return () => {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0
    const spin = random()
    return (((n >>> 8) / 0x1000000) * 0.73 + spin * 0.27) % 1
  }
}

function meaningOf(card) {
  const voiced = arcanumById(card.id) || arcanumById(card.id === "magician" ? "mag" : "")
  return voiced?.meaning || card.line
}

export function laySpread(hero, profile, random = Math.random) {
  if (hero.spreadId === "hexagram") {
    const roles = profile.roles || sizeOf(hero)?.roles
    return layHexagram({ ...profile, roles }, spreadRandom(profile.question, random))
  }
  if (hero.spreadId === "runes") {
    const roles = profile.roles || sizeOf(hero)?.roles
    return layRunes({ ...profile, roles }, spreadRandom(profile.question, random))
  }
  if (hero.spreadId === "question") {
    const roles = profile.roles || sizeOf(hero)?.roles
    return layQuestion({ ...profile, roles, heroTopic: hero.topic }, random)
  }
  const sky = readSky(profile)
  const question = String(profile.question || "").trim()
  if (hero.spreadId === "decan") {
    const card = cardById(sky.sun?.major ?? "wheel")
    const drawn = pull(2, card ? [card.id] : [], spreadRandom(question, random))
    const answerRoles = ["На этот вопрос", "Куда ведёт"]
    const decan = sky.decan ? decanCard(sky.sun.name, sky.decan.index) : null
    const spread = {
      id: "decan",
      title: "Знак и декан",
      sky,
      decan,
      cards: [
        {
          role: sky.sun ? "Карта знака" : "без даты",
          card,
          note: decanNote(sky, decan),
        },
        ...drawn.map((drawnCard, index) => ({
          role: answerRoles[index],
          card: drawnCard,
          note: drawnCard.line,
        })),
      ],
    }
    spread.question = question
    spread.heroTopic = hero.topic
    spread.tell = Math.floor(random() * 8)
    spread.reading = explainSpread(spread)
    return spread
  }

  const significator = sky.sun ? cardById(sky.sun.major) : null
  const drawn = pull(3, significator ? [significator.id] : [], random)
  const roles = ["Опора", "Порог", "Тень"]
  const cards = drawn.map((card, index) => ({ role: roles[index], card, note: card.line }))
  if (significator) {
    cards.unshift({
      role: "Знак",
      card: significator,
      note: `Солнце в знаке ${sky.sun.name}. Это сигнификатор Золотой зари.`,
    })
  }
  const spread = { id: "three-sky", title: "Три окна", sky, cards, question }
  spread.reading = explainSpread(spread)
  return spread
}

function decanNote(sky, decan) {
  if (!sky.sun) return "Назовите день рождения, и стол покажет знак и декан."
  const sun = `Солнце в ${inSign(sky.sun.name)}.`
  if (!decan?.card) return sun
  return `${sun} ${capital(sky.decan.name)} декан — ${decan.planet} в ${inSign(sky.sun.name)}, его карта — «${decan.card.name}», ${decan.title}.`
}

function capital(text) {
  return text ? text[0].toUpperCase() + text.slice(1) : ""
}

function findRole(spread, role) {
  return spread.cards.find((item) => item.role === role)
}

export function explainSpread(spread) {
  if (spread.id === "question") return explainQuestion(spread)
  if (spread.id === "decan") {
    const item = spread.cards[0]
    const asked = String(spread.question || "").trim()
    const others = spread.cards.slice(1)
    const topic = questionTopic(asked, spread.heroTopic || "s")
    const turn = spread.tell || 0
    const bound = others.map((card) => applyCard(card.card, asked, topic, card.role, turn))
    let lead = ""
    if (!item?.card) lead = "Назовите день рождения, и стол покажет знак и декан."
    const items = item?.card ? spread.cards.map((card, index) => ({
      role: card.role,
      name: card.card.name,
      hint: card.card.line,
      open: cardOpen(index === 0 ? "Карта знака" : card.role, card.card.name),
      body: index === 0 ? `${card.note} ${meaningOf(card.card)}` : (asked ? bound[index - 1].act : meaningOf(card.card)),
      personal: "",
    })) : []
    const noteCards = others.filter((card) => card.card).map((card) => boundLot(card, asked, topic, spread.tell || 0))
    const note = item?.card ? synthesize({ cards: noteCards, question: asked || true, echo: true }) : ""
    return { title: "Карты ответили", layout: "cards", lead, items, note }
  }

  const sign = findRole(spread, "Знак")
  const support = findRole(spread, "Опора")
  const door = findRole(spread, "Порог")
  const shadow = findRole(spread, "Тень")
  const parts = []
  if (spread.question) parts.push(`Вы спросили: «${spread.question}». Карты отвечают на это, а не на жизнь вообще.`)
  parts.push("«Три окна» не обещают всё будущее. Это три взгляда на то, что уже с вами.")
  if (sign) parts.push(`Знак называет, кем вы входите в этот день: «${sign.card.name}». ${sign.note}`)
  if (support) parts.push(`Опора — на что можно опереться: «${support.card.name}». ${support.card.line}`)
  if (door) parts.push(`Порог — шаг, который просится: «${door.card.name}». ${door.card.line}`)
  if (shadow) parts.push(`Тень — то, что лучше назвать вслух: «${shadow.card.name}». ${shadow.card.line}`)
  parts.push("Читайте их вместе. Опора держит, порог зовёт сделать шаг, тень мешает меньше, когда её видно.")
  return { title: "Что значит этот расклад", lead: parts.join(" ") }
}
