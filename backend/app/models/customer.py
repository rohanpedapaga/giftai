# backend/app/models/customer.py
# This model represents the customers table, storing profile info for buyers.

from app.models import db
from datetime import datetime

class Customer(db.Model):
    __tablename__ = 'customers'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False)
    phone = db.Column(db.String(20), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    # - recipients: deletes all recipients linked to this customer if the customer is deleted
    # - gift_orders: deletes all orders linked to this customer if the customer is deleted
    recipients = db.relationship('Recipient', backref='customer', cascade='all, delete-orphan', lazy=True)
    messages = db.relationship('Message', backref='customer', lazy=True)
    gift_orders = db.relationship('GiftOrder', backref='customer', cascade='all, delete-orphan', lazy=True)

    def to_dict(self):
        """Converts the model object into a plain Python dictionary for JSON serialization."""
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "phone": self.phone,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
