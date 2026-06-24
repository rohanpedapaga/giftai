# backend/app/routes/tone_routes.py
# This blueprint file implements the API endpoint for fetching tone configurations.

from flask import Blueprint
from app.models import Tone
from app.utils.response_helper import success_response, error_response

tone_bp = Blueprint('tone_routes', __name__)

@tone_bp.route('/tones', methods=['GET'])
def list_tones():
    """
    GET /api/tones
    Returns a list of all pre-seeded emotional tones.
    """
    try:
        tones = Tone.query.all()
        return success_response([t.to_dict() for t in tones])
    except Exception as e:
        return error_response(f"An unexpected error occurred: {str(e)}", 500)
