# backend/app/utils/response_helper.py
# This file provides standardized utility functions for JSON responses.
# It ensures consistency in success and error formats across all routes.

from flask import jsonify

def success_response(data=None, status_code=200, extra=None):
    """
    Returns a standardized JSON success response.
    Format: { "success": true, "data": { ... } }
    """
    response = {
        "success": True
    }
    
    if data is not None:
        response["data"] = data
        
    if extra is not None and isinstance(extra, dict):
        response.update(extra)
        
    return jsonify(response), status_code

def error_response(message, status_code=400):
    """
    Returns a standardized JSON error response.
    Format: { "success": false, "error": "Error message" }
    """
    return jsonify({
        "success": False,
        "error": message
    }), status_code
