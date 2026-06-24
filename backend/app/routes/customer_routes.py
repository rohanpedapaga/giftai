# backend/app/routes/customer_routes.py
# This blueprint file implements REST API endpoints for customer management.

from flask import Blueprint, request
from app.utils.response_helper import success_response, error_response
from app.utils.validators import validate_customer_data
from app.services.customer_service import create_customer, get_all_customers, get_customer_by_id

customer_bp = Blueprint('customer_routes', __name__)

@customer_bp.route('/customers', methods=['POST'])
def add_customer():
    """
    POST /api/customers
    Creates a new customer.
    """
    try:
        data = request.get_json()
        
        # 1. Validate payload
        validation_error = validate_customer_data(data)
        if validation_error:
            return error_response(validation_error, 400)
            
        # 2. Save customer
        customer = create_customer(
            name=data['name'],
            email=data['email'],
            phone=data.get('phone')
        )
        return success_response(customer.to_dict(), 201)
        
    except ValueError as ve:
        return error_response(str(ve), 409)  # 409 Conflict for duplicate emails
    except Exception as e:
        return error_response(f"An unexpected error occurred: {str(e)}", 500)

@customer_bp.route('/customers', methods=['GET'])
def list_customers():
    """
    GET /api/customers
    Lists all customer records.
    """
    try:
        customers = get_all_customers()
        return success_response([c.to_dict() for c in customers])
    except Exception as e:
        return error_response(f"An unexpected error occurred: {str(e)}", 500)

@customer_bp.route('/customers/<int:customer_id>', methods=['GET'])
def get_customer(customer_id):
    """
    GET /api/customers/:id
    Retrieves details of a single customer.
    """
    try:
        customer = get_customer_by_id(customer_id)
        if not customer:
            return error_response("Customer not found", 404)
        return success_response(customer.to_dict())
    except Exception as e:
        return error_response(f"An unexpected error occurred: {str(e)}", 500)
