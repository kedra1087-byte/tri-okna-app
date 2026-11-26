/** Колоды. Герой ссылается на deckId. Новая колода — новая запись, не новый экран. */

export const MAJORS = [
  { id: "fool", name: "Дурак", sky: "Воздух", line: "Шаг ещё не стал дорогой." },
  { id: "magician", name: "Маг", sky: "Меркурий", line: "Всё нужное уже лежит на столе." },
  { id: "priestess", name: "Верховная Жрица", sky: "Луна", line: "Тишина знает раньше слов." },
  { id: "empress", name: "Императрица", sky: "Венера", line: "Рост идёт там, где тепло." },
  { id: "emperor", name: "Император", sky: "Овен", line: "Граница, которую вы держите сами." },
  { id: "hierophant", name: "Иерофант", sky: "Телец", line: "Опора в том, что уже проверено." },
  { id: "lovers", name: "Влюблённые", sky: "Близнецы", line: "Выбор между двумя правдами." },
  { id: "chariot", name: "Колесница", sky: "Рак", line: "Движение, даже если внутри шторм." },
  { id: "strength", name: "Сила", sky: "Лев", line: "Мягкая рука сильнее рывка." },
  { id: "hermit", name: "Отшельник", sky: "Дева", line: "Один фонарь на весь подъём." },
  { id: "wheel", name: "Колесо Фортуны", sky: "Юпитер", line: "Поворот уже начался." },
  { id: "justice", name: "Справедливость", sky: "Весы", line: "Счёт сходится, когда его называют." },
  { id: "hanged", name: "Повешенный", sky: "Вода", line: "Пауза меняет картину." },
  { id: "death", name: "Смерть", sky: "Скорпион", line: "Старое отпускает место." },
  { id: "temperance", name: "Умеренность", sky: "Стрелец", line: "Две струи в одной чаше." },
  { id: "devil", name: "Дьявол", sky: "Козерог", line: "Цепь видна, если на неё смотреть." },
  { id: "tower", name: "Башня", sky: "Марс", line: "То, что было тесным, трескается." },
  { id: "star", name: "Звезда", sky: "Водолей", line: "После грозы остаётся свет." },
  { id: "moon", name: "Луна", sky: "Рыбы", line: "Дорога есть, но она мерцает." },
  { id: "sun", name: "Солнце", sky: "Солнце", line: "Ясность без объяснений." },
  { id: "judgement", name: "Суд", sky: "Огонь", line: "Зов, на который пора ответить." },
  { id: "world", name: "Мир", sky: "Сатурн", line: "Круг замкнулся, можно выдохнуть." },
]

const BY_ID = Object.fromEntries(MAJORS.map((card) => [card.id, card]))

export const DECKS = {
  dawn: {
    id: "dawn",
    name: "Арканум",
    cloth: "dawn",
    art: "arkanum",
    backLabel: "роза и луч",
  },
  decan: {
    id: "decan",
    name: "Зал",
    cloth: "decan",
    art: "painted",
    backLabel: "три дуги",
  },
  tide: {
    id: "tide",
    name: "Арканум",
    cloth: "tide",
    art: "arkanum",
    backLabel: "узкий серп",
  },
  ember: {
    id: "ember",
    name: "Арканум",
    cloth: "ember",
    art: "arkanum",
    backLabel: "искра в кольце",
  },
  changes: {
    id: "changes",
    name: "Книга перемен",
    cloth: "changes",
    art: "hex",
    backLabel: "дракон",
  },
  futhark: {
    id: "futhark",
    name: "Старший футарк",
    cloth: "futhark",
    art: "rune",
    backLabel: "жребий",
  },
}

export function deckById(id) {
  return DECKS[id] ?? DECKS.dawn
}

export function cardById(id) {
  return BY_ID[id] ?? null
}

export function majorsExcept(ids) {
  const skip = new Set(ids)
  return MAJORS.filter((card) => !skip.has(card.id))
}
