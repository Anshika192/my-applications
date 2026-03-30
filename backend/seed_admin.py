from sqlalchemy.orm import Session
from database import SessionLocal
import models
from main import hash_password 

def seed_admin():
    db = SessionLocal()
    try:
        # 1. Purane admins ko delete karein (taaki format fresh ho)
        db.query(models.AdminUser).delete()
        db.commit()
        print("🗑️ Old admin records cleared.")

        # 2. Naya secure admin banayein
        hashed_pwd = hash_password("admin123")
        new_admin = models.AdminUser(
            email="admin@gmail.com",
            hashed_password=hashed_pwd,
            role="admin"
        )
        db.add(new_admin)
        db.commit()
        print(f"✅ Secure Admin Created: admin@gmail.com / admin123")
        print(f"📝 Stored Hash: {hashed_pwd}") # Verify karne ke liye ki hash ban raha hai
    except Exception as e:
        db.rollback()
        print(f"❌ Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_admin()