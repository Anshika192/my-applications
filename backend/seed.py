from sqlalchemy.orm import Session
from database import SessionLocal, engine
import models

models.Base.metadata.create_all(bind=engine)

def seed_data():
    db = SessionLocal()
    
    # Clear existing data
    db.query(models.Application).delete()
    db.commit()

    apps = [
        models.Application(name="Image to PDF", category="Utility", icon="https://cdn-icons-png.flaticon.com/512/337/337946.png", url="#", status="active"),
        models.Application(name="Image Compressor", category="Utility", icon="https://cdn-icons-png.flaticon.com/512/337/337926.png", url="#", status="active"),
        models.Application(name="Word to PDF", category="Utility", icon="https://cdn-icons-png.flaticon.com/512/337/337956.png", url="#", status="active"),
        models.Application(name="PDF to Word", category="Utility", icon="https://cdn-icons-png.flaticon.com/512/337/337956.png", url="#", status="active"),
    ]

    for app in apps:
        db.add(app)
    
    db.commit()
    print("Seeded applications.")
    db.close()

if __name__ == "__main__":
    seed_data()
