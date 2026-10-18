"""Client HTTP Bitnob avec signature HMAC-SHA256.

Message signé : CLIENT_ID:TIMESTAMP:NONCE:PAYLOAD
 - TIMESTAMP : secondes Unix
 - NONCE     : 16 octets aléatoires en hex
 - PAYLOAD   : le JSON EXACT envoyé (vide s'il n'y a pas de body)
"""
import hashlib
import hmac
import json
import secrets
import time
from typing import Any

import httpx

from app.config import Settings


class BitnobError(Exception):
    def __init__(self, status_code: int, payload: Any):
        self.status_code = status_code
        self.payload = payload
        super().__init__(f"Bitnob API error {status_code}: {payload}")


class BitnobClient:
    def __init__(self, settings: Settings):
        self._client_id = settings.bitnob_client_id
        self._secret = settings.bitnob_client_secret.encode()
        self._http = httpx.AsyncClient(base_url=settings.bitnob_base_url, timeout=30)

    async def aclose(self) -> None:
        await self._http.aclose()

    def _sign(self, body: str) -> dict[str, str]:
        timestamp = str(int(time.time()))
        nonce = secrets.token_hex(16)
        message = f"{self._client_id}:{timestamp}:{nonce}:{body}"
        signature = hmac.new(self._secret, message.encode(), hashlib.sha256).hexdigest()
        return {
            "X-Auth-Client": self._client_id,
            "X-Auth-Timestamp": timestamp,
            "X-Auth-Nonce": nonce,
            "X-Auth-Signature": signature,
            "Content-Type": "application/json",
        }

    async def request(
        self,
        method: str,
        path: str,
        json_body: dict | None = None,
        params: dict | None = None,
    ) -> dict:
        # Corps compact et identique pour la signature ET l'envoi
        body = json.dumps(json_body, separators=(",", ":")) if json_body is not None else ""
        resp = await self._http.request(
            method,
            path,
            content=body.encode() if body else None,
            params=params,
            headers=self._sign(body),
        )
        try:
            data = resp.json()
        except ValueError:
            data = {"raw": resp.text}
        if resp.status_code >= 400 or data.get("success") is False:
            raise BitnobError(resp.status_code, data)
        return data

    async def get(self, path: str, params: dict | None = None) -> dict:
        return await self.request("GET", path, params=params)

    async def post(self, path: str, json_body: dict | None = None) -> dict:
        return await self.request("POST", path, json_body=json_body)
