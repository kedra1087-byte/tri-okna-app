"""Голос стола: что сказать модели и как проверить её ответ.

Модель маленькая. Смысл каждой позиции гость уже читает из колоды, и эти тексты вычитаны.
Модель пишет только общий вывод под вопрос. Ответ читается по предложениям: предложение
с ошибкой русского, с угаданным полом, с чужой картой, с обещанием или с дословной копией
колоды убирается целиком. Слова внутри предложений не правятся и не вырезаются. Если вывода
не осталось, гость видит вывод колоды.
"""

import re
import time

import grammar

READING_TOKENS = 900
FOLLOW_TOKENS = 320
ATTEMPTS = 3
TEMPERATURES = (0.3, 0.45, 0.6)
# После этого времени новая попытка не начинается: гость не должен ждать ответ минуту.
RETRY_BUDGET = 12.0
GOOD_ENOUGH = 1

HEROES = {
    "iris": ("Ирис", "хозяйка таверны и гадаете на картах Таро"),
    "cael": ("Каэль", "звездочёт таверны и читаете карты Таро"),
    "nerra": ("Нерра", "гадаете на картах Таро о любви и отношениях"),
    "sol": ("Соль", "гадаете на картах Таро о работе и деньгах"),
    "lin": ("Линь Цзин", "гадаете по Книге перемен"),
    "einar": ("Эйнар", "читаете руны"),
}

# Слово на столе: подпись блока, «каждой карты», «карты, которых нет», «три карты».
LOTS = {
    "card": ("Карта", "каждой карты", "карты, которых нет на столе", ("карта", "карты", "карт")),
    "sign": ("Знак", "каждого знака", "знаки, которых нет на столе", ("знак", "знака", "знаков")),
    "rune": ("Руна", "каждой руны", "руны, которых нет на столе", ("руна", "руны", "рун")),
}

ROLE_NOTE = {
    "Ответ": "прямой ответ на вопрос гостя",
    "Суть вопроса": "в чём суть ситуации",
    "Что делать": "как гостю лучше поступить",
    "К чему идёт": "к чему всё идёт",
    "Куда идёт": "к чему всё идёт",
    "Куда ведёт": "к чему всё ведёт",
    "На этот вопрос": "ответ на вопрос гостя",
    "Вы": "что сейчас на душе у гостя",
    "Другой человек": "что чувствует и как ведёт себя человек, о котором спрашивает гость",
    "Что между вами": "что происходит между гостем и этим человеком",
    "Что мешает": "что мешает",
    "Где вы сейчас": "в каком положении гость сейчас",
    "Что держит": "что удерживает гостя на месте",
    "Деньги": "что с деньгами",
    "Карта знака": "карта солнечного знака гостя, она показывает, с каким настроем гость подходит к вопросу",
    "Знак": "ответ на вопрос гостя",
    "Сейчас": "что происходит сейчас",
    "Перемена": "во что это переходит",
    "Ход": "как пойдёт дело",
    "Откуда идёт": "с чего всё началось",
    "Как идёт": "что происходит сейчас",
    "Как придёт": "чем это обернётся",
    "Утро": "каким будет утро",
    "День": "каким будет день",
    "Вечер": "каким будет вечер",
}

