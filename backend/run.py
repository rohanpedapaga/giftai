# run.py
# This is the entry point for starting the Flask application.
# It imports the app factory from the app package, loads configuration,
# and starts the development server.

import os
from dotenv import load_dotenv
from app import create_app

# Load environment variables from .env file
load_dotenv()

# Create Flask application instance using the factory
app = create_app()

from app.models import db

with app.app_context():
    db.create_all()
    print("✅ Database tables created")
    from app.seed.seed_tones import seed as seed_tones
    from app.seed.seed_occasions import seed as seed_occasions

seed_tones()
seed_occasions()

print("Lookup tables seeded")

if __name__ == '__main__':
    # Get port from environment variables or default to 5000
    port = int(os.getenv('PORT', 5000))
    
    # Run the server
    # Set debug to True for development mode, False for production
    debug_mode = os.getenv('FLASK_DEBUG', 'False').lower() in ['true', '1', 't']
    
    print(f"Starting server on http://localhost:{port} with debug={debug_mode}")
    app.run(host='0.0.0.0', port=port, debug=debug_mode)
