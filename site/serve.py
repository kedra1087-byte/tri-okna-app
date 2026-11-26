#!/usr/bin/env python3
"""Таверна и голос колоды. Страницы отдаются отсюда, ключ cloud.ru наружу не выходит.

Три расклада в сутки держит сервер: гость подтверждается токеном Google Play или Apple.
"""

import json
import os
import re
import ssl
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from push import Push
from quota import Ledger
from store_auth import StoreAuth, StoreAuthError
import voice
from voice import clip

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
KEY_FILE = ROOT / "cloudru.key"
STORE_FILE = ROOT / "store.json"
MODEL = os.environ.get("CLOUDRU_MODEL", "ai-sage/GigaChat3-10B-A1.8B")
# Та же касса Cloud.ru, другой разработчик. Зовём, только если основная молчит
# или проверка выбросила её вывод целиком.
FALLBACK_MODEL = os.environ.get("CLOUDRU_FALLBACK_MODEL", "openai/gpt-oss-120b")
URL = os.environ.get("CLOUDRU_URL", "https://foundation-models.api.cloud.ru/v1/chat/completions")
# Модель отвечает за секунды. Дольше ждать нет смысла: гость увидит текст колоды.
MODEL_TIMEOUT = 20

AUTH = None
LEDGER = None
PUSH = None
PUSH_ROUTES = {
    "/api/push/subscribe": lambda body: PUSH.subscribe(body),
    "/api/push/unsubscribe": lambda body: PUSH.unsubscribe(body),
    "/api/push/rest": lambda body: PUSH.mark(body, "restDay"),
    "/api/push/seen": lambda body: PUSH.mark(body, "seen"),
    "/api/push/test": lambda body: PUSH.test(body),
}

READING_TOKENS = voice.READING_TOKENS


def api_key():
    env = os.environ.get("CLOUDRU_API_KEY", "").strip()
    if env:
        return env
    if KEY_FILE.is_file():
        return KEY_FILE.read_text(encoding="utf-8").strip()
    return ""


def clean_ids(value):
    if not isinstance(value, list):
        return []
    found = []
    for item in value:
        text = str(item or "").strip()
        if text and text not in found:
            found.append(text)
        if len(found) >= 8:
            break
    return found


def split_env(name):
    return clean_ids(os.environ.get(name, "").split(","))


