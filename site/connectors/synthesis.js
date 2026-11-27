/** Вывод расклада: связывает карты в одну историю и объясняет, почему разные по тону карты не спорят. */

import { DECK, Q } from "./arkanum-data.js"
import { verdictOf } from "./yesno.js"
import { faceVerdict, preparedFace } from "./asks.js"
import { askKind, cardsLeaveCall, signLeaveCall } from "./topic.js"
import { dropEcho } from "./echo.js"

const BY_ID = Object.fromEntries(DECK.map((card) => [card.id, card]))
const ALIAS = { magician: "mag" }

const TONE = { yes: 1, wait: 0, no: -1 }

const PLACE = {
  "Ответ": (h) => `ответ — «${h}»`,
  "Суть вопроса": (h) => `суть вопроса — «${h}»`,
  "Что делать": (h) => `совет — «${h}»`,
  "К чему идёт": (h) => `итог — «${h}»`,
  "Куда идёт": (h) => `итог — «${h}»`,
  "Куда ведёт": (h) => `итог — «${h}»`,
  "На этот вопрос": (h) => `ответ на вопрос — «${h}»`,
  "Вы": (h) => `у вас — «${h}»`,
  "Другой человек": (h) => `у другого человека — «${h}»`,
  "Что между вами": (h) => `между вами — «${h}»`,
  "Что мешает": (h) => `мешает «${h}»`,
  "Где вы сейчас": (h) => `сейчас — «${h}»`,
  "Что держит": (h) => `держит «${h}»`,
  "Деньги": (h) => `в деньгах — «${h}»`,
  "Утро": (h) => `утром — «${h}»`,
  "День": (h) => `днём — «${h}»`,
  "Вечер": (h) => `вечером — «${h}»`,
  "Что посеять": (h) => `посеять — «${h}»`,
  "Что поможет": (h) => `поможет «${h}»`,
  "Что отпустить": (h) => `отпустить — «${h}»`,
  "Что проявилось": (h) => `проявилось «${h}»`,
  "За что поблагодарить": (h) => `поблагодарить стоит за «${h}»`,
  "Знак": (h) => `знак — «${h}»`,
  "Сейчас": (h) => `сейчас — «${h}»`,
  "Перемена": (h) => `перемена — «${h}»`,
  "Ход": (h) => `ход — «${h}»`,
  "Откуда идёт": (h) => `откуда идёт — «${h}»`,
  "Как идёт": (h) => `как идёт — «${h}»`,
  "Как придёт": (h) => `как придёт — «${h}»`,
}

const ASIDE = ["Что мешает", "Что отпустить"]
const ACTION = ["Что делать", "Что поможет"]

const ONE_TAIL = {
  yes: "то, о чём вы спрашиваете, может сложиться, если вы сами сделаете шаг навстречу.",
  no: "в нынешнем виде это не складывается. Это не запрет, а знак поменять подход.",
  wait: "не решайте сгоряча: ответ ещё складывается.",
}

const OVERALL_TAIL = {
  2: "дело движется в хорошую сторону, если вы не будете стоять на месте.",
  1: "скорее хорошо, но не само собой — понадобится ваше усилие.",
  0: "исход пока на весах: он больше зависит от ваших шагов, чем от обстоятельств.",
  "-1": "в нынешнем виде дело идёт тяжело: что-то стоит поменять, но бросать всё не нужно.",
  "-2": "так, как сейчас, не сложится. Это не приговор, а знак перестроить план.",
}

const DAY = {
  2: "День обещает быть лёгким: ловите хорошее и не откладывайте то, что давно хотели.",
  1: "День скорее добрый, хотя без усилия не обойдётся.",
  0: "День ровный, без явного перевеса: многое решит ваше настроение.",
  "-1": "День потребует терпения: берегите силы и не берите лишнего.",
  "-2": "День непростой: не начинайте важных дел сгоряча и берегите себя.",
}

function arcanum(card) {
  return BY_ID[card?.id] || BY_ID[ALIAS[card?.id]] || card
}

function hintOf(card) {
  const known = arcanum(card)
  return known?.hint || known?.name || card?.name || ""
}

function toneOf(card) {
  if (card?.tone && TONE[card.tone] !== undefined) return TONE[card.tone]
  return TONE[verdictOf(arcanum(card)?.id)] ?? 0
}

function capital(text) {
  return text ? text[0].toUpperCase() + text.slice(1) : ""
}

