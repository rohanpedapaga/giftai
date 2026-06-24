# backend/app/utils/validators.py
# This file handles request payload validation logic for all API controllers.
# It checks field formats, required keys, and types to protect route handlers.

import re

def validate_customer_data(data):
    """Validates parameters for registering a customer."""
    if not data:
        return "Request body cannot be empty"
        
    name = data.get('name')
    email = data.get('email')
    
    if not name or not name.strip():
        return "Name is a required field"
    if not email or not email.strip():
        return "Email is a required field"
        
    # Standard email regex validation
    email_regex = r'^[\w\.-]+@[\w\.-]+\.\w+$'
    if not re.match(email_regex, email):
        return "Invalid email format"
        
    return None

def validate_recipient_data(data):
    """Validates parameters for adding a recipient."""
    if not data:
        return "Request body cannot be empty"
        
    customer_id = data.get('customer_id')
    name = data.get('name')
    relationship = data.get('relationship')
    
    if not customer_id:
        return "customer_id is a required field"
    if not isinstance(customer_id, int):
        return "customer_id must be an integer"
    if not name or not name.strip():
        return "Name is a required field"
    if not relationship or not relationship.strip():
        return "Relationship is a required field"
        
    return None

def validate_message_generation(data):
    """Validates parameters for message generation requests."""
    if not data:
        return "Request body cannot be empty"
        
    customer_id = data.get('customer_id')
    recipient_id = data.get('recipient_id')
    occasion_id = data.get('occasion_id')
    tone_id = data.get('tone_id')
    relationship = data.get('relationship')
    
    if not customer_id:
        return "customer_id is a required field"
    if not recipient_id:
        return "recipient_id is a required field"
    if not occasion_id:
        return "occasion_id is a required field"
    if not tone_id:
        return "tone_id is a required field"
    if not relationship or not relationship.strip():
        return "Relationship is a required field"
        
    # Type checking
    if not isinstance(customer_id, int):
        return "customer_id must be an integer"
    if not isinstance(recipient_id, int):
        return "recipient_id must be an integer"
    if not isinstance(occasion_id, int):
        return "occasion_id must be an integer"
    if not isinstance(tone_id, int):
        return "tone_id must be an integer"
        
    return None

def validate_message_edit(data):
    """Validates parameters for editing a message."""
    if not data:
        return "Request body cannot be empty"
        
    message_text = data.get('message_text')
    if not message_text or not message_text.strip():
        return "message_text cannot be empty"
        
    return None
