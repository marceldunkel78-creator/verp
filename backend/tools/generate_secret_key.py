"""Small helper to generate a strong Django SECRET_KEY.

Usage:
  python backend/tools/generate_secret_key.py

Copy the printed key into your environment (e.g. PowerShell: `setx SECRET_KEY "<key>"`).
"""
import secrets


def generate_secret_key(length: int = 64) -> str:
    # token_urlsafe returns URL-safe base64 string; length param is number of bytes
    return secrets.token_urlsafe(length)


def main():
    key = generate_secret_key(48)
    print(key)


if __name__ == '__main__':
    main()
