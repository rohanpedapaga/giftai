# backend/app/seed/seed_tones.py
# This script seeds default emotional categories into the tones table using SQLAlchemy.

import sys
import os

# Adjust path to find the backend app module when run from terminal
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from app import create_app
from app.models import db, Tone

TONES = [
    {"name": "Warm", "description": "Friendly, affectionate, and personal"},
    {"name": "Formal", "description": "Respectful and professional in tone"},
    {"name": "Funny", "description": "Light-hearted, humorous, and playful"},
    {"name": "Heartfelt", "description": "Deep, emotional, and sincere"},
    {"name": "Professional", "description": "Corporate-appropriate and business-focused"},
    {"name": "Inspirational", "description": "Motivational and uplifting in tone"}
]

def seed():
    app = create_app()
    with app.app_context():
        print("Seeding tones lookup data...")
        count = 0
        for item in TONES:
            existing = Tone.query.filter_by(name=item["name"]).first()
            if not existing:
                tone = Tone(name=item["name"], description=item["description"])
                db.session.add(tone)
                count += 1
                
        db.session.commit()
        print(f"Successfully seeded {count} new tones.")

if __name__ == '__main__':
    seed()
