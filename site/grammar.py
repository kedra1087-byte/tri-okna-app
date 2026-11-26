"""Проверка русского в ответе модели.

Маленькая модель ошибается в окончаниях. Этот модуль ничего не переписывает сам: он находит
предложения с явной ошибкой, чтобы сервер переспросил модель или убрал такое предложение.
Ловится только то, в чём словарь уверен: слова, которых нет в языке, предлог с чужим падежом,
прилагательное не в том роде или падеже, подлежащее с чужим глаголом, обращение на «ты»,
угаданный пол гостя или того, о ком спрашивают, фамильярность и слова, которых в ответе быть не должно.
"""

import re

try:
    import pymorphy3

    MORPH = pymorphy3.MorphAnalyzer()
except Exception:  # словаря нет — проверка выключена, ответ идёт как есть
    MORPH = None

WORD = re.compile(r"[А-Яа-яЁё]+(?:-[А-Яа-яЁё]+)*")
SENTENCE_END = re.compile(r"(?<=[.!?…])\s+")
QUOTED = re.compile(r"«[^»]*»")

CASE = {"gen2": "gent", "gen1": "gent", "loc2": "loct", "loc1": "loct", "acc2": "accs", "voct": "nomn"}
PREP = {
    "без": {"gent"}, "для": {"gent"}, "до": {"gent"}, "из": {"gent"}, "от": {"gent"}, "у": {"gent"},
    "ради": {"gent"}, "кроме": {"gent"}, "среди": {"gent"}, "из-за": {"gent"}, "из-под": {"gent"},
    "к": {"datv"}, "ко": {"datv"},
    "про": {"accs"}, "через": {"accs"},
    "над": {"ablt"}, "перед": {"ablt"}, "между": {"ablt", "gent"},
    "при": {"loct"},
    "о": {"loct", "accs"}, "об": {"loct", "accs"}, "обо": {"loct", "accs"},
    "в": {"loct", "accs"}, "во": {"loct", "accs"}, "на": {"loct", "accs"},
    "за": {"ablt", "accs"}, "под": {"ablt", "accs"},
    "с": {"ablt", "gent", "accs"}, "со": {"ablt", "gent", "accs"},
    "по": {"datv", "loct", "accs"},
}
POSSESSIVE = {"его", "её", "ее", "их"}
CASED = {"NOUN", "ADJF", "PRTF", "NPRO", "NUMR"}
COUNT_WORD = {"два", "две", "три", "четыре", "оба", "обе", "полтора", "полторы", "двух", "трёх", "трех", "четырёх", "четырех"}
BE_ADVERB = {
    "особенно", "просто", "только", "немного", "обязательно", "предельно", "максимально", "достаточно",
    "абсолютно", "действительно", "одинаково", "постоянно", "всегда",
}
SUBJECT = {
    "я": ("1per", "sing"), "мы": ("1per", "plur"), "вы": ("2per", "plur"),
    "он": ("3per", "sing"), "она": ("3per", "sing"), "оно": ("3per", "sing"), "они": ("3per", "plur"),
}
SUBJECT_GENDER = {"он": "masc", "она": "femn", "оно": "neut"}
THOU = re.compile(r"(?i)(?<![а-яё])(?:ты|тебя|тебе|тобой|тобою|твой|твоя|твоё|твое|твои|твоего|твоей|твоему|твоим|твоих|твою)(?![а-яё])")
FAMILIAR = re.compile(
    r"(?i)(?<![а-яё])(?:"
    r"дорог(?:ая|ой|ие)\s+мо[яйи]|мо[яйи]\s+дорог(?:ая|ой|ие)|мо[яйи]\s+хорош(?:ая|ий|ие)|хорош(?:ая|ий|ие)\s+мо[яйи]|"
    r"мил(?:ая|ый|ые)\s+мо[яйи]|мо[яйи]\s+мил(?:ая|ый|ые)|родн(?:ая|ой|ые)\s+мо[яйи]|мо[яйи]\s+родн(?:ая|ой|ые)|"
    r"солнышко|девочки|девочка\s+моя|красавица|красавицы|подруга|подруги\s+мои|зайка|душа\s+моя|дорогуша|голубушка|"
    r"детка|малышка"
    r")(?![а-яё])"
)
FAMILIAR_CALL = re.compile(r"(?i)(?:^|[.!?…]\s+|,\s*)(?:дорогая|дорогой|милая|милый|родная|родной)\s*[,!]")
GENDERED = {
    "муж", "жена", "супруг", "супруга", "мужчина", "женщина", "парень", "девушка", "любовник", "любовница",
    "жених", "невеста", "бойфренд", "избранник", "избранница", "возлюбленный", "возлюбленная",
}
# Формы, которые словарь путает с другими словами («жён» — и от «жена», и от «жёны»).
GENDERED_FORM = re.compile(
    r"(?i)(?<![а-яё])(?:"
    r"муж(?:а|у|ем|е|ья|ей|ьям|ьями|ьях)?|жен(?:а|ы|е|у|ой|ою)|жён(?:ы|ам|ами|ах)?|"
    r"супруг(?:а|у|ом|е|и|ой)?|мужчин(?:а|ы|е|у|ой|ам|ами|ах)?|женщин(?:а|ы|е|у|ой|ам|ами|ах)?|"
    r"парн(?:я|ю|ем|е|и|ей|ям|ями|ях)|парень|девушк(?:а|и|е|у|ой|ам|ами|ах)|девушек"
    r")(?![а-яё])"
)
ALONE = re.compile(
    r"(?i)(?<![а-яё])(?:"
    r"(?:вы|вам|вас|себя|себе|собой)\s+(?:сам|сама|самой|самому|самого|саму)(?![а-яё])|"
    r"(?:сам|сама|самой|самому|самого|саму)\s+(?:себя|себе|с\s+собой)(?![а-яё])|"
    r"(?:вы|вам|вас)\s+(?:один|одна|одной|одному|одну)(?=\s*[,.!?…]|\s+(?:и|а|но|не)\s|$)|"
    r"(?:побыть|остаться|оставаться|быть|жить|справиться|справляться|стоять|идти)\s+(?:одной|одному|одним)(?![а-яё])"
    r")"
)
# Слова, которых нет в словаре, но они есть в языке и в наших текстах.
EXTRA_WORDS = {
    "недосказанность", "недосказанности", "недосказанностью", "недосказанного", "недосказанное",
    "жизнелюбие", "жизнелюбия", "соцсети", "соцсетях", "соцсетей", "мессенджер", "мессенджере",
}
BANNED = re.compile(
    r"(?i)(?<![а-яё])(?:энерги[яиюей]\w*|энергетик\w*|вселенн\w+|вибраци\w+|карм(?:а|ы|у|е|ой|ическ\w+)|чакр\w*|"
    r"вопрошающ\w+|кверент\w*|пользовател\w+|кликбейт\w*|высш\w+\s+сил\w*|космос\w*)(?![а-яё])"
)
# «Он», «она» про человека. Про вещь можно: «страх пройдёт, он уже слабеет».
PERSON_PRONOUN = re.compile(
    r"(?i)(?<![а-яё])(?:(он|ему|него|ним|нём|нем)|(она|неё|нее|ней|нею))(?![а-яё])"
)
# Формы, после которых прилагательное в единственном числе выдаёт пол гостя: «будьте честным».
BE_YOU = {
    "будьте", "будете", "станете", "станьте", "оставайтесь", "останьтесь", "остаётесь", "останетесь",
    "кажетесь", "чувствуете", "почувствуете", "выглядите",
}
BE_INFINITIVE = {"быть", "стать", "оставаться", "остаться", "казаться", "чувствовать", "почувствовать", "становиться"}
ABOUT_GUEST = {
    "вы", "вам", "вас", "важно", "нужно", "надо", "стоит", "хочется", "пора", "лучше", "можете", "сможете",
    "должны", "хотите", "боитесь", "умеете", "готовы", "старайтесь", "постарайтесь", "попробуйте", "продолжайте",
    "перестаньте", "учитесь",
}
NEUTER_THING = {"то", "это", "всё", "все", "что-то", "одно", "оно", "что", "чего", "чему"}
STUB = re.compile(
    r"(?i)(?:одно-два\s+предложения|два-три\s+предложения|прямой\s+ответ\s+на\s+вопрос\s+гостя|"
    r"коротко\s+почему\.\s+один\s+шаг|вопрос\s+гостя|дословн\w+\s+вопрос|текст\s+блока|имя\s+карты)"
)


