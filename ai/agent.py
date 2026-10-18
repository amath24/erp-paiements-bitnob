import os
import re
import sqlite3
from dotenv import load_dotenv
from groq import Groq
from ai.sql_guard import validate_sql_query

# Charger les variables du fichier .env
load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b")
client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None


def _clean_sql_code(raw: str) -> str:
    """Nettoie d'eventuelles balises markdown (```sql ... ```) renvoyees par le modele."""
    sql = raw.strip()
    if sql.startswith("```"):
        parts = sql.split("```")
        if len(parts) >= 2:
            sql = parts[1].strip()
            if sql.lower().startswith("sql"):
                sql = sql[3:].strip()
    return sql.strip()


def _fallback_text_to_sql(question: str) -> str:
    """Moteur de regles contextuelles BulkPay pour repondre meme sans cle Groq."""
    q = question.lower()

    if any(k in q for k in ["batch", "lot", "salaires", "campagne"]):
        return "SELECT id, name, status, from_asset, payment_reason, created_at FROM batches ORDER BY created_at DESC LIMIT 5;"

    if any(k in q for k in ["echoue", "echec", "failed", "rejete"]):
        return "SELECT reference, name, amount, currency, country, status, error FROM payouts WHERE status = 'FAILED' LIMIT 20;"

    if any(k in q for k in ["volume", "total envoye", "montant"]):
        return "SELECT currency, COUNT(id) AS total_count, SUM(amount) AS total_volume FROM payouts WHERE status = 'SUCCESS' GROUP BY currency LIMIT 10;"

    if any(k in q for k in ["taux de succes", "reussite", "statut"]):
        return "SELECT status, COUNT(id) AS count FROM payouts GROUP BY status LIMIT 10;"

    # Par defaut : les derniers paiements
    return "SELECT reference, name, amount, currency, country, status, created_at FROM payouts ORDER BY created_at DESC LIMIT 10;"


def _execute_sql_query(query: str) -> list[dict]:
    """Execute la requete SQL en mode STRICTEMENT lecture seule sur la base SQLite locale si disponible."""
    db_path = os.getenv("DATABASE_PATH", "erp.db")
    if not os.path.exists(db_path):
        return []
    try:
        conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute(query)
        rows = [dict(r) for r in cur.fetchall()]
        conn.close()
        return rows
    except Exception as e:
        print(f"[sql_exec_warning] {e}")
        return []


def _format_natural_answer(question: str, query: str, rows: list[dict]) -> str:
    """Synthese en francais fluide a partir des resultats SQL."""
    if not rows:
        return "La requete SQL a ete validee avec succes. Aucune donnee correspondante actuellement en base."

    count = len(rows)
    first = rows[0]

    if "total_volume" in first:
        return f"Synthese des volumes : {count} devise(s) recensee(s) avec succes."

    if "status" in first and "count" in first:
        return f"Repartition des statuts des paiements : {count} categorie(s) extraite(s)."

    return f"Voici les {count} enregistrement(s) correspondant a votre demande."


def ask_erp_ai_with_groq(question: str) -> dict:
    """
    Interroge l'IA Groq (Llama 3.3) pour convertir une question en SQL
    tout en respectant le schema de la base de donnees BulkPay (batches / payouts).
    """
    if not client or not GROQ_API_KEY:
        # Fallback automatique sur les regles BulkPay si pas de cle Groq
        sql_query = _fallback_text_to_sql(question)
        is_valid, error = validate_sql_query(sql_query)
        rows = _execute_sql_query(sql_query) if is_valid else []
        return {
            "answer": _format_natural_answer(question, sql_query, rows) if is_valid else f"Requete bloquee : {error}",
            "sql": sql_query,
            "data": rows,
            "error": error if not is_valid else None,
        }

    # Prompt systeme strict integrant le schema de la base BulkPay
    system_prompt = """Tu es un assistant expert en SQL pour un ERP de paiements de masse (BulkPay).
La base de donnees contient principalement deux tables :
1. 'batches' (lots de paiements) : id, name, status, from_asset, payment_reason, created_at, executed_at
2. 'payouts' (beneficiaires de paiements) : id, batch_id, line, reference, name, account_number, bank_code, destination_type, country, amount, currency, status, fee, created_at, completed_at

Regles strictes :
- Genere UNIQUEMENT une requete SQL valide de type SELECT en lecture seule.
- N'utilise que les tables 'batches' et 'payouts'.
- Ajoute toujours une clause LIMIT (maximum 50) pour eviter les surcharges.
- Reponds UNIQUEMENT par le code SQL brut (sans texte superflu, sans balises markdown)."""

    try:
        completion = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": question},
            ],
            temperature=0.1,
            max_tokens=300,
        )
        sql_raw = completion.choices[0].message.content or ""
        sql_query = _clean_sql_code(sql_raw)

        # Validation de securite avec sql_guard
        is_valid, error = validate_sql_query(sql_query)
        if not is_valid:
            return {
                "answer": f"Requete SQL bloquee par le garde-fou de securite : {error}",
                "sql": sql_query,
                "data": [],
                "error": error,
            }

        rows = _execute_sql_query(sql_query)
        answer = _format_natural_answer(question, sql_query, rows)

        return {
            "answer": answer,
            "sql": sql_query,
            "data": rows,
            "error": None,
        }

    except Exception as e:
        # Repli sur regles en cas d'incident reseau Groq
        sql_fallback = _fallback_text_to_sql(question)
        return {
            "answer": f"Erreur IA Groq ({str(e)}), repli sur regle locale.",
            "sql": sql_fallback,
            "data": _execute_sql_query(sql_fallback),
            "error": str(e),
        }


def ask_erp_ai(question: str) -> dict:
    """Point d'entree unifie de l'assistant IA ERP."""
    return ask_erp_ai_with_groq(question)

