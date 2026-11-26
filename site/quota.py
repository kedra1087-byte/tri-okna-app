"""Три расклада в сутки на аккаунт магазина. День считается по часовому поясу гостя, без пояса — по Москве."""

import json
import secrets
import threading
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

MOSCOW = ZoneInfo("Europe/Moscow")
LIMIT = 3
TICKET_TTL = 20 * 60
FOLLOW_CAP = 3
LOCAL_FOLLOW_CAP = LIMIT * FOLLOW_CAP
# Пояс аккаунта меняется не чаще раза в сутки: иначе прыжками по поясам можно открыть лишний день.
ZONE_HOLD = 24 * 60 * 60


def zone_of(name):
    if not isinstance(name, str) or not name or len(name) > 64:
        return None
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        return None


class Ledger:
    def __init__(self, path, now=None, limit=LIMIT, open_trial=False):
        self.path = Path(path)
        self.now = now or time.time
        self.limit = limit
        # Публичный триал: общий local-trial без дневного потолка (иначе ИИ молчит всем сразу).
        self.open_trial = bool(open_trial)
        self.lock = threading.Lock()

    def _free_trial(self, account):
        return self.open_trial and str(account).split("|")[0] == "local-trial"

    def day(self, zone=MOSCOW):
        return datetime.fromtimestamp(self.now(), zone).date().isoformat()

    def _zone(self, data, account, tz):
        account = str(account).split("|")[0]
        held = data["zones"].get(account)
        asked = zone_of(tz)
        if isinstance(held, dict) and zone_of(held.get("tz")):
            fresh = self.now() - float(held.get("at") or 0) < ZONE_HOLD
            if not asked or held["tz"] == tz or fresh:
                return zone_of(held["tz"])
        if not asked:
            return MOSCOW
        data["zones"][account] = {"tz": tz, "at": self.now()}
        return asked

    def quota(self, account, tz=None):
        with self.lock:
            data = self._load()
            zone = self._zone(data, account, tz)
            self._save(data)
            if self._free_trial(account):
                return {"ok": True, "left": None, "limit": None}
            used = int(data["accounts"].get(self._key(account, zone)) or 0)
            return {"ok": True, "left": max(0, self.limit - used), "limit": self.limit}

    def authorize(self, account, tz=None):
        with self.lock:
            data = self._load()
            zone = self._zone(data, account, tz)
            key = self._key(account, zone)
            free = self._free_trial(account)
            used = int(data["accounts"].get(key) or 0)
            if not free and used >= self.limit:
                self._save(data)
                return {"ok": False, "reason": "rest", "left": 0}
            if not free:
                used += 1
                data["accounts"][key] = used
            ticket = secrets.token_hex(16)
            data["tickets"][ticket] = {
                "account": account,
                "day": self.day(zone),
                "exp": self.now() + TICKET_TTL,
                "voice": False,
            }
            self._save(data)
            return {
                "ok": True,
                "ticket": ticket,
                "left": None if free else self.limit - used,
            }

    def begin_voice(self, account, ticket):
        with self.lock:
            data = self._load()
            row = data["tickets"].get(ticket)
            now = self.now()
            if not isinstance(row, dict) or row.get("account") != account or row.get("exp", 0) < now:
                return "bad-ticket"
            voice = row.get("voice")
            if voice == "done":
                return "spent"
            if voice == "open" and now - float(row.get("voiceAt") or now) < 40:
                return "busy"
            row["voice"] = "open"
            row["voiceAt"] = now
            self._save(data)
            return None

    def finish_voice(self, ticket, ok):
        with self.lock:
            data = self._load()
            row = data["tickets"].get(ticket)
            if not isinstance(row, dict):
                return
            row["voice"] = "done" if ok else False
            self._save(data)

    def follow(self, account, ticket, cap=FOLLOW_CAP):
        """Уточнение к уже разложенным картам. Расклад не тратит, но держит свой предел."""
        with self.lock:
            data = self._load()
            row = data["tickets"].get(ticket)
            if not isinstance(row, dict) or row.get("account") != account:
                return "bad-ticket"
            used = int(row.get("follow") or 0)
            if used >= cap:
                return "enough"
            row["follow"] = used + 1
            self._save(data)
            return None

    def follow_local(self, account, cap=LOCAL_FOLLOW_CAP, tz=None):
        with self.lock:
            data = self._load()
            if self._free_trial(account):
                return None
            key = self._key(f"{account}|follow", self._zone(data, account, tz))
            used = int(data["accounts"].get(key) or 0)
            if used >= cap:
                return "enough"
            data["accounts"][key] = used + 1
            self._save(data)
            return None

    def undo_follow(self, account, ticket=None, tz=None):
        """Неудачный ответ модели не съедает уточнение."""
        with self.lock:
            data = self._load()
            if ticket:
                row = data["tickets"].get(ticket)
                if isinstance(row, dict) and int(row.get("follow") or 0) > 0:
                    row["follow"] = int(row["follow"]) - 1
            else:
                key = self._key(f"{account}|follow", self._zone(data, account, tz))
                used = int(data["accounts"].get(key) or 0)
                if used > 0:
                    data["accounts"][key] = used - 1
            self._save(data)

    def release(self, account, ticket):
        with self.lock:
            data = self._load()
            row = data["tickets"].get(ticket)
            day = row.get("day") if isinstance(row, dict) else None
            key = f"{account}|{day}" if day else self._key(account, self._zone(data, account, None))
            used = int(data["accounts"].get(key) or 0)
            if used > 0:
                data["accounts"][key] = used - 1
            data["tickets"].pop(ticket, None)
            self._save(data)

    def _key(self, account, zone=MOSCOW):
        return f"{account}|{self.day(zone)}"

    def _load(self):
        try:
            raw = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            raw = {}
        accounts = raw.get("accounts") if isinstance(raw, dict) else None
        tickets = raw.get("tickets") if isinstance(raw, dict) else None
        zones = raw.get("zones") if isinstance(raw, dict) else None
        data = {
            "accounts": accounts if isinstance(accounts, dict) else {},
            "tickets": tickets if isinstance(tickets, dict) else {},
            "zones": zones if isinstance(zones, dict) else {},
        }
        now = self.now()
        utc = datetime.fromtimestamp(now, timezone.utc).date()
        # В любом поясе Земли сегодняшняя дата отстоит от UTC не больше чем на сутки.
        live = {(utc + timedelta(days=shift)).isoformat() for shift in (-1, 0, 1)}
        data["accounts"] = {
            key: value for key, value in data["accounts"].items() if str(key).rsplit("|", 1)[-1] in live
        }
        data["zones"] = {
            key: value
            for key, value in data["zones"].items()
            if isinstance(value, dict) and now - float(value.get("at") or 0) < ZONE_HOLD * 7
        }
        data["tickets"] = {
            key: value
            for key, value in data["tickets"].items()
            if isinstance(value, dict) and float(value.get("exp") or 0) > now
        }
        return data

    def _save(self, data):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        tmp.replace(self.path)
