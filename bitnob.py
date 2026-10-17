"""bitnob.py : client Bitnob v2 signe (HMAC-SHA256).
GET = corps vide. On signe EXACTEMENT les octets envoyes (d'ou content= et pas json=)."""
import hashlib
import hmac
import json
import secrets
import time
from typing import Optional

import httpx

from config import config


class BitnobError(Exception):
    def __init__(self, message: str, status: Optional[int] = None, body: Optional[dict] = None):
        super().__init__(message)
        self.status = status
        self.body = body or {}


async def bitnob(method: str, path: str, body: Optional[dict] = None) -> dict:
    payload = json.dumps(body, separators=(",", ":"), ensure_ascii=False) if body is not None else ""
    ts = str(int(time.time()))  # secondes
    nonce = secrets.token_hex(16)
    message = f"{config.bitnob_client_id}:{ts}:{nonce}:{payload}"
    signature = hmac.new(config.bitnob_client_secret.encode("utf-8"), message.encode("utf-8"), hashlib.sha256).hexdigest()
    headers = {
        "Content-Type": "application/json",
        "X-Auth-Client": config.bitnob_client_id,
        "X-Auth-Timestamp": ts,
        "X-Auth-Nonce": nonce,
        "X-Auth-Signature": signature,
    }
    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.request(
            method,
            config.bitnob_base_url + path,
            headers=headers,
            content=payload.encode("utf-8") if payload else None,
        )
    try:
        data = res.json()
    except ValueError:
        data = {}
    if res.status_code >= 400:
        raise BitnobError(data.get("detail") or data.get("message") or f"HTTP {res.status_code}", res.status_code, data)
    return data