HEAD = re.compile(r"(?im)^[ \t]*(?:Карта|Знак|Руна)[ \t]*:[ \t]*(.+?)[ \t]*$")
VERDICT = re.compile(r"(?im)^[ \t]*Вывод[ \t]*[.:]?[ \t]*")
DASH = re.compile(r"\s+[—–-]\s+")
# Гость сам назвал, о ком спрашивает: тогда «он», «она», «жена» можно повторять.
OTHER_NAMED = re.compile(
    r"(?i)(?<![а-яё])(?:он|она|его|её|ее|ему|ей|ним|ней|нему|него|неё|нее|нём|нем|"
    r"муж\w*|жен[аыеуо]\w*|жён\w*|супруг\w*|парен\w*|парн\w+|девушк\w*|мужчин\w*|женщин\w*|"
    r"бывш\w+|любим\w+|партн[её]р\w*|друг\w*|подруг\w*|начальни\w+|шеф\w*|коллег\w+|"
    r"мам\w+|мать|матери|пап\w+|отец|отц\w+|сын\w*|доч\w+|брат\w*|сестр\w+|жених\w*|невест\w+)(?![а-яё])"
)
FORK = re.compile(r"(?i)(?<![а-яё])или(?![а-яё])")
SUIT = r"(?:жезлов|кубков|мечей|пентаклей)"
FOREIGN_CARD = re.compile(
    rf"(?i)(?<![а-яё])(?:туз\w*|двойк\w*|тройк\w*|четв[её]рк\w*|пят[её]рк\w*|шест[её]рк\w*|сем[её]рк\w*|"
    rf"восьм[её]рк\w*|девятк\w*|десятк\w*|паж\w*|рыцар\w*|королев\w*|корол\w*)\s+{SUIT}"
)
NAMED_LOT = re.compile(r"(?i)(?<![а-яё])(?:карт\w*|аркан\w*|знак\w*|рун\w*|гексаграмм\w*)\s+«([^»]{2,40})»")
HARSH = re.compile(
    r"(?i)(?:не\s+любит\s+вас|вас\s+не\s+любит|вас\s+не\s+любят|этого\s+не\s+будет|этого\s+не\s+случится|"
    r"никогда\s+не\s+(?:вернётся|вернется|напишет|полюбит|простит|получится)|нет\s+будущего|всё\s+кончено|"
    r"вы\s+обречены|вам\s+не\s+суждено)"
)
PROMISE = re.compile(
    r"(?i)(?:обязательно\s+(?:сбудется|вернётся|вернется|получится|случится|напишет|встретите)|"
    r"точно\s+(?:сбудется|вернётся|вернется|получится|случится|напишет)|гарантир\w+|"
    r"всё\s+будет\s+хорошо|все\s+будет\s+хорошо|непременно\s+(?:сбудется|вернётся|вернется|получится))"
)
DATE = re.compile(
    r"(?i)(?:\d+\s*(?:дн|недел|месяц|лет|год|час)|"
    r"ближайш\w+\s+(?:время|дни|недел\w+)|"
    r"(?<![а-яё])(?:через|в\s+течение)\s+(?:пару|несколько|два|две|три|четыре|пять|шесть|семь|десять)?\s*"
    r"(?:дн[яейи]\w*|недел\w+|месяц\w*)|"
    r"(?<![а-яё])в\s+(?:январе|феврале|марте|апреле|мае|июне|июле|августе|сентябре|октябре|ноябре|декабре)(?![а-яё]))"
)
YESNO_ANSWER = re.compile(
    r"(?i)(?:(?<![а-яё])(?:да|нет)(?=\s*[,.])|не\s+похож\w*|пока\s+неясн\w*|люб\w*|чувств\w*|отдаля\w*|"
    r"не\s+с\s+вами|(?<![а-яё])(?:не\s+)?стоит(?![а-яё])|ищет\s+друг)"
)
# Модель иногда говорит о госте в третьем лице: «в душе гостя».
GUEST_META = re.compile(r"(?i)(?<![а-яё])гост(?:ь|я|ю|ем|е|и|ей|ям|ями|ях)(?![а-яё])")
META = re.compile(
    r"(?i)(?:смысл\s*:|позици[яиюей]+\s+«|форм[аеуы]\s+ответа|в\s+списке|на\s+столе\s+лежит|"
    r"как\s+(?:языковая\s+)?модель|искусственн\w+\s+интеллект|нейросет\w+|я\s+не\s+могу\s+(?:помочь|ответить))"
)
WORD = re.compile(r"[А-Яа-яЁё]+")
LABEL = re.compile(r"(?im)^[ \t]*(?:шаг|совет|ответ|почему)[ \t]*:[ \t]*")
# Буква другого алфавита внутри русского слова: «чувстваs».
LATIN_MIX = re.compile(r"[А-Яа-яЁё][A-Za-z]|[A-Za-z][А-Яа-яЁё]")
SIDE_WORDS = re.compile(r"(?i)(?:уход|уходи|уйд|остать|остава|остань)")
YESNO = re.compile(
    r"(?i)(?:любит|есть\s+ли|будет\s+ли|стоит\s+ли|получится\s+ли|верн(?:ётся|ется)|напишет|прид[её]т\s+ли)"
)


