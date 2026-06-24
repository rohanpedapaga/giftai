# backend/app/models/greeting_card.py
# This model represents the greeting_cards table, configuring design properties.

from app.models import db
from datetime import datetime

class GreetingCard(db.Model):
    __tablename__ = 'greeting_cards'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    message_id = db.Column(db.Integer, db.ForeignKey('messages.id', ondelete='CASCADE'), nullable=False)
    card_type = db.Column(db.String(50), nullable=False)
    design_ref = db.Column(db.String(100), nullable=False)
    approved = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        """Converts the model object into a plain Python dictionary for JSON serialization."""
        return {
            "id": self.id,
            "message_id": self.message_id,
            "card_type": self.card_type,
            "design_ref": self.design_ref,
            "approved": self.approved,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
