# backend/app/services/recipient_service.py
# This service handles recipient creation and fetch queries from the database.

from app.models import db, Recipient, Customer
from datetime import datetime

def create_recipient(customer_id, name, relationship, important_date_str=None):
    """
    Creates a new recipient record linked to a customer.
    """
    # Verify customer exists
    customer = Customer.query.get(customer_id)
    if not customer:
        raise ValueError(f"Customer with ID {customer_id} does not exist")
        
    important_date = None
    if important_date_str:
        try:
            important_date = datetime.strptime(important_date_str, '%Y-%m-%d').date()
        except ValueError:
            raise ValueError("important_date must be in YYYY-MM-DD format")
            
    recipient = Recipient(
        customer_id=customer_id,
        name=name.strip(),
        relationship=relationship.strip(),
        important_date=important_date
    )
    
    db.session.add(recipient)
    db.session.commit()
    return recipient

def get_all_recipients(customer_id=None):
    """
    Retrieves all recipient records, optionally filtered by customer_id.
    """
    if customer_id:
        return Recipient.query.filter_by(customer_id=customer_id).all()
    return Recipient.query.all()