def clip(value, size):
    return str(value or "").replace("\x00", "").strip()[:size]


def hero_of(body):
    hero = body.get("hero")
    return hero if hero in HEROES else "iris"


def lot_kind(hero):
    if hero == "lin":
        return "sign"
    if hero == "einar":
        return "rune"
    return "card"


def lot_word(hero):
    return LOTS[lot_kind(hero)][0]


def one_line(text, size):
    """Текст колоды одной строкой: «Простыми словами:» остаётся, переносы — нет."""
    return re.sub(r"\s+", " ", clip(text, size))


def table_lots(body):
    """Что лежит на столе: позиция, имя и текст колоды под этот вопрос."""
    lots = []
    for item in body.get("cards") or []:
        if not isinstance(item, dict):
            continue
        role = clip(item.get("role"), 40)
        name = clip(item.get("name"), 80)
        if not (role or name):
            continue
        lean = one_line(item.get("lean") or item.get("meaning"), 900)
        if not lean and isinstance(item.get("facets"), list):
            # Страница прежней версии: вместо текста под позицию она присылала короткие «грани».
            lean = one_line(" ".join(str(row) for row in item["facets"][:2]), 900)
        lots.append({"role": role, "name": name, "lean": lean, "step": one_line(item.get("step"), 200)})
    return lots[:6]


def other_known(body):
    asked = f"{clip(body.get('question'), 300)} {clip(body.get('followup'), 200)}"
    return bool(OTHER_NAMED.search(asked))


def allowed_words(body):
    """Слова, которые ответ может повторять: вопрос гостя, его имя и имена со стола."""
    said = [clip(body.get("question"), 300), clip(body.get("followup"), 200), clip(body.get("name"), 40)]
    for lot in table_lots(body):
        said.append(lot["name"])
        said.append(lot["role"])
    return {word.lower() for text in said for word in WORD.findall(text)}


def count_phrase(count, forms):
    words = {1: "одна", 2: "две", 3: "три", 4: "четыре", 5: "пять", 6: "шесть"}
    if forms[0] == "знак":
        words = {1: "один", 2: "два", 3: "три", 4: "четыре", 5: "пять", 6: "шесть"}
    form = forms[0] if count == 1 else forms[1] if count < 5 else forms[2]
    return f"{words.get(count, str(count))} {form}"


def system_prompt(body):
    hero = hero_of(body)
    name, who = HEROES[hero]
    _, each, foreign, _ = LOTS[lot_kind(hero)]
    if other_known(body):
        other = (
            "5. Гость сам назвал, о ком спрашивает. Говорите об этом человеке теми же словами, что и гость, "
            "и не придумывайте про него лишнего."
        )
    else:
        other = (
            "5. Человека, о котором спрашивает гость, называйте «этот человек». "
            "Не пишите «он», «она», «муж», «жена», «мужчина», «женщина», «парень», «девушка»: вы не знаете, кто это."
        )
    return "\n".join([
        f"Вы — {name}. Вы {who} в таверне «Три окна». Гость сел к вам за стол и задал вопрос. "
        "Вы отвечаете ему вслух, по-русски.",
        "",
        "Как вы говорите:",
        "1. Грамотно. Предложения простые и полные, не длиннее пятнадцати слов. Проверяйте падежи, род и число.",
        "2. Тепло и по-человечески, как с добрым знакомым. Подойдут слова «смотрите», «знаете», «скажу честно», "
        "«вот что здесь видно». Без канцелярита и без высоких слов.",
        "3. Только на «вы». Не пишите «дорогая», «милая», «родная» и не переходите на «ты».",
        "4. Вы не знаете, мужчина перед вами или женщина. Не пишите о госте «сама», «сам», «одна», «один», "
        "«готова», «готов», «должна», «должен». Пишите «вам важно», «вам стоит», «вы можете», «у вас получится».",
        other,
        "6. Говорите честно, но бережно. Не обещайте, что желание сбудется, и не выносите приговор. "
        "Если хорошего пока не видно, скажите, что видно сейчас и что можно сделать.",
        "7. Не называйте дат и сроков, не ставьте диагнозов. Не пишите слова «энергия», «вселенная», «судьба», «карма».",
        f"8. Смысл {each} гость уже прочитал у себя на экране. Пишите только общий вывод: "
        f"ответьте на вопрос своими словами и не повторяйте готовые фразы дословно. Не называйте {foreign}.",
        "9. О себе не рассказывайте.",
    ])


