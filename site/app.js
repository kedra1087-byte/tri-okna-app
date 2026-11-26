import {
  arcanaByNumber,
  arcanaLine,
  byId,
  cardAdvice,
  dailyCard,
  dailyOpened,
  DECK,
  cardCorrespondence,
  followupAnswer,
  IMGS,
  loadJournal,
  loadProfile,
  paintedSrc,
  patchEntry,
  personalize,
  profileFrom,
  birthIssue,
  ageOn,
  BIRTH_MIN_YEAR,
  saveJournal,
  saveProfile,
  toRoman,
  todayKey,
} from "./connectors/arkanum.js"
import { dropEcho } from "./connectors/echo.js"
import { createAudioBus } from "./connectors/audio.js"
import { cardById, deckById } from "./connectors/decks.js"
import { BUZZ, buzz, canBuzz, setHaptics } from "./connectors/haptics.js"
import { ADULT_AGE, AGE_RATING, CONSENT_VERSION, consentDoc, OPERATOR, PARENT_AGE, privacyDoc } from "./connectors/legal.js"
import { HALL_ORDER, heroById, sizeOf } from "./connectors/heroes.js"
import { disablePush, enablePush, notePushRest, notePushSeen, pushOn, pushPrefs, pushServerKey, pushSupport, setPushKinds, testPush } from "./connectors/push.js"
import { horoscope } from "./connectors/sky-today.js"
import { MONTH_DAYS, MONTH_MIN_CARDS, SUIT_ORDER, cardsWord as monthCardsWord, monthCards, monthSummary } from "./connectors/month.js"
import { MOON_PHASES, explainMoon, layMoon, moonDate, moonHeadline, moonWindow, nextMoon } from "./connectors/moon.js"
import { LATER_DAYS, OUTCOMES, OUTCOME_REPLY, OUTCOME_WORD, addDays, agoText, canAsk, daysBetween, nextToAsk, outcomeStats } from "./connectors/outcome.js"
import { hexById, hexSvg } from "./connectors/hexagrams.js"
import { runeById, runeSvg } from "./connectors/runes.js"
import { laySpread } from "./connectors/spreads.js"
import { createUnlocks } from "./connectors/unlocks.js"
import {
  PRODUCTS, REGULAR, createTestPayments, extraSpreads, grant, loadWallet, newOrderId, renewDue, saveWallet, setRenew, subActive,
} from "./connectors/purchases.js"
import { normalizeQuestion, VERDICT_WORD, verdictOf, yesNo } from "./connectors/yesno.js"
import { accountMode, clearAccount, postJson, rememberAccount } from "./store.js"
import { boundLot, detectTopic, questionTopic } from "./connectors/topic.js"

const stage = document.querySelector("#stage")
const lightbox = document.querySelector("#lbox")
const audio = createAudioBus()
const unlocks = createUnlocks({ storage: localStorage })
const payments = createTestPayments()
let wallet = renewDue(loadWallet(localStorage))
saveWallet(localStorage, wallet)

const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"]
const MONTH_NAMES = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"]
const ARRIVED_KEY = "arkanum_arrived"
const SETTINGS_KEY = "tri_okna_settings"
const CONSENT_KEY = "tri_okna_consent"
const APP_VERSION = "189"
const SPREAD_LIMIT = 3
const FOLLOW_LIMIT = 3
const YESNO_LIMIT = 3
const YESNO_PROMPTS = [
  "Он мне напишет на этой неделе?",
  "Стоит ли соглашаться на это предложение?",
  "Получится ли переезд в этом году?",
]
const OWN_ASK = "Свой вопрос"
const LAND_MS = 1400
const LAND_STEP = 160
const LAND_TOUCH = 0
const STONE_FALL = [
  { delay: 0, ms: 740, x: 8, y: -22, rot: -18 },
  { delay: 90, ms: 700, x: 0, y: -18, rot: 16 },
  { delay: 160, ms: 780, x: -16, y: -18, rot: 32 },
]
// Удар о сукно — на 64% падения. В записи одного камня он на 330 мс, трёх — на 120 мс.
const STONE_HIT = 0.64
const STONE_ONE_PEAK = 330
const STONE_THREE_PEAK = 120
const COIN_YIN = "assets/coin-yin.webp?v=86"
const COIN_YANG = "assets/coin-yang.webp?v=84"
const HEX_ART = "97"
const HEX_EMPTY = `assets/hex-empty.webp?v=${HEX_ART}`
const HEX_FRAME = { w: 864, h: 1152, x0: 195, x1: 666, bars: [[261, 359], [376, 472], [488, 586], [601, 702], [714, 812], [831, 929]] }
const FLIP_MS = 450
const CARD_OATH = "Карты здесь не поддакивают. Спросите то, что и правда хотите узнать, а не то, что надеетесь услышать."
const CARD_REST = "На сегодня колода сказала достаточно. Все расклады на сегодня уже легли — карты отдыхают до полуночи."
const JOURNAL_HOME = "Журнал хранится только на этом телефоне. Если удалить приложение или очистить его данные, записи пропадут."
const SUITS = [
  { id: "major", name: "Старшие арканы" },
  { id: "cups", name: "Кубки" },
  { id: "wands", name: "Жезлы" },
  { id: "swords", name: "Мечи" },
  { id: "pentacles", name: "Пентакли" },
]
const BEATS = [
  {
    kicker: "Кто здесь",
    title: "У каждого своя тема",
    text: "Можно узнать про отношения, работу, свой путь и что говорят карты по дате рождения.",
  },
  {
    kicker: "Как гадают",
    title: "Несколько вопросов",
    text: "Вас спросят, как вас зовут, и запомнят. У стола будут готовые вопросы по его теме. Можно написать и свой, а после ответа — переспросить.",
  },
]
const ICONS = {
  hall: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V10l8-6 8 6v10"/><path d="M10 20v-6h4v6"/></svg>`,
  journal: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h11a1 1 0 0 1 1 1v15H7a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1z"/><path d="M5 18a2 2 0 0 1 2-2h11"/><path d="M9 8h6"/></svg>`,
  deck: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="4" width="11" height="16" rx="2"/><path d="M4.5 7.5 7 6.8M4.5 7.5l2.8 10.6"/></svg>`,
  me: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c1.2-3.6 3.9-5.5 7-5.5s5.8 1.9 7 5.5"/></svg>`,
}
const TABS = [
  { id: "hall", label: "Зал" },
  { id: "journal", label: "Журнал" },
  { id: "deck", label: "Колода" },
  { id: "me", label: "Вы" },
]

