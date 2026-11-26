"""Тихая правка сломанного слова в ответе модели.

Берём только длинное слово, которого нет в частых русских словах.
Если рядом одно явное слово той же длины, подставляем его.
Короткие слова, имена карт и имя гостя не трогаем.
"""

import re
from pathlib import Path

WORD = re.compile(r"[А-Яа-яЁё]+")
LIST = Path(__file__).resolve().parent / "words" / "ru-50k.txt"
WORDS = None
BUCKETS = None


def norm(word):
    return str(word or "").lower().replace("ё", "е")


def load():
    global WORDS, BUCKETS
    if WORDS is not None:
        return
    words = {}
    if not LIST.is_file():
        WORDS = {}
        BUCKETS = {}
        return
    for line in LIST.read_text(encoding="utf-8").splitlines():
        parts = line.split()
        if len(parts) != 2 or not parts[1].isdigit():
            continue
        surface, count = parts[0], int(parts[1])
        key = norm(surface)
        if len(key) < 2 or not re.fullmatch(r"[а-яе]+", key):
            continue
        slot = words.get(key)
        if slot is None or count > slot[1]:
            words[key] = [surface, count]
        if "ё" in surface.lower() and words[key][1] and count >= words[key][1] * 0.2:
            words[key][0] = surface
    buckets = {}
    for key, (surface, count) in words.items():
        buckets.setdefault((len(key), key[0]), []).append((key, surface, count))
    WORDS = words
    BUCKETS = buckets


def hamming(left, right):
    return sum(one != two for one, two in zip(left, right))


def prefix(left, right):
    size = 0
    for one, two in zip(left, right):
        if one != two:
            break
        size += 1
    return size


def allow(body):
    found = set()
    if not isinstance(body, dict):
        return found
    chunks = [body.get("name"), body.get("question"), body.get("followup")]
    for item in body.get("cards") or []:
        if isinstance(item, dict):
            chunks.extend(item.get(key) for key in ("name", "role", "hint", "meaning", "gd"))
    for chunk in chunks:
        for match in WORD.finditer(str(chunk or "")):
            found.add(norm(match.group(0)))
    return found


def suggest(key):
    """Одно частое слово той же длины. Если спорно, ничего не меняем."""
    load()
    if key in WORDS or len(key) < 8:
        return ""
    found = []
    for other, surface, count in BUCKETS.get((len(key), key[0]), ()):
        distance = hamming(key, other)
        if 0 < distance <= 3 and prefix(key, other) >= 6:
            found.append((count, surface))
    if not found:
        return ""
    found.sort(reverse=True)
    if len(found) > 1 and found[0][0] < found[1][0] * 4:
        return ""
    return found[0][1]


def match_case(source, suggestion):
    if source.isupper():
        return suggestion.upper()
    if source[:1].isupper():
        return suggestion[:1].upper() + suggestion[1:]
    return suggestion


def spell_fix(text, body=None):
    load()
    known = allow(body)

    def replace(match):
        word = match.group(0)
        key = norm(word)
        if key in WORDS or key in known:
            return word
        suggestion = suggest(key)
        if not suggestion or norm(suggestion) == key:
            return word
        return match_case(word, suggestion)

    return WORD.sub(replace, str(text or ""))
