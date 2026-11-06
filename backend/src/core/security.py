import base64
import hashlib
import hmac
import json
import secrets
import time

from pwdlib import PasswordHash

from src.core.config import settings

password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    return password_hash.verify(password, hashed_password)


def create_session_token(user_id: int) -> str:
    payload = json.dumps(
        {"user_id": user_id, "expires_at": int(time.time()) + 60 * 60 * 24 * 7},
        separators=(",", ":"),
    ).encode()
    encoded_payload = base64.urlsafe_b64encode(payload).decode().rstrip("=")
    signature = hmac.new(
        _session_secret(),
        encoded_payload.encode(),
        hashlib.sha256,
    ).hexdigest()
    return f"{encoded_payload}.{signature}"


def get_session_user_id(token: str | None) -> int | None:
    if not token or "." not in token:
        return None
    encoded_payload, provided_signature = token.split(".", 1)
    expected_signature = hmac.new(
        _session_secret(),
        encoded_payload.encode(),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(provided_signature, expected_signature):
        return None
    try:
        padding = "=" * (-len(encoded_payload) % 4)
        payload = json.loads(base64.urlsafe_b64decode(encoded_payload + padding))
        if int(payload["expires_at"]) < int(time.time()):
            return None
        return int(payload["user_id"])
    except (ValueError, KeyError, TypeError, json.JSONDecodeError):
        return None


def _session_secret() -> bytes:
    configured_secret = settings.jwt_secret
    if configured_secret:
        return configured_secret.encode()
    if settings.app_env == "development":
        return b"studysync-development-session-secret"
    raise RuntimeError("JWT_SECRET must be configured outside development.")