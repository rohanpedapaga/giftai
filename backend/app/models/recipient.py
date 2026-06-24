# backend/app/models/recipient.py
# This model represents the recipients table, storing details of individuals receiving the gifts/messages.

from app.models import db
from datetime import datetime

class Recipient(db.Model):
    __tablename__ = 'recipients'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id', ondelete='CASCADE'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    relationship = db.Column(db.String(50), nullable=False)
    important_date = db.Column(db.Date, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    messages = db.relationship('Message', backref='recipient', lazy=True)

    def to_dict(self):
        """Converts the model object into a plain Python dictionary for JSON serialization."""
        return {
            "id": self.id,
            "customer_id": self.customer_id,
            "name": self.name,
            "relationship": self.relationship,
            "important_date": self.important_date.isoformat() if self.important_date else None,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
