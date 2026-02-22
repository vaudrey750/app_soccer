import os
import sys

# Add project root to path
sys.path.append(os.getcwd())

from src.infrastructure.database.session import SessionLocal
from src.domain.models.sport import Formation

def check_formations():
    db = SessionLocal()
    try:
        formations = db.query(Formation).all()
        print(f"Formations found: {len(formations)}")
        for f in formations:
            print(f"- {f.name} ({f.id})")
    finally:
        db.close()

if __name__ == "__main__":
    check_formations()