function lowerFirst(text) {
  return text ? text[0].toLowerCase() + text.slice(1) : ""
}

function nameOfCard(card) {
  return arcanum(card)?.name || ""
}

/** Вводка перед итогом: эхо вопроса и список легших карт по позициям. */
function leadOf(items, kind, question) {
  const q = `Вы спросили: «${question.trim()}».`
  if (items.length === 1) {
    const onlyName = nameOfCard(items[0].card)
    const one = kind === "rune" ? "Легла руна" : kind === "sign" ? "Лёг знак" : "Легла карта"
    return onlyName ? `${q} ${one} «${onlyName}».` : q
  }
  const lot = kind === "rune" ? "Руны легли" : kind === "sign" ? "Знаки легли" : "Карты легли"
  const list = items.map((item) => `${lowerFirst(item.role)} — ${nameOfCard(item.card) || item.hint}`).join(", ")
  return `${q} ${lot}: ${list}.`
}

function joinStory(parts) {
  if (parts.length < 2) return parts.join("")
  return `${parts.slice(0, -1).join(", ")}, а ${parts[parts.length - 1]}`
}

function place(role, hint) {
  const say = PLACE[role]
  return say ? say(hint) : `${String(role || "").toLowerCase()} — «${hint}»`
}

const CARD_OPEN = {
  "Ответ": (name) => `На ваш вопрос отвечает карта «${name}».`,
  "Суть вопроса": (name) => `Суть вопроса называет карта «${name}».`,
  "Что делать": (name) => `Что делать, говорит карта «${name}».`,
  "К чему идёт": (name) => `К чему это идёт, показывает карта «${name}».`,
  "Куда идёт": (name) => `Куда это идёт, показывает карта «${name}».`,
  "Куда ведёт": (name) => `Куда это ведёт, показывает карта «${name}».`,
  "На этот вопрос": (name) => `На этот вопрос отвечает карта «${name}».`,
  "Вы": (name) => `Вас показывает карта «${name}».`,
  "Другой человек": (name) => `Другого человека показывает карта «${name}».`,
  "Что между вами": (name) => `То, что между вами, показывает карта «${name}».`,
  "Что мешает": (name) => `Что вам мешает, показывает карта «${name}».`,
  "Где вы сейчас": (name) => `Где вы сейчас, показывает карта «${name}».`,
  "Что держит": (name) => `Что вас держит, показывает карта «${name}».`,
  "Деньги": (name) => `Про деньги говорит карта «${name}».`,
  "Утро": (name) => `Утро показывает карта «${name}».`,
  "День": (name) => `День показывает карта «${name}».`,
  "Вечер": (name) => `Вечер показывает карта «${name}».`,
  "Что посеять": (name) => `Что посеять, называет карта «${name}».`,
  "Что поможет": (name) => `Что поможет, называет карта «${name}».`,
  "Что отпустить": (name) => `Что отпустить, называет карта «${name}».`,
  "Что проявилось": (name) => `Что проявилось, называет карта «${name}».`,
  "За что поблагодарить": (name) => `За что поблагодарить, называет карта «${name}».`,
  "Карта знака": (name) => `Ваш знак показывает карта «${name}».`,
  "Знак": (name) => `Ваш знак показывает карта «${name}».`,
}

export function cardOpen(role, name) {
  const say = CARD_OPEN[role]
  return say ? say(name) : `В позиции «${role}» лежит карта «${name}».`
}