def lot_lines(lots):
    return "\n".join(
        f"{index}. Позиция «{lot['role']}» — «{lot['name']}». Смысл: {lot['lean'] or 'скажите коротко, что это значит для вопроса'}"
        for index, lot in enumerate(lots, 1)
    )


def role_lines(lots, body):
    lines = []
    seen = set()
    sign = clip(body.get("sign"), 20)
    for lot in lots:
        role = lot["role"]
        note = ROLE_NOTE.get(role)
        if not note or role in seen:
            continue
        seen.add(role)
        if role == "Карта знака" and sign:
            note = f"{note}. Знак гостя — {sign}"
        lines.append(f"«{role}» — {note}.")
    return "\n".join(lines)


def meanings_choose(lots):
    """В текстах колоды уже есть сторона «уйти» или «остаться»."""
    return any(SIDE_WORDS.search(lot["lean"]) for lot in lots)


def reading_prompt(body):
    hero = hero_of(body)
    _, _, foreign, forms = LOTS[lot_kind(hero)]
    lots = table_lots(body)
    question = clip(body.get("question"), 300)
    guest = clip(body.get("name"), 40)
    parts = [f"Вопрос гостя: «{question}»" if question else "Гость спрашивает, каким будет его день."]
    if guest:
        parts.append(f"Гостя зовут {guest}. По имени можно обратиться один раз.")
    if lots:
        parts.append("")
        parts.append(f"На столе {count_phrase(len(lots), forms)}. Гость эти тексты уже прочитал:")
        parts.append(lot_lines(lots))
        roles = role_lines(lots, body)
        if roles:
            parts.append("")
            parts.append("Что значат позиции:")
            parts.append(roles)
    parts.append("")
    parts.append("Напишите только вывод. Форма такая: строка «Вывод.», под ней три или четыре предложения.")
    parts.append("Первое предложение — прямой ответ на вопрос гостя.")
    parts.append("Дальше коротко почему так: опирайтесь на позиции, но своими словами, без дословных фраз из списка.")
    parts.append("Последнее предложение — один небольшой шаг, который можно сделать уже сейчас.")
    side = clip(body.get("side"), 400)
    if side:
        parts.append(f"По этому выбору колода уже сказала: {side} Скажите то же своими словами и не говорите обратное.")
    elif question and FORK.search(question):
        if meanings_choose(lots):
            parts.append("В текстах сторона уже названа. В первом предложении скажите её своими словами.")
        else:
            parts.append(
                "В текстах не сказано, уходить или оставаться. Не выбирайте сторону за гостя. "
                "Скажите, что расклад сторону не называет, и как принять решение."
            )
    elif question and re.search(r"(?i)когда", question):
        parts.append(
            "На вопрос «когда» срок не называйте. Скажите, что время по картам не видно, и что видно вместо срока. "
            "Если гость спрашивает о будущей встрече, не описывайте нынешние отношения."
        )
    elif question and YESNO.search(question):
        parts.append(
            "Вопрос ждёт прямого ответа в первом предложении: да, нет или пока неясно, и сразу почему. "
            "Не говорите «да», если по позиции, которая отвечает на вопрос, человек отдаляется, молчит или уходит. "
            "Имена карт, знаков и рун в выводе не пишите."
        )
    parts.append(f"Не называйте {foreign}.")
    parts.append("Больше ничего не пишите: ни разбора по каждой позиции, ни списков, ни звёздочек.")
    return "\n".join(parts)


