# backend/app/services/message_service.py
# This service coordinates the core workflow: validating targets, invoking AI
# or fallbacks, saving records, editing messages, and recording version history.

from app.models import db, Message, MessageVersion, Customer, Recipient, Occasion, Tone
from app.services.ai_service import generate_message_with_ai
from app.utils.prompt_builder import build_generation_prompt

class AIGenerationError(Exception):
    def __init__(self, message, debug_info):
        super().__init__(message)
        self.debug_info = debug_info

def generate_and_save_message(customer_id, recipient_id, occasion_id, tone_id, relationship, extra_note=None):
    """
    Core feature: Resolves lookup references, builds prompts, calls AI,
    sets usage flags, and saves the generated message to the database.
    """
    # 1. Validate customer and recipient exist
    customer = Customer.query.get(customer_id)
    if not customer:
        raise ValueError(f"Customer with ID {customer_id} not found")
        
    recipient = Recipient.query.get(recipient_id)
    if not recipient:
        raise ValueError(f"Recipient with ID {recipient_id} not found")
        
    # 2. Look up occasion and tone names
    occasion = Occasion.query.get(occasion_id)
    if not occasion:
        raise ValueError(f"Occasion with ID {occasion_id} not found")
        
    tone = Tone.query.get(tone_id)
    if not tone:
        raise ValueError(f"Tone with ID {tone_id} not found")
        
    # Query recently generated message texts for this combination to prevent repetition
    recent_msgs = Message.query.filter_by(
        customer_id=customer_id,
        recipient_id=recipient_id,
        occasion_id=occasion_id,
        tone_id=tone_id
    ).order_by(Message.created_at.desc()).limit(10).all()
    
    exclude_texts = [m.message_text for m in recent_msgs]
        
    # 3. Build AI prompt
    import uuid
    random_seed = str(uuid.uuid4())[:8]
    prompt = build_generation_prompt(
        recipient_name=recipient.name,
        relationship=relationship,
        occasion_name=occasion.name,
        tone_name=tone.name,
        extra_note=extra_note,
        exclude_texts=exclude_texts,
        random_seed=random_seed
    )
    
    # 4. Generate content
    message_text, ai_used, debug_info = generate_message_with_ai(
        prompt=prompt,
        occasion_name=occasion.name,
        tone_name=tone.name,
        recipient_name=recipient.name,
        relationship=relationship,
        exclude_texts=exclude_texts,
        extra_note=extra_note
    )
    
    # 5. Check if AI generation failed (disable silent fallback)
    if not ai_used:
        is_quota = (debug_info.get("response_status") and "429" in str(debug_info.get("response_status"))) or ("quota" in str(debug_info.get("error_msg")).lower())
        err_msg = "AI generation unavailable: Gemini quota exceeded." if is_quota else f"AI generation unavailable: {debug_info.get('error_msg')}"
        raise AIGenerationError(err_msg, debug_info)
        
    # 6. Save message record
    message = Message(
        customer_id=customer_id,
        recipient_id=recipient_id,
        occasion_id=occasion_id,
        tone_id=tone_id,
        relationship=relationship.strip(),
        message_text=message_text,
        status='generated',
        ai_used=ai_used,
        version_number=1
    )
    
    db.session.add(message)
    db.session.commit()
    
    return message, debug_info

def get_messages(status=None, customer_id=None, occasion_id=None, is_favorite=None, page=1, limit=10):
    """
    Queries messages list with optional filters and pagination.
    """
    query = Message.query
    
    if status:
        if ',' in status:
            statuses = [s.strip() for s in status.split(',') if s.strip()]
            query = query.filter(Message.status.in_(statuses))
        else:
            query = query.filter_by(status=status)
    if customer_id:
        query = query.filter_by(customer_id=customer_id)
    if occasion_id:
        query = query.filter_by(occasion_id=occasion_id)
    if is_favorite is not None:
        query = query.filter_by(is_favorite=is_favorite)
        
    # Run paginate query
    paginated = query.order_by(Message.created_at.desc()).paginate(
        page=page,
        per_page=limit,
        error_out=False
    )
    
    return paginated.items, paginated.total

def get_message_detail(message_id):
    """
    Retrieves message details.
    """
    return Message.query.get(message_id)

def save_message(message_id):
    """
    Updates status of a message to 'saved'.
    """
    message = Message.query.get(message_id)
    if not message:
        raise ValueError(f"Message with ID {message_id} not found")
        
    message.status = 'saved'
    db.session.commit()
    return message

def edit_message(message_id, new_text, edited_by='customer'):
    """
    Updates message text, archives prior text in message_versions,
    and increments the version_number index.
    """
    message = Message.query.get(message_id)
    if not message:
        raise ValueError(f"Message with ID {message_id} not found")
        
    # 1. Archive prior draft into history versions table
    version_log = MessageVersion(
        message_id=message.id,
        version_number=message.version_number,
        message_text=message.message_text,
        edited_by=edited_by
    )
    db.session.add(version_log)
    
    # 2. Update active message parameters
    message.message_text = new_text.strip()
    message.version_number += 1
    message.status = 'edited'
    
    db.session.commit()
    return message

def get_message_versions(message_id):
    """
    Retrieves edit history logs for a message.
    """
    # Verify message exists
    message = Message.query.get(message_id)
    if not message:
        raise ValueError(f"Message with ID {message_id} not found")
        
    return MessageVersion.query.filter_by(message_id=message_id).order_by(MessageVersion.version_number.asc()).all()

def process_message_status(message_id, new_status, gift_order_id=None, greeting_card_id=None):
    """
    Updates the operational processing status of a message.
    Optionally links it to a gift order or greeting card.
    """
    message = Message.query.get(message_id)
    if not message:
        raise ValueError(f"Message with ID {message_id} not found")
        
    if new_status not in ['generated', 'saved', 'edited', 'linked']:
        raise ValueError("Invalid message status value")
        
    message.status = new_status
    
    if gift_order_id is not None:
        message.gift_order_id = gift_order_id
    if greeting_card_id is not None:
        message.greeting_card_id = greeting_card_id
        
    db.session.commit()
    return message