/** Своими словами, не дословный смысл колоды и не имя карты. */
const PLAIN = {
  fool: "Начинать можно и без гарантий: излишний контроль здесь только мешает.",
  mag: "Всё нужное у вас уже есть: соберитесь и начните действовать.",
  priestess: "Пока лучше помолчать: то, что вы уже чувствуете, прояснится в тишине.",
  empress: "Здесь всё растёт от заботы, и тепло сейчас важнее напора.",
  emperor: "Наведите порядок там, где шатко: опору дают ясные правила, а не спешка.",
  hierophant: "Не изобретайте всё заново: спросите совета у того, кто уже прошёл этот путь.",
  lovers: "Расчёт здесь не поможет: выбирайте то, с чем готовы остаться всерьёз.",
  chariot: "Направление задаёте вы, а не обстоятельства: держите курс, и вы доедете.",
  strength: "Напором этого не взять: поможет спокойная настойчивость.",
  hermit: "Отойдите от шума: нужный ответ слышен только в тишине.",
  wheel: "Обстоятельства меняются сами, и держаться за уходящее не стоит.",
  justice: "Взвесьте всё честно, без поблажек себе: что вложено, то и вернётся.",
  hanged: "Дело замерло: посмотрите на него иначе и решите, чем вы готовы поступиться.",
  death: "Прежнее закончилось, и новое не начнётся, пока вы за него держитесь.",
  temperance: "Не бросайтесь в крайности: действуйте понемногу, пока не найдёте свою меру.",
  devil: "Назовите своё желание прямо: пока оно спрятано, оно управляет вами.",
  tower: "Рушится то, что держалось на неправде, и строить заново можно только на честном основании.",
  star: "После трудного времени к вам возвращаются силы, и снова можно надеяться.",
  moon: "Пока всё в тумане, не делайте выводов и проверяйте то, что слышите.",
  sun: "Здесь всё на виду и скрывать нечего: смело делитесь теплом.",
  judgement: "Откладывать больше некуда: подведите итог и ответьте на то, что давно вас зовёт.",
  world: "Путь пройден: признайте, что вы дошли, и завершите этот круг.",
  cups_ace: "Появилось что-то живое и ещё хрупкое: не закрывайтесь от этого.",
  cups_2: "Здесь всё держится на взаимности: нужен шаг с обеих сторон.",
  cups_3: "Сейчас важнее побыть с близкими людьми, чем закончить ещё одно дело.",
  cups_4: "Вы не замечаете того, что вам уже предлагают: оглядитесь.",
  cups_5: "Потеря ощутима, но не всё потеряно: посмотрите на то, что у вас осталось.",
  cups_6: "Тепло идёт из прошлого, и к нему можно ненадолго вернуться.",
  cups_7: "Не всё, что блестит, настоящее: выбирайте то, от чего вам тепло.",
  cups_8: "Это место себя исчерпало, и уйти можно, даже если вложено много.",
  cups_9: "Скажите прямо, чего вы хотите, иначе желание так и останется мечтой.",
  cups_10: "Ваше богатство — близкие люди и простое тепло: делитесь им.",
  cups_page: "Скоро придёт добрая весть: примите её без подозрений.",
  cups_knight: "За красивым жестом смотрите на поступки: чувству можно верить, когда его подтверждают делом.",
  cups_queen: "Заботьтесь о близких, но не забывайте о себе: чужая боль не должна забирать все ваши силы.",
  cups_king: "Сохраняйте спокойствие: сейчас оно опора и вам, и тем, кто рядом.",
  wands_ace: "В вас проснулось живое желание: не гасите его сомнениями и начните с малого.",
  wands_2: "Прежние рамки вам уже тесны: можно смотреть шире.",
  wands_3: "Первый шаг уже сделан: готовьтесь к результату и не торопите его.",
  wands_4: "Даже маленькую победу стоит отметить: вы её заслужили.",
  wands_5: "Это шум и азарт, а не война: не принимайте спор близко к сердцу.",
  wands_6: "Ваш труд заметят: не прячьтесь, когда вас хвалят.",
  wands_7: "Ваша позиция крепче, чем вам кажется: стойте спокойно и не оправдывайтесь.",
  wands_8: "События пойдут быстро, и медлить сейчас хуже, чем поспешить.",
  wands_9: "Финиш близко: сил у вас больше, чем подсказывает усталость.",
  wands_10: "Часть этого груза не ваша: отдайте её, и идти станет легче.",
  wands_page: "В вашу жизнь стучится что-то новое: отнеситесь к этому с любопытством.",
  wands_knight: "Сил у вас много, но они растратятся, если не направить их в одно дело.",
  wands_queen: "Людей привлекает ваше тепло: не прячьте его, и нужное придёт к вам.",
  wands_king: "Вести здесь вам: позовите, и за вами пойдут.",
  swords_ace: "Вы уже видите суть: скажите решающее слово, пока ясность не ушла.",
  swords_2: "Вы медлите, потому что оба варианта вам дороги: посмотрите на факты, и выбор станет яснее.",
  swords_3: "Правда причиняет боль, и прятать её не нужно: когда боль названа, она проходит быстрее.",
  swords_4: "Сейчас полезнее пауза, чем новый рывок: силы возвращаются в тишине.",
  swords_5: "Победа в этом споре обойдётся дорого: подумайте, что вам важнее — выиграть или сохранить отношения.",
  swords_6: "Вы уходите от того, что ранило, к более спокойной жизни: это грустно, но правильно.",
  swords_7: "Действуйте тише и умнее, но чужого не берите даже в мелочах.",
  swords_8: "Вас держит привычка, а не замок: один шаг в сторону уже будет выходом.",
  swords_9: "Ночью страхи кажутся больше, чем есть: запишите их и перечитайте днём.",
  swords_10: "Худшее уже случилось, значит, пора подниматься: впереди светлеет.",
  swords_page: "Слушайте и перепроверяйте: главное вы узнаете раньше, чем успеете догадаться.",
  swords_knight: "Вы уже в движении: следите, чтобы по дороге не разрушить то, что ещё пригодится.",
  swords_queen: "Смотрите трезво, без злости и без иллюзий: такая ясность убережёт вас от лишних разочарований.",
  swords_king: "Факты сейчас надёжнее настроения: принимайте решение, опираясь на них.",
  pentacles_ace: "У вас появилось то, из чего может вырасти дело, дом или доход: отнеситесь к этому бережно.",
  pentacles_2: "Держите в ритме два дела: третье сейчас только собьёт.",
  pentacles_3: "Это стоит доделать и показать людям, а не прятать в стол.",
  pentacles_4: "Раздавать пока рано: сберегите то, что у вас уже есть.",
  pentacles_5: "В одиночку здесь не справиться: попросите о помощи, и вам откроют.",
  pentacles_6: "Отдайте столько, сколько можете, и примите то, что вам дают: здесь важно равновесие.",
  pentacles_7: "Вы уже сделали своё: теперь подождите и посмотрите, что из этого вырастет.",
  pentacles_8: "Мастерство копится понемногу: сделайте ещё один точный шаг, без шума.",
  pentacles_9: "Можно остановиться и порадоваться плодам: вы их заслужили.",
  pentacles_10: "Ваша опора — дом, близкие и то, что вы создаёте надолго.",
  pentacles_page: "Возможность небольшая, но настоящая: изучите её и не спешите.",
  pentacles_knight: "Не ускоряйтесь: ровным шагом вы дойдёте до конца.",
  pentacles_queen: "Здесь всё создаётся заботой и руками: домом, едой и самим делом, а не громкими подвигами.",
  pentacles_king: "Решайте спокойно и надолго: вы здесь на своём месте.",
}

