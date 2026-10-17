import os
import re
from sqlalchemy import text
from db.database import SessionLocal
from ai.sql_guard import validate_sql_query

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")


def _fallback_text_to_sql(question: str) -> str:
    """Moteur de regles contextuelles pour garantir une reponse immediate meme sans cle LLM."""
    q = question.lower()

    if any(k in q for k in ["chiffre d'affaires", "revenu", "ca", "total vendu", "ventes", "recettes", "combien"]):
        return "SELECT today_revenue_xof, total_sats_collected, paid_invoices_count FROM v_kpis;"

    if any(k in q for k in ["combien de facture", "statut", "en attente", "payee", "impayee"]):
        return "SELECT total_invoices_count, paid_invoices_count, pending_invoices_count FROM v_kpis;"

    if any(k in q for k in ["payout", "reglement", "wave", "orange", "mobile money", "usdt", "conversion"]):
        return "SELECT reference, amount_xof, amount_usdt, beneficiary, status FROM settlements ORDER BY created_at DESC LIMIT 5;"

    if any(k in q for k in ["client", "acheteurs", "qui"]):
        return "SELECT name, phone, email FROM customers LIMIT 5;"

    # Par defaut : les dernieres factures de l'ERP
    return "SELECT reference, customer_name, amount_sat, amount_xof, status, created_at FROM invoices ORDER BY created_at DESC LIMIT 5;"


def _format_natural_answer(question: str, query: str, rows: list[dict]) -> str:
    """Synthese en francais fluide a partir des resultats SQL."""
    if not rows:
        return "Aucune donnee ne correspond a votre demande dans l'ERP."

    first = rows[0]

    if "today_revenue_xof" in first:
        rev = first.get("today_revenue_xof", 0)
        sats = first.get("total_sats_collected", 0)
        paid = first.get("paid_invoices_count", 0)
        return (
            f"Le chiffre d'affaires encaisse s'eleve a {rev:,} FCFA "
            f"({sats:,} satoshis Bitcoin) a travers {paid} facture(s) payee(s)."
        )

    if "total_invoices_count" in first:
        tot = first.get("total_invoices_count", 0)
        paid = first.get("paid_invoices_count", 0)
        pend = first.get("pending_invoices_count", 0)
        return (
            f"L'ERP compte actuellement {tot} facture(s) : "
            f"{paid} confirmee(s) et payee(s), et {pend} en attente de reglement."
        )

    if "beneficiary" in first:
        count = len(rows)
        return f"{count} operation(s) de reglement Mobile Money trouvee(s) dans l'historique recent."

    return f"Voici les {len(rows)} enregistrements correspondants extraits de la base de donnees."


def ask_erp_ai(question: str) -> dict:
    """
    Point d'entree de l'assistant IA ERP (P3).
    Convertit la question en requete SQL, valide via sql_guard, execute et formule la synthese.
    """
    # 1. Generation de la requete SQL
    sql_query = _fallback_text_to_sql(question)

    # 2. Validation par le garde-fou de securite
    is_valid, error = validate_sql_query(sql_query)
    if not is_valid:
        return {
            "answer": f"Requete SQL bloquee par mesure de securite : {error}",
            "sql": sql_query,
            "data": [],
            "error": error,
        }

    # 3. Execution securisee
    session = SessionLocal()
    try:
        result = session.execute(text(sql_query))
        columns = result.keys()
        rows = [dict(zip(columns, row)) for row in result.fetchall()]
        
        # 4. Synthese en francais
        answer = _format_natural_answer(question, sql_query, rows)

        return {
            "answer": answer,
            "sql": sql_query,
            "data": rows,
        }
    except Exception as e:
        return {
            "answer": f"Une erreur est survenue lors de l'interrogation de la base : {str(e)}",
            "sql": sql_query,
            "data": [],
            "error": str(e),
        }
    finally:
        session.close()
