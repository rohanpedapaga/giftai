# backend/app/routes/auth_routes.py
from flask import Blueprint, request, jsonify, current_app, g
from werkzeug.security import generate_password_hash, check_password_hash
from app.models import db, Customer
from app.utils.auth_helper import generate_token, token_required
from app.utils.response_helper import success_response, error_response
from app.utils.validators import validate_customer_data

auth_bp = Blueprint('auth_routes', __name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    """
    POST /api/auth/login
    Authenticates a user or administrator.
    """
    try:
        data = request.get_json() or {}
        email = data.get('email')
        password = data.get('password')
        is_admin = data.get('isAdmin', False)

        if not email or not password:
            return error_response("Email and password are required.", 400)

        email_clean = email.strip().lower()

        if is_admin:
            admin_email = current_app.config.get('ADMIN_EMAIL', 'admin@giftai.com').lower()
            admin_password = current_app.config.get('ADMIN_PASSWORD', 'admin123')
            
            if email_clean == admin_email and password == admin_password:
                admin_user = {
                    "id": 0,
                    "name": "System Admin",
                    "email": admin_email
                }
                token = generate_token(0, "admin")
                return success_response({
                    "user": admin_user,
                    "role": "admin",
                    "token": token,
                    "password_reset_required": False
                })
            else:
                return error_response("Invalid administrator credentials.", 401)
        else:
            customer = Customer.query.filter_by(email=email_clean).first()
            if not customer:
                return error_response("No profile found with this email. Please register.", 401)

            if not customer.password_hash:
                # This should not happen if migration was run, but just in case:
                return error_response("Account password not set. Please contact administrator.", 401)

            if not check_password_hash(customer.password_hash, password):
                return error_response("Incorrect password.", 401)

            token = generate_token(customer.id, "user")
            return success_response({
                "user": customer.to_dict(),
                "role": "user",
                "token": token,
                "password_reset_required": customer.password_reset_required
            })

    except Exception as e:
        return error_response(f"An unexpected login error occurred: {str(e)}", 500)


@auth_bp.route('/register', methods=['POST'])
def register():
    """
    POST /api/auth/register
    Registers a new customer profile.
    """
    try:
        data = request.get_json() or {}
        
        # 1. Validate payload
        validation_error = validate_customer_data(data)
        if validation_error:
            return error_response(validation_error, 400)

        password = data.get('password')
        if not password or len(password) < 6:
            return error_response("Password is required and must be at least 6 characters.", 400)

        email_clean = data['email'].strip().lower()

        # Check if email is already taken
        existing = Customer.query.filter_by(email=email_clean).first()
        if existing:
            return error_response("Email already registered.", 409)

        # 2. Create customer
        new_customer = Customer(
            name=data['name'],
            email=email_clean,
            phone=data.get('phone', "+123-456-7890"),
            password_hash=generate_password_hash(password),
            password_reset_required=False
        )
        db.session.add(new_customer)
        db.session.commit()

        # 3. Log user in automatically by generating a token
        token = generate_token(new_customer.id, "user")
        return success_response({
            "user": new_customer.to_dict(),
            "role": "user",
            "token": token,
            "password_reset_required": False
        }, 201)

    except Exception as e:
        db.session.rollback()
        return error_response(f"An unexpected registration error occurred: {str(e)}", 500)


@auth_bp.route('/change-password', methods=['POST'])
@token_required
def change_password():
    """
    POST /api/auth/change-password
    Resets or changes password. Protected by JWT.
    """
    try:
        data = request.get_json() or {}
        old_password = data.get('old_password')
        new_password = data.get('new_password')

        if not new_password or len(new_password) < 6:
            return error_response("New password is required and must be at least 6 characters.", 400)

        if g.role == 'admin':
            return error_response("Admin credentials are set via server environment, not APIs.", 403)

        customer = Customer.query.get(g.user_id)
        if not customer:
            return error_response("Customer profile not found.", 404)

        # If user has a password set, verify old password unless password_reset_required is true
        # (if they are forced to reset, they might enter the old password or not, but we verify it if they provide it)
        if customer.password_hash and old_password:
            if not check_password_hash(customer.password_hash, old_password):
                return error_response("Incorrect old password.", 400)

        # Update the password
        customer.password_hash = generate_password_hash(new_password)
        customer.password_reset_required = False
        db.session.commit()

        return success_response({
            "message": "Password changed successfully.",
            "user": customer.to_dict()
        })

    except Exception as e:
        db.session.rollback()
        return error_response(f"An unexpected error occurred during password change: {str(e)}", 500)