function plainOfCard(card) {
  const known = arcanum(card)
  const text = PLAIN[known?.id]
  if (text) return text
  const hint = hintOf(card)
  return hint ? `Здесь важно вот что: ${hint}.` : ""
}

const PERSON_ROLES = new Set(["Вы", "Другой человек", "Что между вами"])

/** Карты про людей пересказаны в самих карточках: в выводе их не склеиваем с «у вас» и «у другого человека». */
function cardRetell(items) {
  return items
    .filter((item) => !PERSON_ROLES.has(item.role))
    .map((item) => {
      const text = plainOfCard(item.card)
      if (!text) return ""
      const name = nameOfCard(item.card)
      return name ? `${name}: ${lowerFirst(text)}` : text
    })
    .filter(Boolean)
    .join(" ")
}

function pairClose(score) {
  return {
    2: "Карты складываются в вашу пользу: у этой истории хорошие шансы.",
    1: "Карты скорее добрые, но многое зависит от того, как вы оба поступите дальше.",
    0: "Однозначного ответа карты не дают: всё ещё может повернуться в любую сторону, и многое зависит от ваших шагов.",
    "-1": "Сейчас в этой истории больше трудного, чем лёгкого. Это не конец, но что-то придётся менять.",
    "-2": "В нынешнем виде эта история складывается тяжело. Это не приговор, а честный знак: так, как сейчас, продолжать не стоит.",
  }[String(score)] || ""
}

/** «Уходить или остаться» про отношения: отвечает весь стол, а не одна карта. */
function pairLeave(score) {
  if (score >= 1) return "На вопрос, уходить или остаться, карты отвечают: не спешите уходить. У этой истории ещё есть будущее."
  if (score <= -1) return "На вопрос, уходить или остаться, карты отвечают: в нынешнем виде эти отношения вас не держат. Если ничего не изменится, уйти будет честнее, чем терпеть."
  return "На вопрос, уходить или остаться, карты прямо не отвечают: всё ещё может повернуться в любую сторону. Не решайте сгоряча."
}

