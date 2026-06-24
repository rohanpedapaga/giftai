# backend/app/routes/recipient_routes.py
# This blueprint file implements REST API endpoints for recipient management.

from flask import Blueprint, request
from app.utils.response_helper import success_response, error_response
from app.utils.validators import validate_recipient_data
from app.services.recipient_service import create_recipient, get_all_recipients

recipient_bp = Blueprint('recipient_routes', __name__)

@recipient_bp.route('/recipients', methods=['POST'])
def add_recipient():
    """
    POST /api/recipients
    Registers a recipient linked to a customer.
    """
    try:
        data = request.get_json()
        
        # 1. Validate payload
        validation_error = validate_recipient_data(data)
        if validation_error:
            return error_response(validation_error, 400)
            
        # 2. Add recipient
        recipient = create_recipient(
            customer_id=data['customer_id'],
            name=data['name'],
            relationship=data['relationship'],
            important_date_str=data.get('important_date')
        )
        return success_response(recipient.to_dict(), 201)
        
    except ValueError as ve:
        return error_response(str(ve), 400)
    except Exception as e:
        return error_response(f"An unexpected error occurred: {str(e)}", 500)

@recipient_bp.route('/recipients', methods=['GET'])
def list_recipients():
    """
    GET /api/recipients
    Lists all recipients, with optional customer_id query filter.
    """
    try:
        customer_id_str = request.args.get('customer_id')
        customer_id = int(customer_id_str) if customer_id_str else None
        
        recipients = get_all_recipients(customer_id=customer_id)
        return success_response([r.to_dict() for r in recipients])
        
    except ValueError:
        return error_response("customer_id query parameter must be an integer", 400)
    except Exception as e:
        return error_response(f"An unexpected error occurred: {str(e)}", 500)
