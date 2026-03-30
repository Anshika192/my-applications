from sqlalchemy import text
from database import engine

try:
    with engine.connect() as conn:
        print("DB OK:", conn.execute(text("SELECT 1")).scalar())
except Exception as e:
    print("DB ERROR:", e)