/** В раскладе про двоих другой человек и то, что между ними, весят больше, чем настроение гостя. */
function pairScore(flow) {
  return clamp(flow.reduce((sum, item, index) => {
    const heavy = item.role === "Другой человек" || item.role === "Что между вами" || index === flow.length - 1
    return sum + item.tone * (heavy ? 2 : 1)
  }, 0))
}

function cardClose(score) {
  return {
    2: "Вместе карты складываются в вашу пользу, если вы не будете стоять на месте.",
    1: "Вместе карты скорее обещают хорошее, но само оно не случится: нужен ваш шаг.",
    0: "Исход пока не решён и зависит от того, что вы сделаете.",
    "-1": "Пока всё идёт тяжело: что-то стоит изменить, но бросать всё не нужно.",
    "-2": "Так, как сейчас, не сложится. Это не приговор: план стоит перестроить.",
  }[String(score)] || ""
}

function clamp(score) {
  return Math.max(-2, Math.min(2, score))
}

function lotOf(cards) {
  const card = cards[0]?.card
  if (card?.kind === "rune") return "rune"
  if (card?.lines) return "sign"
  return "card"
}

function voice(lot) {
  if (lot === "sign") {
    return {
      one: { yes: "Знак светлый", no: "Знак трудный", wait: "Знак просит паузы" },
      bright: "В целом знаки светлые",
      warn: "Знаки предупреждают",
      story: "знаки",
      allPos: "Знаки смотрят в одну сторону — противоречий тут нет.",
      allNeg: (w) => `Знаки трудные — прежде всего «${w}». Это честное предупреждение, а не приговор: они показывают, где больно, чтобы вы не шли туда вслепую.`,
      allWait: "Знаки просят паузы: ответ ещё созревает, и главное сейчас — не торопить события.",
      move: "Знаки не спорят друг с другом — они показывают движение.",
      first: "Первый знак",
      last: "последний",
      hardFirst: "Трудный знак в начале не отменяет светлый в конце: он",
      endLaid: "в конце лёг знак",
      mid: "Средний знак",
      midHint: "Один знак говорит, где вы, другой — что с этим делать.",
    }
  }
  if (lot === "rune") {
    return {
      one: { yes: "Руна светлая", no: "Руна жёсткая", wait: "Руна просит паузы" },
      bright: "В целом ход светлый",
      warn: "Руны предупреждают",
      story: "руны",
      allPos: "Руны смотрят в одну сторону — противоречий тут нет.",
      allNeg: (w) => `Руны жёсткие — прежде всего «${w}». Это честное предупреждение, а не приговор: они показывают, где больно, чтобы вы не шли туда вслепую.`,
      allWait: "Руны просят паузы: ответ ещё созревает, и главное сейчас — не торопить события.",
      move: "Руны не спорят друг с другом — они показывают движение.",
      first: "Первая руна",
      last: "последняя",
      hardFirst: "Жёсткая руна в начале не отменяет светлую в конце: она",
      endLaid: "в конце легла руна",
      mid: "Средняя руна",
      midHint: "Одна руна говорит, откуда идёт, другая — что с этим делать.",
    }
  }
  return {
    one: { yes: "Карта светлая", no: "Карта трудная", wait: "Карта просит паузы" },
    bright: "В целом расклад светлый",
    warn: "Карты предупреждают",
    story: "карты",
    allPos: "Все карты смотрят в одну сторону — противоречий тут нет.",
    allNeg: (w) => `Все карты тяжёлые — в первую очередь «${w}». Это честное предупреждение, а не приговор: они показывают, где больно, чтобы вы не шли туда вслепую.`,
    allWait: "Все карты просят паузы: ответ ещё созревает, и главное сейчас — не торопить события.",
    move: "Карты не спорят друг с другом — они показывают движение.",
    first: "Первая карта",
    last: "последняя",
    hardFirst: "Трудная карта в начале не отменяет светлую в конце: она",
    endLaid: "в конце легла карта",
    mid: "Средняя карта",
    midHint: "Одна карта говорит, где вы, другая — что с этим делать.",
  }
}

function oneLine(lot, tone) {
  const head = voice(lot).one[tone] || voice(lot).one.wait
  return `${head}: ${ONE_TAIL[tone] || ONE_TAIL.wait}`
}

