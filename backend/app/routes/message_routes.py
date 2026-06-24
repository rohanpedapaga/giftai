# backend/app/routes/message_routes.py
# This blueprint handles API routes for message generation, edits, saves,
# and history retrievals. It implements aliases for frontend convenience.

from flask import Blueprint, request
from app.utils.response_helper import success_response, error_response
from app.utils.validators import validate_message_generation, validate_message_edit
from app.services.message_service import (
    generate_and_save_message,
    get_messages,
    get_message_detail,
    save_message,
    edit_message,
    get_message_versions,
    process_message_status,
    AIGenerationError
)

message_bp = Blueprint('message_routes', __name__)

# ============================================================
# CREATE / GENERATE ENDPOINTS
# ============================================================

from app.utils.auth_helper import token_required
from flask import g, current_app
from app import limiter
from flask_limiter.util import get_remote_address

def get_generation_limit():
    return current_app.config.get('LIMIT_AI_GENERATION', '10 per minute')

@message_bp.route('/messages/generate', methods=['POST'])
@message_bp.route('/messages/create', methods=['POST'])
@message_bp.route('/create', methods=['POST']) # Root level alias compatibility
@token_required
@limiter.limit(get_generation_limit, key_func=lambda: f"user_{g.user_id}" if getattr(g, 'user_id', None) else get_remote_address())
def generate_greeting():
    """
    POST /api/messages/generate
    POST /api/messages/create
    POST /api/create
    Generates card text using AI or fallback templates.
    """
    try:
        data = request.get_json()
        
        # 1. Validate inputs
        validation_error = validate_message_generation(data)
        if validation_error:
            return error_response(validation_error, 400)
            
        # IDOR protection: force standard users to generate for themselves
        customer_id = int(data['customer_id'])
        if g.role != 'admin':
            customer_id = g.user_id
            
        # 2. Run generation service
        message, debug_info = generate_and_save_message(
            customer_id=customer_id,
            recipient_id=data['recipient_id'],
            occasion_id=data['occasion_id'],
            tone_id=data['tone_id'],
            relationship=data['relationship'],
            extra_note=data.get('extra_note')
        )
        
        response_data = message.to_dict()
        return success_response(response_data, 201, extra={"extra": {"ai_debug": debug_info}})
        
    except AIGenerationError as age:
        is_quota = "quota" in str(age).lower()
        status_code = 429 if is_quota else 503
        from flask import jsonify
        return jsonify({
            "success": False,
            "error": str(age),
            "extra": {"ai_debug": age.debug_info}
        }), status_code
    except ValueError as ve:
        return error_response(str(ve), 404)  # 404 if customer or recipient lookup fails
    except Exception as e:
        return error_response(f"An unexpected error occurred: {str(e)}", 500)

@message_bp.route('/config/check', methods=['GET'])
def check_config():
    """
    GET /api/config/check
    Checks if API credentials are set and returns diagnostic metadata.
    """
    from flask import current_app
    api_key = current_app.config.get('GROQ_API_KEY')
    if not api_key or api_key == "your_groq_api_key_here":
        return success_response({
            "configured": False,
            "is_standard_format": False,
            "prefix": "None",
            "key_length": 0,
            "error": "GROQ_API_KEY is missing from environment/config."
        })
        
    # Standard format check (usually starts with gsk_)
    is_standard = api_key.startswith("gsk_")
    key_length = len(api_key)
    prefix = api_key[:4] + "..." if key_length > 4 else "..."
    
    return success_response({
        "configured": True,
        "is_standard_format": is_standard,
        "key_length": key_length,
        "prefix": prefix
    })

