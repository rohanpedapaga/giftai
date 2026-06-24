# backend/app/__init__.py
# This file initializes the Flask application using the Application Factory pattern.
# It configures CORS, binds SQLAlchemy database operations, and registers API blueprints.

from flask import Flask, jsonify
from flask_cors import CORS
from app.config import Config
from app.models import db

def create_app(config_class=Config):
    # Instantiate Flask
    app = Flask(__name__)
    
    # Load settings from Config class
    app.config.from_object(config_class)
    
    # Enable CORS for frontend integration
    CORS(app)
    
    # Initialize the database with the app context
    db.init_app(app)
    
    # Global exception handler for handling internal errors cleanly
    @app.errorhandler(500)
    def handle_internal_server_error(e):
        return jsonify({
            "success": False,
            "error": "An internal server error occurred. Please contact the administrator."
        }), 500

    @app.errorhandler(404)
    def handle_not_found_error(e):
        return jsonify({
            "success": False,
            "error": "The requested resource could not be found."
        }), 404

    # Import and register routing blueprints
    from app.routes.customer_routes import customer_bp
    from app.routes.recipient_routes import recipient_bp
    from app.routes.message_routes import message_bp
    from app.routes.tone_routes import tone_bp
    from app.routes.occasion_routes import occasion_bp
    from app.routes.dashboard_routes import dashboard_bp

    app.register_blueprint(customer_bp, url_prefix='/api')
    app.register_blueprint(recipient_bp, url_prefix='/api')
    app.register_blueprint(message_bp, url_prefix='/api')
    app.register_blueprint(tone_bp, url_prefix='/api')
    app.register_blueprint(occasion_bp, url_prefix='/api')
    app.register_blueprint(dashboard_bp, url_prefix='/api')

    # Basic server check route
    @app.route('/hello', methods=['GET'])
    def hello():
        return jsonify({
            "success": True,
            "message": "Hello, world! Flask backend is fully configured and running."
        }), 200

    return app