def available():
    return MORPH is not None


def _case(tag):
    value = tag.case
    return CASE.get(value, value)


def _parses(word):
    return MORPH.parse(word)


def known_word(word):
    """Слово есть в словаре. Составные через дефис проверяются по частям."""
    if MORPH is None:
        return True
    low = word.lower()
    if low in EXTRA_WORDS or MORPH.word_is_known(low) or MORPH.word_is_known(low.replace("ё", "е")):
        return True
    if "-" in low:
        return all(len(part) < 3 or known_word(part) for part in low.split("-"))
    return False


def split_sentences(text):
    return [part.strip() for part in SENTENCE_END.split(str(text or "").strip()) if part.strip()]


def _words(sentence):
    """Слова с отметкой: стоит ли между словом и следующим только пробел."""
    found = []
    matches = list(WORD.finditer(sentence))
    for index, match in enumerate(matches):
        glued = False
        if index + 1 < len(matches):
            gap = sentence[match.end():matches[index + 1].start()]
            glued = gap.strip() == "" and gap != ""
        found.append((match.group(0), glued, match.start()))
    return found


def _only(parses, kinds):
    return bool(parses) and all(parse.tag.POS in kinds for parse in parses)


def _agree_adjective(adjective, noun):
    """Согласовано ли прилагательное с существительным. Дополнение («недоступные логике») ошибкой не считается."""
    if any(parse.normal_form == "который" for parse in adjective):
        return True
    noun_cases = {_case(parse.tag) for parse in noun}
    adjective_cases = {_case(parse.tag) for parse in adjective}
    if not noun_cases <= {"nomn", "accs"} and not (noun_cases & adjective_cases):
        return True
    for left in adjective:
        if left.tag.POS not in ("ADJF", "PRTF"):
            continue
        for right in noun:
            if right.tag.POS != "NOUN":
                continue
            if _case(left.tag) != _case(right.tag):
                continue
            if "Fixd" in right.tag or ("Pltm" in right.tag and left.tag.number == "plur"):
                return True
            if left.tag.number != right.tag.number:
                continue
            if left.tag.number == "plur":
                return True
            gender = right.tag.gender
            if gender is None or "ms-f" in right.tag or left.tag.gender == gender:
                return True
    return False