function loadSettings() {
  try {
    return { sound: true, haptics: true, candleDeck: true, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") }
  } catch {
    return { sound: true, haptics: true, candleDeck: true }
  }
}

const settings = loadSettings()
audio.setMuted(!settings.sound)
setHaptics(settings.haptics)

function saveSetting(key, value) {
  settings[key] = value
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

function consented() {
  try {
    return JSON.parse(localStorage.getItem(CONSENT_KEY) || "null")?.v >= CONSENT_VERSION
  } catch {
    return false
  }
}

const saved = loadProfile(localStorage)
const state = {
  screen: "arrive",
  beat: 0,
  heroId: null,
  sizeIdx: null,
  birthDate: saved?.dob ? isoFromDob(saved.dob) : "",
  name: saved?.name || "",
  question: "",
  pickedPrompt: "",
  follow: "",
  status: "",
  hallNote: "",
  spread: null,
  accountLeft: null,
  accountStore: null,
  googleClientId: "",
  appleClientId: "",
  laying: false,
  freshBubble: -1,
  yn: null,
  ynQuestion: "",
  ynStatus: "",
  ynFresh: false,
  consentTicked: false,
  doc: "privacy",
  docBack: "me",
  wipeArmed: false,
  pushReady: false,
  pushNote: "",
  pushBusy: false,
  checkout: null,
  shopBack: "me",
  plan: "regular_year",
  cameNote: "",
  moonFresh: false,
}

function knownProfile() {
  const profile = currentProfile()
  return Boolean(profile?.name && profile?.dob)
}

function entryScreen() {
  if (localStorage.getItem(ARRIVED_KEY) !== "1") return "arrive"
  return knownProfile() && consented() ? "hall" : "who"
}

state.screen = entryScreen()
if (location.hash === "#moon") {
  if (state.screen === "hall") state.screen = "moon"
  history.replaceState(null, "", location.pathname + location.search)
}

function isoFromDob(dob) {
  const [day, month, year] = dob
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function glueShortWords(value) {
  const safe = escapeHtml(value)
  return safe.replace(/(^|[\s(«"])(во|на|ко|со|об|по|из|от|до|за|про|для|но|в|к|с|о|у|и|а|не) /gi, "$1$2\u00A0")
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char])
}

function currentProfile() {
  return profileFrom({ name: state.name, birthDate: state.birthDate })
}

function hero() {
  return heroById(state.heroId)
}

function spreadsToday() {
  const today = todayKey()
  return loadJournal(localStorage).filter((entry) => entry.type === "spread" && entry.date === today).length
}

function regular() {
  return subActive(wallet)
}

function spreadLimit() {
  return (regular() ? REGULAR.spreads : SPREAD_LIMIT) + extraSpreads(wallet, todayKey())
}

function followLimit() {
  return regular() ? REGULAR.follow : FOLLOW_LIMIT
}

function spreadsLeft() {
  // Аккаунт магазина: лимит с сервера. Гость на публичном триале — без дневного потолка.
  if (state.accountLeft != null) return state.accountLeft
  if (state.accountStore) return Math.max(0, spreadLimit() - spreadsToday())
  return Infinity
}

const TIMES = ["", "один раз", "два раза", "три раза", "четыре раза"]
function timesWord(n) {
  return TIMES[n] || `${n} раз`
}

function spreadQuotaLine() {
  const left = spreadsLeft()
  if (left === Infinity) return "Раскладывайте без дневного счёта. Карта дня, «да или нет» и гороскоп по-прежнему рядом."
  if (left <= 0) return CARD_REST
  if (left < spreadLimit()) return `Сегодня колода ляжет ещё ${timesWord(left)}.`
  return `Сегодня колода ляжет ${timesWord(left)}. Карта дня, «да или нет», гороскоп и уточнения в счёт не идут.`
}

function resting() {
  return spreadsLeft() <= 0
}

function untilMidnight() {
  const now = new Date()
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  const minutes = Math.max(1, Math.ceil((midnight - now) / 6e4))
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (!hours) return `через ${rest} мин`
  return rest ? `через ${hours} ч ${rest} мин` : `через ${hours} ч`
}

function yesnoToday() {
  const today = todayKey()
  return loadJournal(localStorage).filter((entry) => entry.type === "yesno" && entry.date === today)
}

function yesnoLeft() {
  if (regular()) return Infinity
  return Math.max(0, YESNO_LIMIT - yesnoToday().length)
}

function cardsWord(n) {
  return n === 1 ? "карта" : n >= 2 && n <= 4 ? "карты" : "карт"
}

function questionsWord(n) {
  return n === 1 ? "вопрос" : n >= 2 && n <= 4 ? "вопроса" : "вопросов"
}

const REST_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 14.6A7.5 7.5 0 1 1 9.4 5a6 6 0 0 0 9.6 9.6z"/><path d="M16.5 3v3M15 4.5h3"/><path d="M20.5 8.5v2M19.5 9.5h2"/></svg>`
const YESNO_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="8" height="13" rx="1.5"/><rect x="12.5" y="5" width="8" height="13" rx="1.5"/><path d="m5.8 11.7 1.5 1.5 2.6-3"/><path d="m14.8 9.8 3.4 3.4m0-3.4-3.4 3.4"/></svg>`
const SKY_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l1.9 7.6 7.6 1.9-7.6 1.9-1.9 7.6-1.9-7.6-7.6-1.9 7.6-1.9z"/><path d="M5.6 5.6l2.5 2.5M18.4 5.6l-2.5 2.5M5.6 18.4l2.5-2.5M18.4 18.4l-2.5-2.5"/></svg>`

const PUSH_REASON = {
  server: "Сервер уведомлений сейчас не отвечает. Попробуйте позже.",
  denied: "Уведомления запрещены в настройках браузера для этого сайта. Разрешите их там и попробуйте снова.",
  dismissed: "Браузер не получил разрешения. Можно попробовать ещё раз.",
  "ios-home": "На iPhone уведомления приходят только таверне с экрана «Домой»: «Поделиться» → «На экран „Домой“», затем откройте её оттуда.",
  no: "Этот браузер не умеет получать уведомления.",
}

function pushOfferHtml() {
  if (!state.pushReady) return ""
  if (pushOn("rest")) return `<p class="push-on">Утром, после 10:00, придёт одно напоминание, что карты отдохнули.</p>`
  const support = pushSupport()
  if (support === "no") return ""
  if (support !== "ok") return `<p class="push-hint">${escapeHtml(PUSH_REASON[support])}</p>`
  return `<button class="push-ask" data-action="pushRest" type="button"${state.pushBusy ? " disabled" : ""}>Напомнить утром, когда карты отдохнут</button>
    ${state.pushNote ? `<p class="push-hint">${escapeHtml(state.pushNote)}</p>` : ""}`
}

function pushSettingsHtml() {
  if (!state.pushReady) {
    return `<div class="info"><p>Уведомления отправляет сервер таверны. В версии на GitHub Pages сервера нет, поэтому здесь их пока не включить.</p></div>`
  }
  const support = pushSupport()
  const prefs = pushPrefs()
  const on = (kind) => Boolean(prefs.endpoint && prefs.kinds?.[kind])
  const off = support !== "ok" && !prefs.endpoint
  const toggle = (kind, title, text) => `<label class="switch">
      <input type="checkbox" data-action="pushToggle" data-push="${kind}"${on(kind) ? " checked" : ""}${off || state.pushBusy ? " disabled" : ""} />
      <span><b>${title}</b>${text}</span>
    </label>`
  return `<div class="info push-box">
    <p>Не чаще раза в день и никогда ночью — только с 10:00 до 21:00.</p>
    ${toggle("rest", "Карты отдохнули", "Утром после дня, когда легли все три расклада. Если вы уже зашли сами — не придёт.")}
    ${toggle("moon", "Новолуние и полнолуние", "Вечером в день фазы, дважды в месяц.")}
    ${off && PUSH_REASON[support] ? `<p class="push-hint">${escapeHtml(PUSH_REASON[support])}</p>` : ""}
    ${prefs.endpoint ? `<button class="text-button push-test" data-action="pushTest" type="button">Прислать пробное уведомление</button>` : ""}
    ${state.pushNote ? `<p class="push-hint" role="status">${escapeHtml(state.pushNote)}</p>` : ""}
  </div>`
}

function restBanner() {
  return `<div class="rest-banner" role="status">
    <span class="rest-ico">${REST_ICON}</span>
    <span class="rest-copy">
      <b>Карты сказали всё на сегодня</b>
      <span>Все расклады на сегодня легли. Столы откроются в полночь — <span data-until>${untilMidnight()}</span>. Пока открыты карта дня, «да или нет» и гороскоп.</span>
      ${offerHtml()}
      ${pushOfferHtml()}
    </span>
  </div>`
}

const rub = (n) => `${n.toLocaleString("ru-RU")} ₽`
const dayMonth = (iso) => new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })

function offerHtml() {
  const pack = PRODUCTS.pack3
  return `<div class="offer">
    <button class="offer-pack" type="button" data-action="buy" data-sku="pack3" data-buzz="tap">
      <span><b>${escapeHtml(pack.title)}</b><span>Сегодня, до полуночи</span></span>
      <em>${rub(pack.price)}</em>
    </button>
    ${regular() ? "" : `<button class="text-button offer-sub" type="button" data-action="shop">Завсегдатай: ${REGULAR.spreads} раскладов в день — от ${rub(Math.round(PRODUCTS.regular_year.price / 12))} в месяц</button>`}
  </div>`
}

function perksHtml() {
  return `<ul class="perks">
    <li><b>${REGULAR.spreads} раскладов в день</b> вместо ${SPREAD_LIMIT}</li>
    <li><b>${REGULAR.follow} уточнений</b> к каждому раскладу вместо ${FOLLOW_LIMIT}</li>
    <li><b>«Да или нет» без счёта</b> — сколько захотите</li>
    <li>Продление отменяется в любой момент</li>
  </ul>`
}

const TEST_NOTE = "Тестовая оплата: деньги не списываются. Настоящая оплата появится позже."

function historyHtml() {
  if (!wallet.history.length) return ""
  const rows = wallet.history.slice(0, 12).map((row) => {
    const product = PRODUCTS[row.sku]
    const title = row.renewal ? `${product?.title || row.sku} · продление` : product?.title || row.sku
    return `<li><span><b>${escapeHtml(title)}</b><span>${escapeHtml(dayMonth(row.at))}${row.test ? " · тест" : ""}</span></span><em>${rub(row.price)}</em></li>`
  }).join("")
  return `<h2 class="section-title">История покупок</h2><ul class="receipts">${rows}</ul>`
}

function renderShop() {
  const active = regular()
  const sub = wallet.sub
  const status = active
    ? `<div class="sub-card is-on">
        <p class="meta">Вы завсегдатай</p>
        <h3>${sub.renew ? "Продлится" : "Действует до"} ${escapeHtml(dayMonth(sub.until))}</h3>
        <p>${escapeHtml(PRODUCTS[sub.sku].title)}. ${sub.renew ? `Следующее списание — ${rub(PRODUCTS[sub.sku].price)}.` : "Продление отменено, после этой даты лимиты вернутся к обычным."}</p>
        ${perksHtml()}
        <button class="secondary" type="button" data-action="renew" data-on="${sub.renew ? "0" : "1"}">${sub.renew ? "Отменить продление" : "Возобновить продление"}</button>
      </div>`
    : `<div class="sub-card">
        <p class="meta">Подписка</p>
        <h3>Завсегдатай таверны</h3>
        ${perksHtml()}
        <div class="plans" role="radiogroup" aria-label="Срок подписки">
          ${["regular_month", "regular_year"].map((sku) => {
            const product = PRODUCTS[sku]
            const on = state.plan === sku
            const save = sku === "regular_year" ? `<i>−${Math.round((1 - product.price / (PRODUCTS.regular_month.price * 12)) * 100)}%</i>` : ""
            return `<button class="plan${on ? " on" : ""}" type="button" role="radio" aria-checked="${on}" data-action="plan" data-sku="${sku}">
              <span>${escapeHtml(product.short)}${save}</span><b>${rub(product.price)}</b><small>${sku === "regular_year" ? `${rub(Math.round(product.price / 12))} в месяц` : "в месяц"}</small>
            </button>`
          }).join("")}
        </div>
        <button class="primary" type="button" data-action="buy" data-sku="${state.plan}">Оформить за ${rub(PRODUCTS[state.plan].price)}</button>
      </div>`
  const pack = PRODUCTS.pack3
  const extra = extraSpreads(wallet, todayKey())
  el(`<section class="page sub shop">
    <button class="back-link" data-action="shopBack" type="button" data-buzz="tap">‹ Назад</button>
    <header class="page-head">
      <p class="eyebrow">Покупки</p>
      <h1>Лавка таверны</h1>
      <p class="blurb">Бесплатно остаются ${SPREAD_LIMIT} расклада в день, карта дня, «да или нет» и гороскоп.</p>
    </header>
    <p class="test-note">${escapeHtml(TEST_NOTE)}</p>
    ${status}
    <div class="sub-card">
      <p class="meta">Разово</p>
      <h3>${escapeHtml(pack.title)}</h3>
      <p>${escapeHtml(pack.note)} Пригодится, когда вопрос не ждёт до завтра.${extra ? ` Сегодня уже докуплено: ${extra}.` : ""}</p>
      <button class="secondary" type="button" data-action="buy" data-sku="pack3">Купить за ${rub(pack.price)}</button>
    </div>
    <p class="quota">Покупки хранятся на этом телефоне. Когда появится вход через Яндекс ID или VK ID, они будут переезжать вместе с вами.</p>
    ${historyHtml()}
  </section>`)
}

function checkoutHtml() {
  const order = state.checkout
  const product = PRODUCTS[order.sku]
  const what = product.kind === "pack"
    ? `${product.spreads} расклада сверх сегодняшних. ${product.note}`
    : `${REGULAR.spreads} раскладов в день, ${REGULAR.follow} уточнений к раскладу и «да или нет» без счёта. ${product.note}`
  let body
  if (order.stage === "adult") {
    body = `<div class="pay-done is-bad" role="alert"><h3>Покупки — с ${ADULT_AGE} лет</h3><p>По дате рождения в профиле вам меньше ${ADULT_AGE}. Бесплатные расклады, карта дня, «да или нет» и гороскоп остаются открыты. Если дата указана неверно, исправьте её в разделе «Вы».</p></div>
      <button class="primary" type="button" data-action="closeCheckout">Понятно</button>`
  } else if (order.stage === "paying") {
    body = `<div class="pay-wait" role="status"><span class="spinner" aria-hidden="true"></span><p>Связываемся с банком…</p></div>`
  } else if (order.stage === "done") {
    const line = product.kind === "pack"
      ? `Колода ляжет ещё ${timesWord(spreadsLeft())} сегодня.`
      : `Вы завсегдатай до ${dayMonth(wallet.sub.until)}.`
    body = `<div class="pay-done" role="status"><p class="pay-mark" aria-hidden="true">✓</p><h3>Оплачено</h3><p>${escapeHtml(line)}</p></div>
      <button class="primary" type="button" data-action="closeCheckout">${product.kind === "pack" ? "К столам" : "Готово"}</button>`
  } else if (order.stage === "declined") {
    body = `<div class="pay-done is-bad" role="alert"><h3>Оплата не прошла</h3><p>Деньги не списаны. Попробуйте ещё раз или другую карту.</p></div>
      <button class="primary" type="button" data-action="pay">Попробовать ещё раз</button>
      <button class="text-button" type="button" data-action="closeCheckout">Закрыть</button>`
  } else {
    body = `<p class="pay-what">${escapeHtml(what)}</p>
      <p class="test-note">${escapeHtml(TEST_NOTE)}</p>
      <button class="primary" type="button" data-action="pay">Оплатить ${rub(product.price)}</button>
      <button class="text-button" type="button" data-action="closeCheckout">Отмена</button>
      <button class="text-button pay-fail" type="button" data-action="pay" data-decline="1">Проверить отказ банка</button>`
  }
  return `<div class="sheet-wrap" data-stage="${order.stage}">
    <div class="sheet-scrim"${order.stage === "paying" ? "" : ` data-action="closeCheckout"`}></div>
    <section class="sheet" role="dialog" aria-modal="true" aria-label="${escapeHtml(product.title)}">
      <p class="meta">${product.kind === "pack" ? "Разовая покупка" : "Подписка"}</p>
      <h2>${escapeHtml(product.title)}</h2>
      <p class="sheet-price">${rub(product.price)}</p>
      ${body}
    </section>
  </div>`
}

function extrasHtml(title) {
  const left = yesnoLeft()
  const sky = horoscope(currentProfile()?.sign || "")
  const ynLine = left === Infinity ? "Для завсегдатая — без счёта" : left ? `Осталось ${left} ${questionsWord(left)} на сегодня` : "На сегодня всё — завтра снова"
  return `<h2 class="section-title">${escapeHtml(title)}</h2>
    <div class="extras">
      <button class="extra" type="button" data-action="openYesNo" data-buzz="tap">
        <span class="extra-ico">${YESNO_ICON}</span>
        <span class="meta">Одна карта</span>
        <b>Да или нет</b>
        <span class="blurb">${escapeHtml(ynLine)}</span>
      </button>
      <button class="extra" type="button" data-action="openSky" data-buzz="tap">
        <span class="extra-ico">${SKY_ICON}</span>
        <span class="meta">Луна в ${escapeHtml(sky.moonIn)}</span>
        <b>Гороскоп на день</b>
        <span class="blurb">${sky.sign ? `Для ${escapeHtml(sky.signGen)} · ${escapeHtml(sky.date)}` : escapeHtml(sky.date)}</span>
      </button>
    </div>`
}

function accountHtml() {
  if (state.accountStore === "google") return `<p class="account">Колода помнит этот аккаунт Google Play.</p>`
  if (state.accountStore === "apple") return `<p class="account">Колода помнит этот аккаунт Apple.</p>`
  const buttons = []
  if (state.googleClientId) buttons.push(`<div id="google-signin"></div>`)
  if (state.appleClientId) buttons.push(`<button class="text-button" data-action="apple" type="button">Войти через Apple</button>`)
  if (!buttons.length) return ""
  return `<div class="account"><p>Войдите аккаунтом магазина — и три расклада останутся вашими, даже на новом телефоне.</p>${buttons.join("")}</div>`
}

const scripts = new Map()

function loadScript(src) {
  if (scripts.has(src)) return scripts.get(src)
  const pending = new Promise((resolve, reject) => {
    const node = document.createElement("script")
    node.src = src
    node.async = true
    node.onload = () => resolve()
    node.onerror = () => reject(new Error("script"))
    document.head.appendChild(node)
  })
  scripts.set(src, pending)
  return pending
}

function paintGoogle() {
  const host = stage.querySelector("#google-signin")
  if (!host || !state.googleClientId) return
  loadScript("https://accounts.google.com/gsi/client").then(() => {
    const googleId = window.google?.accounts?.id
    if (!stage.querySelector("#google-signin") || !googleId) return
    googleId.initialize({
      client_id: state.googleClientId,
      callback: (resp) => {
        if (!resp?.credential) return
        rememberAccount({ store: "google", token: resp.credential })
        state.accountStore = "google"
        refreshAccount().then(() => render())
      },
    })
    googleId.renderButton(host, {
      theme: "filled_black",
      size: "large",
      shape: "pill",
      text: "continue_with",
      locale: "ru",
    })
  }).catch(() => {})
}

async function refreshAccount() {
  const mode = await accountMode()
  if (mode.kind !== "store" || !mode.account) {
    state.accountLeft = null
    if (!mode.account) state.accountStore = null
    return mode
  }
  state.accountStore = mode.account.store
  try {
    const data = await postJson("/api/quota", { store: mode.account.store, token: mode.account.token })
    if (data?.ok) state.accountLeft = data.left
    else if (data?.reason === "bad-token" || data?.reason === "need-account") {
      clearAccount()
      state.accountLeft = null
      state.accountStore = null
    }
  } catch {
    /* sit закроет дверь, если зал не ответит */
  }
  return mode
}

async function takeSeat() {
  const mode = await accountMode()
  if (mode.kind !== "store") return { ok: true, local: true }
  if (!mode.account) return { ok: false, reason: "need-account" }
  let data
  try {
    data = await postJson("/api/spread", { store: mode.account.store, token: mode.account.token })
  } catch {
    return { ok: false, reason: "offline" }
  }
  if (data?.ok && data.ticket) {
    state.accountLeft = data.left
    state.accountStore = mode.account.store
    return { ok: true, ticket: data.ticket, account: mode.account }
  }
  if (data?.reason === "rest") state.accountLeft = 0
  if (data?.reason === "bad-token" || data?.reason === "need-account") {
    clearAccount()
    state.accountLeft = null
    state.accountStore = null
  }
  return { ok: false, reason: data?.reason || "offline" }
}

function seatNote(reason) {
  if (reason === "need-account") return "Сначала войдите через Google Play или Apple во вкладке «Вы». Колода помнит гостя по аккаунту магазина."
  if (reason === "bad-token") return "Колода не узнала этот вход. Войдите ещё раз во вкладке «Вы»."
  if (reason === "offline") return "Зал сейчас не дозваться. Повторите через минуту."
  return ""
}

function rememberProfile() {
  const profile = currentProfile()
  const kept = loadProfile(localStorage)
  if (profile && !profile.dob && kept?.dob) {
    saveProfile(localStorage, { ...kept, name: profile.name })
    return
  }
  saveProfile(localStorage, profile)
}

function spokenBirth(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "")
  if (!match) return ""
  const month = MONTHS[+match[2] - 1]
  if (!month) return ""
  return `${+match[3]} ${month} ${match[1]}`
}

const BIRTH_TEXT = {
  future: "Эта дата ещё не наступила — проверьте год.",
  "no-such-day": "Такого дня нет в этом месяце.",
  "too-old": `Год — четыре цифры, не раньше ${BIRTH_MIN_YEAR}.`,
}

function guestAge() {
  return ageOn(state.birthDate)
}

function consentLabel() {
  const age = guestAge()
  return age !== null && age < PARENT_AGE
    ? `Я родитель или законный представитель и соглашаюсь на обработку данных ребёнка — ему меньше ${PARENT_AGE} лет`
    : "Соглашаюсь на обработку персональных данных"
}

function birthProblem() {
  return BIRTH_TEXT[birthIssue(state.birthDate)] || ""
}

function birthLine() {
  const profile = currentProfile()
  if (profile?.sign) return `${spokenBirth(state.birthDate)} — ${profile.sign}`
  return birthProblem() || "День, потом месяц, потом год"
}

function daysIn(year, month) {
  return new Date(year || 2000, month, 0).getDate()
}

// Подсказки браузеру: год не позже текущего, будущие месяцы и дни недоступны. Решает всё равно birthIssue.
function limitBirth(day, month, year) {
  const now = new Date()
  const y = +year.value
  const thisYear = y === now.getFullYear()
  month.querySelectorAll("option[value]").forEach((option) => {
    if (option.value) option.disabled = thisYear && +option.value > now.getMonth() + 1
  })
  const m = +month.value
  const thisMonth = thisYear && m === now.getMonth() + 1
  day.max = String(m ? (thisMonth ? now.getDate() : daysIn(y, m)) : 31)
}

function birthFields() {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(state.birthDate || "")
  const year = match ? match[1] : ""
  const month = match ? String(+match[2]) : ""
  const day = match ? String(+match[3]) : ""
  const options = MONTH_NAMES.map((name, index) => {
    const value = String(index + 1)
    return `<option value="${value}"${value === month ? " selected" : ""}>${name}</option>`
  }).join("")
  const bad = birthProblem() ? ' aria-invalid="true"' : ""
  return `<div class="birth">
    <label>День<input id="bday" type="number" min="1" max="31" inputmode="numeric" value="${escapeHtml(day)}"${bad} /></label>
    <label>Месяц<select id="bmonth"${bad}><option value="">месяц</option>${options}</select></label>
    <label>Год<input id="byear" type="number" min="${BIRTH_MIN_YEAR}" max="${new Date().getFullYear()}" inputmode="numeric" value="${escapeHtml(year)}"${bad} /></label>
  </div>
  <p class="birth-read${birthProblem() ? " is-bad" : ""}" aria-live="polite">${escapeHtml(birthLine())}</p>`
}

function bindBirth() {
  const day = stage.querySelector("#bday")
  const month = stage.querySelector("#bmonth")
  const year = stage.querySelector("#byear")
  if (!day || !month || !year) return
  const sync = () => {
    const d = +day.value
    const m = +month.value
    const y = +year.value
    state.birthDate = d && m && y ? `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` : ""
    limitBirth(day, month, year)
    const read = stage.querySelector(".birth-read")
    if (read) {
      read.textContent = birthLine()
      read.classList.toggle("is-bad", Boolean(birthProblem()))
    }
    const bad = Boolean(birthProblem())
    for (const field of [day, month, year]) field.setAttribute("aria-invalid", String(bad))
    const label = stage.querySelector("#consent-label")
    if (label) label.textContent = consentLabel()
    const profile = currentProfile()
    if (profile?.name && profile?.dob) rememberProfile()
    const wrap = stage.querySelector("#fate-arcana")
    if (wrap) {
      const next = document.createElement("div")
      next.innerHTML = fateArcanaHtml()
      wrap.replaceWith(next.firstElementChild)
      wire(stage.querySelector("#fate-arcana"))
    }
  }
  limitBirth(day, month, year)
  for (const field of [day, month, year]) {
    field.addEventListener("change", sync)
    field.addEventListener("input", sync)
  }
}

function wire(root) {
  root.querySelectorAll("[data-action]").forEach((node) => {
    node.addEventListener("click", () => {
      if (node.dataset.buzz === "tap") buzz(BUZZ.tap)
      actions[node.dataset.action](node)
    })
  })
}

const ASK_BOX = `autocomplete="off" autocorrect="off" autocapitalize="sentences" spellcheck="false" writingsuggestions="false" enterkeyhint="enter"`

function syncPromptChips(fieldId, action) {
  const field = stage.querySelector(fieldId)
  const typed = (field?.value || "").trim()
  const picked = action === "prompt" ? state.pickedPrompt.trim() : ""
  const text = typed || picked
  stage.querySelectorAll(`[data-action='${action}']`).forEach((btn) => {
    btn.classList.toggle("on", !typed && btn.dataset.text === text)
  })
}

function bindField(selector, key, after) {
  const field = stage.querySelector(selector)
  if (!field) return
  field.value = state[key]
  field.addEventListener("focus", () => {
    window.setTimeout(() => field.scrollIntoView({ block: "center", behavior: "smooth" }), 50)
  })
  field.addEventListener("input", () => {
    state[key] = field.value
    if (after) after()
  })
}

function el(html) {
  stage.innerHTML = html
  wire(stage)
  bindBirth()
  bindField("#name", "name", rememberProfile)
  bindField("#question", "question", () => {
    state.status = ""
    syncPromptChips("#question", "prompt")
  })
  bindField("#follow", "follow")
  bindField("#yn", "ynQuestion", () => {
    state.ynStatus = ""
    syncPromptChips("#yn", "ynPrompt")
  })
  stage.querySelector("#consent")?.addEventListener("change", (event) => {
    state.consentTicked = event.target.checked
  })
  bindFaces(stage)
  bindCash(stage)
  bindGua(stage)
  revealImages(stage)
  paintGoogle()
}

function revealImages(root) {
  root.querySelectorAll("img.fade").forEach((img) => {
    if (img.complete && img.naturalWidth) img.classList.add("is-loaded")
    else img.addEventListener("load", () => img.classList.add("is-loaded"), { once: true })
  })
}

function hideBoot() {
  const splash = document.getElementById("boot")
  if (!splash || splash.dataset.leaving) return
  splash.dataset.leaving = "1"
  const wait = Math.max(0, 450 - performance.now())
  setTimeout(() => {
    splash.classList.add("gone")
    setTimeout(() => splash.remove(), 450)
  }, wait)
}

function bindFaces(root) {
  root.querySelectorAll("img[data-src]").forEach((img) => {
    const fail = () => {
      const next = img.dataset.fallback
      img.dataset.fallback = ""
      if (next && !img.src.endsWith(next)) {
        img.src = next
        return
      }
      if (img.classList.contains("face")) {
        img.closest(".card, .daily-flip, .jthumb, .lbox-card, .dthumb")?.classList.add("no-art")
      }
    }
    img.addEventListener("error", fail)
    img.src = img.dataset.src
    if (img.complete && img.naturalWidth === 0) fail()
  })
}

function showLightbox(card, role, art = "arkanum", topic = null) {
  const profile = currentProfile()
  const advice = topic ? cardAdvice(card, topic) : ""
  const personal = profile?.sign && byId(card.id) ? personalize(card, profile) : ""
  const goldenDawn = cardCorrespondence(card.id)
  const hex = art === "hex" || card?.lines
  const from = state.spread?.cards?.find((item) => item.card?.id === card.id)
  const portrait = hex
    ? guaPlateHtml(card, from)
    : cardArt(card, art)
  const rune = art === "rune" || card?.kind === "rune"
  const copy = `<div class="lbox-name">${escapeHtml(card.name)}</div>
    <div class="lbox-pos">${escapeHtml(role)}${card.hint || card.sky ? ` · ${escapeHtml(card.hint || card.sky)}` : ""}</div>
    ${goldenDawn && !rune ? `<div class="lbox-gd">Золотая заря: ${escapeHtml(goldenDawn)}</div>` : ""}
    <p class="lbox-mean">${escapeHtml(card.meaning || card.line || "")}${advice ? ` Совет карты: ${escapeHtml(advice)}` : ""}</p>
    ${personal ? `<p class="lbox-pers">${escapeHtml(personal)}</p>` : ""}
    <button class="text-button" type="button" data-close="1">Закрыть</button>`
  lightbox.innerHTML = `<div class="lbox-card${rune ? " is-rune" : ""}${hex ? " is-gua" : ""}">
    ${portrait}
    ${rune ? `<div class="lbox-copy">${copy}</div>` : copy}
  </div>`
  lightbox.classList.remove("hidden")
  bindFaces(lightbox)
  lightbox.querySelector("[data-close]").addEventListener("click", () => lightbox.classList.add("hidden"))
}

lightbox.addEventListener("click", (event) => {
  if (event.target === lightbox) lightbox.classList.add("hidden")
})

function laidCard(item) {
  return byId(item.card.id) || hexById(item.card.id) || runeById(item.card.id) || item.card
}

function allOpen(spread) {
  return Boolean(spread) && !spread.casting && spread.open.every(Boolean)
}

function entryFor(spread) {
  return {
    laid: spread.cards.map((item) => ({
      role: item.role,
      id: item.card.id,
      name: laidCard(item).name,
      changing: item.changing || [],
      vacant: Boolean(item.vacant),
    })),
    throws: spread.throws || null,
    moving: spread.moving || [],
    reading: {
      title: spread.reading.title,
      lead: spread.reading.lead,
      items: spread.reading.items || [],
      note: spread.reading.note || "",
    },
    tell: spread.tell || 0,
  }
}

function spreadFromEntry(entry) {
  const laid = (entry.laid || []).map((item) => ({
    role: item.role,
    card: byId(item.id) || hexById(item.id) || runeById(item.id) || cardById(item.id) || { id: item.id, name: item.name },
    changing: item.changing || [],
    vacant: Boolean(item.vacant),
  }))
  const reading = { ...(entry.reading || { title: "Карты ответили", lead: "", items: [] }) }
  if (entry.speech) reading.speech = entry.speech
  if (entry.reading?.voiced) reading.voiced = true
  return {
    id: laid.some((item) => item.card?.lines) ? "hexagram" : laid.some((item) => item.card?.kind === "rune") ? "runes" : undefined,
    cards: laid,
    question: entry.q || "",
    topic: entry.topic || null,
    tell: entry.tell || 0,
    heroTopic: entry.heroTopic !== undefined ? entry.heroTopic : undefined,
    reading,
    throws: entry.throws || null,
    moving: entry.moving || [],
    entryId: entry.id,
    open: laid.map(() => true),
    casting: false,
    castStep: 6,
    thread: Array.isArray(entry.thread) ? entry.thread.map((item) => ({ ...item })) : [],
    fresh: false,
    seat: null,
  }
}

function latestTable() {
  const today = todayKey()
  const yesterday = todayKey(new Date(Date.now() - 864e5))
  const entry = loadJournal(localStorage).find((item) => item.type === "spread" && item.laid && item.hero)
  if (!entry || (entry.date !== today && entry.date !== yesterday)) return null
  return { entry, when: entry.date === today ? "Сегодня" : "Вчера" }
}

function openTable(person, spread = null) {
  state.heroId = person.id
  state.sizeIdx = null
  state.status = ""
  state.follow = ""
  if (!spread) {
    state.question = ""
    state.pickedPrompt = ""
  }
  state.spread = spread
  audio.load(person.audio)
  if (person.spreadId === "runes") audio.warmStoneFlip().catch(() => {})
  else if (person.spreadId !== "hexagram") {
    audio.warmFlip().catch(() => {})
    audio.warmLay().catch(() => {})
  }
  state.screen = unlocks.canUse(person) ? "table" : "lock"
  render()
  window.scrollTo(0, 0)
}

function laidCaption(name) {
  return name === "Справедливость" ? "Справед\u00ADливость" : name
}

function flipNode(node, spread, index) {
  spread.open[index] = true
  node.classList.remove("is-down")
  const label = node.querySelector(".laid-name")
  if (label) label.textContent = laidCaption(laidCard(spread.cards[index]).name)
  const stone = node.classList.contains("is-rune") || laidCard(spread.cards[index])?.kind === "rune"
  if (stone) audio.playStoneFlip().catch(() => {})
  else audio.playFlip().catch(() => {})
  buzz(BUZZ.flip)
}

function afterFlip(spread) {
  if (!allOpen(spread)) return
  window.setTimeout(() => {
    if (state.spread !== spread || state.screen !== "table") return
    askVoice(spread)
    render()
  }, FLIP_MS + 30)
}

function applyVoiceReading(spread, data) {
  const items = Array.isArray(data?.items) ? data.items : []
  const note = data?.note ? String(data.note).trim() : ""
  const speech = data?.speech ? String(data.speech).trim() : ""
  if (items.length) {
    const base = spread.reading.items || []
    const sky = spread.id === "decan" && spread.cards[0]?.note ? spread.cards[0].note : ""
    spread.reading.items = items.map((item, index) => {
      // У Линь первая дощечка стоит во вступлении, поэтому прежний блок ищем по позиции, а не по номеру.
      const prev = base.find((entry) => entry.role && entry.role === item.role) || (base.length === items.length ? base[index] : null) || {}
      const role = item.role || prev.role || ""
      const name = item.name || prev.name || ""
      const said = String(item.body || "").trim()
      return {
        ...prev,
        role,
        name,
        open: item.open || prev.open || (role && name ? `${role} — ${name}.` : name || role),
        body: said ? (sky && index === 0 ? `${sky} ${said}` : said) : (prev.body || ""),
        // После голоса модели стихии/Золотую зарю из офлайн-текста не оставляем.
        personal: "",
      }
    })
    const prior = [spread.reading.lead, ...spread.reading.items.map((item) => item.body)].filter(Boolean).join("\n")
    const cleanNote = dropEcho(note, prior)
    if (cleanNote) spread.reading.note = cleanNote
    spread.reading.voiced = true
    spread.reading.lead = ""
    const person = hero()
    if (person?.id === "einar") spread.reading.layout = "runes"
    else if (person?.id !== "lin") spread.reading.layout = "cards"
    else spread.reading.layout = "cards"
    const preview = cleanNote || items.map((item) => item.body).filter(Boolean).join(" ")
    if (preview) spread.reading.speech = preview
    patchEntry(localStorage, spread.entryId, {
      speech: preview,
      reading: {
        title: spread.reading.title,
        lead: "",
        items: spread.reading.items,
        note: spread.reading.note || "",
        layout: spread.reading.layout,
        voiced: true,
      },
    })
    return true
  }
  if (speech) {
    spread.reading.speech = speech
    patchEntry(localStorage, spread.entryId, { speech })
    return true
  }
  return false
}

function askVoice(spread) {
  if (!spread?.reading || spread.voiceAsked || spread.reading.voiced || spread.reading.speech) return
  const person = hero()
  spread.voiceAsked = true
  spread.reading.pending = true
  const profile = spread.profile || currentProfile()
  const topic = voiceTopic(spread)
  const payload = {
    hero: person?.id || "",
    question: spread.question || "",
    name: profile?.name || "",
    sign: profile?.sign || "",
    cards: voiceCards(spread),
  }
  const side = voiceSide(spread)
  if (side) payload.side = side
  if (topic) payload.topic = topic
  if (spread.seat?.ticket && spread.seat.account) {
    payload.store = spread.seat.account.store
    payload.token = spread.seat.account.token
    payload.ticket = spread.seat.ticket
  }
  postJson("/api/reading", payload).then((data) => {
    spread.reading.pending = false
    if (data?.ok) applyVoiceReading(spread, data)
    if (state.spread === spread && state.screen === "table") render()
  }).catch(() => {
    spread.reading.pending = false
    if (state.spread === spread && state.screen === "table") render()
  })
}

function threadPayload(spread) {
  return spread.thread.filter((item) => item.a).map((item) => ({ q: item.q, a: item.a }))
}

function leaveEntrance() {
  localStorage.setItem(ARRIVED_KEY, "1")
  state.screen = knownProfile() && consented() ? "hall" : "who"
  render()
}

const actions = {
  story() {
    state.beat = 0
    state.screen = "story"
    render()
  },
  nextBeat() {
    if (state.beat < BEATS.length - 1) {
      state.beat += 1
      render()
      return
    }
    leaveEntrance()
  },
  saveWho() {
    const name = stage.querySelector("#name")
    if (name) state.name = name.value
    const profile = currentProfile()
    if (!state.name.trim()) {
      state.hallNote = "Напишите, как к вам обращаться."
      render()
      stage.querySelector("#name")?.focus()
      return
    }
    if (!profile?.dob) {
      state.hallNote = birthProblem() || "Нужен день рождения: число, месяц и год. Так вас узнают в следующий раз."
      render()
      return
    }
    if (!consented()) {
      if (!stage.querySelector("#consent")?.checked) {
        state.hallNote = "Отметьте согласие на обработку данных — без него таролог не сможет ответить на вопрос."
        render()
        return
      }
      const age = guestAge()
      localStorage.setItem(CONSENT_KEY, JSON.stringify({ v: CONSENT_VERSION, at: new Date().toISOString(), parent: age !== null && age < PARENT_AGE }))
    }
    state.hallNote = ""
    rememberProfile()
    state.screen = "hall"
    audio.warmFlip().catch(() => {})
    render()
  },
  tab(node) {
    lightbox.classList.add("hidden")
    state.wipeArmed = false
    state.screen = node.dataset.tab
    if (node.dataset.tab === "hall") audio.warmFlip().catch(() => {})
    render()
    window.scrollTo(0, 0)
  },
  open(node) {
    const person = heroById(node.dataset.id)
    if (person) openTable(person)
  },
  resume(node) {
    const entry = loadJournal(localStorage).find((item) => item.id === node.dataset.id)
    const person = entry ? heroById(entry.hero) : null
    if (!entry || !person || !entry.laid) return
    openTable(person, spreadFromEntry(entry))
  },
  home() {
    state.heroId = null
    state.spread = null
    state.status = ""
    audio.load({ theme: "hall" })
    state.screen = "hall"
    audio.warmFlip().catch(() => {})
    render()
    window.scrollTo(0, 0)
  },
  size(node) {
    state.sizeIdx = +node.dataset.index
    stage.querySelectorAll("[data-action='size']").forEach((btn) => {
      const on = btn === node
      btn.classList.toggle("on", on)
      btn.setAttribute("aria-pressed", on ? "true" : "false")
    })
    const gives = stage.querySelector(".size-gives")
    if (gives) gives.textContent = hero()?.sizes[state.sizeIdx]?.gives || ""
  },
  prompt(node) {
    state.pickedPrompt = node.dataset.text
    state.question = ""
    state.status = ""
    const field = stage.querySelector("#question")
    if (field) field.value = ""
    syncPromptChips("#question", "prompt")
  },
  async sit() {
    if (state.laying) return
    const field = stage.querySelector("#question")
    if (field) state.question = field.value
    const question = (state.question.trim() || state.pickedPrompt.trim())
    if (question.length < 3) {
      state.status = "Выберите готовый вопрос или напишите свой."
      render()
      return
    }
    await refreshAccount()
    if (spreadsLeft() <= 0) {
      buzz(BUZZ.rest)
      state.status = CARD_REST
      render()
      return
    }
    state.laying = true
    const seated = hero()
    if (seated?.spreadId === "runes") {
      audio.warmStone(sizeOf(seated, state.sizeIdx)?.count || 1).catch(() => {})
    }
    try {
      const seat = await takeSeat()
      if (!seat.ok) {
        if (seat.reason === "rest") buzz(BUZZ.rest)
        state.status = seat.reason === "rest" ? CARD_REST : seatNote(seat.reason)
        render()
        return
      }
      const person = hero()
      const size = sizeOf(person, state.sizeIdx)
      const spread = laySpread(person, {
        birthDate: state.birthDate,
        name: state.name.trim(),
        question,
        roles: size?.roles || undefined,
      })
      spread.heroTopic = person.topic
      spread.entryId = Date.now().toString(36)
      spread.open = spread.cards.map((_, index) => person.spreadId === "hexagram" || (person.spreadId === "decan" && index === 0))
      spread.casting = person.spreadId === "hexagram"
      spread.castStep = 0
      spread.tossing = false
      spread.coinPose = null
      spread.thread = []
      spread.fresh = true
      spread.seat = seat
      saveJournal(localStorage, {
        id: spread.entryId,
        type: "spread",
        date: todayKey(),
        hero: person.id,
        size: size?.name || "",
        topic: spread.topic || null,
        heroTopic: person.topic,
        cards: spread.cards.filter((item) => !item.vacant).map((item) => item.card.id),
        q: question,
        thread: [],
        ...entryFor(spread),
      })
      rememberProfile()
      if (resting()) notePushRest()
      state.spread = spread
      state.status = ""
      state.follow = ""
      render()
      spread.fresh = false
      if (person.spreadId === "hexagram") {
        buzz(BUZZ.tap)
        audio.warmToss().catch(() => {})
      } else if (person.spreadId === "runes") {
        let landed = 0
        spread.cards.forEach((_, i) => {
          const fall = STONE_FALL[i] || STONE_FALL[0]
          landed = Math.max(landed, fall.delay + fall.ms)
        })
        const first = STONE_FALL[0]
        if (spread.cards.length === 1) {
          audio.playStone(Math.round(first.ms * STONE_HIT - STONE_ONE_PEAK), 1).catch(() => {})
        } else if (spread.cards.length === 3) {
          audio.playStone(Math.round(first.delay + first.ms * STONE_HIT - STONE_THREE_PEAK), 3).catch(() => {})
        } else {
          spread.cards.forEach((_, i) => {
            const fall = STONE_FALL[i] || STONE_FALL[0]
            audio.playLay(fall.delay + 70).catch(() => {})
          })
        }
        window.setTimeout(() => {
          if (state.spread !== spread) return
          buzz(BUZZ.landed)
        }, landed)
      } else {
        const landed = (spread.cards.length - 1) * LAND_STEP + LAND_MS
        spread.cards.forEach((_, i) => {
          audio.playLay(i * LAND_STEP + LAND_TOUCH + Math.random() * 25).catch(() => {})
        })
        window.setTimeout(() => {
          if (state.spread !== spread) return
          buzz(BUZZ.landed)
        }, landed)
      }
    } catch {
      state.status = seatNote("offline")
      render()
    } finally {
      state.laying = false
    }
  },
  toss() {
    const spread = state.spread
    if (!spread?.casting || spread.tossing) return
    const now = performance.now()
    if (now - lastTossAt < 120) return
    const step = spread.castStep || 0
    const row = spread.throws?.[step]
    if (!row) return
    const cash = stage.querySelector(".cash")
    if (!cash) return
    lastTossAt = now
    spread.tossing = true
    cash.classList.add("is-tossing")
    cash.classList.remove("is-wait")
    const note = stage.querySelector(".cast-live")
    if (note) note.textContent = `Бросок ${step + 1} из 6 — монеты в воздухе.`
    const kicker = stage.querySelector(".cast-kicker")
    if (kicker) kicker.textContent = `Бросок ${step + 1} из 6`
    const chip = stage.querySelector(".cast-chip")
    if (chip) chip.textContent = "Монеты ещё крутятся."
    buzz(BUZZ.toss)
    audio.playToss(0).catch(() => {})
    const release = () => {
      spread.tossing = false
      const node = stage.querySelector(".cash")
      if (!node || spread.castStep >= 6) return
      node.classList.remove("is-tossing")
      node.classList.add("is-wait", "is-scattered")
      node.setAttribute("data-action", "toss")
      node.setAttribute("aria-label", `Бросить монеты, бросок ${(spread.castStep || 0) + 1} из 6`)
    }
    try {
      flyCoins(cash, row, (poses) => {
        if (state.spread !== spread) return
        spread.coinPose = poses
        spread.castStep = step + 1
        spread.tossing = false
        paintCoinPose(stage.querySelector(".cash"), poses)
        if (spread.castStep >= 6) {
          spread.casting = false
          buzz(BUZZ.landed)
          askVoice(spread)
          render()
          return
        }
        release()
        try {
          patchCastUi(spread)
        } catch {
          release()
        }
      })
    } catch {
      release()
    }
  },
  flip(node) {
    const spread = state.spread
    const index = +node.dataset.index
    if (!spread) return
    if (spread.open[index]) {
      const card = laidCard(spread.cards[index])
      showLightbox(card, spread.cards[index].role, deckById(hero().deckId).art, spread.topic)
      return
    }
    flipNode(node, spread, index)
    afterFlip(spread)
  },
  flipAll() {
    const spread = state.spread
    if (!spread) return
    const closed = [...stage.querySelectorAll(".card.laid.is-down")]
    closed.forEach((node, order) => {
      window.setTimeout(() => {
        if (state.spread !== spread) return
        flipNode(node, spread, +node.dataset.index)
        if (order === closed.length - 1) afterFlip(spread)
      }, order * 160)
    })
  },
  async follow() {
    const spread = state.spread
    const person = hero()
    if (!spread || !person) return
    const field = stage.querySelector("#follow")
    const text = (field ? field.value : state.follow).trim()
    if (text.length < 3) {
      field?.focus()
      return
    }
    if (spread.thread.length >= followLimit() || spread.thread.some((item) => !item.a)) return
    buzz(BUZZ.tap)
    const prior = threadPayload(spread)
    const turn = spread.thread.length
    spread.thread.push({ q: text, a: null })
    state.follow = ""
    state.freshBubble = turn * 2
    render()
    const profile = spread.profile || currentProfile()
    const payload = {
      hero: person.id,
      question: spread.question || "",
      followup: text,
      thread: prior,
      name: profile?.name || "",
      sign: profile?.sign || "",
      cards: voiceCards(spread, text),
      topic: voiceTopic(spread, text),
    }
    if (spread.seat?.ticket && spread.seat.account) {
      payload.store = spread.seat.account.store
      payload.token = spread.seat.account.token
      payload.ticket = spread.seat.ticket
    }
    let answer = ""
    try {
      const data = await postJson("/api/followup", payload)
      if (data?.ok && data.speech) answer = String(data.speech).trim()
    } catch {
      /* без голоса отвечает колода */
    }
    const already = [
      spread.reading?.lead,
      ...(spread.reading?.items || []).map((item) => item.body),
      spread.reading?.note,
      ...spread.thread.filter((item) => item.a).map((item) => item.a),
    ].filter(Boolean).join("\n")
    if (answer) answer = dropEcho(answer, already)
    if (!answer) answer = followupAnswer(spread.cards.map((item) => ({ id: item.card.id, role: item.role })), text, turn + 1, spread.topic)
    answer = dropEcho(answer, already) || answer
    spread.thread[turn].a = answer
    patchEntry(localStorage, spread.entryId, { thread: spread.thread })
    if (state.spread !== spread || state.screen !== "table") return
    state.freshBubble = turn * 2 + 1
    render()
  },
  reset() {
    state.spread = null
    state.question = ""
    state.pickedPrompt = ""
    state.follow = ""
    state.status = ""
    render()
    window.scrollTo(0, 0)
  },
  doc(node) {
    if (state.screen === "who") {
      const name = stage.querySelector("#name")
      if (name) state.name = name.value
    }
    if (state.screen !== "doc") state.docBack = state.screen
    state.doc = node.dataset.doc
    state.screen = "doc"
    render()
    window.scrollTo(0, 0)
  },
  docBack() {
    state.screen = state.docBack || "me"
    render()
    window.scrollTo(0, 0)
  },
  setting(node) {
    const key = node.dataset.key
    saveSetting(key, node.checked)
    if (key === "sound") {
      audio.setMuted(!node.checked)
      if (node.checked) audio.playCard().catch(() => {})
    }
    if (key === "haptics") {
      setHaptics(node.checked)
      buzz(BUZZ.tap)
    }
  },
  async wipe() {
    if (!state.wipeArmed) {
      state.wipeArmed = true
      render()
      return
    }
    try {
      await disablePush()
    } catch {
      /* подписку уже снял браузер */
    }
    localStorage.clear()
    sessionStorage.clear()
    window.location.reload()
  },
  async pushRest() {
    if (state.pushBusy) return
    state.pushBusy = true
    state.pushNote = ""
    render()
    let result
    try {
      result = await enablePush({ rest: true })
    } catch {
      result = { ok: false, reason: "server" }
    }
    state.pushBusy = false
    if (result.ok) {
      buzz(BUZZ.landed)
      notePushRest()
    } else {
      state.pushNote = PUSH_REASON[result.reason] || ""
    }
    render()
  },
  async pushToggle(node) {
    if (state.pushBusy) return
    const kind = node.dataset.push
    const want = node.checked
    state.pushBusy = true
    state.pushNote = ""
    let result
    try {
      result = await setPushKinds({ [kind]: want })
    } catch {
      result = { ok: false, reason: "server" }
    }
    state.pushBusy = false
    if (result.ok) {
      if (want) buzz(BUZZ.tap)
      if (want && kind === "rest" && resting()) notePushRest()
    } else {
      state.pushNote = PUSH_REASON[result.reason] || ""
    }
    render()
  },
  async pushTest() {
    state.pushNote = "Отправляем…"
    render()
    const result = await testPush()
    state.pushNote = result.ok
      ? "Отправлено. Если уведомление не появилось, проверьте, не выключены ли они для браузера в настройках телефона."
      : result.reason === "limit"
        ? "Пробных уведомлений на сегодня хватит — три уже отправлено."
        : PUSH_REASON.server
    render()
  },
  openYesNo() {
    lightbox.classList.add("hidden")
    state.yn = null
    state.ynQuestion = ""
    state.ynStatus = ""
    state.screen = "yesno"
    audio.warmFlip().catch(() => {})
    render()
    window.scrollTo(0, 0)
  },
  openSky() {
    lightbox.classList.add("hidden")
    state.screen = "sky"
    render()
    window.scrollTo(0, 0)
  },
  openMoon() {
    lightbox.classList.add("hidden")
    state.screen = "moon"
    audio.warmFlip().catch(() => {})
    audio.warmLay().catch(() => {})
    render()
    window.scrollTo(0, 0)
  },
  layMoon() {
    const event = moonWindow()
    if (!event || moonEntry(event.key)) {
      render()
      return
    }
    const spread = layMoon(event, state.name)
    saveJournal(localStorage, {
      id: Date.now().toString(36),
      type: "moon",
      date: todayKey(),
      key: event.key,
      phase: event.phase,
      sign: event.sign,
      cards: spread.cards.map((item) => item.card.id),
      laid: spread.cards.map((item) => ({ role: item.role, id: item.card.id, name: item.card.name })),
    })
    state.moonFresh = true
    render()
    state.moonFresh = false
    spread.cards.forEach((_, index) => {
      audio.playLay(index * LAND_STEP + LAND_TOUCH).catch(() => {})
      window.setTimeout(() => {
        stage.querySelectorAll(".moon-card .daily-flip")[index]?.classList.remove("is-down")
        audio.playFlip().catch(() => {})
        buzz(BUZZ.flip)
      }, 420 + index * 380)
    })
  },
  came(node) {
    const outcome = node.dataset.came
    if (!OUTCOME_WORD[outcome]) return
    patchEntry(localStorage, node.dataset.id, { came: outcome, cameAt: todayKey() })
    if (state.screen === "hall") state.cameNote = OUTCOME_REPLY[outcome]
    render()
  },
  cameLater(node) {
    patchEntry(localStorage, node.dataset.id, { later: addDays(todayKey(), LATER_DAYS) })
    render()
  },
  ynPrompt(node) {
    state.ynQuestion = node.dataset.text
    state.ynStatus = ""
    const field = stage.querySelector("#yn")
    if (field) {
      field.value = state.ynQuestion
      field.focus()
      const end = field.value.length
      field.setSelectionRange(end, end)
    }
    syncPromptChips("#yn", "ynPrompt")
  },
  ynAgain() {
    state.yn = null
    state.ynQuestion = ""
    state.ynStatus = ""
    render()
    stage.querySelector("#yn")?.focus()
  },
  askYesNo() {
    const field = stage.querySelector("#yn")
    if (field) state.ynQuestion = field.value
    const question = state.ynQuestion.trim()
    if (question.length < 3) {
      state.ynStatus = "Выберите готовый вопрос или напишите свой: ясно, про отношения это или про работу."
      render()
      stage.querySelector("#yn")?.focus()
      return
    }
    const asked = yesnoToday().find((entry) => normalizeQuestion(entry.q) === normalizeQuestion(question))
    const result = { ...yesNo(question, { name: state.name, day: todayKey() }), question }
    if (asked) {
      state.ynStatus = "Этот вопрос сегодня уже задан — карта та же, и вопрос не потрачен."
    } else {
      if (yesnoLeft() <= 0) {
        state.ynStatus = "Три вопроса на сегодня заданы. Завтра колода ответит снова."
        render()
        return
      }
      saveJournal(localStorage, { id: Date.now().toString(36), type: "yesno", date: todayKey(), cards: [result.card.id], q: question })
      state.ynStatus = ""
    }
    state.yn = result
    state.ynFresh = true
    render()
    state.ynFresh = false
    window.setTimeout(() => {
      stage.querySelector(".yn-card .daily-flip")?.classList.remove("is-down")
      audio.playFlip().catch(() => {})
      buzz(BUZZ.flip)
    }, 120)
  },
  flipDaily(node) {
    const card = dailyCard(currentProfile())
    if (dailyOpened(localStorage)) {
      showLightbox(card, "Карта дня")
      return
    }
    saveJournal(localStorage, { id: Date.now().toString(36), type: "daily", date: todayKey(), cards: [card.id] })
    node.querySelector(".daily-flip")?.classList.remove("is-down")
    audio.playFlip().catch(() => {})
    buzz(BUZZ.flip)
    window.setTimeout(() => {
      if (state.screen === "hall") render()
    }, FLIP_MS + 30)
  },
  shop() {
    if (state.screen !== "shop") state.shopBack = state.screen
    state.screen = "shop"
    render()
    window.scrollTo(0, 0)
  },
  shopBack() {
    state.screen = state.shopBack || "me"
    render()
    window.scrollTo(0, 0)
  },
  plan(node) {
    state.plan = node.dataset.sku
    render()
  },
  renew(node) {
    wallet = setRenew(wallet, node.dataset.on === "1")
    saveWallet(localStorage, wallet)
    render()
  },
  buy(node) {
    const age = guestAge()
    const stage = age !== null && age < ADULT_AGE ? "adult" : "confirm"
    state.checkout = { sku: node.dataset.sku, stage, orderId: newOrderId() }
    render()
  },
  async pay(node) {
    const order = state.checkout
    if (!order || order.stage === "paying" || order.stage === "adult") return
    order.stage = "paying"
    render()
    const result = await payments.pay({ orderId: order.orderId, sku: order.sku, price: PRODUCTS[order.sku].price }, { decline: node.dataset.decline === "1" })
    if (state.checkout !== order) return
    if (result.ok) {
      wallet = grant(wallet, order.sku, { day: todayKey(), orderId: order.orderId, test: payments.mode === "test" })
      saveWallet(localStorage, wallet)
      order.stage = "done"
      buzz(BUZZ.landed)
    } else {
      order.stage = "declined"
      order.orderId = newOrderId()
      buzz(BUZZ.rest)
    }
    render()
  },
  closeCheckout() {
    if (state.checkout?.stage === "paying") return
    state.checkout = null
    state.status = ""
    render()
  },
  zoom(node) {
    if (state.spread?.casting || state.spread?.tossing) return
    if (node.classList.contains("is-vacant") || node.dataset.vacant === "1") return
    const card = byId(node.dataset.id) || hexById(node.dataset.id) || runeById(node.dataset.id) || cardById(node.dataset.id)
    if (card) showLightbox(card, node.dataset.role || "Колода", node.dataset.art || "arkanum")
  },
  async apple() {
    if (!state.appleClientId) return
    try {
      await loadScript("https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js")
    } catch {
      state.hallNote = "Вход Apple сейчас не открылся."
      render()
      return
    }
    const appleAuth = window.AppleID?.auth
    if (!appleAuth) {
      state.hallNote = "Вход Apple сейчас не открылся."
      render()
      return
    }
    appleAuth.init({
      clientId: state.appleClientId,
      scope: "name",
      redirectURI: `${location.origin}/`,
      usePopup: true,
    })
    try {
      const result = await appleAuth.signIn()
      const token = result?.authorization?.id_token
      if (!token) return
      rememberAccount({ store: "apple", token })
      state.accountStore = "apple"
      await refreshAccount()
      render()
    } catch {
      state.hallNote = "Вход Apple не завершился."
      render()
    }
  },
  async unlockHero() {
    const person = hero()
    try {
      await unlocks.purchase(person)
      state.status = ""
      state.spread = null
      state.screen = "table"
      render()
    } catch (error) {
      state.status = error.code === "PAYMENTS_NOT_CONNECTED"
        ? "Сюда подключается оплата. Пока стол закрыт."
        : error.message
      render()
    }
  },
}

function voiceTopic(spread, followup) {
  if (followup) {
    const asked = detectTopic(followup)
    if (asked !== "s") return asked
  }
  if (["l", "w", "m", "s"].includes(spread.topic)) return spread.topic
  const heroTopic = spread.heroTopic !== undefined ? spread.heroTopic : hero()?.topic
  const detected = detectTopic(spread.question || "")
  if (detected !== "s") return detected
  if (heroTopic == null) return null
  return questionTopic(spread.question || "", heroTopic || "s")
}

/** Сторона развилки, если колода её уже назвала. Модель пересказывает её и не говорит обратное. */
function voiceSide(spread) {
  const note = String(spread.reading?.note || "")
  const line = note.split("\n").map((row) => row.trim()).find((row) => /уходить или остаться|Сторону знак|Ни «уходите»/.test(row))
  if (!line) return ""
  return line.replace(/^Вывод\.\s*/, "").slice(0, 400)
}

/** Что лежит на столе, для голоса модели: позиция, имя и готовый текст колоды под этот вопрос. */
function voiceCards(spread, followup) {
  const topic = voiceTopic(spread, followup)
  const asked = spread.question || ""
  return spread.cards.filter((item) => !item.vacant).map((item, index) => {
    const card = laidCard(item)
    const sign = spread.id === "decan" && index === 0
    const bound = boundLot({ role: sign ? "" : item.role, card }, asked, topic, spread.tell || 0)
    return {
      role: item.role,
      name: card.name,
      hint: card.hint || card.line || "",
      lean: bound.card.meaning || card.meaning || card.line || "",
      step: bound.card.a || "",
    }
  })
}

function fateArcanaHtml() {
  const profile = currentProfile()
  const card = profile?.sign ? arcanaByNumber(profile.arcana) : null
  if (!card) return `<div id="fate-arcana" hidden></div>`
  return `<article id="fate-arcana" class="fate">
    <button type="button" class="jthumb fate-thumb" data-action="zoom" data-id="${card.id}" data-role="Аркан судьбы" aria-label="Карта аркана судьбы: ${escapeHtml(card.name)}">${cardArt(card)}</button>
    <div>
      <p class="meta">Аркан судьбы · ${toRoman(profile.arcana)}</p>
      <b>${escapeHtml(card.name)}</b>
      <p>Складываем цифры даты рождения, пока не получится число от I до XXII. Это ваша карта на всю жизнь. Когда она приходит в раскладе, таверна пишет, что карта легла лично про вас.</p>
      <p>${escapeHtml(arcanaLine(profile.arcana))}</p>
    </div>
  </article>`
}

function profileChip() {
  const profile = currentProfile()
  if (!profile?.sign) return ""
  const name = profile.name ? `${profile.name} · ` : ""
  const when = spokenBirth(state.birthDate)
  return `<p class="chip">${escapeHtml(name)}${when ? `${escapeHtml(when)} · ` : ""}${escapeHtml(profile.sign)} · аркан судьбы ${toRoman(profile.arcana)}</p>`
}

function tabbar(active) {
  return `<nav class="tabbar" aria-label="Разделы">
    ${TABS.map((tab) => `<button class="tab${tab.id === active ? " on" : ""}" type="button" data-action="tab" data-tab="${tab.id}" data-buzz="tap"${tab.id === active ? ` aria-current="page"` : ""}>
      ${ICONS[tab.id]}<span>${tab.label}</span>
    </button>`).join("")}
  </nav>`
}

let arriveSettled = false

function entranceCopy() {
  if (state.screen === "story") {
    const beat = BEATS[state.beat] || BEATS[0]
    const last = state.beat >= BEATS.length - 1
    const label = last ? (knownProfile() && consented() ? "В зал" : "Назвать себя") : "Дальше"
    const body = beat.items
      ? `<ul class="beat beat-list">${beat.items.map((line) => `<li>${glueShortWords(line)}</li>`).join("")}</ul>`
      : `<p class="beat">${glueShortWords(beat.text || "")}</p>`
    return `<div class="glass">
      <p class="eyebrow">${glueShortWords(beat.kicker)}</p>
      <h1>${glueShortWords(beat.title)}</h1>
      ${body}
      <p class="step-count">${state.beat + 1} из ${BEATS.length}</p>
      <button class="primary" data-action="nextBeat" type="button">${label}</button>
    </div>`
  }
  return `<div class="arrive-word"><small>Таверна</small><h1>Три окна</h1></div>
    <div class="glass">
    <p class="blurb">${glueShortWords("Шестеро уже сели за столы: те, кто гадает на таро, рунах и Книге перемен.")}</p>
    <button class="primary" data-action="story" type="button">Дальше</button>
  </div>`
}

function syncArriveCta() {
  if (state.screen !== "arrive" || !arriveSettled) return
  const next = stage.querySelector(".arrive-next")
  const skip = stage.querySelector(".arrive-skip")
  if (next) next.hidden = false
  if (skip) skip.hidden = true
}

function armArriveVideo(reduce) {
  const video = stage.querySelector("#arrive")
  const section = stage.querySelector(".arrive")
  const settle = () => {
    arriveSettled = true
    syncArriveCta()
  }
  if (!video || reduce) {
    section?.classList.add("is-still")
    settle()
    return
  }
  video.addEventListener("playing", () => section?.classList.add("is-playing"))
  video.addEventListener("ended", settle)
  video.addEventListener("error", () => {
    section?.classList.remove("is-playing")
    section?.classList.add("is-still")
    settle()
  })
  const start = () => {
    const attempt = video.play()
    if (attempt && typeof attempt.catch === "function") {
      attempt.catch(() => {
        section?.classList.remove("is-playing")
        section?.classList.add("is-still")
        settle()
      })
    }
  }
  const poster = stage.querySelector(".arrive-poster")
  if (!poster || poster.complete) start()
  else {
    poster.addEventListener("load", start, { once: true })
    poster.addEventListener("error", start, { once: true })
    setTimeout(start, 1200)
  }
}

function renderEntrance() {
  const alive = stage.querySelector("section.arrive video#arrive")
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  if (!alive) {
    arriveSettled = false
    el(`<section class="arrive">
      <img class="arrive-poster" src="assets/arrive-poster.jpg?v=153" alt="" fetchpriority="high" />
      <video id="arrive" poster="assets/arrive-poster.jpg?v=153" muted playsinline webkit-playsinline preload="none">
        <source src="assets/arrive.mp4?v=153" type="video/mp4" />
      </video>
      <div class="arrive-veil"></div>
      <div class="arrive-slot"></div>
    </section>`)
  }
  const video = stage.querySelector("section.arrive video#arrive")
  if (video && !video.dataset.armed) {
    video.dataset.armed = "1"
    armArriveVideo(reduce)
  }
  const slot = stage.querySelector(".arrive-slot")
  if (!slot) return
  const early = slot.querySelector("[data-early]")
  const queued = early?.dataset.queued === "1"
  slot.innerHTML = entranceCopy()
  wire(slot)
  syncArriveCta()
  if (queued) actions.story()
}

function renderWho() {
  el(`<section class="step who">
    <p class="eyebrow">Вас запомнят</p>
    <h1>Как вас зовут?</h1>
    <label>Имя
      <input id="name" type="text" maxlength="30" autocomplete="given-name" placeholder="Как к вам обращаться" />
    </label>
    <div>
      <span class="field-name">Когда вы родились</span>
      ${birthFields()}
    </div>
    ${consented() ? "" : `<div class="consent">
      <input id="consent" type="checkbox"${state.consentTicked ? " checked" : ""} />
      <label for="consent" id="consent-label">${escapeHtml(consentLabel())}</label>
      <p>Подробно: <button class="link" type="button" data-action="doc" data-doc="consent">согласие</button> и <button class="link" type="button" data-action="doc" data-doc="privacy">политика конфиденциальности</button>. Имя, дата рождения и журнал хранятся только на этом телефоне.</p>
    </div>`}
    <p class="status" role="status">${escapeHtml(state.hallNote)}</p>
    <button class="primary" data-action="saveWho" type="button">Запомнить</button>
  </section>`)
}

/** Колода «при свече» — перекрашенные копии из cards-candle/; оригиналы в cards/ не меняются. */
function deckSrc(path) {
  if (!settings.candleDeck) return path
  return String(path || "").replace(/^cards\/card_([\w]+)\.jpg$/, "cards-candle/card_$1.webp")
}

function cardArt(card, art = "arkanum") {
  if (card?.lines || art === "hex") {
    const hex = hexById(card.id) || card
    const src = hex?.img || (hex?.n ? `assets/hex/${hex.n}.webp` : "")
    if (src) return `<img class="face" alt="" data-src="${escapeHtml(src)}" data-fallback="" />`
    return hexSvg(hex)
  }
  if (card?.kind === "rune" || art === "rune") {
    const rune = runeById(card.id) || card
    const src = rune?.img || (rune?.id ? `assets/runes/${rune.id}.webp` : "")
    if (src) return `<img class="face" alt="" data-src="${escapeHtml(src)}?v=${APP_VERSION}" data-fallback="" />`
    return runeSvg(rune)
  }
  const original = byId(card.id)
  const src = art === "painted"
    ? paintedSrc(card.id)
    : deckSrc(original?.img || card.img || "")
  return `<img class="face" alt="" data-src="${escapeHtml(src)}" data-fallback="" />`
}

function backArt(deck) {
  if (deck?.art === "hex") return `<img class="back" alt="" data-src="assets/hex-back.webp" data-fallback="assets/hex-back.webp" />`
  if (deck?.art === "rune") return `<img class="back" alt="" data-src="assets/rune-back.webp?v=${APP_VERSION}" data-fallback="assets/rune-back.webp" />`
  return `<img class="back" alt="" data-src="${deckSrc(IMGS.back)}" data-fallback="assets/card-back.svg" />`
}

function dailyWidget() {
  const card = dailyCard(currentProfile())
  const open = dailyOpened(localStorage)
  const line = open ? (card.hint ? `${card.hint[0].toUpperCase()}${card.hint.slice(1)}.` : "") : "Коснитесь рубашки — карта откроется."
  return `<button class="widget day" type="button" data-action="flipDaily" aria-label="${open ? `Карта дня: ${escapeHtml(card.name)}` : "Открыть карту дня"}">
    <span class="daily-flip${open ? "" : " is-down"}">${cardArt(card)}${backArt()}</span>
    <span class="widget-text">
      <span class="meta">Карта дня</span>
      <b>${open ? escapeHtml(card.name) : "Ещё рубашкой вверх"}</b>
      <span class="blurb">${escapeHtml(line)}</span>
      ${open ? `<span class="widget-more">${escapeHtml(card.meaning)}</span>` : ""}
    </span>
  </button>`
}

function resumeStrip() {
  const last = latestTable()
  if (!last) return ""
  const person = heroById(last.entry.hero)
  if (!person) return ""
  const extra = last.entry.thread?.length ? ` · уточнений ${last.entry.thread.length}` : ""
  return `<button class="resume" type="button" data-action="resume" data-id="${escapeHtml(last.entry.id)}" data-buzz="tap">
    <img class="mini" src="${person.portrait}" alt="" />
    <span>
      <span class="meta">${last.when} у стола ${escapeHtml(person.gen || person.short)}${extra}</span>
      <span class="resume-q">«${escapeHtml(last.entry.q || "без вопроса")}»</span>
    </span>
    <span class="chev" aria-hidden="true">›</span>
  </button>`
}

function unitWord(person, n) {
  if (person?.spreadId === "hexagram") return n === 1 ? "знак" : n >= 2 && n <= 4 ? "знака" : "знаков"
  if (person?.spreadId === "runes") return n === 1 ? "руна" : n >= 2 && n <= 4 ? "руны" : "рун"
  return cardsWord(n)
}

function sizesLine(person) {
  const counts = person.sizes.map((size) => size.count)
  if (counts.length === 1) return `${counts[0]} ${unitWord(person, counts[0])}`
  return `${counts.slice(0, -1).join(", ")} или ${counts.at(-1)} ${unitWord(person, counts.at(-1))}`
}

function tile(person, rest) {
  const locked = !unlocks.canUse(person)
  const label = rest ? ` aria-label="${escapeHtml(person.name)}: стол отдыхает до полуночи"` : ""
  return `<button class="tile${locked ? " locked" : ""}${rest ? " resting" : ""}" type="button" data-action="open" data-id="${person.id}" data-buzz="tap"${label}>
    <span class="tile-art">
      <img class="fade" src="${person.portrait}" alt="" />
      ${locked ? `<span class="lock">${escapeHtml(person.price)}</span>` : ""}
      ${rest ? `<span class="rest-veil" aria-hidden="true">${REST_ICON}<span>Отдыхает</span></span>` : ""}
    </span>
    <span class="tile-text">
      <span class="meta">${escapeHtml(person.theme)}</span>
      <b>${escapeHtml(person.name)}</b>
      <span class="blurb">${rest ? "Карты накрыты до полуночи" : escapeHtml(sizesLine(person))}</span>
    </span>
  </button>`
}

function greeting() {
  const hour = new Date().getHours()
  const part = hour < 5 ? "Доброй ночи" : hour < 12 ? "Доброе утро" : hour < 18 ? "Добрый день" : "Добрый вечер"
  return state.name.trim() ? `${part}, ${state.name.trim()}` : part
}

function outcomeButtons(entry) {
  return `<div class="came-btns">
    ${OUTCOMES.map((item) => `<button class="came-btn" type="button" data-action="came" data-id="${escapeHtml(entry.id)}" data-came="${item.id}" data-buzz="tap">${item.label}</button>`).join("")}
  </div>`
}

function cameCard() {
  if (state.cameNote) {
    const note = state.cameNote
    state.cameNote = ""
    return `<section class="came" role="status"><p class="came-done">${escapeHtml(note)}</p></section>`
  }
  const today = todayKey()
  const entry = nextToAsk(loadJournal(localStorage), today)
  if (!entry) return ""
  const person = heroById(entry.hero)
  return `<section class="came" aria-label="Как вышло с вопросом">
    <p class="meta">${escapeHtml(agoText(daysBetween(entry.date, today)))}${person ? ` у стола ${escapeHtml(person.gen || person.short)}` : ""}</p>
    <p class="came-q">«${escapeHtml(entry.q)}»</p>
    <p class="came-ask">Как вышло?</p>
    ${outcomeButtons(entry)}
    <button class="text-button came-later" type="button" data-action="cameLater" data-id="${escapeHtml(entry.id)}">Спросите позже</button>
  </section>`
}

function moonEntry(key) {
  return loadJournal(localStorage).find((entry) => entry.type === "moon" && entry.key === key) || null
}

function moonWidget() {
  const event = moonWindow()
  if (!event) return ""
  const phase = MOON_PHASES[event.phase]
  const done = moonEntry(event.key)
  return `<button class="widget moon-widget" type="button" data-action="openMoon" data-buzz="tap">
    <span class="moon-disc is-${event.phase}" aria-hidden="true"></span>
    <span class="widget-text">
      <span class="meta">${escapeHtml(moonHeadline(event))}</span>
      <b>${escapeHtml(phase.title)}</b>
      <span class="blurb">${done ? "Карты этой фазы уже легли — откройте, чтобы перечитать." : `${phase.invite} Не тратит расклады.`}</span>
    </span>
    <span class="chev" aria-hidden="true">›</span>
  </button>`
}

function renderHall() {
  const order = HALL_ORDER.map(heroById).filter(Boolean)
  const rest = resting()
  const tables = `<h2 class="section-title">Столы${rest ? " <span>отдыхают</span>" : ""}</h2>
    <div class="tiles">${order.map((person) => tile(person, rest)).join("")}</div>`
  el(`<section class="page hall">
    <header class="page-head">
      <p class="eyebrow">Таверна «Три окна»</p>
      <h1>${escapeHtml(greeting())}</h1>
    </header>
    ${rest ? restBanner() : ""}
    ${dailyWidget()}
    ${moonWidget()}
    ${cameCard()}
    ${rest ? extrasHtml("Пока карты отдыхают") : ""}
    ${resumeStrip()}
    ${tables}
    ${rest ? "" : `<p class="quota">${escapeHtml(spreadQuotaLine())}</p>`}
    ${rest ? "" : extrasHtml("Без счёта раскладов")}
  </section>
  ${tabbar("hall")}`)
}

function renderLock() {
  const person = hero()
  el(`<section class="page">
    <button class="back-link" data-action="home" type="button" data-buzz="tap">‹ Зал</button>
    <div class="lock-card">
      <img class="lock-portrait" src="${person.portrait}" alt="" />
      <p class="meta">${escapeHtml(person.theme)} · ${escapeHtml(person.school)}</p>
      <h1>${escapeHtml(person.name)}</h1>
      <p class="blurb">${escapeHtml(person.line)}</p>
      <p class="blurb">Расклады: ${person.sizes.map((size) => `${escapeHtml(size.name.toLowerCase())} — ${size.count} ${cardsWord(size.count)}`).join("; ")}.</p>
      <p>Открывается отдельно: ${escapeHtml(person.price)}.</p>
      <p class="status" role="status">${escapeHtml(state.status)}</p>
      <button class="primary" data-action="unlockHero" type="button">Открыть стол</button>
    </div>
  </section>`)
}

function resultThrows(throws, moving) {
  return (throws || []).map((row, index) => {
    if (!moving?.includes(index)) return { ...row, moving: false }
    return { coins: row.coins, sum: row.yang ? 8 : 7, yang: !row.yang, moving: false }
  })
}

function yaoKind(row) {
  if (row.sum === 9) return { age: "старший ян", num: "9", face: "сплошная", yang: true, moving: true }
  if (row.sum === 7) return { age: "молодой ян", num: "7", face: "сплошная", yang: true, moving: false }
  if (row.sum === 8) return { age: "молодой инь", num: "8", face: "с разрывом", yang: false, moving: false }
  return { age: "старший инь", num: "6", face: "с разрывом", yang: false, moving: true }
}

function yaoLineHtml(row, index, visible) {
  if (!visible) return `<span class="yao-line is-slot" data-yao="${index}"></span>`
  const old = row.moving ? " is-old" : ""
  const arms = row.yang ? "" : `<i class="arm"></i><i class="arm"></i>`
  const mark = !row.moving
    ? ""
    : row.yang
      ? ` title="Старший ян: сплошная черта потом станет с разрывом"`
      : ` title="Старший инь: разорванная черта потом станет сплошной"`
  return `<span class="yao-line ${row.yang ? "is-yang" : "is-yin"}${old} is-in" data-yao="${index}"${mark}>${arms}</span>`
}

function guaBarVars(index) {
  const [y0, y1] = HEX_FRAME.bars[5 - index]
  const left = HEX_FRAME.x0 / HEX_FRAME.w * 100
  const width = (HEX_FRAME.x1 - HEX_FRAME.x0) / HEX_FRAME.w * 100
  const top = y0 / HEX_FRAME.h * 100
  const height = (y1 - y0) / HEX_FRAME.h * 100
  return `--bl:${left};--bt:${top};--bw:${width};--bh:${height}`
}

function guaMarkTop(index) {
  const [y0, y1] = HEX_FRAME.bars[5 - index]
  return ((y0 + y1) / 2) / HEX_FRAME.h * 100
}

function guaMarksHtml(rows, visibleCount = 6) {
  return (rows || []).map((row, index) => {
    if (!row.moving || index >= visibleCount) return ""
    return `<i class="gua-mark ${row.yang ? "is-circle" : "is-diamond"}" style="top:${guaMarkTop(index)}%" title="${row.yang ? "Старший ян" : "Старший инь"}"></i>`
  }).join("")
}

function guaPlateHtml(card, item) {
  const src = card?.img ? `${card.img}?v=${HEX_ART}` : ""
  if (!src) return guaFromCard(card, item?.changing || [])
  const later = item?.role === "Перемена"
  const rows = later
    ? (card.lines || []).map((yang) => ({ yang: Boolean(yang), moving: false }))
    : (item?.changing || state.spread?.moving || []).length
      ? (card.lines || []).map((yang, index) => ({
        yang: Boolean(yang),
        moving: (item?.changing || state.spread?.moving || []).includes(index),
      }))
      : []
  return `<span class="gua-plate"><img src="${escapeHtml(src)}" alt="" />${guaMarksHtml(rows)}</span>`
}

function guaStack(throws, visibleCount) {
  const rows = (throws || []).map((row, index) => yaoLineHtml(row, index, index < visibleCount))
  return `<span class="gua">${[...rows].reverse().join("")}</span>`
}

function guaBarStamp(row, index) {
  return `assets/hex-bars/${row.yang ? "yang" : "yin"}-${index}.webp?v=${HEX_ART}`
}

function guaLiveHtml(card, throws, visibleCount, item) {
  if (!card) return guaStack(throws, visibleCount)
  if (item?.vacant) {
    return `<span class="gua-plate is-vacant"><img src="${HEX_EMPTY}" alt="" /></span>`
  }
  const marks = item?.role === "Знак" ? "" : guaMarksHtml(throws, visibleCount)
  const bars = (throws || []).map((row, index) => {
    const shown = index < visibleCount
    return `<i class="gua-bar${shown ? " is-in" : ""}${row.yang ? " is-yang" : " is-yin"}" data-yao="${index}" style="${guaBarVars(index)}"><img src="${guaBarStamp(row, index)}" alt="" /></i>`
  }).join("")
  return `<span class="gua-plate"><img src="${HEX_EMPTY}" alt="" /><span class="gua-bars">${bars}</span>${marks}</span>`
}

function guaFromCard(card, changing = []) {
  const throws = (card.lines || []).map((yang, index) => ({ yang: Boolean(yang), moving: changing.includes(index) }))
  return guaStack(throws, 6)
}

function yaoPlace(index) {
  return ["Первая, снизу", "Вторая", "Третья", "Четвёртая", "Пятая", "Шестая, сверху"][index] || "Черта"
}

function yaoCaption(row, index) {
  const kind = yaoKind(row)
  const turn = kind.moving ? " — эта черта потом перевернётся" : ""
  return `${yaoPlace(index)}: ${kind.face}, ${kind.age} (${kind.num})${turn}.`
}

function coinMarks(row) {
  return (row.coins || []).map((value) => `<i class="cast-coin${value === 3 ? " is-yang" : ""}" title="${value === 3 ? "ян, 3" : "инь, 2"}"></i>`).join("")
}

function wantsChange(spread) {
  return Boolean(spread?.cards?.some((item) => item.role === "Перемена" || item.role === "Сейчас"))
}

function castKickerText(spread) {
  if (!spread?.throws) return ""
  const step = spread.castStep || 0
  if (spread.tossing) return `Бросок ${step + 1} из 6`
  if (step === 0 && spread.casting) return "Шесть касаний"
  if (!step) return ""
  const row = spread.throws[step - 1]
  if (!row) return ""
  return `Бросок ${step} из 6 · ${row.coins.join(" + ")} = ${row.sum}`
}

function castKickerHtml(spread) {
  const text = castKickerText(spread)
  if (!text) return ""
  return `<p class="cast-k cast-kicker">${escapeHtml(text)}</p>`
}

function castChipHtml(spread) {
  if (!spread?.throws) return ""
  const step = spread.castStep || 0
  const change = wantsChange(spread)
  if (spread.tossing) {
    return `<p class="cast-chip" aria-live="polite">Монеты ещё крутятся.</p>`
  }
  if (step === 0 && spread.casting) {
    const extra = change
      ? " Второй знак, если будет, сложится из старших черт — его отдельно не бросают."
      : ""
    return `<p class="cast-chip is-wait" aria-live="polite">Коснитесь монет. Первый бросок ляжет нижней чертой.${extra}</p>`
  }
  if (!step) return ""
  const row = spread.throws[step - 1]
  const kind = yaoKind(row)
  const two = spread.cards.some((item) => item.role === "Перемена")
  const vacant = spread.cards.some((item) => item.vacant)
  const next = spread.casting
    ? `Коснитесь ещё раз — черта ${step + 1} из 6.`
    : two && vacant
      ? "Все черты молодые — перемены нет, второй знак не сложился."
      : two
        ? "Второй знак не бросают: его сложили старшие черты."
        : "Шесть черт легли."
  const turn = kind.moving ? " Потом перевернётся." : ""
  return `<p class="cast-chip" aria-live="polite">
    <span class="cast-coins">${coinMarks(row)}</span>
    <b>${kind.age}</b> — ${yaoPlace(step - 1).toLowerCase()}, ${kind.face}.${turn}
    <span class="cast-next">${next}</span>
  </p>`
}

function castHint(spread) {
  const step = spread.castStep || 0
  if (spread.tossing) return `Бросок ${step + 1} из 6 — монеты в воздухе.`
  if (!spread.casting) return yaoCaption(spread.throws[step - 1], step - 1)
  if (step === 0) return "Коснитесь монет — первый бросок, нижняя черта."
  return `${yaoCaption(spread.throws[step - 1], step - 1)} Коснитесь монет ещё раз — черта ${step + 1} из 6.`
}

function paintCoinPose(cash, poses) {
  if (!cash || !poses?.length) return
  const spins = [...cash.querySelectorAll(".cash-spin")]
  poses.forEach((pose, index) => {
    const node = spins[index]
    if (!node || !pose) return
    if (pose.face) node.dataset.face = pose.face
    node.style.transform = "none"
    const fly = node.querySelector(".cash-fly")
    const body = node.querySelector(".cash-3d")
    if (fly) {
      fly.style.willChange = ""
      fly.style.transform = "none"
      fly.style.left = `${Number(pose.x) || 0}px`
    }
    if (body) {
      body.classList.remove("is-tumble")
      body.style.willChange = ""
      body.style.transformStyle = "flat"
      body.style.transform = `rotateZ(${Number(pose.tilt) || 0}deg)`
    }
  })
}

function cashPoseStyle(pose, part) {
  if (!pose) return ""
  const x = Number(pose.x) || 0
  const y = Number(pose.y) || 0
  const tilt = Number(pose.tilt) || 0
  if (part === "spin") return ` style="transform:none"`
  if (part === "fly") return ` style="transform:translate3d(${x}px, ${y}px, 0)"`
  return ` style="transform:rotateZ(${tilt}deg)"`
}

function cashHtml(spread) {
  const step = spread?.castStep || 0
  const last = spread?.throws?.[Math.max(0, step - 1)]
  const faces = last?.coins || [2, 3, 2]
  const poses = spread?.coinPose
  const scattered = Boolean(poses?.length)
  const interactive = Boolean(spread?.casting && step < 6)
  const waiting = interactive && !spread?.tossing
  const label = waiting
    ? `Бросить монеты, бросок ${(step || 0) + 1} из 6`
    : "Монеты"
  const tag = interactive ? "button" : "div"
  const extra = interactive
    ? ` type="button" data-action="toss" aria-label="${escapeHtml(label)}"`
    : ` aria-hidden="true"`
  const coins = faces.map((value, index) => {
    const pose = poses?.[index]
    return `<span class="cash-spin" data-i="${index}" data-face="${value === 3 ? "yang" : "yin"}"${cashPoseStyle(pose, "spin")}>
      <span class="cash-fly"${cashPoseStyle(pose, "fly")}>
        <span class="cash-3d"${cashPoseStyle(pose, "body")}>
          <span class="cash-face is-yang"><img src="${COIN_YANG}" alt="" /></span>
          <span class="cash-face is-yin"><img src="${COIN_YIN}" alt="" /></span>
        </span>
      </span>
    </span>`
  }).join("")
  return `<${tag} class="cash${waiting ? " is-wait" : ""}${spread?.tossing ? " is-tossing" : ""}${scattered ? " is-scattered" : ""}"${extra}>${coins}</${tag}>`
}

function patchCastUi(spread) {
  const cash = stage.querySelector(".cash")
  if (cash) {
    cash.classList.remove("is-tossing")
    cash.classList.add("is-wait", "is-scattered")
    cash.setAttribute("aria-label", `Бросить монеты, бросок ${(spread.castStep || 0) + 1} из 6`)
  }
  const chip = stage.querySelector(".cast-chip")
  if (chip) {
    const wrap = document.createElement("div")
    wrap.innerHTML = castChipHtml(spread)
    const next = wrap.firstElementChild
    if (next) chip.replaceWith(next)
  }
  const live = stage.querySelector(".cast-live")
  if (live) live.textContent = castHint(spread)
  const kicker = stage.querySelector(".cast-kicker")
  if (kicker) kicker.textContent = castKickerText(spread)
  const step = spread.castStep || 0
  const row = spread.throws?.[step - 1]
  const bar = stage.querySelector(`.gua-sign:not(.is-later) .gua-bar[data-yao="${step - 1}"]`)
  if (bar && row) {
    bar.classList.add("is-in")
    bar.classList.toggle("is-yang", Boolean(row.yang))
    bar.classList.toggle("is-yin", !row.yang)
    const img = bar.querySelector("img")
    if (img) img.src = guaBarStamp(row, step - 1)
    const plate = bar.closest(".gua-plate")
    if (plate && row.moving && !plate.querySelector(`.gua-mark[data-yao="${step - 1}"]`)) {
      plate.insertAdjacentHTML("beforeend", `<i class="gua-mark ${row.yang ? "is-circle" : "is-diamond"}" data-yao="${step - 1}" style="top:${guaMarkTop(step - 1)}%" title="${row.yang ? "Старший ян" : "Старший инь"}"></i>`)
    }
  } else {
    const slot = stage.querySelector(`.gua-sign:not(.is-later) .yao-line[data-yao="${step - 1}"]`)
    if (slot && row) {
      const wrap = document.createElement("div")
      wrap.innerHTML = yaoLineHtml(row, step - 1, true)
      const next = wrap.firstElementChild
      if (next) slot.replaceWith(next)
    }
  }
}

function clamp(value, min, max) {
  if (min > max) return (min + max) / 2
  return Math.min(max, Math.max(min, value))
}

function coinClothRange(node, cloth) {
  const slot = node.getBoundingClientRect()
  const table = cloth.getBoundingClientRect()
  const pad = 10
  let xmin = table.left + pad - slot.left
  let xmax = table.right - pad - slot.right
  if (xmin > xmax) {
    const mid = (xmin + xmax) / 2
    xmin = mid
    xmax = mid
  }
  const ymin = table.top + pad - slot.top
  return { xmin, xmax, ymin }
}

function flyCoins(cash, row, done) {
  const spins = [...cash.querySelectorAll(".cash-spin")]
  const cloth = cash.closest(".table-scene") || cash
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
  const restPose = (coin) => ({
    x: coin.x,
    y: 0,
    tilt: coin.tilt,
    face: coin.yang ? "yang" : "yin",
  })
  const settle = (coin) => {
    coin.node.dataset.face = coin.yang ? "yang" : "yin"
    coin.x = clamp(coin.x, coin.xmin, coin.xmax)
    coin.y = 0
    if (coin.body) {
      coin.body.classList.remove("is-tumble")
      coin.body.style.transform = `rotateZ(${coin.tilt}deg)`
      coin.body.style.willChange = ""
    }
    if (coin.fly) {
      coin.fly.style.willChange = ""
      coin.fly.style.transform = "none"
      coin.fly.style.left = `${coin.x}px`
    }
    coin.node.style.removeProperty("--lift")
  }
  const startPose = (index, range) => {
    const pose = state.spread?.coinPose?.[index]
    const tilt = pose
      ? Number(pose.tilt) || 0
      : (index - 1) * 10 + (Math.random() - 0.5) * 14
    const x = clamp(pose ? Number(pose.x) || 0 : 0, range.xmin, range.xmax)
    return { x, y: 0, tilt }
  }
  const tossVx = (x, range) => {
    let vx = (Math.random() - 0.5) * 96
    const left = x - range.xmin
    const right = range.xmax - x
    if (left < 22) vx = 18 + Math.random() * 48
    else if (right < 22) vx = -(18 + Math.random() * 48)
    return vx
  }
  if (reduce || !spins.length) {
    const poses = spins.map((node, index) => {
      const range = coinClothRange(node, cloth)
      const from = startPose(index, range)
      const span = Math.max(0, range.xmax - range.xmin)
      const coin = {
        node,
        fly: node.querySelector(".cash-fly"),
        body: node.querySelector(".cash-3d"),
        yang: row.coins[index] === 3,
        xmin: range.xmin,
        xmax: range.xmax,
        x: clamp(from.x + (Math.random() - 0.5) * Math.min(36, span), range.xmin, range.xmax),
        tilt: from.tilt + (Math.random() - 0.5) * 16,
      }
      settle(coin)
      return restPose(coin)
    })
    done(poses)
    return
  }
  const gravity = 2100
  const coins = spins.map((node, index) => {
    const fly = node.querySelector(".cash-fly")
    const body = node.querySelector(".cash-3d")
    const yang = row.coins[index] === 3
    const dir = Math.random() < 0.5 ? -1 : 1
    const range = coinClothRange(node, cloth)
    const from = startPose(index, range)
    if (fly) {
      fly.style.willChange = "transform"
      fly.classList.remove("is-toss")
      fly.style.left = "0px"
      fly.style.transform = `translate3d(${from.x}px, 0px, 0)`
      fly.style.filter = ""
    }
    if (body) {
      body.classList.add("is-tumble")
      body.style.willChange = "transform"
      body.style.transform = `rotateZ(${from.tilt}deg)`
    }
    node.style.transform = "none"
    return {
      node,
      fly,
      body,
      yang,
      delay: 0.018 + index * 0.055 + Math.random() * 0.04,
      x: from.x,
      y: 0,
      xmin: range.xmin,
      xmax: range.xmax,
      ymin: range.ymin,
      vx: tossVx(from.x, range),
      vy: -(640 + Math.random() * 220),
      rot: node.dataset.face === "yin" ? 180 : 0,
      omega: dir * (920 + Math.random() * 640 + index * 80),
      tilt: from.tilt + (Math.random() - 0.5) * 12,
      bounces: 0,
      started: false,
      done: false,
    }
  })
  let left = coins.length
  let last = performance.now()
  const born = last
  let closed = false
  let watchdog = 0
  const land = (coin) => {
    if (coin.done) return
    coin.done = true
    coin.vy = 0
    coin.vx = 0
    coin.omega = 0
    try { settle(coin) } catch { /* стол уже перерисован */ }
    left -= 1
  }
  const finish = () => {
    if (closed) return
    closed = true
    window.clearTimeout(watchdog)
    window.setTimeout(() => done(coins.map(restPose)), 70)
  }
  const tick = (now) => {
    const dt = Math.min(0.032, Math.max(0, (now - last) / 1000))
    last = now
    const overdue = now - born > 1500
    try {
      coins.forEach((coin) => {
        if (coin.done) return
        if (overdue || !coin.fly || !coin.body) {
          land(coin)
          return
        }
        coin.delay -= dt
        if (coin.delay > 0) return
        coin.started = true
        coin.vy += gravity * dt
        coin.x += coin.vx * dt
        coin.y += coin.vy * dt
        coin.rot += coin.omega * dt
        if (coin.x < coin.xmin) {
          coin.x = coin.xmin
          coin.vx = Math.abs(coin.vx) * 0.45
        } else if (coin.x > coin.xmax) {
          coin.x = coin.xmax
          coin.vx = -Math.abs(coin.vx) * 0.45
        }
        if (coin.y < coin.ymin) {
          coin.y = coin.ymin
          coin.vy = Math.abs(coin.vy) * 0.2
        }
        if (coin.y >= 0) {
          coin.y = 0
          if (coin.vy > 140 && coin.bounces < 2) {
            coin.vy *= -0.26
            coin.vx *= 0.58
            coin.omega *= 0.42
            coin.bounces += 1
            if (state.spread?.tossing) buzz(BUZZ.coin)
          } else {
            land(coin)
            return
          }
        }
        const up = Math.max(0, -coin.y)
        const k = Math.min(1, up / 90)
        coin.fly.style.left = "0px"
        coin.fly.style.transform = `translate3d(${coin.x}px, ${coin.y}px, 0)`
        coin.node.style.setProperty("--lift", String(k))
        coin.body.style.transform = `rotateZ(${coin.tilt}deg) rotateX(${coin.rot}deg)`
      })
    } catch {
      coins.forEach(land)
    }
    if (left > 0) window.requestAnimationFrame(tick)
    else finish()
  }
  watchdog = window.setTimeout(() => {
    coins.forEach(land)
    finish()
  }, 1800)
  window.requestAnimationFrame(tick)
}

function pointOnCoin(cash, x, y) {
  if (!cash) return false
  return [...cash.querySelectorAll(".cash-3d, .cash-fly")].some((node) => {
    const rect = node.getBoundingClientRect()
    if (rect.width < 2 || rect.height < 2) return false
    const pad = 10
    return x >= rect.left - pad && x <= rect.right + pad && y >= rect.top - pad && y <= rect.bottom + pad
  })
}

// Монета за краем кнопки в части браузеров не получает click: жест уходит в стол.
// Ловим касание по прямоугольнику монеты, если сама кнопка его не взяла.
function bindCash(root) {
  if (root.dataset.cashBound) return
  root.dataset.cashBound = "1"
  let down = null
  root.addEventListener("pointerdown", (event) => {
    down = { x: event.clientX, y: event.clientY, id: event.pointerId }
  })
  root.addEventListener("pointerup", (event) => {
    if (!down || down.id !== event.pointerId) return
    const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y)
    down = null
    if (moved > 14) return
    const spread = state.spread
    if (!spread?.casting || spread.tossing) return
    const cash = stage.querySelector(".cash.is-wait")
    if (!cash || !pointOnCoin(cash, event.clientX, event.clientY)) return
    actions.toss()
  })
}

let lastTossAt = 0

function bindGua(root) {
  const spread = state.spread
  if (!spread?.throws?.length || (spread.id !== "hexagram" && hero()?.spreadId !== "hexagram")) return
  const step = spread.casting ? (spread.castStep || 0) : 6
  root.querySelectorAll(".gua-sign:not(.is-later) .gua-bar, .gua-sign:not(.is-later) .yao-line").forEach((node) => {
    if (+node.dataset.yao < step) node.classList.add("is-in")
  })
  if (!spread.casting) {
    const later = root.querySelector(".gua-sign.is-later")
    later?.classList.add("is-ready")
    later?.querySelectorAll(".yao-line").forEach((node) => node.classList.add("is-in"))
  }
}

function guaFace(item, index, spread) {
  const card = laidCard(item)
  const later = item.role === "Перемена"
  const vacant = Boolean(item.vacant)
  const throws = later && !vacant ? resultThrows(spread.throws, spread.moving) : spread.throws
  const step = spread.castStep || 0
  const visible = vacant ? 0 : spread.casting ? (later ? 0 : step) : 6
  const name = spread.casting || vacant ? "" : escapeHtml(card.name)
  const face = guaLiveHtml(card, throws, visible, item)
  const caption = vacant && !spread.casting ? "Перемены нет" : name
  return `<button class="gua-sign is-plate${later ? " is-later" : ""}${vacant ? " is-vacant" : ""}${spread.fresh ? " is-new" : ""}" type="button" style="--i:${index}" data-action="zoom"${vacant ? ' data-vacant="1"' : ""} data-id="${escapeHtml(card.id)}" data-art="hex" data-role="${escapeHtml(item.role)}" data-index="${index}" aria-label="${escapeHtml(item.role)}${caption ? `: ${caption}` : ""}">
    <span class="laid-role">${escapeHtml(item.role)}</span>
    ${face}
    <span class="laid-name">${caption}</span>
  </button>`
}

function cardFace(item, index, deck, open, fresh) {
  const card = laidCard(item)
  const rune = deck.art === "rune" || card.kind === "rune"
  const fall = rune ? (STONE_FALL[index] || STONE_FALL[0]) : null
  const style = rune
    ? `--i:${index};--drop-ms:${fall.ms}ms;--drop-delay:${fall.delay}ms;--from-x:${fall.x}%;--from-y:${fall.y}%;--from-rot:${fall.rot}deg`
    : `--i:${index}`
  return `<button class="card laid${rune ? " is-rune" : ""}${open ? "" : " is-down"}${fresh ? " is-new" : ""}" type="button" style="${style}" data-cloth="${deck.cloth}" data-action="flip" data-index="${index}" aria-label="${open ? escapeHtml(card.name) : rune ? `Открыть руну: ${escapeHtml(item.role)}` : `Открыть карту: ${escapeHtml(item.role)}`}">
    <span class="laid-tilt">
      <span class="flip">${cardArt(card, deck.art)}${backArt(deck)}</span>
      <span class="laid-name">${open ? escapeHtml(laidCaption(card.name)) : ""}</span>
    </span>
  </button>`
}

function plainReading(reading, showLead) {
  const said = new Set()
  const lead = showLead ? dropEcho(reading.lead || "", said) : ""
  const items = (reading.items || []).map((item) => ({
    ...item,
    body: dropEcho(item.body || "", said),
    personal: dropEcho(item.personal || "", said),
  }))
  const note = dropEcho(reading.note || "", said).replace(/^Вывод\.\s*/, "")
  return { lead, items, note }
}

function readingHtml(reading, person, spread) {
  if (reading.pending && !reading.voiced && !reading.speech) {
    const words = tableWords(person, spread)
    const short = person?.short || "Таролог"
    return `<section class="reading" aria-live="polite">
      <h3>${escapeHtml(reading.title || "")}</h3>
      <p class="wait">${escapeHtml(short)} смотрит на ${words.gaze}…</p>
    </section>`
  }
  const paras = (text) => String(text || "").split(/\n\n+/).filter(Boolean).map((part) => `<p>${escapeHtml(part)}</p>`).join("")
  const structured = reading.voiced || reading.layout === "cards" || reading.layout === "runes"
  if (structured && (reading.items || []).length) {
    const shown = plainReading(reading, !reading.voiced)
    const items = shown.items.map((item) => {
      const chunks = String(item.body || "").split(/\n\n+/).filter(Boolean).map((part) => `<p>${escapeHtml(part)}</p>`).join("")
      const head = item.open || `${item.role} — ${item.name}.`
      return `<li><p><b>${escapeHtml(head)}</b></p>${chunks}${item.personal ? `<div class="pers">${escapeHtml(item.personal)}</div>` : ""}</li>`
    }).join("")
    const title = reading.title || (person?.id === "einar" ? "Руны ответили" : person?.id === "lin" ? "Знак ответил" : "Карты ответили")
    return `<section class="reading is-cards">
      <h3>${escapeHtml(title)}</h3>
      ${shown.lead ? paras(shown.lead) : ""}
      ${items ? `<ul>${items}</ul>` : ""}
      ${shown.note ? `<div class="note is-sum"><h3 class="verdict">Вывод</h3>${paras(shown.note)}</div>` : ""}
    </section>`
  }
  if (reading.speech && !reading.voiced) {
    const speech = dropEcho(reading.speech, "").split(/\n\n+/).filter(Boolean).map((part) => `<p>${escapeHtml(part)}</p>`).join("")
    return `<section class="reading">
      <h3>${escapeHtml(reading.title)}</h3>
      <div class="speech">${speech}</div>
    </section>`
  }
  if (reading.layout === "cards" || reading.layout === "runes") {
    const shown = plainReading(reading, true)
    const items = shown.items.map((item) => {
      const chunks = String(item.body || "").split(/\n\n+/).filter(Boolean).map((part) => `<p>${escapeHtml(part)}</p>`).join("")
      const head = item.open || `${item.role} — ${item.name}.`
      return `<li><p><b>${escapeHtml(head)}</b></p>${chunks}${item.personal ? `<div class="pers">${escapeHtml(item.personal)}</div>` : ""}</li>`
    }).join("")
    return `<section class="reading is-cards">
      <h3>${escapeHtml(reading.title || "Карты ответили")}</h3>
      ${shown.lead ? paras(shown.lead) : ""}
      ${items ? `<ul>${items}</ul>` : ""}
      ${shown.note ? `<div class="note is-sum"><h3 class="verdict">Вывод</h3>${paras(shown.note)}</div>` : ""}
    </section>`
  }
  const shown = plainReading(reading, true)
  const items = shown.items.map((item) => {
    const chunks = String(item.body || "").split(/\n\n+/).filter(Boolean)
    const first = chunks[0] || ""
    const rest = chunks.slice(1).map((part) => `<p>${escapeHtml(part)}</p>`).join("")
    return `<li><p><b>${escapeHtml(item.role)} — ${escapeHtml(item.name)}.</b> ${escapeHtml(first)}</p>${rest}${item.personal ? `<div class="pers">${escapeHtml(item.personal)}</div>` : ""}</li>`
  }).join("")
  return `<section class="reading">
    <h3>${escapeHtml(reading.title)}</h3>
    ${shown.lead ? paras(shown.lead) : ""}
    ${items ? `<ul>${items}</ul>` : ""}
    ${shown.note ? `<div class="note">${paras(shown.note)}</div>` : ""}
  </section>`
}

function resetHtml(person) {
  const who = person?.gen || person?.short || ""
  return `<button class="text-button reset-spread" data-action="reset" type="button" aria-label="${who ? `Новый расклад у ${who}` : "Новый расклад"}">Новый расклад</button>`
}

function laidCount(spread) {
  return (spread?.cards || []).filter((item) => !item.vacant).length
}

function tableWords(person, spread) {
  const one = laidCount(spread) <= 1
  if (person?.id === "einar") {
    return one
      ? { look: "ту же руну", gaze: "руну", stay: "Руна остаётся та же", these: "этой руне", done: "эту руну" }
      : { look: "те же руны", gaze: "руны", stay: "Руны остаются те же", these: "этим рунам", done: "эти руны" }
  }
  if (person?.id === "lin") {
    return one
      ? { look: "тот же знак", gaze: "знак", stay: "Знак остаётся тот же", these: "этому знаку", done: "этот знак" }
      : { look: "те же знаки", gaze: "знаки", stay: "Знаки остаются те же", these: "этим знакам", done: "эти знаки" }
  }
  return { look: "те же карты", gaze: "карты", stay: "Карты остаются те же", these: "этим картам", done: "этот расклад" }
}

function threadHtml(spread, person) {
  const words = tableWords(person, spread)
  const bubbles = []
  spread.thread.forEach((item, index) => {
    bubbles.push(`<p class="bubble me${state.freshBubble === index * 2 ? " is-new" : ""}">${escapeHtml(item.q)}</p>`)
    const answer = item.a
      ? item.a.split(/\n\n+/).filter(Boolean).map((part) => `<span>${escapeHtml(part)}</span>`).join("")
      : `<span class="wait">${escapeHtml(person.short)} смотрит на ${words.look}…</span>`
    bubbles.push(`<div class="bubble them${state.freshBubble === index * 2 + 1 ? " is-new" : ""}"><b>${escapeHtml(person.short)}</b>${answer}</div>`)
  })
  state.freshBubble = -1
  const waiting = spread.thread.some((item) => !item.a)
  const left = followLimit() - spread.thread.length
  const form = left > 0
    ? `<label for="follow">Спросить ${escapeHtml(person.acc || person.short)} ещё
        <textarea id="follow" rows="2" maxlength="160" ${ASK_BOX} placeholder="${escapeHtml(person.followPrompt || person.prompts[0])}"></textarea>
      </label>
      <p class="hint">${words.stay}. Уточнение не тратит расклад.${spreadsLeft() === Infinity ? "" : ` Осталось раскладов на сегодня: ${spreadsLeft()}.`} Уточнений к ${words.these}: ${left} из ${followLimit()}.</p>
      <button class="primary" data-action="follow" type="button"${waiting ? " disabled" : ""}>Спросить</button>`
    : `<p class="hint">На ${words.done} сказано всё.</p>`
  return `<section class="thread" aria-label="Уточнения">
    ${bubbles.join("")}
    ${form}
  </section>`
}

function renderTable() {
  const person = hero()
  const deck = deckById(person.deckId)
  const spread = state.spread
  const sizeIdx = Number.isInteger(state.sizeIdx) ? state.sizeIdx : person.defaultSize
  const shown = spread ? spread.cards : []
  const cards = spread
    ? shown.map((item, index) => (deck.art === "hex"
      ? guaFace(item, index, spread)
      : cardFace(item, index, deck, spread.open[index], spread.fresh))).join("")
    : ""
  const opened = allOpen(spread)
  const voiceWait = Boolean(opened && spread.reading?.pending && !spread.reading.voiced && !spread.reading.speech)
  const sizes = person.sizes.length > 1
    ? `<div class="segment" role="group" aria-label="Сколько карт">
        ${person.sizes.map((size, index) => `<button type="button" class="seg${index === sizeIdx ? " on" : ""}" data-action="size" data-index="${index}" aria-pressed="${index === sizeIdx}">
          <b>${size.count} ${unitWord(person, size.count)}</b><span>${escapeHtml(size.name)}</span>
        </button>`).join("")}
      </div>
      <p class="size-gives">${escapeHtml(person.sizes[sizeIdx]?.gives || "")}</p>`
    : `<p class="size-gives"><b>${person.sizes[0].count} ${unitWord(person, person.sizes[0].count)}.</b> ${escapeHtml(person.sizes[0].gives || "")}</p>`
  const ownOn = Boolean(state.question.trim())
  const ask = `<div class="table-bar">
      ${sizes}
      <p class="ask-kicker">Готовый вопрос</p>
      <div class="prompts ask-list">
        ${person.prompts.map((text) => `<button type="button" class="ghost${!ownOn && state.pickedPrompt.trim() === text ? " on" : ""}" data-action="prompt" data-text="${escapeHtml(text)}">${escapeHtml(text)}</button>`).join("")}
      </div>
      <label for="question">Свой вопрос
        <textarea id="question" rows="2" maxlength="160" ${ASK_BOX} placeholder="${escapeHtml(OWN_ASK)}"></textarea>
      </label>
      <p class="courtesy">${escapeHtml(CARD_OATH)} ${escapeHtml(spreadQuotaLine())}</p>
      ${accountHtml()}
      <p class="status" role="status">${escapeHtml(state.status)}</p>
      <button class="primary" data-action="sit" type="button">${spreadsLeft() <= 0 ? "Колода отдыхает" : person.spreadId === "hexagram" ? "Бросить монеты" : person.spreadId === "runes" ? "Кинуть руны" : "Положить карты"}</button>
    </div>`
  const restPanel = `<div class="rest-panel">
      <span class="rest-ico">${REST_ICON}</span>
      <p class="meta">Стол отдыхает</p>
      <h3>Карты ${escapeHtml(person.gen || person.short)} сказали всё на сегодня</h3>
      <p>Все расклады на сегодня уже легли. Новый вопрос — после полуночи, <span data-until>${untilMidnight()}</span>. Сегодняшние ответы ждут в журнале.</p>
      ${offerHtml()}
      <button class="primary" data-action="openYesNo" type="button">Спросить «да или нет»</button>
      <button class="secondary" data-action="openSky" type="button">Гороскоп на день</button>
      <button class="text-button" data-action="tab" data-tab="journal" type="button">Открыть журнал</button>
      ${pushOfferHtml()}
    </div>`
  const rest = !spread && resting()
  const asked = spread?.question ? `<p class="asked">«${escapeHtml(spread.question)}»</p>` : ""
  const openHead = spread && person.spreadId === "hexagram"
    ? `<div class="cast-block">${castKickerHtml(spread)}${asked}</div>`
    : asked
  const after = spread
    ? (opened
      ? `${openHead}
        ${readingHtml(spread.reading, person, spread)}
        ${voiceWait ? "" : threadHtml(spread, person)}
        ${resetHtml(person)}`
      : person.spreadId === "hexagram"
        ? `<div class="cast-block">
            ${castKickerHtml(spread)}
            ${asked}
            <p class="hint center cast-live" aria-live="polite">${escapeHtml(castHint(spread))}</p>
          </div>`
        : `${asked}
        <p class="hint center cast-live" aria-live="polite">${person.spreadId === "runes"
          ? "Коснитесь камней, чтобы открыть их по одной."
          : "Коснитесь карт, чтобы открыть их по одной."}</p>
        <button class="text-button" data-action="flipAll" type="button">Открыть все</button>`)
    : (rest ? restPanel : ask)
  el(`<section class="seated${rest ? " is-resting" : ""}">
    <div class="table-top">
      <button class="back-link" data-action="home" type="button" data-buzz="tap">‹ Зал</button>
      <div class="who">
        <img class="mini" src="${person.portrait}" alt="" />
        <div>
          <p class="meta">${escapeHtml(person.theme)} · ${escapeHtml(person.title)}</p>
          <h2>${escapeHtml(person.name)}</h2>
        </div>
      </div>
    </div>
    <div class="table-scene" data-cloth="${deck.cloth}">
      <img class="table-art fade" src="${person.table}" alt="Стол ${escapeHtml(person.name)}, вид сверху" />
      ${deck.cloth === "changes" ? cashHtml(spread) : ""}
      ${cards
        ? `<div class="spread" data-count="${shown.length}">${cards}</div>`
        : `<p class="invite">${rest ? "Стол накрыт платком до полуночи." : escapeHtml(person.line)}</p>`}
      ${deck.cloth === "changes" && spread ? castChipHtml(spread) : ""}
    </div>
    ${after}
  </section>`)
}

function journalEntry(entry) {
  const [year, month, day] = String(entry.date).split("-")
  const person = entry.hero ? heroById(entry.hero) : null
  const label = entry.type === "daily"
    ? "Карта дня"
    : entry.type === "yesno"
      ? `Да или нет · ${VERDICT_WORD[verdictOf(entry.cards?.[0])]}`
      : entry.type === "moon"
        ? `${MOON_PHASES[entry.phase]?.title || "Лунный расклад"}${entry.sign ? ` · Луна в ${entry.sign}` : ""}`
        : (person ? `${person.short} · ${entry.size || "расклад"}` : "Расклад")
  const art = person ? deckById(person.deckId).art : "arkanum"
  const thumbs = (entry.cards || []).map((id) => {
    const card = byId(id) || hexById(id) || runeById(id) || cardById(id)
    if (!card) return ""
    return `<button type="button" class="jthumb" data-action="zoom" data-id="${card.id}" data-art="${art}" data-role="${escapeHtml(label)}">${cardArt(card, art)}</button>`
  }).join("")
  const said = entry.thread?.length ? `<p class="jthread">Уточнений: ${entry.thread.length}</p>` : ""
  const came = entry.came
    ? `<p class="jcame is-${escapeHtml(entry.came)}">${escapeHtml(OUTCOME_WORD[entry.came] || "")}</p>`
    : canAsk(entry, todayKey())
      ? `<div class="jask"><p>Как вышло?</p>${outcomeButtons(entry)}</div>`
      : ""
  return `<article class="jentry">
    <p class="jdate">${escapeHtml(day)} ${escapeHtml(MONTHS[(+month || 1) - 1] || "")} ${escapeHtml(year)} · ${escapeHtml(label)}</p>
    ${entry.q ? `<p class="jq">«${escapeHtml(entry.q)}»</p>` : ""}
    <div class="jcards">${thumbs}</div>
    ${entry.speech ? `<p class="jspeech">${escapeHtml(entry.speech.slice(0, 220))}${entry.speech.length > 220 ? "…" : ""}</p>` : ""}
    ${said}
    ${came}
    ${entry.laid && person ? `<button class="text-button jopen" type="button" data-action="resume" data-id="${escapeHtml(entry.id)}" data-buzz="tap">Открыть стол ›</button>` : ""}
  </article>`
}

function renderJournal() {
  const list = loadJournal(localStorage)
  const rows = list.length
    ? list.map(journalEntry).join("")
    : `<div class="empty">
        <p>Здесь будут ваши вопросы, карты и ответы тарологов. Запись появляется сама, когда карты легли.</p>
        <button class="primary" type="button" data-action="tab" data-tab="hall">К столам</button>
      </div>`
  el(`<section class="page journal">
    <header class="page-head">
      <p class="eyebrow">Архив</p>
      <h1>Журнал</h1>
      <p class="blurb">${escapeHtml(JOURNAL_HOME)}</p>
    </header>
    <div class="jlist">${rows}</div>
  </section>
  ${tabbar("journal")}`)
}

function ynResultHtml(result) {
  const card = result.card
  const personal = personalize(card, currentProfile())
  return `<div class="yn-result" data-verdict="${result.verdict}">
    <button class="yn-card" type="button" data-action="zoom" data-id="${card.id}" data-role="Да или нет" aria-label="${escapeHtml(card.name)}">
      <span class="daily-flip${state.ynFresh ? " is-down" : ""}">${cardArt(card)}${backArt()}</span>
    </button>
    <div class="yn-copy">
      <p class="asked">«${escapeHtml(result.question)}»</p>
      <p class="yn-word">${escapeHtml(result.word)}</p>
      <p class="yn-card-name">${escapeHtml(card.name)} · ${escapeHtml(card.hint)}</p>
      <p>${escapeHtml(result.line)}</p>
      <p class="yn-mean">${escapeHtml(card.meaning)}</p>
      ${personal ? `<p class="yn-pers">${escapeHtml(personal)}</p>` : ""}
    </div>
  </div>`
}

function renderYesNo() {
  const left = yesnoLeft()
  const result = state.yn
  const leftLine = left === Infinity
    ? "Вы завсегдатай — спрашивайте сколько хотите. Расклады у тарологов это не тратит."
    : left
    ? `Сегодня можно спросить ещё ${left} ${questionsWord(left)} из ${YESNO_LIMIT}. Расклады у тарологов это не тратит.`
    : "Три вопроса на сегодня заданы. Завтра колода ответит снова."
  const form = left
    ? `<label for="yn">Ваш вопрос
        <textarea id="yn" rows="2" maxlength="120" ${ASK_BOX} placeholder="${escapeHtml(YESNO_PROMPTS[0])}"></textarea>
      </label>
      <div class="prompts">
        ${YESNO_PROMPTS.map((text) => `<button type="button" class="ghost${state.ynQuestion.trim() === text ? " on" : ""}" data-action="ynPrompt" data-text="${escapeHtml(text)}">${escapeHtml(text)}</button>`).join("")}
      </div>
      <p class="status" role="status">${escapeHtml(state.ynStatus)}</p>
      <button class="primary" data-action="askYesNo" type="button">Вытянуть карту</button>`
    : `<p class="status" role="status">${escapeHtml(state.ynStatus)}</p>`
  el(`<section class="page sub yesno">
    <button class="back-link" data-action="home" type="button" data-buzz="tap">‹ Зал</button>
    <header class="page-head">
      <p class="eyebrow">Без счёта раскладов</p>
      <h1>Да или нет</h1>
      <p class="blurb">Одна карта на прямой вопрос. Спросите так, чтобы ответить можно было «да» или «нет». Тот же вопрос сегодня получит ту же карту — карту не перетягивают.</p>
    </header>
    ${result ? ynResultHtml(result) : ""}
    ${result && left ? `<button class="secondary" data-action="ynAgain" type="button">Другой вопрос</button>` : ""}
    ${result ? "" : form}
    <p class="quota">${escapeHtml(leftLine)}</p>
    ${resting() ? "" : `<button class="text-button" data-action="home" type="button">Для сложного вопроса — к столам тарологов</button>`}
  </section>`)
}

function skyMoonHtml() {
  const event = moonWindow()
  if (event) {
    return `<button class="row-link moon-row" type="button" data-action="openMoon" data-buzz="tap"><span><b>${escapeHtml(moonHeadline(event))}</b><span>${escapeHtml(MOON_PHASES[event.phase].title)} открыт до следующего дня после фазы</span></span>${CHEV}</button>`
  }
  const next = nextMoon()
  if (!next) return ""
  return `<p class="quota">Ближайшее ${escapeHtml(MOON_PHASES[next.phase].name)} — ${escapeHtml(moonTime(next.at))}, в ${escapeHtml(next.sign)}. За день до него в зале откроется лунный расклад.</p>`
}

function renderSky() {
  const sky = horoscope(currentProfile()?.sign || "")
  const card = byId(sky.card)
  const rows = sky.lines.map((line) => `<div class="sky-row"><dt>${escapeHtml(line.k)}</dt><dd>${escapeHtml(line.t)}</dd></div>`).join("")
  el(`<section class="page sub sky">
    <button class="back-link" data-action="home" type="button" data-buzz="tap">‹ Зал</button>
    <header class="page-head">
      <p class="eyebrow">Гороскоп на день</p>
      <h1>${escapeHtml(sky.date)}${sky.sign ? ` · ${escapeHtml(sky.sign)}` : ""}</h1>
      <p class="blurb">Луна в ${escapeHtml(sky.moonIn)}, ${escapeHtml(sky.moon.phase.name)}.</p>
    </header>
    ${card ? `<button class="widget sky-card" type="button" data-action="zoom" data-id="${card.id}" data-role="Карта неба">
      <span class="daily-flip">${cardArt(card)}</span>
      <span class="widget-text">
        <span class="meta">Карта неба</span>
        <b>${escapeHtml(card.name)}</b>
        <span class="blurb">Аркан ${escapeHtml(sky.moonGen)} по Золотой заре — в этом знаке сейчас Луна. ${escapeHtml(card.hint[0].toUpperCase() + card.hint.slice(1))}.</span>
      </span>
    </button>` : ""}
    <dl class="sky-list">${rows}</dl>
    ${skyMoonHtml()}
    <p class="quota">Гороскоп считается по солнечным домам от вашего знака: без времени и места рождения точнее не получится. Свой путь по дате рождения разбирает Каэль Морн.</p>
  </section>`)
}

function moonTime(at) {
  return `${moonDate(at)}, около ${String(at.getHours()).padStart(2, "0")}:00`
}

function moonCards(laid, fresh) {
  return `<div class="moon-cards">
    ${laid.map((item, index) => `<button class="moon-card" type="button" data-action="zoom" data-id="${item.card.id}" data-role="${escapeHtml(item.role)}" style="--i:${index}">
      <span class="daily-flip${fresh ? " is-down" : ""}">${cardArt(item.card)}${backArt()}</span>
      <span class="moon-role">${escapeHtml(item.role)}</span>
    </button>`).join("")}
  </div>`
}

function renderMoon() {
  const event = moonWindow()
  const back = `<button class="back-link" data-action="home" type="button" data-buzz="tap">‹ Зал</button>`
  if (!event) {
    const next = nextMoon()
    el(`<section class="page sub moon">
      ${back}
      <header class="page-head">
        <p class="eyebrow">Лунный расклад</p>
        <h1>Луна ещё в пути</h1>
        <p class="blurb">${next ? `Ближайшее ${escapeHtml(MOON_PHASES[next.phase].name)} — ${escapeHtml(moonTime(next.at))}, в ${escapeHtml(next.sign)}. ` : ""}Расклад открывается за день до новолуния или полнолуния и держится до следующего дня после него.</p>
      </header>
    </section>`)
    return
  }
  const phase = MOON_PHASES[event.phase]
  const entry = moonEntry(event.key)
  const laid = entry ? entry.laid.map((item) => ({ role: item.role, card: byId(item.id) })).filter((item) => item.card) : []
  const reading = laid.length ? explainMoon(event.phase, laid) : null
  el(`<section class="page sub moon">
    ${back}
    <header class="page-head">
      <p class="eyebrow">${escapeHtml(moonHeadline(event))}</p>
      <h1>${escapeHtml(phase.title)}</h1>
      <p class="blurb">Точная фаза — ${escapeHtml(moonTime(event.at))}. ${escapeHtml(phase.lead)}</p>
    </header>
    ${reading
      ? `${moonCards(laid, state.moonFresh)}${readingHtml(reading)}`
      : `<div class="moon-roles">${phase.roles.map((role) => `<span>${escapeHtml(role)}</span>`).join("")}</div>
        <button class="primary" data-action="layMoon" type="button">Разложить карты ${event.phase === "new" ? "новолуния" : "полнолуния"}</button>
        <p class="quota">Один расклад на фазу. Расклады у тарологов он не тратит.</p>`}
  </section>`)
}

function suitOf(card) {
  return card.id.includes("_") ? card.id.split("_")[0] : "major"
}

function renderDeck() {
  const groups = SUITS.map((suit) => {
    const cards = DECK.filter((card) => suitOf(card) === suit.id)
    if (!cards.length) return ""
    return `<h2 class="section-title">${suit.name} <span>${cards.length}</span></h2>
      <div class="deck-grid">
        ${cards.map((card) => `<button type="button" class="dthumb" data-action="zoom" data-id="${card.id}" data-role="${escapeHtml(suit.name)}">
          <img class="face" alt="" loading="lazy" data-src="${escapeHtml(deckSrc(card.img))}" data-fallback="" />
          <span>${escapeHtml(card.name)}</span>
        </button>`).join("")}
      </div>`
  }).join("")
  el(`<section class="page deck">
    <header class="page-head">
      <p class="eyebrow">Без оплаты</p>
      <h1>Колода</h1>
      <p class="blurb">${DECK.length} карт. Коснитесь карты, чтобы прочитать значение.</p>
    </header>
    ${groups}
  </section>
  ${tabbar("deck")}`)
}

const CHEV = `<span class="chev" aria-hidden="true">›</span>`

function mailLink(subject, body = "") {
  const query = `subject=${encodeURIComponent(subject)}${body ? `&body=${encodeURIComponent(body)}` : ""}`
  return `mailto:${OPERATOR.email}?${query}`
}

function bugReportBody() {
  return [
    "Что случилось:",
    "",
    "",
    "Что вы ожидали:",
    "",
    "",
    "— Для разработчика —",
    `Версия: ${APP_VERSION}`,
    `Экран: ${window.innerWidth}×${window.innerHeight}`,
    `Браузер: ${navigator.userAgent}`,
  ].join("\n")
}

function lastSpreadEntry() {
  return loadJournal(localStorage).find((item) => item.type === "spread" && item.laid?.length) || null
}

function unclearReportBody(entry) {
  const lines = [
    "Что осталось непонятным (оставьте нужное):",
    "— карты противоречат друг другу",
    "— слишком общо, не про мой вопрос",
    "— слишком длинно",
    "— непонятные слова",
    "",
    "Своими словами:",
    "",
    "",
  ]
  if (entry) {
    const conclusion = String(entry.reading?.note || "").split(/\n\n+/)[0] || ""
    lines.push(
      "— Расклад —",
      `Таролог: ${heroById(entry.hero)?.name || "—"}`,
      `Дата: ${entry.date || "—"}`,
      `Вопрос (можно стереть): ${entry.q || "без вопроса"}`,
      "Карты:",
      ...entry.laid.map((item) => `${item.role} — ${item.name}`),
    )
    if (conclusion) lines.push(conclusion)
    if (entry.thread?.length) lines.push(`Уточнений: ${entry.thread.length}`)
    lines.push("")
  }
  lines.push(`Версия: ${APP_VERSION}`)
  return lines.join("\n")
}

function laidVerb(n) {
  return n % 10 === 1 && n % 100 !== 11 ? "легла" : "легло"
}

function monthHtml() {
  const list = loadJournal(localStorage)
  const stats = monthCards(list, todayKey())
  const lines = monthSummary(stats)
  const came = outcomeStats(list)
  const head = `<h2 class="section-title">Ваш месяц в картах <span>${MONTH_DAYS} дней</span></h2>`
  if (!lines) {
    const need = MONTH_MIN_CARDS - stats.total
    return `${head}<div class="info month">
      <p>За последние ${MONTH_DAYS} дней ${laidVerb(stats.total)} ${stats.total} ${monthCardsWord(stats.total)}. Сводка появится, когда наберётся ещё ${need} ${monthCardsWord(need)}: считаются карта дня, «да или нет», лунные расклады и расклады у столов.</p>
    </div>`
  }
  const max = Math.max(...SUIT_ORDER.map((suit) => stats.suits[suit.id]), 1)
  const bars = SUIT_ORDER.map((suit) => `<div class="mbar">
      <span class="mbar-name">${escapeHtml(suit.name)}</span>
      <span class="mbar-track"><span style="width:${Math.round((stats.suits[suit.id] / max) * 100)}%"></span></span>
      <span class="mbar-n">${stats.suits[suit.id]}</span>
    </div>`).join("")
  const top = stats.top.length
    ? `<div class="mtop">${stats.top.map(({ card, count }) => `<button type="button" class="jthumb" data-action="zoom" data-id="${card.id}" data-role="Карты месяца">${cardArt(card)}<span class="mtop-n">×${count}</span></button>`).join("")}</div>`
    : ""
  const outcome = came.total
    ? `<p class="mcame">Из отмеченных раскладов сбылось ${came.yes}, отчасти ${came.part}, не сбылось ${came.no}.</p>`
    : ""
  return `${head}<div class="info month">
    <p class="mtotal">За ${MONTH_DAYS} дней ${laidVerb(stats.total)} ${stats.total} ${monthCardsWord(stats.total)}.</p>
    <div class="mbars">${bars}</div>
    ${top}
    ${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
    ${outcome}
  </div>`
}

function renderMe() {
  const lastSpread = lastSpreadEntry()
  const toggle = (key, title, text, disabled = false) => `<label class="switch">
      <input type="checkbox" data-action="setting" data-key="${key}"${settings[key] && !disabled ? " checked" : ""}${disabled ? " disabled" : ""} />
      <span><b>${title}</b>${text}</span>
    </label>`
  el(`<section class="page me">
    <header class="page-head">
      <p class="eyebrow">Профиль и настройки</p>
      <h1>Вы</h1>
      ${profileChip()}
    </header>
    <label>Имя
      <input id="name" type="text" maxlength="30" autocomplete="given-name" placeholder="Как к вам обращаться" />
    </label>
    <div>
      <span class="field-name">Когда вы родились</span>
      ${birthFields()}
    </div>
    ${fateArcanaHtml()}
    <div class="info">
      <p><b>Расклады.</b> ${escapeHtml(spreadQuotaLine())}</p>
      <p><b>Где лежит журнал.</b> ${escapeHtml(JOURNAL_HOME)}</p>
    </div>
    ${accountHtml()}
    <p class="status" role="status">${escapeHtml(state.hallNote)}</p>

    ${monthHtml()}

    <h2 class="section-title">Покупки</h2>
    <nav class="rows" aria-label="Покупки">
      <button class="row-link" type="button" data-action="shop"><span><b>${regular() ? "Вы завсегдатай" : "Лавка таверны"}</b><span>${regular() ? `${wallet.sub.renew ? "Продлится" : "Действует до"} ${escapeHtml(dayMonth(wallet.sub.until))}` : `Ещё расклады и подписка «Завсегдатай»`}</span></span>${CHEV}</button>
    </nav>

    <h2 class="section-title">Уведомления</h2>
    ${pushSettingsHtml()}

    <h2 class="section-title">Колода</h2>
    <div class="info push-box">
      ${toggle("candleDeck", "Карты при свече", "Тёплая бумага, оранжевые акценты и тёмная рубашка под цвет таверны. Выключите, чтобы увидеть оригинальную колоду.")}
    </div>

    <h2 class="section-title">Звук и отклик</h2>
    <div class="info push-box">
      ${toggle("sound", "Звук карт", "Тихий шорох карт и звон монет Линь, когда знак собирается и открывается.")}
      ${toggle("haptics", "Вибрация", canBuzz() ? "Короткий отклик телефона на касания." : "Этот телефон не даёт сайтам вибрировать — на iPhone так всегда.", !canBuzz())}
    </div>

    <h2 class="section-title">Связь</h2>
    <nav class="rows" aria-label="Связь">
      <a class="row-link" href="${mailLink("Три окна: вопрос")}"><span><b>Написать нам</b><span>${escapeHtml(OPERATOR.email)}</span></span>${CHEV}</a>
      <a class="row-link" href="${escapeHtml(mailLink("Три окна: непонятный расклад", unclearReportBody(lastSpread)))}"><span><b>Непонятный расклад</b><span>${lastSpread ? "Письмо уже знает карты последнего расклада" : "Сначала сделайте расклад — письмо подхватит его карты"}</span></span>${CHEV}</a>
      <a class="row-link" href="${escapeHtml(mailLink("Три окна: ошибка", bugReportBody()))}"><span><b>Сообщить об ошибке</b><span>Письмо уже знает версию и браузер</span></span>${CHEV}</a>
    </nav>

    <h2 class="section-title">Ваши данные</h2>
    <nav class="rows" aria-label="Документы">
      <button class="row-link" type="button" data-action="doc" data-doc="privacy"><span><b>Политика конфиденциальности</b></span>${CHEV}</button>
      <button class="row-link" type="button" data-action="doc" data-doc="consent"><span><b>Согласие на обработку данных</b></span>${CHEV}</button>
      <button class="row-link danger" type="button" data-action="wipe"><span><b>${state.wipeArmed ? "Нажмите ещё раз — всё сотрётся" : "Удалить мои данные"}</b><span>Профиль, журнал, настройки, покупки на этом телефоне и подписка на уведомления. Это отзывает согласие.</span></span></button>
    </nav>
    <p class="version">Три окна · версия ${APP_VERSION} · ${AGE_RATING}</p>
  </section>
  ${tabbar("me")}`)
}

function renderDoc() {
  const doc = state.doc === "consent" ? consentDoc() : privacyDoc()
  const body = doc.sections.map((section) => `${section.h ? `<h2>${escapeHtml(section.h)}</h2>` : ""}${section.p.map((text) => `<p>${escapeHtml(text)}</p>`).join("")}`).join("")
  el(`<section class="page sub doc">
    <button class="back-link" data-action="docBack" type="button" data-buzz="tap">‹ Назад</button>
    <header class="page-head">
      <p class="eyebrow">Документ</p>
      <h1>${escapeHtml(doc.title)}</h1>
      <p class="blurb">${escapeHtml(doc.lead)}</p>
    </header>
    <article class="doc-body">${body}</article>
    <a class="row-link" href="${mailLink(`Три окна: ${doc.title.toLowerCase()}`)}"><span><b>Вопрос о данных</b><span>${escapeHtml(OPERATOR.email)}</span></span>${CHEV}</a>
  </section>`)
}

function render() {
  document.body.classList.remove("skip-arrive")
  const screen = state.screen
  const tabbed = ["hall", "journal", "deck", "me"].includes(screen)
  document.body.classList.toggle("is-step", screen === "who" || screen === "arrive" || screen === "story")
  document.body.classList.toggle("is-entrance", screen === "arrive" || screen === "story")
  document.body.classList.toggle("has-tabs", tabbed)
  if (screen === "arrive" || screen === "story") renderEntrance()
  else if (screen === "who") renderWho()
  else if (screen === "table") renderTable()
  else if (screen === "lock") renderLock()
  else if (screen === "journal") renderJournal()
  else if (screen === "deck") renderDeck()
  else if (screen === "me") renderMe()
  else if (screen === "yesno") renderYesNo()
  else if (screen === "sky") renderSky()
  else if (screen === "moon") renderMoon()
  else if (screen === "doc") renderDoc()
  else if (screen === "shop") renderShop()
  else renderHall()
  document.body.classList.toggle("has-sheet", Boolean(state.checkout))
  if (state.checkout) {
    stage.insertAdjacentHTML("beforeend", checkoutHtml())
    const sheet = stage.querySelector(".sheet-wrap")
    wire(sheet)
    sheet.querySelector(".sheet .primary")?.focus({ preventScroll: true })
  }
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.checkout) actions.closeCheckout()
})

