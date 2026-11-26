"""Пуши таверны по Web Push (RFC 8291 + VAPID, RFC 8292) без сторонних сервисов.

Правила частоты:
- не больше одного пуша в день на подписку;
- только с 10:00 до 21:00 по времени гостя;
- «Карты отдохнули» — утром после дня, когда легли все три расклада, и только если гость ещё не вернулся сам;
- «Новолуние / полнолуние» — вечером в день точной фазы, то есть дважды в месяц.
"""

import base64
import hashlib
import json
import math
import os
import struct
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

KINDS = ("rest", "moon")
PUSH_HOSTS = ("googleapis.com", "mozilla.com", "push.apple.com", "notify.windows.com", "yandex.net", "yandex.ru")
MAX_SUBS = 20000
DAY_START = 10
DAY_END = 21
MOON_HOUR = 19
TEST_LIMIT = 3

SIGN_LOC = ["Овне", "Тельце", "Близнецах", "Раке", "Льве", "Деве", "Весах", "Скорпионе", "Стрельце", "Козероге", "Водолее", "Рыбах"]


def b64u(raw):
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def b64u_decode(text):
    text = str(text)
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def public_bytes(key):
    return key.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)


def hkdf(salt, ikm, info, length):
    return HKDF(algorithm=hashes.SHA256(), length=length, salt=salt, info=info).derive(ikm)


def encrypt(p256dh, auth, plaintext):
    """Тело сообщения в формате aes128gcm (RFC 8188/8291), одна запись."""
    ua_public = b64u_decode(p256dh)
    auth_secret = b64u_decode(auth)
    if len(ua_public) != 65 or len(auth_secret) < 16:
        raise ValueError("bad-keys")
    local = ec.generate_private_key(ec.SECP256R1())
    as_public = public_bytes(local)
    shared = local.exchange(ec.ECDH(), ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), ua_public))
    ikm = hkdf(auth_secret, shared, b"WebPush: info\x00" + ua_public + as_public, 32)
    salt = os.urandom(16)
    cek = hkdf(salt, ikm, b"Content-Encoding: aes128gcm\x00", 16)
    nonce = hkdf(salt, ikm, b"Content-Encoding: nonce\x00", 12)
    body = AESGCM(cek).encrypt(nonce, plaintext + b"\x02", None)
    return salt + struct.pack("!I", 4096) + bytes([len(as_public)]) + as_public + body


def push_host_ok(endpoint):
    parsed = urllib.parse.urlparse(str(endpoint or ""))
    host = (parsed.hostname or "").lower()
    if parsed.scheme != "https" or not host:
        return False
    return any(host == base or host.endswith("." + base) for base in PUSH_HOSTS)


# Луна и Солнце по сокращённой теории Meeus — та же формула, что в connectors/sky-today.js.
def _days(moment):
    return moment.timestamp() / 86400 + 2440587.5 - 2451545.0


def _sin(deg):
    return math.sin(math.radians(deg))


def sun_longitude(moment):
    d = _days(moment)
    anomaly = 357.529 + 0.98560028 * d
    return (280.46 + 0.9856474 * d + 1.915 * _sin(anomaly) + 0.02 * _sin(2 * anomaly)) % 360


def moon_longitude(moment):
    d = _days(moment)
    anomaly = 134.963 + 13.064993 * d
    elong = 297.85 + 12.190749 * d
    sun_anomaly = 357.529 + 0.98560028 * d
    node = 93.272 + 13.22935 * d
    return (
        218.316 + 13.176396 * d
        + 6.289 * _sin(anomaly)
        + 1.274 * _sin(2 * elong - anomaly)
        + 0.658 * _sin(2 * elong)
        + 0.214 * _sin(2 * anomaly)
        - 0.186 * _sin(sun_anomaly)
        - 0.114 * _sin(2 * node)
    ) % 360


