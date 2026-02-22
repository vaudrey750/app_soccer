import os
import sys

# Add project root to path
sys.path.append(os.getcwd())

from fff_api.database import SessionLocal
from src.domain.models.sport import Formation, FormationPosition

def check_bench():
    db = SessionLocal()
    try:
        formations = db.query(Formation).all()
        for f in formations:
            bench_count = db.query(FormationPosition).filter(
                FormationPosition.formation_id == f.id, 
                FormationPosition.role == 'B'
            ).count()
            print(f"Formation {f.name} (ID: {f.id}): {bench_count} bench positions")
    finally:
        db.close()

if __name__ == "__main__":
    check_bench()
