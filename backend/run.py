# run.py
# This is the entry point for starting the Flask application.
# It imports the app factory from the app package, loads configuration,
# and starts the development server.

import os
from dotenv import load_dotenv

# Load environment variables from .env file FIRST
dotenv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
load_dotenv(dotenv_path=dotenv_path)

from app import create_app


# Create Flask application instance using the factory
app = create_app()

from app.models import db


with app.app_context():
    db.create_all()
    print("[SUCCESS] Database tables created")
    
    # Run dynamic inspection-based database migration to update schema
    from app.utils.migrations import run_migrations
    run_migrations(app)
    
    from app.seed.seed_tones import seed as seed_tones
    from app.seed.seed_occasions import seed as seed_occasions
    
    # Run the seeders inside the application context, passing the app instance
    # to reuse the same database engine, connection pool, and application context.
    seed_tones(app)
    seed_occasions(app)

print("Lookup tables seeded")


if __name__ == '__main__':
    # Get port from environment variables or default to 5000
    port = int(os.getenv('PORT', 5000))
    
    # Run the server
    # Set debug to True for development mode, False for production
    debug_mode = os.getenv('FLASK_DEBUG', 'False').lower() in ['true', '1', 't']
    
    print(f"Starting server on http://localhost:{port} with debug={debug_mode}")
    app.run(host='0.0.0.0', port=port, debug=debug_mode)
