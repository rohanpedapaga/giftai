# backend/app/models/gift_order.py
# This model represents the gift_orders table, tracking physical product shipments.

from app.models import db
from datetime import datetime

class GiftOrder(db.Model):
    __tablename__ = 'gift_orders'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id', ondelete='CASCADE'), nullable=False)
    product_name = db.Column(db.String(150), nullable=False)
    occasion_id = db.Column(db.Integer, db.ForeignKey('occasions.id', ondelete='SET NULL'), nullable=True)
    status = db.Column(db.Enum('pending', 'processing', 'dispatched', 'delivered', name='order_status_enum'), default='pending')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        """Converts the model object into a plain Python dictionary for JSON serialization."""
        return {
            "id": self.id,
            "customer_id": self.customer_id,
            "product_name": self.product_name,
            "occasion_id": self.occasion_id,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