def _agree_verb(noun, verb):
    for left in noun:
        if left.tag.POS != "NOUN" or _case(left.tag) != "nomn":
            continue
        for right in verb:
            if right.tag.POS != "VERB" or right.tag.tense != "past":
                continue
            if left.tag.number != right.tag.number:
                continue
            if left.tag.number == "plur" or left.tag.gender is None or "ms-f" in left.tag:
                return True
            if left.tag.gender == right.tag.gender:
                return True
    return False


def _pronoun_verb_ok(pronoun, verb):
    person, number = SUBJECT[pronoun]
    for parse in verb:
        tag = parse.tag
        if tag.POS != "VERB":
            return True
        if tag.mood == "impr":
            return True
        if tag.tense == "past":
            if number == "plur" and tag.number == "plur":
                return True
            if number == "sing" and tag.number == "sing":
                wanted = SUBJECT_GENDER.get(pronoun)
                if wanted is None or tag.gender == wanted:
                    return True
            continue
        if tag.person == person and tag.number == number:
            return True
    return False


def _antecedent(text, gender):
    """Есть ли в тексте вещь нужного рода, к которой может относиться «он» или «она»."""
    for match in WORD.finditer(text):
        low = match.group(0).lower()
        if gender == "neut" and low in NEUTER_THING:
            return True
        if len(low) < 3 or low in ("человек", "гость"):
            continue
        for parse in _parses(low):
            if gender == "neut" and parse.tag.POS in ("ADJF", "PRTF") and parse.tag.gender == "neut":
                return True
            tag = parse.tag
            if "Abbr" in tag or "Fixd" in tag:
                continue
            if tag.POS == "NOUN" and tag.number == "sing" and tag.gender == gender and "anim" not in tag:
                return True
    return False