def moon_event(local_day_start):
    """Новолуние или полнолуние в эти местные сутки: ("full"|"new", знак Луны) или None."""
    end = local_day_start + timedelta(days=1)
    first = (moon_longitude(local_day_start) - sun_longitude(local_day_start)) % 360
    last = (moon_longitude(end) - sun_longitude(end)) % 360
    sign = SIGN_LOC[int(moon_longitude(local_day_start + timedelta(hours=12)) // 30)]
    if first < 180 <= last:
        return "full", sign
    if last < first:
        return "new", sign
    return None


def zone_of(name):
    try:
        return ZoneInfo(str(name))
    except Exception:
        return ZoneInfo("Europe/Moscow")


class Push:
    def __init__(self, folder, contact="mailto:kedra1087@gmail.com", now=time.time, sender=None):
        self.folder = folder
        self.file = folder / "push.json"
        self.key_file = folder / "vapid.pem"
        self.contact = contact
        self.now = now
        self.lock = threading.Lock()
        self.sender = sender or self._post
        self.key = self._load_key()
        self.subs = self._load_subs()

    # Хранилище

    def _load_key(self):
        self.folder.mkdir(parents=True, exist_ok=True)
        if self.key_file.is_file():
            return serialization.load_pem_private_key(self.key_file.read_bytes(), password=None)
        key = ec.generate_private_key(ec.SECP256R1())
        self.key_file.write_bytes(key.private_bytes(
            serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
        return key

    def _load_subs(self):
        try:
            data = json.loads(self.file.read_text(encoding="utf-8"))
            return data if isinstance(data, dict) else {}
        except (OSError, ValueError):
            return {}

    def _save(self):
        tmp = self.file.with_suffix(".tmp")
        tmp.write_text(json.dumps(self.subs, ensure_ascii=False), encoding="utf-8")
        tmp.replace(self.file)

    @property
    def public_key(self):
        return b64u(public_bytes(self.key))

    @staticmethod
    def sub_id(endpoint):
        return hashlib.sha256(str(endpoint).encode("utf-8")).hexdigest()[:32]

    def _find(self, body):
        return self.subs.get(self.sub_id((body or {}).get("endpoint", "")))

    # API

    def subscribe(self, body):
        sub = body.get("subscription") if isinstance(body, dict) else None
        if not isinstance(sub, dict):
            return {"ok": False, "reason": "bad-subscription"}
        endpoint = sub.get("endpoint")
        keys = sub.get("keys") if isinstance(sub.get("keys"), dict) else {}
        if not push_host_ok(endpoint) or not keys.get("p256dh") or not keys.get("auth"):
            return {"ok": False, "reason": "bad-subscription"}
        kinds = body.get("kinds") if isinstance(body.get("kinds"), dict) else {}
        with self.lock:
            sid = self.sub_id(endpoint)
            if sid not in self.subs and len(self.subs) >= MAX_SUBS:
                return {"ok": False, "reason": "full"}
            old = self.subs.get(sid, {})
            self.subs[sid] = {
                **old,
                "endpoint": endpoint,
                "p256dh": str(keys["p256dh"])[:200],
                "auth": str(keys["auth"])[:100],
                "tz": str(body.get("tz") or old.get("tz") or "Europe/Moscow")[:64],
                "kinds": {kind: bool(kinds.get(kind, old.get("kinds", {}).get(kind, True))) for kind in KINDS},
                "created": old.get("created") or int(self.now()),
            }
            self._save()
        return {"ok": True}

    def unsubscribe(self, body):
        with self.lock:
            removed = self.subs.pop(self.sub_id((body or {}).get("endpoint", "")), None)
            if removed:
                self._save()
        return {"ok": True}

    def mark(self, body, field):
        day = str((body or {}).get("day") or "")[:10]
        if len(day) != 10:
            return {"ok": False, "reason": "bad-day"}
        with self.lock:
            sub = self._find(body)
            if not sub:
                return {"ok": False, "reason": "unknown"}
            sub[field] = day
            if field == "seen" and sub.get("restDay") and day > sub["restDay"]:
                sub.pop("restDay", None)
            self._save()
        return {"ok": True}

    def test(self, body):
        with self.lock:
            sub = self._find(body)
            if not sub:
                return {"ok": False, "reason": "unknown"}
            today = self._local(sub).date().isoformat()
            used = sub.get("tests", {}).get(today, 0)
            if used >= TEST_LIMIT:
                return {"ok": False, "reason": "limit"}
            sub["tests"] = {today: used + 1}
            self._save()
        ok = self.send(sub, {
            "title": "Так приходят вести из таверны",
            "body": "Не чаще раза в день и никогда ночью: утром — когда карты отдохнули, вечером — в новолуние и полнолуние.",
            "tag": "test",
        })
        return {"ok": ok}

    # Отправка

    def _jwt(self, endpoint):
        parsed = urllib.parse.urlparse(endpoint)
        header = b64u(json.dumps({"typ": "JWT", "alg": "ES256"}).encode())
        claims = b64u(json.dumps({
            "aud": f"{parsed.scheme}://{parsed.netloc}",
            "exp": int(self.now()) + 12 * 3600,
            "sub": self.contact,
        }).encode())
        signing = f"{header}.{claims}".encode()
        r, s = decode_dss_signature(self.key.sign(signing, ec.ECDSA(hashes.SHA256())))
        return f"{header}.{claims}.{b64u(r.to_bytes(32, 'big') + s.to_bytes(32, 'big'))}"

    def _post(self, endpoint, headers, data):
        request = urllib.request.Request(endpoint, data=data, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                return response.status
        except urllib.error.HTTPError as error:
            return error.code
        except (urllib.error.URLError, OSError):
            return 0

    def send(self, sub, message):
        endpoint = sub["endpoint"]
        payload = json.dumps({"url": "./", **message}, ensure_ascii=False).encode("utf-8")
        try:
            data = encrypt(sub["p256dh"], sub["auth"], payload)
        except ValueError:
            return False
        status = self.sender(endpoint, {
            "Authorization": f"vapid t={self._jwt(endpoint)}, k={self.public_key}",
            "Content-Encoding": "aes128gcm",
            "Content-Type": "application/octet-stream",
            "TTL": "21600",
            "Urgency": "normal",
        }, data)
        if status in (404, 410):
            with self.lock:
                self.subs.pop(self.sub_id(endpoint), None)
                self._save()
        return 200 <= status < 300

    # Расписание

    def _local(self, sub):
        return datetime.fromtimestamp(self.now(), timezone.utc).astimezone(zone_of(sub.get("tz")))

    def due(self, sub):
        """Какой пуш положен подписке прямо сейчас, или None."""
        local = self._local(sub)
        today = local.date().isoformat()
        if sub.get("sent") == today or not (DAY_START <= local.hour < DAY_END):
            return None
        kinds = sub.get("kinds", {})
        rest_day = sub.get("restDay")
        if kinds.get("rest") and rest_day and today > rest_day and not (sub.get("seen", "") > rest_day):
            return {
                "kind": "rest",
                "title": "Карты отдохнули",
                "body": "Столы снова открыты: три расклада на сегодня ждут вас. Карта дня уже лежит рубашкой вверх.",
                "tag": "rest",
            }
        if kinds.get("moon") and local.hour >= MOON_HOUR:
            start = local.replace(hour=0, minute=0, second=0, microsecond=0)
            event = moon_event(start)
            if event:
                phase, sign = event
                if phase == "full":
                    return {
                        "kind": "moon",
                        "title": f"Сегодня полнолуние в {sign}",
                        "body": "Вечер, когда тайное всплывает. В таверне открыт расклад полнолуния: что проявилось и что пора отпустить.",
                        "tag": "moon",
                        "url": "./#moon",
                    }
                return {
                    "kind": "moon",
                    "title": f"Сегодня новолуние в {sign}",
                    "body": "Время загадывать и начинать с малого. В таверне открыт расклад новолуния: что посеять в новом круге.",
                    "tag": "moon",
                    "url": "./#moon",
                }
        return None

    def tick(self):
        with self.lock:
            jobs = [(sid, dict(sub)) for sid, sub in self.subs.items()]
        sent = 0
        for sid, sub in jobs:
            message = self.due(sub)
            if not message:
                continue
            kind = message.pop("kind")
            ok = self.send(sub, message)
            with self.lock:
                live = self.subs.get(sid)
                if live is None:
                    continue
                if not ok:
                    continue
                live["sent"] = self._local(live).date().isoformat()
                if kind == "rest":
                    live.pop("restDay", None)
                sent += 1
                self._save()
        return sent

    def run_forever(self, every=60):
        def loop():
            while True:
                try:
                    self.tick()
                except Exception as error:  # планировщик не должен ронять сервер
                    print("push tick:", error)
                time.sleep(every)

        thread = threading.Thread(target=loop, name="push", daemon=True)
        thread.start()
        return thread
