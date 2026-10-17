from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from backend.app.config import config  # SEULE source des variables d'env (AGENTS.md regle 3)

# Par defaut SQLite local zero-config, ou PostgreSQL via DATABASE_URL dans .env
DATABASE_URL = config.database_url

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """Generateur de session SQLAlchemy pour les dependances FastAPI."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
