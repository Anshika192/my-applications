from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os

# Prefer a .env entry; fallback to local dev connection
# NOTE: '@' must be percent-encoded as %40

DEFAULT_URL = "postgresql+psycopg2://postgres:Admin%40123@127.0.0.1:5433/minapplications"
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_URL)
print("USING DB URL:", SQLALCHEMY_DATABASE_URL)

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_pre_ping=True,     # helps avoid 'server closed the connection unexpectedly'
)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

Base = declarative_base()

# Dependency you will import in main.py
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()