/** Развилка «уйти или остаться» у знака: сторона называется прямо или честно не называется. */
function forkLine(card) {
  return signLeaveCall(card) || "Сторону знак за вас не выбирает: он говорит о том, как принять это решение."
}

function overallLine(lot, score) {
  const key = String(score)
  const say = voice(lot)
  if (key === "2") return `${say.bright}: ${OVERALL_TAIL[2]}`
  if (key === "1") return `В целом ${OVERALL_TAIL[1]}`
  if (key === "0") return capital(OVERALL_TAIL[0])
  if (key === "-1") return capital(OVERALL_TAIL["-1"])
  return `${say.warn}: ${OVERALL_TAIL["-2"]}`
}

function worstOf(items) {
  return items.reduce((acc, item) => item.tone < acc.tone ? item : acc, items[0])
}

/** Детерминированный выбор варианта текста по составу расклада: один и тот же расклад
 * всегда получает один и тот же вариант, а разные — с большой вероятностью разные. */
function hashIndex(seed, n) {
  let hash = 0
  for (const ch of String(seed)) hash = (hash * 33 + ch.charCodeAt(0)) >>> 0
  return n ? hash % n : 0
}

function seedOf(items) {
  return items.map((item) => `${item.role}:${item.card?.id || item.hint}`).join("|")
}

const HEAVY_ROLES = new Set(["Другой человек", "Что между вами"])

/** Две карты, на которые опирается вывод: сначала роли про людей, потом самые заряженные по тону. */
function decisiveItems(items) {
  const flow = items.filter((item) => !ASIDE.includes(item.role))
  const heavy = flow.filter((item) => HEAVY_ROLES.has(item.role))
  const rest = flow
    .filter((item) => !HEAVY_ROLES.has(item.role))
    .sort((a, b) => Math.abs(b.tone) - Math.abs(a.tone) || flow.indexOf(a) - flow.indexOf(b))
  return [...heavy, ...rest].slice(0, 2)
}

/** Доказательная строка из выпавших карт: имя карты и её приземлённый смысл. */
function evidenceLine(items) {
  return decisiveItems(items)
    .map((item) => {
      const name = nameOfCard(item.card)
      const plain = plainOfCard(item.card)
      return name && plain ? `«${name}» — ${lowerFirst(plain)}` : ""
    })
    .filter(Boolean)
    .join(" ")
}

