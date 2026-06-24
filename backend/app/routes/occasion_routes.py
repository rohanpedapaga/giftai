# backend/app/routes/occasion_routes.py
# This blueprint file implements the API endpoint for fetching occasion configurations.

from flask import Blueprint
from app.models import Occasion
from app.utils.response_helper import success_response, error_response

occasion_bp = Blueprint('occasion_routes', __name__)

@occasion_bp.route('/occasions', methods=['GET'])
def list_occasions():
    """
    GET /api/occasions
    Returns a list of all pre-seeded occasions.
    """
    try:
        occasions = Occasion.query.all()
        return success_response([o.to_dict() for o in occasions])
    except Exception as e:
        return error_response(f"An unexpected error occurred: {str(e)}", 500)
