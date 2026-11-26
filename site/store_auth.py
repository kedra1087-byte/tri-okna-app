"""Проверка входа Google Play и Apple. Аккаунт берётся из подписи токена, не из письма клиента."""

from jwt import InvalidTokenError, decode

GOOGLE_ISSUERS = ("accounts.google.com", "https://accounts.google.com")
APPLE_ISSUER = "https://appleid.apple.com"
GOOGLE_CERTS = "https://www.googleapis.com/oauth2/v3/certs"
APPLE_CERTS = "https://appleid.apple.com/auth/keys"


class StoreAuthError(Exception):
    def __init__(self, reason):
        super().__init__(reason)
        self.reason = reason


class StoreAuth:
    def __init__(self, google_ids, apple_ids, jwk_clients=None):
        self.google_ids = list(google_ids or [])
        self.apple_ids = list(apple_ids or [])
        self._clients = dict(jwk_clients or {})

    def account_for(self, store, token):
        if store not in ("google", "apple"):
            raise StoreAuthError("need-account")
        if not isinstance(token, str) or not token.strip() or len(token) > 8000:
            raise StoreAuthError("need-account")
        ids = self.google_ids if store == "google" else self.apple_ids
        if not ids:
            raise StoreAuthError("need-account")
        try:
            key = self._client(store).get_signing_key_from_jwt(token).key
        except Exception as exc:
            raise StoreAuthError("bad-token") from exc
        return account_from_token(store, token, ids, key)

    def _client(self, store):
        if store not in self._clients:
            from jwt import PyJWKClient
            url = GOOGLE_CERTS if store == "google" else APPLE_CERTS
            self._clients[store] = PyJWKClient(url, cache_keys=True, lifespan=3600)
        return self._clients[store]


def account_from_token(store, token, client_ids, key):
    try:
        payload = decode(
            token,
            key,
            algorithms=["RS256", "ES256"],
            audience=list(client_ids),
            options={"verify_iss": False},
            leeway=10,
        )
    except InvalidTokenError as exc:
        raise StoreAuthError("bad-token") from exc
    issuer = payload.get("iss")
    if store == "google" and issuer not in GOOGLE_ISSUERS:
        raise StoreAuthError("bad-token")
    if store == "apple" and issuer != APPLE_ISSUER:
        raise StoreAuthError("bad-token")
    subject = payload.get("sub")
    if not isinstance(subject, str) or not subject.strip() or len(subject) > 128:
        raise StoreAuthError("bad-token")
    return f"{store}:{subject.strip()}"