def followup_prompt(body):
    hero = hero_of(body)
    _, _, _, forms = LOTS[lot_kind(hero)]
    lots = table_lots(body)
    question = clip(body.get("question"), 300)
    follow = clip(body.get("followup"), 200)
    parts = []
    if question:
        parts.append(f"Первый вопрос гостя: «{question}»")
    parts.append(f"На столе {count_phrase(len(lots), forms)}, они те же:")
    parts.append(lot_lines(lots))
    thread = [item for item in (body.get("thread") or []) if isinstance(item, dict)][-2:]
    if thread:
        parts.append("")
        parts.append("Вы уже говорили с гостем:")
        for item in thread:
            asked = clip(item.get("q"), 200)
            said = re.sub(r"\s+", " ", clip(item.get("a"), 400))
            if asked and said:
                parts.append(f"Гость: «{asked}»")
                parts.append(f"Вы: «{said}»")
    parts.append("")
    parts.append(f"Теперь гость уточняет: «{follow}»")
    parts.append("")
    parts.append(
        "Ответьте на уточнение тремя-четырьмя предложениями. Сначала прямой ответ, потом почему так, "
        "потом один небольшой шаг. Опирайтесь на то, что лежит на столе, и ничего нового не называйте. "
        "Без заголовков, списков и звёздочек."
    )
    return "\n".join(parts)


def tidy(text):
    """Убирает разметку, которую модель добавляет от себя."""
    out = str(text or "").replace("\r", "")
    out = out.replace("*", "").replace("#", "").replace("`", "")
    out = re.sub(r"(?m)^[ \t]*(?:[-•–—]|\d+[.)])[ \t]+", "", out)
    out = re.sub(r"(?i)(?<!\n)[ \t]*(?=(?:Карта|Знак|Руна)[ \t]*:)", "\n", out)
    out = LABEL.sub("", out)
    return out.strip()


def flat(text):
    out = re.sub(r"\s+", " ", str(text or "")).strip()
    return out.strip("\"'")


def norm(text):
    return re.sub(r"[^а-яa-z0-9 ]", "", str(text or "").lower().replace("ё", "е")).strip()


def split_reply(speech, lots):
    """Режет ответ на блоки по столу и вывод. Блок, которого модель не дала, остаётся пустым."""
    text = tidy(speech)
    verdict = None
    for match in VERDICT.finditer(text):
        verdict = match
    if verdict:
        head = text[:verdict.start()]
        note = flat(text[verdict.end():])
    else:
        head, note = text, ""
    bodies = [""] * len(lots)
    marks = list(HEAD.finditer(head))
    free = list(range(len(lots)))
    for index, match in enumerate(marks):
        end = marks[index + 1].start() if index + 1 < len(marks) else len(head)
        title = match.group(1)
        after = head[match.end():end]
        pieces = DASH.split(title, maxsplit=1)
        named = norm(pieces[1] if len(pieces) > 1 else title)
        role = norm(pieces[0]) if len(pieces) > 1 else ""
        slot = None
        for candidate in free:
            key = norm(lots[candidate]["name"])
            if key and (named == key or named.startswith(key + " ")):
                slot = candidate
                break
        if slot is None and role:
            for candidate in free:
                if norm(lots[candidate]["role"]) == role:
                    slot = candidate
                    break
        if slot is None:
            # Имени со стола в заголовке нет: блок про чужую карту, его не берём.
            continue
        free.remove(slot)
        extra = ""
        key = norm(lots[slot]["name"])
        if named != key and len(pieces) > 1:
            # Модель дописала текст в строку заголовка: «Карта: Вы — Маг. У вас всё есть».
            cut = re.search(r"[.!?…]\s+", pieces[1])
            extra = pieces[1][cut.end():] if cut else ""
        bodies[slot] = flat(f"{extra} {after}")
    if not marks and len(lots) == 1 and head.strip():
        bodies[0] = flat(head)
    return bodies, note


def phrase_words(text):
    return [word for word in norm(text).split() if len(word) >= 2]


