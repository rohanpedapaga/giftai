# backend/app/seed/seed_occasions.py
# This script seeds default event categories into the occasions table using SQLAlchemy.

import sys
import os

# Adjust path to find the backend app module when run from terminal
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from app import create_app
from app.models import db, Occasion

OCCASIONS = [
    {"name": "Birthday", "description": "Celebrating someone special on their birthday"},
    {"name": "Anniversary", "description": "Marking a relationship or work milestone"},
    {"name": "Thank You", "description": "Expressing gratitude for a kind act"},
    {"name": "Corporate Gift", "description": "Professional gifting for business relationships"},
    {"name": "Festival", "description": "Seasonal or cultural celebration greeting"}
]

def seed():
    app = create_app()
    with app.app_context():
        print("Seeding occasions lookup data...")
        count = 0
        for item in OCCASIONS:
            existing = Occasion.query.filter_by(name=item["name"]).first()
            if not existing:
                occasion = Occasion(name=item["name"], description=item["description"])
                db.session.add(occasion)
                count += 1
                
        db.session.commit()
        print(f"Successfully seeded {count} new occasions.")

if __name__ == '__main__':
    seed()
