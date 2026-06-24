# backend/app/models/message.py
# This model represents the messages table, storing the generated text and config details.

from app.models import db
from datetime import datetime

class Message(db.Model):
    __tablename__ = 'messages'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id', ondelete='RESTRICT'), nullable=False)
    recipient_id = db.Column(db.Integer, db.ForeignKey('recipients.id', ondelete='RESTRICT'), nullable=False)
    occasion_id = db.Column(db.Integer, db.ForeignKey('occasions.id', ondelete='RESTRICT'), nullable=False)
    tone_id = db.Column(db.Integer, db.ForeignKey('tones.id', ondelete='RESTRICT'), nullable=False)
    relationship = db.Column(db.String(50), nullable=False)
    message_text = db.Column(db.Text, nullable=False)
    status = db.Column(db.Enum('generated', 'saved', 'edited', 'linked', name='message_status_enum'), default='generated')
    ai_used = db.Column(db.Boolean, default=True)
    gift_order_id = db.Column(db.Integer, nullable=True)
    greeting_card_id = db.Column(db.Integer, nullable=True)
    version_number = db.Column(db.Integer, default=1)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    # - versions: delete-orphan cleans up edit logs if the primary message is deleted
    # - greeting_cards: clean up linked cards on delete
    versions = db.relationship('MessageVersion', backref='message', cascade='all, delete-orphan', lazy=True)
    greeting_cards = db.relationship('GreetingCard', backref='message', cascade='all, delete-orphan', lazy=True)

    def to_dict(self):
        """Converts the model object into a plain Python dictionary for JSON serialization."""
        return {
            "id": self.id,
            "customer_id": self.customer_id,
            "recipient_id": self.recipient_id,
            "occasion_id": self.occasion_id,
            "tone_id": self.tone_id,
            "relationship": self.relationship,
            "message_text": self.message_text,
            "status": self.status,
            "ai_used": self.ai_used,
            "gift_order_id": self.gift_order_id,
            "greeting_card_id": self.greeting_card_id,
            "version_number": self.version_number,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
