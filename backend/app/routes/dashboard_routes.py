# backend/app/routes/dashboard_routes.py
# This blueprint gathers dashboard analytics by running aggregate database queries.

from flask import Blueprint
from app.models import db, Message, Occasion, Tone
from app.utils.response_helper import success_response, error_response
from datetime import datetime, date, time

dashboard_bp = Blueprint('dashboard_routes', __name__)

from app.utils.auth_helper import token_required
from flask import g

@dashboard_bp.route('/dashboard/stats', methods=['GET'])
@dashboard_bp.route('/dashboard', methods=['GET']) # Root level alias compatibility
@token_required
def get_dashboard_statistics():
    """
    GET /api/dashboard/stats
    GET /api/dashboard
    Returns summary statistics for the dashboard.
    """
    try:
        # Determine query filters based on role
        if g.role == 'admin':
            msg_filter = True
        else:
            msg_filter = (Message.customer_id == g.user_id)

        # 1. Total messages count
        total_messages = Message.query.filter(msg_filter).count()
        
        # 2. Today's message volume
        today_start = datetime.combine(date.today(), time.min)
        messages_today = Message.query.filter(msg_filter, Message.created_at >= today_start).count()
        
        # 3. Occasions breakdown counts
        # Join Message and Occasion to get names rather than raw IDs
        occasion_query = db.session.query(
            Occasion.name, 
            db.func.count(Message.id)
        ).join(Message, Message.occasion_id == Occasion.id).filter(msg_filter).group_by(Occasion.name).all()
        
        messages_by_occasion = [{"occasion": item[0], "count": item[1]} for item in occasion_query]
        
        # 4. Tones breakdown counts
        tone_query = db.session.query(
            Tone.name, 
            db.func.count(Message.id)
        ).join(Message, Message.tone_id == Tone.id).filter(msg_filter).group_by(Tone.name).all()
        
        messages_by_tone = [{"tone": item[0], "count": item[1]} for item in tone_query]
        
        # 5. Status counts
        status_query = db.session.query(
            Message.status,
            db.func.count(Message.id)
        ).filter(msg_filter).group_by(Message.status).all()
        
        # Format status counts into dictionary and handle defaults for missing status options
        status_counts = {
            "generated": 0,
            "saved": 0,
            "edited": 0,
            "linked": 0
        }
        for item in status_query:
            status_counts[item[0]] = item[1]
            
        dashboard_data = {
            "total_messages": total_messages,
            "messages_today": messages_today,
            "messages_by_occasion": messages_by_occasion,
            "messages_by_tone": messages_by_tone,
            "messages_by_status": status_counts
        }
        
        return success_response(dashboard_data)
        
    except Exception as e:
        return error_response(f"An unexpected error occurred: {str(e)}", 500)