function bridge(items, lot = "card") {
  const flow = items.filter((item) => !ASIDE.includes(item.role))
  const moon = items.some((item) => item.role === "Что отпустить")
  const you = items.find((item) => item.role === "Вы")
  const other = items.find((item) => item.role === "Другой человек")
  const lines = []

  const say = voice(lot)
  const card = lot === "card"
  const pick = (list) => list[hashIndex(seedOf(items), list.length)]
  if (you && other && you.tone !== other.tone) {
    lines.push(card
      ? pick([
        "Карты как будто спорят, но это потому, что вы и другой человек сейчас в разном состоянии. В разговоре учитывайте и своё настроение, и чужое.",
        "Разнобой в раскладе честный: вы и другой человек сейчас на разных берегах. Это не ошибка расклада, а разница ваших мест — её и стоит учитывать в разговоре.",
        `Карты показывают двоих, которые чувствуют по-разному: у вас «${nameOfCard(you.card)}», у другого человека — «${nameOfCard(other.card)}», и это пока не совпадает.`,
      ])
      : `Ощущение, что карты спорят, здесь от того, что вы и другой человек сейчас в разном состоянии: у вас «${you.hint}», у другого человека — «${other.hint}». Это не ошибка расклада, а разница ваших мест — её и стоит учитывать в разговоре.`)
  }

  const first = flow[0]
  const last = flow[flow.length - 1]
  const tones = new Set(flow.map((item) => item.tone))

  if (tones.size === 1) {
    if (first.tone > 0) {
      lines.push(card
        ? pick([
          say.allPos,
          "Карты согласны друг с другом: расклад цельный, идти можно.",
          "Разногласий между картами нет: они тянут в одну сторону.",
        ])
        : say.allPos)
    }
    else if (first.tone < 0) lines.push(say.allNeg(card ? nameOfCard(worstOf(flow).card) || worstOf(flow).hint : worstOf(flow).hint))
    else {
      lines.push(card
        ? pick([
          say.allWait,
          "Карты советуют выдержать паузу: зрелое решение придёт само, если не форсировать.",
        ])
        : say.allWait)
    }
  } else if (!(you && other) && !moon) {
    if (first.tone < last.tone) {
      lines.push(card
        ? pick([
          "Сначала будет труднее, чем в конце. Трудное начало не отменяет того, к чему ведут карты: оно показывает, через что придётся пройти.",
          "Расклад идёт от тяжёлого к светлому: начало — не приговор, а дорога, через которую ведут карты.",
          `Карты ведут вверх: от «${nameOfCard(first.card)}» к «${nameOfCard(last.card)}». Трудное в начале — то, через что нужно пройти, а не то, где остановиться.`,
        ])
        : `${say.move} ${say.first}, «${first.hint}», — это то, откуда вы начинаете, а ${say.last}, «${last.hint}», — куда можно прийти. ${first.tone < 0 && last.tone > 0 ? say.hardFirst : "Начало не отменяет конец: оно"} объясняет, через что придётся пройти.`)
    } else if (first.tone > last.tone) {
      lines.push(card
        ? pick([
          `Начало ${first.tone > 0 ? "светлое" : "ровное"}, а к концу становится тяжелее. ${first.tone > 0 ? "Хорошее само не удержится: его надо поддерживать." : "Это не знак, что всё пропало, а предупреждение: здесь нужно быть внимательнее."}`,
          first.tone > 0
            ? "Хорошее начало не гарантирует лёгкий конец: то, что растёт, нужно поддерживать, иначе оно остынет."
            : "Расклад тяжелеет к концу: то, что в начале давалось ровно, к финишу потребует внимания.",
          `От «${nameOfCard(first.card)}» к «${nameOfCard(last.card)}» дорога идёт вниз: это предупреждение, где быть внимательнее, а не знак, что всё пропало.`,
        ])
        : `Начало ${first.tone > 0 ? "светлое" : "ровное"}, но ${say.endLaid} «${last.hint}». Это не значит, что всё испортится: ${first.tone > 0 ? "хорошее нужно поддерживать, само оно не удержится" : "это предупреждение, где быть внимательнее"}.`)
    }
    const middle = lot === "card" ? null : flow.slice(1, -1).find((item) => item.tone !== first.tone)
    if (middle && middle.tone > first.tone) {
      lines.push(`${say.mid}, «${middle.hint}», — не описание того, что уже есть, а подсказка, как ответить на первую. ${say.midHint}`)
    } else if (middle && middle.tone < first.tone) {
      lines.push(`${say.mid}, «${middle.hint}», — не приговор, а то, что нужно признать или пройти по дороге.`)
    }
  }

  const block = items.find((item) => item.role === "Что мешает")
  if (block && block.tone > 0) {
    lines.push(card
      ? pick([
        `Мешает, как ни странно, «${nameOfCard(block.card)}» — и это не плохая карта. За хорошее тоже можно держаться слишком крепко.`,
        `Помеха в раскладе — «${nameOfCard(block.card)}», карта светлая: за хорошее тоже можно держаться слишком крепко, и оно мешает двигаться дальше.`,
      ])
      : `Мешает, как ни странно, «${block.hint}» — и это не плохая карта. Даже хорошее отвлекает, если держаться за него слишком крепко.`)
  } else if (block) {
    lines.push(card
      ? pick([
        `Сначала разберитесь с «${nameOfCard(block.card)}»: именно эта карта тормозит дело. Пока она не решена, остальное не сдвинется.`,
        `Главная помеха названа — «${nameOfCard(block.card)}». С ней стоит разобраться в первую очередь: остальное подождёт.`,
      ])
      : `Карта помехи, «${block.hint}», — то, с чем стоит разобраться в первую очередь: именно она тормозит.`)
  }
  const release = items.find((item) => item.role === "Что отпустить")
  if (release && release.tone > 0) {
    lines.push(card
      ? pick([
        `Отпустить предлагается даже то, что кажется хорошим, — «${nameOfCard(release.card)}». За хорошее тоже можно держаться слишком крепко: дайте ему свободу.`,
        `«${nameOfCard(release.card)}» в позиции отпускания — знак, что и хорошее бывает лишним: дайте ему свободу, и оно не потеряется.`,
      ])
      : `Отпустить предлагается даже светлую карту — «${release.hint}». За хорошее тоже можно держаться слишком крепко: дайте ему свободу.`)
  } else if (release) {
    lines.push(card
      ? pick([
        `То, что тянет вас назад, — «${nameOfCard(release.card)}». Пора оставить это в прошлом и не брать с собой дальше.`,
        `«${nameOfCard(release.card)}» — груз, который пора снять: не берите его с собой дальше.`,
      ])
      : `Карта «${release.hint}» — то, что пора оставить в прошлом: не берите это с собой дальше.`)
  }
  return lines.join(" ")
}

