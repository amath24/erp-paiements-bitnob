from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from ai.agent import ask_erp_ai

router = APIRouter(prefix="/api/ai", tags=["Assistant IA ERP"])


class AiQueryRequest(BaseModel):
    question: str = Field(..., description="Question en langage naturel sur l'activite de l'ERP", min_length=2)


class AiQueryResponse(BaseModel):
    answer: str
    sql: str
    data: list[dict]
    error: str | None = None


@router.post("/query", response_model=AiQueryResponse)
async def query_erp_ai(req: AiQueryRequest):
    """
    Endpoint de l'assistant IA (P3).
    Prend une question en francais, interroge les vues SQL de maniere securisee
    via sql_guard, et retourne la reponse explicative avec les donnees brutes.
    """
    if not req.question.strip():
        raise HTTPException(status_code=400, detail={"error": "La question ne peut pas etre vide."})

    res = ask_erp_ai(req.question)
    return res