SPEAKS = re.compile(r"(?i)(?<![а-яё])(?:говорит|показывает|советует|предупреждает|отвечает|просит)(?![а-яё])")
ABOUT_SOMEONE = re.compile(
    r"(?i)(?:человек|отношен|люб|партн|муж|жен|бывш|друг|семь|мам|пап|сын|доч|брат|сестр|начальн|шеф|коллег)"
)


def mentions_lot(sentence, lots):
    """В выводе не называют карту, знак или руну по имени. Обычное слово из названия знака — можно."""
    words = set(norm(sentence).split())
    for lot in lots:
        parts = [part for part in norm(lot["name"]).split() if part]
        if len(parts) >= 2 and all(part in words for part in parts):
            return True
        if len(parts) == 1 and parts[0] in words and SPEAKS.search(sentence):
            return True
    return False


def head_without_verb(sentence):
    """«Перемены к лучшему, но…» — обрывок без глагола."""
    parts = re.split(r"(?i),\s*но\b", sentence, maxsplit=1)
    if len(parts) < 2 or grammar.MORPH is None:
        return False
    words = WORD.findall(parts[0])
    if not (2 <= len(words) <= 5):
        return False
    return not any(
        parse.tag.POS in ("VERB", "INFN", "PRED")
        for word in words
        for parse in grammar.MORPH.parse(word.lower())
    )


def answers_yesno(question, verdict):
    if not question or not YESNO.search(question):
        return True
    return bool(YESNO_ANSWER.search(verdict or ""))


def answers_when(question, verdict):
    """На «когда» нужен прямой отказ называть срок, а не история про нынешние отношения."""
    if not question or not re.search(r"(?i)(?<![а-яё])когда(?![а-яё])", question):
        return True
    return bool(re.search(r"(?i)срок|время|не\s+видно|заранее", verdict or ""))


def echoes(sentence, lots):
    """Четыре слова подряд уже были в тексте, который гость прочитал."""
    said = phrase_words(sentence)
    if len(said) < 4:
        return False
    windows = {" ".join(said[index:index + 4]) for index in range(len(said) - 3)}
    for lot in lots:
        prior = phrase_words(lot["lean"])
        for index in range(len(prior) - 3):
            if " ".join(prior[index:index + 4]) in windows:
                return True
    return False


def sentence_flaw(sentence, body, allow, known, names, before=""):
    """Почему предложение нельзя показать гостю. Пустая строка — можно."""
    if LATIN_MIX.search(sentence):
        return "typo"
    guest = GUEST_META.search(sentence)
    if guest and guest.group(0).lower().replace("ё", "е") not in set(allow):
        return "meta"
    question = clip(body.get("question"), 300)
    roles = " ".join(lot["role"] for lot in table_lots(body))
    about = known or ABOUT_SOMEONE.search(question) or "Другой" in roles or "между вами" in roles
    if re.search(r"(?i)эт(?:от|ого|ому|им)\s+человек", sentence) and not about:
        return "meta"
    if head_without_verb(sentence):
        return "stub"
    flaws = grammar.sentence_flaws(sentence, allow, known, before)
    if flaws:
        return flaws[0][0]
    if META.search(sentence):
        return "meta"
    if HARSH.search(sentence):
        return "harsh"
    if PROMISE.search(sentence):
        return "promise"
    if DATE.search(sentence) and not DATE.search(clip(body.get("question"), 300)):
        return "date"
    if lot_kind(hero_of(body)) == "card":
        hit = FOREIGN_CARD.search(sentence)
        if hit and norm(hit.group(0)) not in names:
            return "foreign"
    for hit in NAMED_LOT.finditer(sentence):
        if norm(hit.group(1)) not in names:
            return "foreign"
    return ""


def clean_block(text, body, allow, known, names, lots=(), echoes_on=False):
    """Блок без негодных предложений и число убранных."""
    kept = []
    dropped = 0
    before = ""
    for sentence in grammar.split_sentences(text):
        if len(sentence) < 3:
            continue
        flawed = sentence_flaw(sentence, body, allow, known, names, before)
        if not flawed and echoes_on and mentions_lot(sentence, lots):
            flawed = "name"
        if not flawed and echoes_on and echoes(sentence, lots):
            flawed = "echo"
        if flawed:
            dropped += 1
        elif sentence.rstrip("»\")")[-1:] not in tuple(".!?…"):
            # Оборванный хвост: модели не хватило места.
            dropped += 1
        else:
            kept.append(sentence)
        before = sentence
    return " ".join(kept).strip(), dropped


