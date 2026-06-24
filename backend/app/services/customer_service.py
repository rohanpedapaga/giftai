# backend/app/services/customer_service.py
# This service handles customer creation and fetch queries from the database.

from app.models import db, Customer

def create_customer(name, email, phone=None):
    """
    Creates a new customer record.
    Returns: Customer model object.
    Raises: ValueError if the email already exists.
    """
    existing = Customer.query.filter_by(email=email).first()
    if existing:
        raise ValueError(f"Email '{email}' is already registered")
        
    customer = Customer(
        name=name.strip(),
        email=email.strip(),
        phone=phone.strip() if phone else None
    )
    
    db.session.add(customer)
    db.session.commit()
    return customer

def get_all_customers():
    """
    Retrieves all customer records.
    """
    return Customer.query.all()

def get_customer_by_id(customer_id):
    """
    Retrieves a single customer by their primary key.
    """
    return Customer.query.get(customer_id)
