import datetime
from pathlib import Path
from sqlalchemy import text
from db.database import Base, engine, SessionLocal
from db.models import Customer, Invoice, Settlement, WebhookEvent


def init_db():
    print("[DB] Creation des tables SQLAlchemy...")
    Base.metadata.create_all(bind=engine)

    views_path = Path(__file__).parent / "views.sql"
    if views_path.exists():
        print("[DB] Execution des vues analytiques (views.sql)...")
        with engine.connect() as conn:
            raw_sql = views_path.read_text(encoding="utf-8")
            # Decoupage par instructions
            for statement in raw_sql.split(";"):
                stmt = statement.strip()
                if stmt:
                    conn.execute(text(stmt))
            conn.commit()


def seed_demo_data():
    session = SessionLocal()
    try:
        # Verifie si des factures existent deja
        if session.query(Invoice).first():
            print("[DB] Donnees deja presentes, aucun re-seeding necessaire.")
            return

        print("[DB] Injection du jeu d'essai pour la demonstration...")

        # 1. Clients
        c1 = Customer(name="Boutique Touba Tech", phone="+221776543210", email="contact@toubatech.sn")
        c2 = Customer(name="Supermarche Al-Baraka", phone="+221781234567", email="caisse@albaraka.sn")
        c3 = Customer(name="Client Comptoir", phone="+221709876543", email="client@dakar.sn")
        session.add_all([c1, c2, c3])
        session.commit()

        # 2. Factures Lightning
        now = datetime.datetime.utcnow()
        invoices = [
            Invoice(
                id="inv_demo_101",
                reference="inv_1713374829_001",
                customer_id=c1.id,
                customer_name=c1.name,
                amount_sat=5000,
                amount_xof=25000,
                description="Paiement Materiel Informatique (Routeur 4G)",
                status="paid",
                paid=True,
                payment_request="lntb50u1p3demo1...",
                demo=False,
                created_at=now - datetime.timedelta(hours=4),
                paid_at=now - datetime.timedelta(hours=3, minutes=45),
            ),
            Invoice(
                id="inv_demo_102",
                reference="inv_1713374829_002",
                customer_id=c2.id,
                customer_name=c2.name,
                amount_sat=2000,
                amount_xof=10000,
                description="Courses Alimentaires Express",
                status="paid",
                paid=True,
                payment_request="lntb20u1p3demo2...",
                demo=False,
                created_at=now - datetime.timedelta(hours=2),
                paid_at=now - datetime.timedelta(hours=1, minutes=50),
            ),
            Invoice(
                id="inv_demo_103",
                reference="inv_1713374829_003",
                customer_id=c3.id,
                customer_name=c3.name,
                amount_sat=1200,
                amount_xof=6000,
                description="Cafe & Patisseries - Caisse 1",
                status="paid",
                paid=True,
                payment_request="lntb12u1p3demo3...",
                demo=True,
                created_at=now - datetime.timedelta(minutes=45),
                paid_at=now - datetime.timedelta(minutes=40),
            ),
            Invoice(
                id="inv_demo_104",
                reference="inv_1713374829_004",
                customer_id=c1.id,
                customer_name=c1.name,
                amount_sat=8000,
                amount_xof=40000,
                description="Abonnement Fibre Optique Pro",
                status="pending",
                paid=False,
                payment_request="lntb80u1p3demo4...",
                demo=False,
                created_at=now - datetime.timedelta(minutes=15),
            ),
            Invoice(
                id="inv_demo_105",
                reference="inv_1713374829_005",
                customer_id=c3.id,
                customer_name=c3.name,
                amount_sat=3500,
                amount_xof=17500,
                description="Achat Accessoires Mobile",
                status="paid",
                paid=True,
                payment_request="lntb35u1p3demo5...",
                demo=True,
                created_at=now - datetime.timedelta(minutes=10),
                paid_at=now - datetime.timedelta(minutes=8),
            ),
        ]
        session.add_all(invoices)
        session.commit()

        # 3. Reglements (Settlements)
        settlement1 = Settlement(
            id="stl_demo_001",
            invoice_id=invoices[0].id,
            reference="payout_wave_221776543210_01",
            amount_sats=5000,
            amount_usdt=4.85,
            amount_xof=24500,
            beneficiary="+221776543210",
            status="COMPLETED",
            created_at=now - datetime.timedelta(hours=3),
        )
        settlement2 = Settlement(
            id="stl_demo_002",
            invoice_id=invoices[1].id,
            reference="payout_orange_221781234567_02",
            amount_sats=2000,
            amount_usdt=1.95,
            amount_xof=9800,
            beneficiary="+221781234567",
            status="COMPLETED",
            created_at=now - datetime.timedelta(hours=1),
        )
        session.add_all([settlement1, settlement2])

        # 4. Webhooks
        w1 = WebhookEvent(
            event_id="evt_bitnob_test_1",
            event_type="transfer.success",
            raw_payload='{"event": "transfer.success", "data": {"id": "inv_demo_101", "status": "paid"}}',
            created_at=now - datetime.timedelta(hours=3, minutes=45),
        )
        session.add(w1)

        session.commit()
        print("[DB] Succes : 3 clients, 5 factures, 2 reglements et 1 evenement webhook injectes.")
    finally:
        session.close()


if __name__ == "__main__":
    init_db()
    seed_demo_data()