def _person_pronoun(bare, before):
    """«Он» или «она» без вещи, к которой они относятся: значит, речь о человеке."""
    for match in PERSON_PRONOUN.finditer(bare):
        gender = "masc" if match.group(1) else "femn"
        low = match.group(0).lower()
        if low in ("ней", "нею", "ним", "нём", "нем", "него", "неё", "нее", "ему"):
            # В косвенных падежах род вещи может быть и средним: «в нём» — «в чувстве».
            if gender == "masc" and _antecedent(f"{before} {bare[:match.start()]}", "neut"):
                continue
        if _antecedent(f"{before} {bare[:match.start()]}", gender):
            continue
        return match.group(0)
    return ""


def sentence_flaws(sentence, allow=(), other_known=False, before=""):
    """Список ошибок в одном предложении: (вид, слово или пара слов).

    allow — слова из вопроса гостя: их можно повторять. other_known — в вопросе сам гость назвал,
    о ком речь («он», «жена»), тогда так говорить можно. before — предыдущее предложение.
    """
    flaws = []
    bare = QUOTED.sub(" ", sentence)
    allowed = {str(item).lower().replace("ё", "е") for item in allow}
    hit = BANNED.search(bare)
    if hit and hit.group(0).lower().replace("ё", "е") not in allowed:
        flaws.append(("banned", hit.group(0)))
    if STUB.search(bare):
        flaws.append(("stub", STUB.search(bare).group(0)))
    if THOU.search(bare):
        flaws.append(("thou", THOU.search(bare).group(0)))
    hit = FAMILIAR.search(bare) or FAMILIAR_CALL.search(bare)
    if hit:
        flaws.append(("familiar", hit.group(0).strip(" ,!.")))
    hit = ALONE.search(bare)
    if hit:
        flaws.append(("gender", hit.group(0)))
    if not other_known:
        hit = GENDERED_FORM.search(bare)
        if hit and (MORPH is None or any(parse.normal_form in GENDERED for parse in _parses(hit.group(0).lower()))):
            flaws.append(("gender", hit.group(0)))
    if MORPH is None:
        return flaws
    if not other_known:
        pronoun = _person_pronoun(bare, QUOTED.sub(" ", before))
        if pronoun:
            flaws.append(("gender", pronoun))
    words = _words(bare)
    for index, (word, glued, start) in enumerate(words):
        low = word.lower()
        parses = _parses(low)
        proper = word[0].isupper() and start > 0
        if (
            len(low) >= 4
            and not proper
            and low.replace("ё", "е") not in allowed
            and not known_word(low)
        ):
            flaws.append(("word", word))
            continue
        if _only(parses, {"VERB"}) and all(
            parse.tag.person == "2per" and parse.tag.number == "sing" and parse.tag.mood == "indc" for parse in parses
        ):
            flaws.append(("thou", word))
        if low == "вы" and glued and index + 1 < len(words):
            after = _parses(words[index + 1][0].lower())
            if _only(after, {"ADJS", "PRTS"}) and all(parse.tag.number == "sing" for parse in after):
                flaws.append(("gender", f"{word} {words[index + 1][0]}"))
        near = {item[0].lower() for item in words[max(0, index - 3):index]}
        if (low in BE_YOU or (low in BE_INFINITIVE and near & ABOUT_GUEST)) and glued and index + 1 < len(words):
            # «Быть открытой», «чувствуете себя одиноким»: род гостя угадан.
            at = index + 1
            if words[at][0].lower() == "себя" and words[at][1] and at + 1 < len(words):
                at += 1
            after = _parses(words[at][0].lower())
            follower = _parses(words[at + 1][0].lower()) if words[at][1] and at + 1 < len(words) else []
            if (
                _only(after, {"ADJF", "PRTF"})
                and any(parse.tag.number == "sing" and _case(parse.tag) == "ablt" for parse in after)
                and not any(_case(parse.tag) in ("nomn", "accs") for parse in after)
                and not _only(follower, {"NOUN", "ADJF", "PRTF"})
            ):
                flaws.append(("gender", f"{word} {words[at][0]}"))
        if not glued or index + 1 >= len(words):
            continue
        nxt, nxt_glued, _ = words[index + 1]
        nxt_low = nxt.lower()
        nxt_parses = _parses(nxt_low)
        if low in PREP:
            target = nxt_parses
            target_word = nxt
            if nxt_low in POSSESSIVE:
                if nxt_glued and index + 2 < len(words):
                    target_word = words[index + 2][0]
                    target = _parses(target_word.lower())
                else:
                    target = []
            if target and _only(target, CASED) and not any("Fixd" in parse.tag for parse in target):
                cases = {_case(parse.tag) for parse in target if parse.tag.case}
                # «Между вами», не «между вас»: с местоимением только творительный.
                if low == "между" and any(parse.tag.POS == "NPRO" for parse in target):
                    cases = {case for case in cases if case == "ablt"} or cases
                    if "ablt" not in {_case(parse.tag) for parse in target if parse.tag.case}:
                        flaws.append(("case", f"{word} {target_word}"))
                        continue
                if cases and not (cases & PREP[low]):
                    flaws.append(("case", f"{word} {target_word}"))
            continue
        if low in SUBJECT and _only(nxt_parses, {"VERB"}):
            if not _pronoun_verb_ok(low, nxt_parses):
                flaws.append(("verb", f"{word} {nxt}"))
            continue
        if _only(parses, {"ADJF", "PRTF"}) and _only(nxt_parses, {"NOUN"}):
            before = words[index - 1][0].lower() if index else ""
            if before in COUNT_WORD or before.isdigit() or nxt_low == "друг":
                continue
            if not _agree_adjective(parses, nxt_parses):
                flaws.append(("agree", f"{word} {nxt}"))
            continue
        if (
            _only(parses, {"NOUN"})
            and "anim" in parses[0].tag
            and _case(parses[0].tag) == "nomn"
            and _only(nxt_parses, {"INFN"})
        ):
            flaws.append(("verb", f"{word} {nxt}"))
            continue
        if low == "будьте" and nxt_low.endswith("о") and nxt_low not in BE_ADVERB and any(
            parse.tag.POS == "ADJS" and parse.tag.gender == "neut" for parse in nxt_parses
        ):
            flaws.append(("agree", f"{word} {nxt}"))
            continue
        if _only(parses, {"NOUN"}) and all(_case(parse.tag) in ("nomn", "accs") for parse in parses) and any(
            _case(parse.tag) == "nomn" for parse in parses
        ) and _only(nxt_parses, {"VERB"}):
            past = [parse for parse in nxt_parses if parse.tag.tense == "past"]
            if not past or len(past) != len(nxt_parses):
                continue
            object_like = any(_case(parse.tag) == "accs" for parse in parses)
            intransitive = all("intr" in parse.tag for parse in past)
            if (intransitive or not object_like) and not _agree_verb(parses, past):
                flaws.append(("verb", f"{word} {nxt}"))
    return flaws


def text_flaws(text, allow=(), other_known=False):
    """Все ошибки текста: (вид, слово, предложение)."""
    found = []
    before = ""
    for sentence in split_sentences(text):
        for kind, piece in sentence_flaws(sentence, allow, other_known, before):
            found.append((kind, piece, sentence))
        before = sentence
    return found


def clean_sentences(text, allow=(), other_known=False):
    """Текст без предложений с ошибкой. Второе значение — сколько предложений убрано."""
    kept = []
    dropped = 0
    before = ""
    for sentence in split_sentences(text):
        if sentence_flaws(sentence, allow, other_known, before):
            dropped += 1
        else:
            kept.append(sentence)
        before = sentence
    return " ".join(kept).strip(), dropped
