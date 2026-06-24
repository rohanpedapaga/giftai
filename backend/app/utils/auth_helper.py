# backend/app/utils/auth_helper.py
from functools import wraps
from flask import request, jsonify, g, current_app
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadSignature

def get_serializer():
    return URLSafeTimedSerializer(current_app.config['SECRET_KEY'])

def generate_token(user_id, role):
    """
    Generates a secure timed token containing the user_id and role.
    """
    s = get_serializer()
    return s.dumps({"user_id": user_id, "role": role})

def verify_token(token):
    """
    Verifies the timed token. Returns (user_id, role) if valid, or (None, None) if expired/invalid.
    """
    s = get_serializer()
    try:
        # Token valid for 24 hours (86400 seconds)
        data = s.loads(token, max_age=86400)
        return data.get("user_id"), data.get("role")
    except (SignatureExpired, BadSignature):
        return None, None

def token_required(f):
    """
    Decorator to protect routes. Extracts Bearer token, validates it, and sets g.user_id and g.role.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Check Authorization header
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header.split(" ")[1]
        
        if not token:
            return jsonify({
                "success": False,
                "error": "Authentication token is missing. Please log in."
            }), 401
            
        user_id, role = verify_token(token)
        if user_id is None:
            return jsonify({
                "success": False,
                "error": "Session expired or invalid token. Please log in again."
            }), 401
            
        g.user_id = user_id
        g.role = role
        return f(*args, **kwargs)
        
    return decorated
