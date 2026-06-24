# backend/app/models/occasion.py
# This model represents the occasions lookup table (e.g. Birthday, Anniversary).

from app.models import db

class Occasion(db.Model):
    __tablename__ = 'occasions'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    description = db.Column(db.String(200), nullable=True)

    # Relationships
    messages = db.relationship('Message', backref='occasion', lazy=True)
    gift_orders = db.relationship('GiftOrder', backref='occasion', lazy=True)

    def to_dict(self):
        """Converts the model object into a plain Python dictionary for JSON serialization."""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description
        }
