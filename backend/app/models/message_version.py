# backend/app/models/message_version.py
# This model represents the message_versions table, storing historical message edits.

from app.models import db
from datetime import datetime

class MessageVersion(db.Model):
    __tablename__ = 'message_versions'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    message_id = db.Column(db.Integer, db.ForeignKey('messages.id', ondelete='CASCADE'), nullable=False)
    version_number = db.Column(db.Integer, nullable=False)
    message_text = db.Column(db.Text, nullable=False)
    edited_by = db.Column(db.String(100), default='customer')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        """Converts the model object into a plain Python dictionary for JSON serialization."""
        return {
            "id": self.id,
            "message_id": self.message_id,
            "version_number": self.version_number,
            "message_text": self.message_text,
            "edited_by": self.edited_by,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