def verdict_text(speech, lots):
    """Вывод модели. Если подписи «Вывод» нет, берётся весь ответ: разбор позиций мы не просим."""
    bodies, note = split_reply(speech, lots)
    if note:
        return note
    joined = flat(" ".join(body for body in bodies if body))
    return joined or flat(tidy(speech))


def judge(speech, body):
    """Разбирает вывод. Тексты позиций остаются колоды: их гость уже читает, модель их не переписывает."""
    lots = table_lots(body)
    allow = allowed_words(body)
    known = other_known(body)
    names = {norm(lot["name"]) for lot in lots}
    verdict, dropped = clean_block(verdict_text(speech, lots), body, allow, known, names, lots, echoes_on=True)
    question = clip(body.get("question"), 300)
    if (
        len(grammar.split_sentences(verdict)) < 2
        or not answers_yesno(question, verdict)
        or not answers_when(question, verdict)
    ):
        verdict = ""
    items = [{"role": lot["role"], "name": lot["name"], "body": lot["lean"]} for lot in lots]
    return {"items": items, "note": f"Вывод. {verdict}" if verdict else "", "score": dropped + (0 if verdict else 4)}


def shaped(result, body):
    mark = lot_word(hero_of(body))
    parts = [f"{mark}: {item['role']} — {item['name']}\n{item['body']}" for item in result["items"] if item["body"]]
    if result["note"]:
        parts.append(result["note"])
    out = {"ok": True, "items": result["items"], "speech": "\n\n".join(parts)}
    if result["note"]:
        out["note"] = result["note"]
    return out


def attempts(ask, score_of, started=None, tries=None):
    """Спрашивает модель до трёх раз и возвращает лучший разбор. Первая ошибка сети идёт наружу.

    tries=1 — один запрос. Так зовут запасную модель, чтобы гость не ждал вторую серию.
    """
    started = started if started is not None else time.monotonic()
    best = None
    total = ATTEMPTS if tries is None else tries
    for index in range(total):
        try:
            speech = ask(TEMPERATURES[min(index, len(TEMPERATURES) - 1)])
        except Exception:
            if best is None:
                raise
            break
        result = score_of(speech) if speech else None
        if result and (best is None or result["score"] < best["score"]):
            best = result
        if best and best["score"] <= GOOD_ENOUGH:
            break
        if time.monotonic() - started > RETRY_BUDGET:
            break
    return best


def reading(body, complete, tries=None):
    """Ответ на расклад. None — модель ничего годного не сказала, гость видит текст колоды."""
    if not clip(body.get("question"), 300) and not table_lots(body):
        return None
    system = system_prompt(body)
    user = reading_prompt(body)
    best = attempts(
        lambda temperature: complete(user, READING_TOKENS, system=system, temperature=temperature),
        lambda speech: judge(speech, body),
        tries=tries,
    )
    if not best or not best["note"]:
        return None
    return shaped(best, body)


def judge_followup(speech, body):
    allow = allowed_words(body)
    known = other_known(body)
    names = {norm(lot["name"]) for lot in table_lots(body)}
    text = tidy(speech)
    text = VERDICT.sub("", text)
    text = HEAD.sub("", text)
    clean, dropped = clean_block(flat(text), body, allow, known, names, table_lots(body), echoes_on=True)
    enough = len(grammar.split_sentences(clean)) >= 2
    return {"speech": clean if enough else "", "score": dropped + (0 if enough else 6)}


def followup(body, complete, tries=None):
    """Ответ на уточнение. Пустая строка — говорит колода."""
    system = system_prompt(body)
    user = followup_prompt(body)
    best = attempts(
        lambda temperature: complete(user, FOLLOW_TOKENS, system=system, temperature=temperature),
        lambda speech: judge_followup(speech, body),
        tries=tries,
    )
    return best["speech"] if best else ""
