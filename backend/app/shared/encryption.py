"""Fernet helpers for OAuth token encryption.

Never log raw or decrypted tokens.
"""

from __future__ import annotations

from functools import lru_cache

from cryptography.fernet import Fernet

from app.config import get_settings


class EncryptionConfigError(RuntimeError):
    pass


@lru_cache(maxsize=1)
def _get_cipher() -> Fernet:
    settings = get_settings()
    key = settings.token_encryption_key
    if not key:
        raise EncryptionConfigError(
            "TOKEN_ENCRYPTION_KEY belum di-set di .env. "
            'Generate dengan: python -c "from cryptography.fernet import Fernet; '
            'print(Fernet.generate_key().decode())"'
        )
    try:
        return Fernet(key.encode())
    except (ValueError, TypeError) as exc:
        raise EncryptionConfigError(
            f"TOKEN_ENCRYPTION_KEY tidak valid (harus base64-encoded 32-byte key): {exc}"
        ) from exc


def encrypt_token(plaintext: str) -> str:
    return _get_cipher().encrypt(plaintext.encode()).decode()


def decrypt_token(ciphertext: str) -> str:
    return _get_cipher().decrypt(ciphertext.encode()).decode()


def validate_encryption_config() -> None:
    _get_cipher()
