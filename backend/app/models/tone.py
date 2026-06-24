# backend/app/models/tone.py
# This model represents the tones lookup table (e.g. Warm, Funny, Formal).

from app.models import db

class Tone(db.Model):
    __tablename__ = 'tones'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    description = db.Column(db.String(200), nullable=True)

    # Relationships
    messages = db.relationship('Message', backref='tone', lazy=True)

    def to_dict(self):
        """Converts the model object into a plain Python dictionary for JSON serialization."""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description
        }