@message_bp.route('/health', methods=['GET'])
def health_check():
    """
    GET /api/health
    Checks API key config, Groq connectivity, and remaining quota.
    """
    from flask import current_app, jsonify
    import requests
    import re
    
    api_key = current_app.config.get('GROQ_API_KEY')
    if not api_key or api_key == "your_groq_api_key_here":
        return jsonify({
            "success": False,
            "status": "unhealthy",
            "error": "GROQ_API_KEY is missing from environment/config.",
            "provider": "Groq API",
            "api_key_loaded": False,
            "quota_available": False,
            "last_provider_response_code": "N/A",
            "connectivity": "Unattempted"
        }), 503
        
    try:
        # Attempt minimal completions call to check connection & quota status
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": "llama-3.3-70b-versatile",
            "messages": [{"role": "user", "content": "ping"}],
            "max_tokens": 1
        }
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers=headers,
            json=payload,
            timeout=10.0
        )
        
        status_code = response.status_code
        if status_code == 200:
            return jsonify({
                "success": True,
                "status": "healthy",
                "provider": "Groq API",
                "api_key_loaded": True,
                "quota_available": True,
                "last_provider_response_code": 200,
                "connectivity": "Success"
            }), 200
        else:
            is_quota_error = (status_code == 429) or ("quota" in response.text.lower())
            err_status = "unhealthy" if is_quota_error else "error"
            http_code = 429 if is_quota_error else (status_code or 500)
            
            return jsonify({
                "success": False,
                "status": err_status,
                "error": "AI generation unavailable: Groq quota exceeded." if is_quota_error else f"Groq API failure: {response.text}",
                "provider": "Groq API",
                "api_key_loaded": True,
                "quota_available": False,
                "last_provider_response_code": status_code,
                "connectivity": f"Failed with HTTP {status_code}",
                "raw_error": response.text
            }), http_code
            
    except Exception as e:
        status_code = 500
        match = re.search(r'\b(400|401|403|404|429|500|503|504)\b', str(e))
        if match:
            status_code = int(match.group(1))
            
        is_quota_error = (status_code == 429) or ("quota" in str(e).lower())
        err_status = "unhealthy" if is_quota_error else "error"
        http_code = 429 if is_quota_error else 500
        
        return jsonify({
            "success": False,
            "status": err_status,
            "error": "AI generation unavailable: Groq quota exceeded." if is_quota_error else f"Groq API connection failure: {str(e)}",
            "provider": "Groq API",
            "api_key_loaded": True,
            "quota_available": False,
            "last_provider_response_code": status_code,
            "connectivity": f"Failed with exception",
            "raw_error": str(e)
        }), http_code

@message_bp.route('/diagnostics', methods=['GET'])
@token_required
def get_diagnostics():
    """
    GET /api/diagnostics
    Returns detailed diagnostics: Active key prefix, Active model name,
    SDK version, Endpoint URL, and Raw provider response. (Admin only)
    """
    if g.role != 'admin':
        return error_response("Access denied. Admin privileges required.", 403)
    from flask import current_app, jsonify
    import requests
    
    api_key = current_app.config.get('GROQ_API_KEY')
    prefix = api_key[:4] + "..." if api_key else "None"
    sdk_version = requests.__version__ if hasattr(requests, '__version__') else "requests-based-client"
    
    endpoint_url = "https://api.groq.com/openai/v1/chat/completions"
    
    models_attempted = [
        'llama-3.3-70b-versatile',
        'llama-3.1-8b-instant',
        'mixtral-8x7b-32768',
        'llama3-70b-8192',
        'llama3-8b-8192'
    ]
    
    raw_response = "Unattempted"
    if api_key and api_key != "your_groq_api_key_here":
        try:
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": "llama-3.3-70b-versatile",
                "messages": [{"role": "user", "content": "ping"}],
                "max_tokens": 1
            }
            res = requests.post(
                endpoint_url,
                headers=headers,
                json=payload,
                timeout=10.0
            )
            raw_response = f"HTTP {res.status_code}: {res.text}"
        except Exception as e:
            raw_response = str(e)
            
    return jsonify({
        "active_key_prefix": prefix,
        "active_model_name": "llama-3.3-70b-versatile (primary check) / " + ", ".join(models_attempted),
        "sdk_version": sdk_version,
        "endpoint_url": endpoint_url,
        "raw_provider_response": raw_response
    }), 200
        
# ============================================================
# READ / LIST ENDPOINTS
# ============================================================

@message_bp.route('/messages', methods=['GET'])
@message_bp.route('/messages/list', methods=['GET'])
@message_bp.route('/list', methods=['GET']) # Root level alias compatibility
@token_required
def list_messages():
    """
    GET /api/messages
    GET /api/messages/list
    GET /api/list
    Lists generated greetings with pagination and filters.
    """
    try:
        # Query params
        status = request.args.get('status')
        customer_id_str = request.args.get('customer_id')
        occasion_id_str = request.args.get('occasion_id')
        
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 10))
        
        # IDOR prevention: non-admins can only list their own messages
        if g.role != 'admin':
            customer_id = g.user_id
        else:
            customer_id = int(customer_id_str) if customer_id_str else None
            
        occasion_id = int(occasion_id_str) if occasion_id_str else None
        
        messages, total = get_messages(
            status=status,
            customer_id=customer_id,
            occasion_id=occasion_id,
            page=page,
            limit=limit
        )
        
        serialized = [m.to_dict() for m in messages]
        extra_pagination_info = {
            "total": total,
            "page": page,
            "limit": limit
        }
        return success_response(serialized, 200, extra=extra_pagination_info)
        
    except ValueError:
        return error_response("Invalid query parameters format. Page/limit/IDs must be integers.", 400)
    except Exception as e:
        return error_response(f"An unexpected error occurred: {str(e)}", 500)

