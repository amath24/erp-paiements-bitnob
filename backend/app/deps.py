from fastapi import Header, HTTPException, Request

from app.bitnob.client import BitnobClient
from app.config import get_settings


def get_client(request: Request) -> BitnobClient:
    return request.app.state.bitnob


def require_api_key(x_api_key: str = Header(default="")) -> None:
    if x_api_key != get_settings().app_api_key:
        raise HTTPException(status_code=401, detail="Invalid API key")