def load_ids():
    google = split_env("GOOGLE_CLIENT_IDS")
    apple = split_env("APPLE_CLIENT_IDS")
    if STORE_FILE.is_file():
        try:
            data = json.loads(STORE_FILE.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            data = {}
        if isinstance(data, dict):
            google = google or clean_ids(data.get("googleClientIds"))
            apple = apple or clean_ids(data.get("appleClientIds"))
    return google, apple


def auth():
    global AUTH
    if AUTH is None:
        google, apple = load_ids()
        AUTH = StoreAuth(google, apple)
    return AUTH


def ledger():
    global LEDGER
    if LEDGER is None:
        # Аккаунты магазина — 3/день. Публичный триал (local-trial) без потолка.
        LEDGER = Ledger(DATA / "quota.json", open_trial=public_trial_on())
    return LEDGER


def public_store():
    google, apple = load_ids()
    return {"googleClientIds": google, "appleClientIds": apple}


def identity(body):
    store = body.get("store")
    token = body.get("token")
    if store not in ("google", "apple") or not isinstance(token, str) or not token.strip():
        return None, "need-account"
    try:
        return auth().account_for(store, token), None
    except StoreAuthError as exc:
        return None, exc.reason


def handle_quota(body):
    account, reason = identity(body)
    if reason:
        return {"ok": False, "reason": reason}
    return ledger().quota(account, body.get("tz"))


def handle_spread(body):
    account, reason = identity(body)
    if reason:
        return {"ok": False, "reason": reason}
    return ledger().authorize(account, body.get("tz"))


LOCAL_TRIAL = "local-trial"
MODEL_ERRORS = (urllib.error.URLError, KeyError, IndexError, json.JSONDecodeError, TimeoutError, ValueError, OSError)


def public_trial_on():
    """Пока нет магазина: на VPS можно включить пробные расклады через TRI_OKNA_PUBLIC_TRIAL=1."""
    return os.environ.get("TRI_OKNA_PUBLIC_TRIAL", "").strip().lower() in ("1", "true", "yes", "on")


def local_trial(host, headers):
    google, apple = load_ids()
    if google or apple:
        return False
    if public_trial_on():
        return True
    if host not in ("127.0.0.1", "::1"):
        return False
    if headers:
        for name in ("X-Forwarded-For", "Forwarded", "X-Real-IP"):
            if headers.get(name):
                return False
    return True


def ask_voice(runner, complete, spare=None):
    """Сначала основная. Запасная — один раз, если сеть упала или годного вывода не осталось."""
    try:
        out = runner(complete, None)
    except MODEL_ERRORS as exc:
        print(f"основная модель не ответила: {exc!r}")
        out = None
    if out or spare is None:
        return out
    print(f"зову запасную {FALLBACK_MODEL}")
    try:
        return runner(spare, 1)
    except MODEL_ERRORS as exc:
        print(f"запасная модель не ответила: {exc!r}")
        return None


def handle_local_reading(body, complete, key, spare=None):
    """Текстовый ответ на этом компьютере, пока нет аккаунта магазина. Озвучки нет."""
    if not key:
        return {"ok": False, "reason": "no-key"}
    seat = ledger().authorize(LOCAL_TRIAL, body.get("tz"))
    if not seat.get("ok"):
        return {"ok": False, "reason": "rest", "left": 0}
    ticket = seat["ticket"]
    out = ask_voice(lambda fn, tries: voice.reading(body, fn, tries=tries), complete, spare)
    if not out:
        ledger().release(LOCAL_TRIAL, ticket)
        return {"ok": False, "reason": "upstream"}
    ledger().finish_voice(ticket, True)
    out["left"] = seat["left"]
    return out


def handle_reading(body, complete, key, host="", headers=None, spare=None):
    account, reason = identity(body)
    if reason:
        if reason == "need-account" and local_trial(host, headers):
            return handle_local_reading(body, complete, key, spare)
        return {"ok": False, "reason": reason}
    ticket = body.get("ticket") if isinstance(body.get("ticket"), str) else ""
    gate = ledger().begin_voice(account, ticket)
    if gate:
        return {"ok": False, "reason": gate}
    if not key:
        ledger().finish_voice(ticket, False)
        return {"ok": False, "reason": "no-key"}
    out = ask_voice(lambda fn, tries: voice.reading(body, fn, tries=tries), complete, spare)
    if not out:
        ledger().finish_voice(ticket, False)
        return {"ok": False, "reason": "upstream"}
    ledger().finish_voice(ticket, True)
    return out


def handle_followup(body, complete, key, host="", headers=None, spare=None):
    """Уточнение к тем же картам. Расклад из трёх не тратится."""
    account, reason = identity(body)
    if reason and (reason != "need-account" or not local_trial(host, headers)):
        return {"ok": False, "reason": reason}
    if len(clip(body.get("followup"), 200)) < 3:
        return {"ok": False, "reason": "empty"}
    if not key:
        return {"ok": False, "reason": "no-key"}
    if reason:
        gate = ledger().follow_local(LOCAL_TRIAL, tz=body.get("tz"))
    else:
        ticket = body.get("ticket") if isinstance(body.get("ticket"), str) else ""
        gate = ledger().follow(account, ticket)
    if gate:
        return {"ok": False, "reason": gate}
    speech = ask_voice(lambda fn, tries: voice.followup(body, fn, tries=tries), complete, spare)
    if not speech:
        print("уточнение не вышло")
        if reason:
            ledger().undo_follow(LOCAL_TRIAL, tz=body.get("tz"))
        else:
            ledger().undo_follow(account, ticket)
        return {"ok": False, "reason": "upstream"}
    return {"ok": True, "speech": speech}


def complete(text, limit=480, system="", temperature=0.3, model=None):
    """Один запрос к модели. system — кто говорит и как, text — что лежит на столе."""
    chosen = model or MODEL
    messages = [{"role": "user", "content": text}]
    if system:
        messages.insert(0, {"role": "system", "content": system})
    body = {
        "model": chosen,
        "messages": messages,
        "max_tokens": limit,
        "temperature": temperature,
    }
    # gpt-oss всегда пишет ход рассуждения. Короткий ход умещается в лимит и в 20 секунд.
    # Гостю уходит только content: поле reasoning на экран не попадает.
    if str(chosen).startswith("openai/gpt-oss"):
        body["reasoning_effort"] = "low"
    payload = json.dumps(body).encode("utf-8")
    request = urllib.request.Request(
        URL,
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key()}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    context = ssl.create_default_context()
    try:
        with urllib.request.urlopen(request, timeout=MODEL_TIMEOUT, context=context) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read(800).decode("utf-8", "replace")
        print(f"Cloud.ru {exc.code}: {detail}")
        raise
    message = data["choices"][0]["message"]
    content = message.get("content") if isinstance(message, dict) else ""
    if not content:
        print(f"Cloud.ru прислал пустой ответ: {list(message)[:8] if isinstance(message, dict) else message}")
    return str(content or "").strip()


def spare_complete(text, limit=480, system="", temperature=0.3):
    """Тот же запрос запасной модели. Пустое имя в окружении выключает её."""
    if not FALLBACK_MODEL.strip() or FALLBACK_MODEL.strip() == MODEL:
        raise RuntimeError("запасная модель не задана")
    return complete(text, limit=limit, system=system, temperature=temperature, model=FALLBACK_MODEL.strip())


def live_spare():
    if FALLBACK_MODEL.strip() and FALLBACK_MODEL.strip() != MODEL:
        return spare_complete
    return None


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/api/store":
            self.answer(200, public_store())
            return
        if path == "/api/push/key":
            self.answer(200, {"ok": True, "key": PUSH.public_key} if PUSH else {"ok": False})
            return
        super().do_GET()

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        if path not in ("/api/quota", "/api/spread", "/api/reading", "/api/followup", *PUSH_ROUTES):
            self.send_error(404)
            return
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > 120000:
            self.answer(400, {"ok": False, "reason": "bad-json"})
            return
        try:
            body = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self.answer(400, {"ok": False, "reason": "bad-json"})
            return
        if not isinstance(body, dict):
            self.answer(400, {"ok": False, "reason": "bad-json"})
            return
        if path in PUSH_ROUTES:
            self.answer(200, PUSH_ROUTES[path](body) if PUSH else {"ok": False, "reason": "off"})
            return
        if path == "/api/quota":
            self.answer(200, handle_quota(body))
            return
        if path == "/api/spread":
            self.answer(200, handle_spread(body))
            return
        spare = live_spare()
        if path == "/api/followup":
            self.answer(200, handle_followup(body, complete, api_key(), self.client_address[0], self.headers, spare))
            return
        self.answer(200, handle_reading(body, complete, api_key(), self.client_address[0], self.headers, spare))

    def answer(self, status, payload):
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def log_message(self, fmt, *args):
        print("%s - %s" % (self.address_string(), fmt % args), flush=True)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "41791"))
    host = os.environ.get("HOST", "127.0.0.1").strip() or "127.0.0.1"
    PUSH = Push(DATA, contact=os.environ.get("PUSH_CONTACT", "mailto:kedra1087@gmail.com"))
    PUSH.run_forever()
    server = ThreadingHTTPServer((host, port), Handler)
    print(f"Таверна: http://{host}:{port}")
    if public_trial_on():
        print("Пробные расклады без магазина включены (TRI_OKNA_PUBLIC_TRIAL).")
    server.serve_forever()