@message_bp.route('/messages/<int:message_id>', methods=['GET'])
@message_bp.route('/messages/detail/<int:message_id>', methods=['GET'])
@message_bp.route('/detail/<int:message_id>', methods=['GET']) # Root level alias compatibility
@token_required
def detail_message(message_id):
    """
    GET /api/messages/:id
    GET /api/messages/detail/:id
    GET /api/detail/:id
    Retrieves message details along with its edit version logs.
    """
    try:
        message = get_message_detail(message_id)
        if not message:
            return error_response("Message not found", 404)
            
        # IDOR prevention: non-admins can only view their own messages
        if g.role != 'admin' and message.customer_id != g.user_id:
            return error_response("Access denied. You cannot view other customers' messages.", 403)
            
        # Pull version logs as well
        versions = get_message_versions(message_id)
        
        data = message.to_dict()
        data["version_history"] = [v.to_dict() for v in versions]
        
        return success_response(data, 200)
    except Exception as e:
        return error_response(f"An unexpected error occurred: {str(e)}", 500)

# ============================================================
# UPDATE / EDIT ENDPOINTS
# ============================================================

@message_bp.route('/messages/<int:message_id>', methods=['PUT'])
@token_required
def edit_existing_message(message_id):
    """
    PUT /api/messages/:id
    Edits a message and creates a version log entry.
    """
    try:
        from app.models import Message
        message = Message.query.get(message_id)
        if not message:
            return error_response("Message not found", 404)
            
        # IDOR prevention
        if g.role != 'admin' and message.customer_id != g.user_id:
            return error_response("Access denied. You cannot edit other customers' messages.", 403)

        data = request.get_json()
        
        validation_error = validate_message_edit(data)
        if validation_error:
            return error_response(validation_error, 400)
            
        edited_by = data.get('edited_by', 'customer')
        
        message = edit_message(
            message_id=message_id,
            new_text=data['message_text'],
            edited_by=edited_by
        )
        return success_response(message.to_dict(), 200)
        
    except ValueError as ve:
        return error_response(str(ve), 404)
    except Exception as e:
        return error_response(f"An unexpected error occurred: {str(e)}", 500)

@message_bp.route('/messages/<int:message_id>/save', methods=['POST'])
@token_required
def save_generated_message(message_id):
    """
    POST /api/messages/:id/save
    Saves a generated message by changing its status to 'saved'.
    """
    try:
        from app.models import Message
        message = Message.query.get(message_id)
        if not message:
            return error_response("Message not found", 404)
            
        # IDOR prevention
        if g.role != 'admin' and message.customer_id != g.user_id:
            return error_response("Access denied. You cannot save other customers' messages.", 403)

        message = save_message(message_id)
        return success_response(message.to_dict(), 200)
    except ValueError as ve:
        return error_response(str(ve), 404)
    except Exception as e:
        return error_response(f"An unexpected error occurred: {str(e)}", 500)

# ============================================================
# PROCESS STATUS ENDPOINT
# ============================================================

@message_bp.route('/messages/process', methods=['POST'])
@message_bp.route('/messages/<int:message_id>/process', methods=['POST'])
@message_bp.route('/process', methods=['POST']) # Root level alias compatibility
@token_required
def process_message(message_id=None):
    """
    POST /api/messages/process
    POST /api/messages/:id/process
    POST /api/process
    Updates message state to saved/edited/linked and links cards or orders.
    """
    try:
        data = request.get_json() or {}
        
        # Determine message_id from path or request body
        final_message_id = message_id or data.get('message_id')
        if not final_message_id:
            return error_response("message_id is a required field", 400)
            
        from app.models import Message
        message = Message.query.get(final_message_id)
        if not message:
            return error_response("Message not found", 404)
            
        # IDOR prevention
        if g.role != 'admin' and message.customer_id != g.user_id:
            return error_response("Access denied. You cannot process other customers' messages.", 403)

        new_status = data.get('status')
        if not new_status:
            return error_response("status is a required field", 400)
            
        gift_order_id = data.get('gift_order_id')
        greeting_card_id = data.get('greeting_card_id')
        
        message = process_message_status(
            message_id=final_message_id,
            new_status=new_status,
            gift_order_id=gift_order_id,
            greeting_card_id=greeting_card_id
        )
        
        return success_response(message.to_dict(), 200)
        
    except ValueError as ve:
        return error_response(str(ve), 400)
    except Exception as e:
        return error_response(f"An unexpected error occurred: {str(e)}", 500)

# ============================================================
# VERSION HISTORY ONLY ENDPOINT
# ============================================================

@message_bp.route('/messages/<int:message_id>/versions', methods=['GET'])
@token_required
def list_versions(message_id):
    """
    GET /api/messages/:id/versions
    Retrieves version history for a message.
    """
    try:
        from app.models import Message
        message = Message.query.get(message_id)
        if not message:
            return error_response("Message not found", 404)
            
        # IDOR prevention
        if g.role != 'admin' and message.customer_id != g.user_id:
            return error_response("Access denied. You cannot view other customers' message versions.", 403)

        versions = get_message_versions(message_id)
        return success_response([v.to_dict() for v in versions])
    except ValueError as ve:
        return error_response(str(ve), 404)
    except Exception as e:
        return error_response(f"An unexpected error occurred: {str(e)}", 500)