function stepOf(items) {
  const pick = items.find((item) => ACTION.includes(item.role))
    || items.find((item) => ASIDE.includes(item.role) && item.tone < 0)
    || items[items.length - 1]
  const card = arcanum(pick.card)
  return pick.card?.a || Q[card?.id]?.a || card?.a || ""
}

export function synthesize({ cards = [], question = "", end = "", lot, echo = false } = {}) {
  const items = cards
    .filter((item) => item?.card)
    .map((item) => ({ role: item.role, card: item.card, hint: hintOf(item.card), tone: toneOf(item.card) }))
  if (!items.length) return ""
  const shown = items.map((item) => item.card?.meaning || "").join("\n")
  const finish = (note) => dropEcho(note, shown)
  const kind = lot || lotOf(cards)

  const fork = kind === "card" && typeof question === "string" && question && askKind(question).leave ? cardsLeaveCall(cards) : ""
  const face = kind === "card" && typeof question === "string" ? preparedFace(question) : ""
  const lead = echo && typeof question === "string" && question.trim() ? leadOf(items, kind, question) : ""

  if (items.length === 1) {
    const [only] = items
    const step = stepOf(items)
    const tone = only.card?.tone || verdictOf(arcanum(only.card)?.id)
    const leave = kind !== "card" && question && typeof question === "string" && askKind(question).leave
    const head = face
      ? faceVerdict(face, tone === "yes" ? 2 : tone === "no" ? -2 : 0, fork)
      : kind === "card"
      ? `${fork || capital(ONE_TAIL[tone] || ONE_TAIL.wait)} ${plainOfCard(only.card)}`.replace(/\s+/g, " ").trim()
      : leave && kind === "sign" ? forkLine(only.card) : oneLine(kind, tone)
    return finish([
      lead,
      `Итог расклада. ${head}`,
      face ? evidenceLine(items) : "",
      step ? `${kind === "card" ? "Что советует карта" : kind === "rune" ? "Что советует руна" : "Что советует знак"} — ${step}` : "",
      end,
    ].filter(Boolean).join("\n\n"))
  }

  const flow = items.filter((item) => !ASIDE.includes(item.role))
  const score = clamp(flow.reduce((sum, item, index) => sum + item.tone * (index === flow.length - 1 ? 2 : 1), 0))
  const head = question ? overallLine(kind, score) : DAY[score]
  const story = kind === "card"
    ? cardRetell(items)
    : `Если сложить ${voice(kind).story} в одну историю: ${joinStory(items.map((item) => place(item.role, item.hint)))}.`
  const step = stepOf(items)

  if (kind === "card") {
    const pair = items.some((item) => PERSON_ROLES.has(item.role))
    if (pair && question) {
      const weighed = pairScore(flow)
      const open = face ? faceVerdict(face, weighed, fork) : (fork ? pairLeave(weighed) : pairClose(weighed))
      return finish([
        lead,
        `Итог расклада. ${open}`,
        evidenceLine(items),
        bridge(items, kind),
        step ? `Что советуют карты — ${step}` : "",
        end,
      ].filter(Boolean).join("\n\n"))
    }
    if (face) {
      return finish([
        lead,
        `Итог расклада. ${faceVerdict(face, score, fork)}`,
        evidenceLine(items),
        bridge(items, kind),
        step ? `Что советуют карты — ${step}` : "",
        end,
      ].filter(Boolean).join("\n\n"))
    }
    return finish([
      lead,
      question ? `Итог расклада. ${[fork, story].filter(Boolean).join(" ")}` : `Итог расклада. ${head}`,
      question ? cardClose(score) : story,
      bridge(items, kind),
      step ? `Что советуют карты — ${step}` : "",
      end,
    ].filter(Boolean).join("\n\n"))
  }

  return finish([
    lead,
    `Итог расклада. ${head}`,
    story,
    bridge(items, kind),
    step ? `Что советуют ${voice(kind).story} — ${step}` : "",
    end,
  ].filter(Boolean).join("\n\n"))
}