let wasResting = null
window.setInterval(() => {
  stage.querySelectorAll("[data-until]").forEach((node) => {
    node.textContent = untilMidnight()
  })
  const now = resting()
  if (wasResting !== null && now !== wasResting && ["hall", "table", "yesno"].includes(state.screen)) render()
  wasResting = now
}, 30e3)

// Страница может прийти из HTTP-кэша браузера со старой версией: сверяемся с сервером и перезагружаемся один раз.
async function refreshIfStale() {
  try {
    const html = await fetch("./index.html", { cache: "no-store" }).then((res) => res.text())
    const fresh = Number(html.match(/app\.bundle\.js\?v=(\d+)/)?.[1] || 0)
    const tried = sessionStorage.getItem("tri_okna_reloaded")
    if (fresh > Number(APP_VERSION) && tried !== String(fresh)) {
      sessionStorage.setItem("tri_okna_reloaded", String(fresh))
      const page = location.href.split("#")[0]
      await Promise.all([page, "./index.html"].map((url) => fetch(url, { cache: "reload" }).catch(() => {})))
      location.reload()
    }
  } catch {
    /* без сети остаёмся на текущей версии */
  }
}

navigator.serviceWorker?.addEventListener("message", (event) => {
  if (event.data?.open === "moon" && consented() && knownProfile()) actions.openMoon()
})

async function boot() {
  refreshIfStale()
  render()
  requestAnimationFrame(hideBoot)
  const before = `${state.googleClientId}|${state.appleClientId}|${state.accountLeft}|${state.accountStore}|${state.pushReady}`
  try {
    const data = await fetch("/api/store").then((res) => res.json())
    state.googleClientId = data?.googleClientIds?.[0] || ""
    state.appleClientId = data?.appleClientIds?.[0] || ""
  } catch {
    /* без списка входов экран остаётся прежним */
  }
  await refreshAccount()
  state.pushReady = Boolean(await pushServerKey())
  if (state.pushReady) {
    notePushSeen()
    if (resting()) notePushRest()
  }
  const after = `${state.googleClientId}|${state.appleClientId}|${state.accountLeft}|${state.accountStore}|${state.pushReady}`
  if (before !== after && state.screen !== "arrive" && state.screen !== "story") render()
}

boot()
